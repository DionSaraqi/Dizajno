"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import * as api from "@/lib/api";

type Tab = "products" | "categories";

export default function ModerationPage() {
  const [tab, setTab] = useState<Tab>("products");
  return (
    <>
      <div className="flex gap-2 mb-6">
        <TabButton active={tab === "products"} onClick={() => setTab("products")}>
          Products
        </TabButton>
        <TabButton active={tab === "categories"} onClick={() => setTab("categories")}>
          Categories
        </TabButton>
      </div>
      {tab === "products" ? <PendingProducts /> : <PendingCategories />}
    </>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded border px-3 py-1.5 font-mono text-xs tracking-widest uppercase transition ${
        active
          ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
          : "border-white/10 text-dizajno-muted hover:text-dizajno-text hover:border-white/20"
      }`}
    >
      {children}
    </button>
  );
}

function PendingProducts() {
  const qc = useQueryClient();
  const products = useQuery({
    queryKey: ["admin", "moderation", "products"],
    queryFn: () => api.listPendingProducts(),
  });
  const approve = useMutation({
    mutationFn: (id: string) => api.approveProduct(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "moderation", "products"] }),
  });
  const reject = useMutation({
    mutationFn: (id: string) => api.rejectProduct(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "moderation", "products"] }),
  });

  if (products.isLoading) return <p className="font-mono text-sm text-dizajno-muted">Loading…</p>;
  if (products.data?.length === 0)
    return <p className="font-mono text-sm text-dizajno-muted">Queue is empty.</p>;

  return (
    <ul className="space-y-2">
      {products.data?.map((p) => (
        <li
          key={p.id}
          className="flex items-center justify-between rounded border border-white/10 bg-black/30 px-3 py-2"
        >
          <div className="min-w-0">
            <p className="font-mono text-sm text-dizajno-text truncate">{p.name}</p>
            <p className="font-mono text-[10px] tracking-widest text-dizajno-muted uppercase mt-0.5">
              {p.family} · {p.category} · {p.supplierName} ·{" "}
              {new Date(p.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => approve.mutate(p.id)}
              title="Approve → Published"
              className="rounded border border-white/10 px-2 py-1 text-dizajno-muted hover:text-emerald-300 hover:border-emerald-500/40 transition"
            >
              <Check size={14} />
            </button>
            <button
              type="button"
              onClick={() => reject.mutate(p.id)}
              title="Reject → Hidden"
              className="rounded border border-white/10 px-2 py-1 text-dizajno-muted hover:text-red-300 hover:border-red-500/40 transition"
            >
              <X size={14} />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function PendingCategories() {
  const qc = useQueryClient();
  const cats = useQuery({
    queryKey: ["admin", "moderation", "categories"],
    queryFn: () => api.listPendingCategories(),
  });
  const approve = useMutation({
    mutationFn: (id: string) => api.approveCategory(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "moderation", "categories"] }),
  });
  const reject = useMutation({
    mutationFn: (id: string) => api.rejectCategory(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "moderation", "categories"] }),
    onError: (e: Error) => alert(e.message),
  });

  if (cats.isLoading) return <p className="font-mono text-sm text-dizajno-muted">Loading…</p>;
  if (cats.data?.length === 0)
    return <p className="font-mono text-sm text-dizajno-muted">Queue is empty.</p>;

  return (
    <ul className="space-y-2">
      {cats.data?.map((c) => (
        <li
          key={c.id}
          className="flex items-center justify-between rounded border border-white/10 bg-black/30 px-3 py-2"
        >
          <div className="min-w-0">
            <p className="font-mono text-sm text-dizajno-text truncate">{c.name}</p>
            <p className="font-mono text-[10px] tracking-widest text-dizajno-muted uppercase mt-0.5">
              {c.family} · {c.path}
              {c.suggestedBySupplierName ? ` · suggested by ${c.suggestedBySupplierName}` : ""}
            </p>
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => approve.mutate(c.id)}
              title="Approve"
              className="rounded border border-white/10 px-2 py-1 text-dizajno-muted hover:text-emerald-300 hover:border-emerald-500/40 transition"
            >
              <Check size={14} />
            </button>
            <button
              type="button"
              onClick={() => reject.mutate(c.id)}
              title="Reject (delete)"
              className="rounded border border-white/10 px-2 py-1 text-dizajno-muted hover:text-red-300 hover:border-red-500/40 transition"
            >
              <X size={14} />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
