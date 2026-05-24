"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Pencil, Plus, Send, Trash2 } from "lucide-react";
import * as api from "@/lib/api";

export default function SupplierProductsPage() {
  const params = useParams<{ supplierId: string }>();
  const supplierId = params.supplierId;
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<api.ProductStatus | "All">("All");
  const [search, setSearch] = useState("");

  const products = useQuery({
    queryKey: ["supplier", supplierId, "products", statusFilter, search],
    queryFn: () =>
      api.listSupplierProducts({
        supplierId,
        status: statusFilter === "All" ? undefined : statusFilter,
        search: search || undefined,
      }),
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["supplier", supplierId, "products"] });
  }

  const publish = useMutation({
    mutationFn: (id: string) => api.publishSupplierProduct(id),
    onSuccess: invalidate,
    onError: (e: Error) => alert(e.message),
  });
  const hide = useMutation({
    mutationFn: (id: string) => api.hideSupplierProduct(id),
    onSuccess: invalidate,
    onError: (e: Error) => alert(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.removeSupplierProduct(id),
    onSuccess: invalidate,
    onError: (e: Error) => alert(e.message),
  });

  return (
    <>
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or slug"
            className="rounded border border-white/10 bg-black/30 px-3 py-1.5 font-mono text-sm text-dizajno-text placeholder:text-dizajno-muted/40 focus:outline-none focus:border-white/30 w-60"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="rounded border border-white/10 bg-black/30 px-3 py-1.5 font-mono text-xs tracking-widest uppercase text-dizajno-text focus:outline-none focus:border-white/30"
          >
            <option value="All">All</option>
            <option value="Draft">Draft</option>
            <option value="Pending">Pending</option>
            <option value="Published">Published</option>
            <option value="Hidden">Hidden</option>
          </select>
        </div>
        <Link
          href={`/supplier/${supplierId}/products/new`}
          className="flex items-center gap-2 rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 font-mono text-xs tracking-widest uppercase text-emerald-300 hover:bg-emerald-500/20 transition"
        >
          <Plus size={12} /> New product
        </Link>
      </div>

      {products.isLoading && (
        <p className="font-mono text-sm text-dizajno-muted">Loading…</p>
      )}
      {products.error && (
        <p className="font-mono text-sm text-red-400">
          {(products.error as Error).message}
        </p>
      )}
      {products.data && products.data.length === 0 && (
        <div className="rounded border border-white/10 bg-black/20 px-6 py-10 text-center">
          <p className="font-mono text-sm text-dizajno-muted">
            No products yet — click <span className="text-dizajno-text">New product</span> to add one.
          </p>
        </div>
      )}

      {products.data && products.data.length > 0 && (
        <ul className="grid grid-cols-1 gap-2">
          {products.data.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 rounded border border-white/10 bg-black/30 px-4 py-3 hover:bg-black/40 transition"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    href={`/supplier/${supplierId}/products/${p.id}`}
                    className="font-mono text-sm text-dizajno-text hover:text-emerald-300 transition truncate"
                  >
                    {p.name}
                  </Link>
                  <StatusBadge status={p.status} />
                </div>
                <p className="font-mono text-[10px] tracking-widest text-dizajno-muted uppercase mt-0.5 truncate">
                  /{p.slug} · {p.family} · {p.categoryName} · {p.variantCount} variant{p.variantCount === 1 ? "" : "s"}
                  {p.basePrice != null
                    ? ` · ${formatPrice(p.basePrice, p.currency)}`
                    : ""}
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <Link
                  href={`/supplier/${supplierId}/products/${p.id}`}
                  title="Edit"
                  className="rounded border border-white/10 px-2 py-1 text-dizajno-muted hover:text-dizajno-text hover:border-white/30 transition"
                >
                  <Pencil size={14} />
                </Link>
                {p.status === "Draft" || p.status === "Hidden" ? (
                  <button
                    type="button"
                    onClick={() => publish.mutate(p.id)}
                    title={p.status === "Draft" ? "Publish (untrusted suppliers go to Pending review)" : "Re-publish"}
                    className="rounded border border-white/10 px-2 py-1 text-dizajno-muted hover:text-emerald-300 hover:border-emerald-500/40 transition"
                  >
                    <Send size={14} />
                  </button>
                ) : null}
                {p.status === "Published" || p.status === "Pending" ? (
                  <button
                    type="button"
                    onClick={() => hide.mutate(p.id)}
                    title="Hide"
                    className="rounded border border-white/10 px-2 py-1 text-dizajno-muted hover:text-amber-300 hover:border-amber-500/40 transition"
                  >
                    <EyeOff size={14} />
                  </button>
                ) : null}
                {p.status !== "Published" && p.status !== "Pending" ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Remove "${p.name}"? This is terminal. Historical quotes already snapshot the variant data so past orders survive.`))
                        remove.mutate(p.id);
                    }}
                    title="Remove (terminal)"
                    className="rounded border border-white/10 px-2 py-1 text-dizajno-muted hover:text-red-300 hover:border-red-500/40 transition"
                  >
                    <Trash2 size={14} />
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function StatusBadge({ status }: { status: api.ProductStatus }) {
  const colour = {
    Draft: "border-white/20 text-dizajno-muted bg-white/5",
    Pending: "border-amber-500/40 text-amber-300 bg-amber-500/10",
    Published: "border-emerald-500/40 text-emerald-300 bg-emerald-500/10",
    Hidden: "border-white/15 text-dizajno-muted bg-black/20",
    Removed: "border-red-500/40 text-red-300 bg-red-500/10",
  }[status];
  return (
    <span
      className={`rounded border px-1.5 py-0.5 font-mono text-[9px] tracking-widest uppercase ${colour}`}
    >
      {status}
    </span>
  );
}

function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-EU", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
