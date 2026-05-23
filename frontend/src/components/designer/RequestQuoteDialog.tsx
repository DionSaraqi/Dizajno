"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, X } from "lucide-react";
import { useDesignerStore } from "@/store/useDesignerStore";
import { useFurnitureCatalog } from "@/hooks/useFurnitureCatalog";
import {
  computeRoomAreas,
  quantityUnitToken,
  suggestMaterialQuantity,
  unitLabel,
} from "@/utils/areaCalc";
import * as api from "@/lib/api";
import type {
  FurnitureCatalogItem,
  FurnitureData,
  OpeningData,
} from "@/types/designer";

interface RequestQuoteDialogProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
}

interface SupplierGroup {
  supplierId: string;
  supplierName: string;
  items: Array<{ item: FurnitureData; def: FurnitureCatalogItem }>;
  brandedOpenings: Array<{ opening: OpeningData; def: FurnitureCatalogItem }>;
  subtotal: number | null;
  currency: string;
}

interface MaterialPick {
  selected: boolean;
  quantity: number;
}

/**
 * "Request quote" flow. Reads the live scene from the designer store, groups
 * placed items + branded openings by supplier (using catalog metadata), and
 * surfaces a per-supplier preview before fanning out to
 * <c>POST /api/projects/{id}/quotes</c>. Phase 6 added a "Materials & finishes"
 * section that auto-suggests paint/flooring quantities from the room geometry.
 */
