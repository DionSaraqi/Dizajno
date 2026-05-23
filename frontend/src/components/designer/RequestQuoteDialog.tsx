"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Send, X } from "lucide-react";
import { useDesignerStore } from "@/store/useDesignerStore";
import { useFurnitureCatalog } from "@/hooks/useFurnitureCatalog";
import * as api from "@/lib/api";
import type { FurnitureCatalogItem, FurnitureData } from "@/types/designer";

interface RequestQuoteDialogProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
}

interface SupplierGroup {
  supplierId: string;
  supplierName: string;
  items: Array<{ item: FurnitureData; def: FurnitureCatalogItem }>;
  subtotal: number | null;
  currency: string;
}

/**
 * "Request quote" flow. Reads the live scene from the designer store, groups
 * placed items by supplier (using catalog metadata), and surfaces a per-supplier
 * preview before fanning out to <c>POST /api/projects/{id}/quotes</c>.
 */
export function RequestQuoteDialog({
  projectId,
  open,
  onClose,
}: RequestQuoteDialogProps) {
  const router = useRouter();
  const furniture = useDesignerStore((s) => s.furniture);
  const { items: catalog } = useFurnitureCatalog();
  const [message, setMessage] = useState("");

  const groups = useMemo(() => {
    const bySupplier = new Map<string, SupplierGroup>();
    const orphans: FurnitureData[] = [];
    for (const item of furniture) {
      const def = catalog.find((c) => c.type === item.type);
      if (!def || !def.supplierId) {
        orphans.push(item);
        continue;
      }
      const key = def.supplierId;
      const existing = bySupplier.get(key);
      const priceContribution =
        def.basePrice == null ? null : def.basePrice;
      if (existing) {
        existing.items.push({ item, def });
        if (priceContribution != null && existing.subtotal != null) {
          existing.subtotal += priceContribution;
        } else if (priceContribution == null) {
          existing.subtotal = null;
        }
      } else {
        bySupplier.set(key, {
          supplierId: key,
          supplierName: def.supplierName ?? "Unknown supplier",
          items: [{ item, def }],
          subtotal: priceContribution,
          currency: def.currency ?? "EUR",
        });
      }
    }
    return {
      groups: Array.from(bySupplier.values()).sort((a, b) =>
        a.supplierName.localeCompare(b.supplierName)
      ),
      orphans,
    };
  }, [furniture, catalog]);

  const mutation = useMutation({
    mutationFn: () => api.createQuote(projectId, message.trim() || null),
    onSuccess: (detail) => {
      onClose();
      router.push(`/quotes/${detail.id}`);
    },
  });

  if (!open) return null;

  const totalItems = furniture.length;
  const sceneEmpty = totalItems === 0;
  const submitDisabled = mutation.isPending || sceneEmpty;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-white/10 bg-dizajno-bg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-5 py-3 border-b border-white/10">
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
              Add at least one piece of furniture to your scene before requesting a quote.
            </p>
          ) : (
            <>
              <div>
                <p className="font-mono text-[10px] tracking-widest uppercase text-dizajno-muted mb-2">
                  Suppliers
                </p>
                <ul className="space-y-1.5">
                  {groups.groups.map((g) => (
                    <li
                      key={g.supplierId}
                      className="flex items-center justify-between rounded border border-white/10 bg-black/30 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-xs text-dizajno-text truncate">
                          {g.supplierName}
                        </p>
                        <p className="font-mono text-[10px] tracking-widest text-dizajno-muted/70 uppercase mt-0.5">
                          {g.items.length} {g.items.length === 1 ? "item" : "items"}
                        </p>
                      </div>
                      <p className="font-mono text-xs text-dizajno-text whitespace-nowrap ml-3">
                        {g.subtotal == null
                          ? "— est."
                          : formatPrice(g.subtotal, g.currency)}
                      </p>
                    </li>
                  ))}
                </ul>
                {groups.orphans.length > 0 && (
                  <p className="mt-2 font-mono text-[10px] text-amber-400/80">
                    {groups.orphans.length} item(s) cannot be quoted — the catalog
                    couldn&apos;t resolve their supplier. They&apos;ll be skipped.
                  </p>
                )}
              </div>

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
            </>
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
