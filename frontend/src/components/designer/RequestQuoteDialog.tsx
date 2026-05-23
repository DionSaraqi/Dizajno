"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, X } from "lucide-react";
import { useDesignerStore } from "@/store/useDesignerStore";
import { useFurnitureCatalog } from "@/hooks/useFurnitureCatalog";
import { polygonArea, unitLabel } from "@/utils/areaCalc";
import * as api from "@/lib/api";
import type {
  FurnitureCatalogItem,
  FurnitureData,
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
  brandedOpenings: Array<{ openingId: string; def: FurnitureCatalogItem }>;
  /** Per-material aggregates rolled into this supplier's row. */
  materials: Array<{ def: FurnitureCatalogItem; quantity: number; subtotal: number | null }>;
  subtotal: number | null;
  currency: string;
}

/**
 * Phase 6.5 redesign: the dialog is now a read-only summary of what the user
 * has already designed. Walls with paint + floors with flooring + branded
 * openings + placed furniture all get rolled up per supplier with computed
 * quantities (paint = wallArea/coverage × waste, flooring = floorArea × waste,
 * everything else = piece counts). Submit just sends a message; the backend
 * recomputes the same fan-out from the persisted scene.
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
          materials: [],
          subtotal: 0,
          currency,
        };
        bySupplier.set(supplierId, group);
      }
      return group;
    };
    const addToSubtotal = (group: SupplierGroup, contribution: number | null) => {
      if (group.subtotal == null) return;
      if (contribution == null) {
        group.subtotal = null;
      } else {
        group.subtotal += contribution;
      }
    };

    // Placed items (quantity 1 each).
    for (const item of furniture) {
      const def = catalog.find((c) => c.type === item.type);
      if (!def || !def.supplierId) {
        orphans.push(item);
        continue;
      }
      const group = ensure(def.supplierId, def.supplierName ?? "Unknown supplier", def.currency ?? "EUR");
      group.items.push({ item, def });
      addToSubtotal(group, def.basePrice ?? null);
    }

    // Branded openings (one per opening).
    for (const opening of openings) {
      if (!opening.productVariantId) continue;
      const def = catalog.find((c) => c.variantId === opening.productVariantId);
      if (!def || !def.supplierId) continue;
      const group = ensure(def.supplierId, def.supplierName ?? "Unknown supplier", def.currency ?? "EUR");
      group.brandedOpenings.push({ openingId: opening.id, def });
      addToSubtotal(group, def.basePrice ?? null);
    }

    // Flooring — aggregate floor areas per assigned variant.
    const floorAreaByVariant = new Map<string, number>();
    for (const floor of floors) {
      if (!floor.flooringVariantId) continue;
      const area = polygonArea(floor.vertices);
      floorAreaByVariant.set(
        floor.flooringVariantId,
        (floorAreaByVariant.get(floor.flooringVariantId) ?? 0) + area
      );
    }
    for (const [variantId, area] of floorAreaByVariant) {
      const def = catalog.find((c) => c.variantId === variantId);
      if (!def || !def.supplierId) continue;
      const waste = def.wasteFactor ?? 0;
      const qty = round1(area * (1 + waste));
      const subtotal = def.basePrice != null ? def.basePrice * qty : null;
      const group = ensure(def.supplierId, def.supplierName ?? "Unknown supplier", def.currency ?? "EUR");
      group.materials.push({ def, quantity: qty, subtotal });
      addToSubtotal(group, subtotal);
    }

    // Paint — aggregate paintable wall surface per assigned variant.
    const paintAreaByVariant = new Map<string, number>();
    const openingAreaByWallId = new Map<string, number>();
    for (const opening of openings) {
      openingAreaByWallId.set(
        opening.wallId,
        (openingAreaByWallId.get(opening.wallId) ?? 0) + opening.width * opening.height
      );
    }
    for (const wall of walls) {
      if (!wall.paintVariantId) continue;
      const length = Math.hypot(wall.end[0] - wall.start[0], wall.end[1] - wall.start[1]);
      const gross = length * wall.height;
      const openingArea = openingAreaByWallId.get(wall.id) ?? 0;
      const paintable = Math.max(0, gross - openingArea);
      paintAreaByVariant.set(
        wall.paintVariantId,
        (paintAreaByVariant.get(wall.paintVariantId) ?? 0) + paintable
      );
    }
    for (const [variantId, area] of paintAreaByVariant) {
      const def = catalog.find((c) => c.variantId === variantId);
      if (!def || !def.supplierId || !def.coverageRate || def.coverageRate <= 0) continue;
      const waste = def.wasteFactor ?? 0;
      const qty = Math.ceil((area / def.coverageRate) * (1 + waste));
      const subtotal = def.basePrice != null ? def.basePrice * qty : null;
      const group = ensure(def.supplierId, def.supplierName ?? "Unknown supplier", def.currency ?? "EUR");
      group.materials.push({ def, quantity: qty, subtotal });
      addToSubtotal(group, subtotal);
    }

    return {
      groups: Array.from(bySupplier.values()).sort((a, b) =>
        a.supplierName.localeCompare(b.supplierName)
      ),
      orphans,
    };
  }, [furniture, openings, floors, walls, catalog]);

  const totalLines = useMemo(
    () =>
      groups.groups.reduce(
        (acc, g) => acc + g.items.length + g.brandedOpenings.length + g.materials.length,
        0
      ),
    [groups]
  );

  const grandTotal = useMemo(() => {
    let sum = 0;
    let currency = "EUR";
    let known = true;
    for (const g of groups.groups) {
      if (g.subtotal == null) {
        known = false;
      } else {
        sum += g.subtotal;
        currency = g.currency;
      }
    }
    return { sum, currency, known };
  }, [groups]);

  const mutation = useMutation({
    // Backend recomputes everything from the persisted scene; no manualLines needed.
    mutationFn: () => api.createQuote(projectId, message.trim() || null),
    onSuccess: (detail) => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      onClose();
      router.push(`/quotes/${detail.id}`);
    },
  });

  if (!open) return null;

  const sceneEmpty = totalLines === 0;
  const submitDisabled = mutation.isPending || sceneEmpty;

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
          {sceneEmpty ? (
            <p className="font-mono text-xs text-dizajno-muted">
              Add furniture, attach a branded door/window, or assign flooring/paint
              in the designer to request a quote. Materials and finishes are picked
              by selecting a wall or floor and using its properties panel.
            </p>
          ) : (
            <div>
              <p className="font-mono text-[10px] tracking-widest uppercase text-dizajno-muted mb-2">
                Summary ({groups.groups.length} supplier{groups.groups.length === 1 ? "" : "s"} · {totalLines} line{totalLines === 1 ? "" : "s"})
              </p>
              <ul className="space-y-3">
                {groups.groups.map((g) => (
                  <li
                    key={g.supplierId}
                    className="rounded border border-white/10 bg-black/30 px-3 py-2"
                  >
                    <div className="flex items-baseline justify-between gap-2 mb-1.5">
                      <p className="font-mono text-xs text-dizajno-text truncate">
                        {g.supplierName}
                      </p>
                      <p className="font-mono text-xs text-emerald-400/90 whitespace-nowrap">
                        {g.subtotal == null
                          ? "— est."
                          : formatPrice(g.subtotal, g.currency)}
                      </p>
                    </div>
                    <ul className="space-y-0.5">
                      {g.items.map(({ item, def }) => (
                        <li
                          key={item.id}
                          className="flex items-baseline justify-between gap-2"
                        >
                          <span className="font-mono text-[11px] text-dizajno-muted truncate">
                            {def.label} × 1
                          </span>
                          <span className="font-mono text-[11px] text-dizajno-muted whitespace-nowrap">
                            {def.basePrice == null
                              ? "—"
                              : formatPrice(def.basePrice, def.currency ?? "EUR")}
                          </span>
                        </li>
                      ))}
                      {g.brandedOpenings.map(({ openingId, def }) => (
                        <li
                          key={openingId}
                          className="flex items-baseline justify-between gap-2"
                        >
                          <span className="font-mono text-[11px] text-dizajno-muted truncate">
                            {def.label} × 1
                          </span>
                          <span className="font-mono text-[11px] text-dizajno-muted whitespace-nowrap">
                            {def.basePrice == null
                              ? "—"
                              : formatPrice(def.basePrice, def.currency ?? "EUR")}
                          </span>
                        </li>
                      ))}
                      {g.materials.map(({ def, quantity, subtotal }) => (
                        <li
                          key={def.variantId}
                          className="flex items-baseline justify-between gap-2"
                        >
                          <span className="font-mono text-[11px] text-dizajno-muted truncate">
                            {def.label} · {quantity} {unitLabel(def.unitOfSale)}
                            {def.wasteFactor && def.wasteFactor > 0 && (
                              <> (+{Math.round((def.wasteFactor ?? 0) * 100)}% waste)</>
                            )}
                          </span>
                          <span className="font-mono text-[11px] text-dizajno-muted whitespace-nowrap">
                            {subtotal == null
                              ? "—"
                              : formatPrice(subtotal, def.currency ?? "EUR")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
              {groups.orphans.length > 0 && (
                <p className="mt-2 font-mono text-[10px] text-amber-400/80">
                  {groups.orphans.length} placed item(s) cannot be quoted — the catalog
                  couldn&apos;t resolve their supplier. They&apos;ll be skipped.
                </p>
              )}
              {grandTotal.known && groups.groups.length > 1 && (
                <p className="mt-3 font-mono text-xs text-dizajno-text text-right">
                  Estimated total:{" "}
                  <span className="text-emerald-400/90">
                    {formatPrice(grandTotal.sum, grandTotal.currency)}
                  </span>
                </p>
              )}
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

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