export function RequestQuoteDialog({
  projectId,
  open,
  onClose,
}: RequestQuoteDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const furniture = useDesignerStore((s) => s.furniture);
  const walls = useDesignerStore((s) => s.walls);
  const floors = useDesignerStore((s) => s.floors);
  const openings = useDesignerStore((s) => s.openings);
  const { items: catalog } = useFurnitureCatalog();
  const [message, setMessage] = useState("");

  const areas = useMemo(
    () => computeRoomAreas({ walls, floors, openings }),
    [walls, floors, openings]
  );

  const materialItems = useMemo(
    () =>
      catalog
        .filter((c) => c.family === "BuildingMaterial" && c.variantId)
        .sort((a, b) => a.label.localeCompare(b.label)),
    [catalog]
  );

  const [materialPicks, setMaterialPicks] = useState<Record<string, MaterialPick>>({});

  // Seed picks with suggested quantities whenever the dialog opens or the
  // catalog/geometry changes. Preserves any user edits via the functional setter.
  useEffect(() => {
    if (!open) return;
    setMaterialPicks((prev) => {
      const next: Record<string, MaterialPick> = {};
      for (const item of materialItems) {
        if (!item.variantId) continue;
        const suggested = suggestMaterialQuantity(
          item.unitOfSale,
          item.coverageRate ?? null,
          item.wasteFactor,
          areas
        );
        const existing = prev[item.variantId];
        next[item.variantId] = {
          selected: existing?.selected ?? false,
          quantity: existing?.quantity ?? suggested ?? 0,
        };
      }
      return next;
    });
  }, [open, materialItems, areas]);

  const groups = useMemo(() => {
    const bySupplier = new Map<string, SupplierGroup>();
    const orphans: FurnitureData[] = [];
    const ensure = (supplierId: string, supplierName: string, currency: string) => {
      let group = bySupplier.get(supplierId);
      if (!group) {
        group = {
          supplierId,
          supplierName,
          items: [],
          brandedOpenings: [],
          subtotal: 0,
          currency,
        };
        bySupplier.set(supplierId, group);
      }
      return group;
    };

    for (const item of furniture) {
      const def = catalog.find((c) => c.type === item.type);
      if (!def || !def.supplierId) {
        orphans.push(item);
        continue;
      }
      const group = ensure(def.supplierId, def.supplierName ?? "Unknown supplier", def.currency ?? "EUR");
      group.items.push({ item, def });
      if (def.basePrice != null && group.subtotal != null) {
        group.subtotal += def.basePrice;
      } else if (def.basePrice == null) {
        group.subtotal = null;
      }
    }

    for (const opening of openings) {
      if (!opening.productVariantId) continue;
      const def = catalog.find((c) => c.variantId === opening.productVariantId);
      if (!def || !def.supplierId) continue;
      const group = ensure(def.supplierId, def.supplierName ?? "Unknown supplier", def.currency ?? "EUR");
      group.brandedOpenings.push({ opening, def });
      if (def.basePrice != null && group.subtotal != null) {
        group.subtotal += def.basePrice;
      } else if (def.basePrice == null) {
        group.subtotal = null;
      }
    }

    return {
      groups: Array.from(bySupplier.values()).sort((a, b) =>
        a.supplierName.localeCompare(b.supplierName)
      ),
      orphans,
    };
  }, [furniture, openings, catalog]);

  const selectedMaterialCount = useMemo(
    () =>
      Object.values(materialPicks).filter((p) => p.selected && p.quantity > 0)
        .length,
    [materialPicks]
  );

  const placedFurnitureCount = furniture.length;
  const brandedOpeningCount = openings.filter((o) => !!o.productVariantId).length;
  const totalSourceCount =
    placedFurnitureCount + brandedOpeningCount + selectedMaterialCount;
  const dialogEmpty = totalSourceCount === 0;

  const mutation = useMutation({
    mutationFn: () => {
      const manualLines = Object.entries(materialPicks)
        .filter(([, pick]) => pick.selected && pick.quantity > 0)
        .map(([variantId, pick]) => {
          const def = materialItems.find((m) => m.variantId === variantId);
          return {
            productVariantId: variantId,
            quantity: pick.quantity,
            quantityUnit: quantityUnitToken(def?.unitOfSale),
          };
        });
      return api.createQuote(
        projectId,
        message.trim() || null,
        manualLines
      );
    },
    onSuccess: (detail) => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      onClose();
      router.push(`/quotes/${detail.id}`);
    },
  });

  if (!open) return null;

  const submitDisabled = mutation.isPending || dialogEmpty;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-white/10 bg-dizajno-bg shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-5 py-3 border-b border-white/10 sticky top-0 bg-dizajno-bg z-10">
          <h2 className="font-mono text-sm tracking-widest text-dizajno-text">
            REQUEST QUOTE
          </h2>
          <button
            onClick={onClose}
            className="text-dizajno-muted hover:text-dizajno-text"
            aria-label="Close request-quote dialog"
          >
            <X size={16} />
          </button>
        </header>

        <div className="p-5 space-y-5">
          {dialogEmpty ? (
            <p className="font-mono text-xs text-dizajno-muted">
              Add furniture, attach a branded door/window, or pick a material below
              to request a quote.
            </p>
          ) : (
            <div>
              <p className="font-mono text-[10px] tracking-widest uppercase text-dizajno-muted mb-2">
                Suppliers ({groups.groups.length})
              </p>
              <ul className="space-y-1.5">
                {groups.groups.map((g) => {
                  const lineCount = g.items.length + g.brandedOpenings.length;
                  return (
                    <li
                      key={g.supplierId}
                      className="flex items-center justify-between rounded border border-white/10 bg-black/30 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-xs text-dizajno-text truncate">
                          {g.supplierName}
                        </p>
                        <p className="font-mono text-[10px] tracking-widest text-dizajno-muted/70 uppercase mt-0.5">
                          {lineCount} {lineCount === 1 ? "item" : "items"}
                          {g.brandedOpenings.length > 0 && (
                            <>
                              {" "}· {g.brandedOpenings.length} fixture
                              {g.brandedOpenings.length === 1 ? "" : "s"}
                            </>
                          )}
                        </p>
                      </div>
                      <p className="font-mono text-xs text-dizajno-text whitespace-nowrap ml-3">
                        {g.subtotal == null
                          ? "— est."
                          : formatPrice(g.subtotal, g.currency)}
                      </p>
                    </li>
                  );
                })}
              </ul>
              {groups.orphans.length > 0 && (
                <p className="mt-2 font-mono text-[10px] text-amber-400/80">
                  {groups.orphans.length} item(s) cannot be quoted — the catalog
                  couldn&apos;t resolve their supplier. They&apos;ll be skipped.
                </p>
              )}
            </div>
          )}

          {materialItems.length > 0 && (
            <div>
              <p className="font-mono text-[10px] tracking-widest uppercase text-dizajno-muted mb-1">
                Materials & finishes
              </p>
              <p className="font-mono text-[10px] text-dizajno-muted/70 mb-2">
                Floor area {areas.floorAreaM2.toFixed(1)} m² · Paintable walls{" "}
                {areas.paintableWallM2.toFixed(1)} m²
              </p>
              <ul className="space-y-1.5">
                {materialItems.map((item) => {
                  if (!item.variantId) return null;
                  const pick = materialPicks[item.variantId] ?? {
                    selected: false,
                    quantity: 0,
                  };
                  const suggested = suggestMaterialQuantity(
                    item.unitOfSale,
                    item.coverageRate ?? null,
                    item.wasteFactor,
                    areas
                  );
                  return (
                    <li
                      key={item.variantId}
                      className="flex items-center gap-2 rounded border border-white/10 bg-black/30 px-3 py-2"
                    >
                      <input
                        type="checkbox"
                        checked={pick.selected}
                        onChange={(e) =>
                          setMaterialPicks((prev) => ({
                            ...prev,
                            [item.variantId!]: {
                              selected: e.target.checked,
                              quantity:
                                e.target.checked && pick.quantity <= 0
                                  ? suggested ?? 0
                                  : pick.quantity,
                            },
                          }))
                        }
                        className="accent-dizajno-accent"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-xs text-dizajno-text truncate">
                          {item.label}
                        </p>
                        <p className="font-mono text-[10px] tracking-widest text-dizajno-muted/70 uppercase mt-0.5">
                          {suggested == null
                            ? "Enter quantity manually"
                            : `Suggested: ${suggested} ${unitLabel(item.unitOfSale)}`}
                          {item.wasteFactor && item.wasteFactor > 0 && suggested != null && (
                            <> · +{Math.round((item.wasteFactor ?? 0) * 100)}% waste</>
                          )}
                        </p>
                      </div>
                      <input
                        type="number"
                        min={0}
                        step={item.unitOfSale === "Liter" ? 1 : 0.1}
                        value={pick.quantity}
                        disabled={!pick.selected}
                        onChange={(e) =>
                          setMaterialPicks((prev) => ({
                            ...prev,
                            [item.variantId!]: {
                              selected: prev[item.variantId!]?.selected ?? false,
                              quantity: Math.max(0, parseFloat(e.target.value) || 0),
                            },
                          }))
                        }
                        className="w-20 rounded border border-white/10 bg-black/40 px-2 py-1 text-sm text-dizajno-text disabled:opacity-50 focus:border-white/40 focus:outline-none"
                      />
                      <span className="font-mono text-[10px] text-dizajno-muted w-8 text-center">
                        {unitLabel(item.unitOfSale)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div>
            <p className="font-mono text-[10px] tracking-widest uppercase text-dizajno-muted mb-2">
              Message to suppliers (optional)
            </p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Tell suppliers about your project — timeline, customisations, anything they should know."
              className="w-full rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-dizajno-text focus:border-white/40 focus:outline-none"
            />
          </div>

          {mutation.isError && (
            <p className="font-mono text-[11px] text-red-400">
              {mutation.error instanceof Error
                ? mutation.error.message
                : "Failed to send quote."}
            </p>
          )}

          <button
            onClick={() => mutation.mutate()}
            disabled={submitDisabled}
            className="w-full flex items-center justify-center gap-2 rounded bg-white/10 border border-white/20 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed py-2.5 font-mono text-xs tracking-wider text-dizajno-text transition"
          >
            <Send size={12} />
            {mutation.isPending ? "Sending…" : "Send to suppliers"}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatPrice(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value.toFixed(0)} ${currency}`;
  }
}
