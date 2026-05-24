"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Send, Store } from "lucide-react";
import { useDesignerStore } from "@/store/useDesignerStore";
import { useFurnitureCatalog } from "@/hooks/useFurnitureCatalog";
import { polygonArea, unitLabel } from "@/utils/areaCalc";
import * as api from "@/lib/api";
import type {
  FurnitureCatalogItem,
  FurnitureData,
} from "@/types/designer";
import {
  Button,
  EmptyState,
  Modal,
  Textarea,
} from "@/components/ui";

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
  materials: Array<{
    def: FurnitureCatalogItem;
    quantity: number;
    subtotal: number | null;
  }>;
  subtotal: number | null;
  currency: string;
}

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
    const ensure = (
      supplierId: string,
      supplierName: string,
      currency: string,
    ) => {
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
    const addToSubtotal = (
      group: SupplierGroup,
      contribution: number | null,
    ) => {
      if (group.subtotal == null) return;
      if (contribution == null) {
        group.subtotal = null;
      } else {
        group.subtotal += contribution;
      }
    };

    for (const item of furniture) {
      const def = catalog.find((c) => c.type === item.type);
      if (!def || !def.supplierId) {
        orphans.push(item);
        continue;
      }
      const group = ensure(
        def.supplierId,
        def.supplierName ?? "Unknown supplier",
        def.currency ?? "EUR",
      );
      group.items.push({ item, def });
      addToSubtotal(group, def.basePrice ?? null);
    }

    for (const opening of openings) {
      if (!opening.productVariantId) continue;
      const def = catalog.find(
        (c) => c.variantId === opening.productVariantId,
      );
      if (!def || !def.supplierId) continue;
      const group = ensure(
        def.supplierId,
        def.supplierName ?? "Unknown supplier",
        def.currency ?? "EUR",
      );
      group.brandedOpenings.push({ openingId: opening.id, def });
      addToSubtotal(group, def.basePrice ?? null);
    }

    const floorAreaByVariant = new Map<string, number>();
    for (const floor of floors) {
      if (!floor.flooringVariantId) continue;
      const area = polygonArea(floor.vertices);
      floorAreaByVariant.set(
        floor.flooringVariantId,
        (floorAreaByVariant.get(floor.flooringVariantId) ?? 0) + area,
      );
    }
    for (const [variantId, area] of floorAreaByVariant) {
      const def = catalog.find((c) => c.variantId === variantId);
      if (!def || !def.supplierId) continue;
      const waste = def.wasteFactor ?? 0;
      const qty = round1(area * (1 + waste));
      const subtotal = def.basePrice != null ? def.basePrice * qty : null;
      const group = ensure(
        def.supplierId,
        def.supplierName ?? "Unknown supplier",
        def.currency ?? "EUR",
      );
      group.materials.push({ def, quantity: qty, subtotal });
      addToSubtotal(group, subtotal);
    }

    const paintAreaByVariant = new Map<string, number>();
    const openingAreaByWallId = new Map<string, number>();
    for (const opening of openings) {
      openingAreaByWallId.set(
        opening.wallId,
        (openingAreaByWallId.get(opening.wallId) ?? 0) +
          opening.width * opening.height,
      );
    }
    for (const wall of walls) {
      if (!wall.paintVariantId) continue;
      const length = Math.hypot(
        wall.end[0] - wall.start[0],
        wall.end[1] - wall.start[1],
      );
      const gross = length * wall.height;
      const openingArea = openingAreaByWallId.get(wall.id) ?? 0;
      const paintable = Math.max(0, gross - openingArea);
      paintAreaByVariant.set(
        wall.paintVariantId,
        (paintAreaByVariant.get(wall.paintVariantId) ?? 0) + paintable,
      );
    }
    for (const [variantId, area] of paintAreaByVariant) {
      const def = catalog.find((c) => c.variantId === variantId);
      if (!def || !def.supplierId || !def.coverageRate || def.coverageRate <= 0)
        continue;
      const waste = def.wasteFactor ?? 0;
      const qty = Math.ceil((area / def.coverageRate) * (1 + waste));
      const subtotal = def.basePrice != null ? def.basePrice * qty : null;
      const group = ensure(
        def.supplierId,
        def.supplierName ?? "Unknown supplier",
        def.currency ?? "EUR",
      );
      group.materials.push({ def, quantity: qty, subtotal });
      addToSubtotal(group, subtotal);
    }

    return {
      groups: Array.from(bySupplier.values()).sort((a, b) =>
        a.supplierName.localeCompare(b.supplierName),
      ),
      orphans,
    };
  }, [furniture, openings, floors, walls, catalog]);

  const totalLines = useMemo(
    () =>
      groups.groups.reduce(
        (acc, g) =>
          acc + g.items.length + g.brandedOpenings.length + g.materials.length,
        0,
      ),
    [groups],
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
    mutationFn: () => api.createQuote(projectId, message.trim() || null),
    onSuccess: (detail) => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      onClose();
      router.push(`/quotes/${detail.id}`);
    },
  });

  const sceneEmpty = totalLines === 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Request quote"
      description="One request, multiple suppliers. Each supplier sees only their own line items and replies independently."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            leftIcon={!mutation.isPending ? <Send /> : undefined}
            loading={mutation.isPending}
            disabled={sceneEmpty}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Sending…" : "Send to suppliers"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {sceneEmpty ? (
          <EmptyState
            icon={<Store />}
            bare
            title="Nothing to quote yet"
            description="Add furniture, attach a branded door/window, or assign flooring/paint in the designer. Material picks live in each wall and floor's properties panel."
          />
        ) : (
          <>
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11.5px] font-medium uppercase tracking-label text-dizajno-muted">
                  Summary
                </p>
                <p className="text-[12px] text-dizajno-muted">
                  <span className="font-medium text-dizajno-text-subtle tabular-nums">
                    {groups.groups.length}
                  </span>{" "}
                  supplier
                  {groups.groups.length === 1 ? "" : "s"}
                  <span className="mx-1.5 text-dizajno-muted-subtle">·</span>
                  <span className="font-medium text-dizajno-text-subtle tabular-nums">
                    {totalLines}
                  </span>{" "}
                  line{totalLines === 1 ? "" : "s"}
                </p>
              </div>
              <ul className="space-y-3">
                {groups.groups.map((g) => (
                  <li
                    key={g.supplierId}
                    className="rounded-lg border border-dizajno-border bg-dizajno-bg/40 px-4 py-3"
                  >
                    <div className="flex items-baseline justify-between gap-3 mb-2">
                      <p className="text-[13.5px] font-semibold text-dizajno-text truncate">
                        {g.supplierName}
                      </p>
                      <p className="text-[13.5px] text-dizajno-text-subtle font-semibold tabular-nums whitespace-nowrap">
                        {g.subtotal == null
                          ? "—"
                          : formatPrice(g.subtotal, g.currency)}
                      </p>
                    </div>
                    <ul className="space-y-1">
                      {g.items.map(({ item, def }) => (
                        <li
                          key={item.id}
                          className="flex items-baseline justify-between gap-2 text-[12px]"
                        >
                          <span className="text-dizajno-muted truncate">
                            {def.label}
                            <span className="text-dizajno-muted-subtle">
                              {" "}
                              × 1
                            </span>
                          </span>
                          <span className="text-dizajno-muted tabular-nums whitespace-nowrap">
                            {def.basePrice == null
                              ? "—"
                              : formatPrice(def.basePrice, def.currency ?? "EUR")}
                          </span>
                        </li>
                      ))}
                      {g.brandedOpenings.map(({ openingId, def }) => (
                        <li
                          key={openingId}
                          className="flex items-baseline justify-between gap-2 text-[12px]"
                        >
                          <span className="text-dizajno-muted truncate">
                            {def.label}
                            <span className="text-dizajno-muted-subtle">
                              {" "}
                              × 1
                            </span>
                          </span>
                          <span className="text-dizajno-muted tabular-nums whitespace-nowrap">
                            {def.basePrice == null
                              ? "—"
                              : formatPrice(def.basePrice, def.currency ?? "EUR")}
                          </span>
                        </li>
                      ))}
                      {g.materials.map(({ def, quantity, subtotal }) => (
                        <li
                          key={def.variantId}
                          className="flex items-baseline justify-between gap-2 text-[12px]"
                        >
                          <span className="text-dizajno-muted truncate">
                            {def.label}
                            <span className="text-dizajno-muted-subtle">
                              {" "}
                              ·{" "}
                            </span>
                            <span className="font-mono">
                              {quantity} {unitLabel(def.unitOfSale)}
                            </span>
                            {def.wasteFactor && def.wasteFactor > 0 && (
                              <span className="text-dizajno-muted-subtle">
                                {" "}
                                +{Math.round((def.wasteFactor ?? 0) * 100)}% waste
                              </span>
                            )}
                          </span>
                          <span className="text-dizajno-muted tabular-nums whitespace-nowrap">
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
                <div className="mt-3 rounded-lg border border-dizajno-warning/30 bg-dizajno-warning-soft px-3 py-2 flex items-start gap-2 text-[12px] text-dizajno-warning">
                  <AlertCircle size={13} className="mt-0.5 shrink-0" />
                  <span>
                    {groups.orphans.length} placed item
                    {groups.orphans.length === 1 ? "" : "s"} can&apos;t be
                    quoted — the catalog couldn&apos;t resolve their supplier.
                    They&apos;ll be skipped.
                  </span>
                </div>
              )}
              {grandTotal.known && groups.groups.length > 1 && (
                <div className="mt-3 pt-3 border-t border-dizajno-border-subtle flex items-baseline justify-between">
                  <p className="text-[12.5px] text-dizajno-muted uppercase tracking-label font-medium">
                    Estimated total
                  </p>
                  <p className="text-[15px] font-semibold text-dizajno-text tabular-nums">
                    {formatPrice(grandTotal.sum, grandTotal.currency)}
                  </p>
                </div>
              )}
            </div>

            <div>
              <label
                htmlFor="quote-message"
                className="block text-[11.5px] font-medium uppercase tracking-label text-dizajno-muted mb-2"
              >
                Message to suppliers
                <span className="ml-1 normal-case tracking-normal text-dizajno-muted-subtle font-normal">
                  (optional)
                </span>
              </label>
              <Textarea
                id="quote-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder="Timeline, customisations, anything suppliers should know."
              />
            </div>

            {mutation.isError && (
              <div className="rounded-lg border border-dizajno-danger/30 bg-dizajno-danger-soft px-3 py-2 text-[13px] text-dizajno-danger flex items-start gap-2">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span>
                  {mutation.error instanceof Error
                    ? mutation.error.message
                    : "Failed to send quote."}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
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
