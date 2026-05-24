"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Eye, EyeOff, Send } from "lucide-react";
import * as api from "@/lib/api";
import ProductInfoTab from "./ProductInfoTab";
import VariantsTab from "./VariantsTab";

type Tab = "info" | "variants";

export default function SupplierProductEditorPage() {
  const params = useParams<{ supplierId: string; productId: string }>();
  const { supplierId, productId } = params;
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("info");

  const product = useQuery({
    queryKey: ["supplier", supplierId, "products", productId],
    queryFn: () => api.getSupplierProduct(productId),
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["supplier", supplierId, "products", productId] });
    qc.invalidateQueries({ queryKey: ["supplier", supplierId, "products"] });
  }

  const publish = useMutation({
    mutationFn: () => api.publishSupplierProduct(productId),
    onSuccess: invalidate,
    onError: (e: Error) => alert(e.message),
  });
  const hide = useMutation({
    mutationFn: () => api.hideSupplierProduct(productId),
    onSuccess: invalidate,
    onError: (e: Error) => alert(e.message),
  });

  if (product.isLoading) {
    return <p className="font-mono text-sm text-dizajno-muted">Loading…</p>;
  }
  if (product.error) {
    return (
      <p className="font-mono text-sm text-red-400 break-words">
        {(product.error as Error).message}
      </p>
    );
  }
  if (!product.data) return null;
  const p = product.data;

  return (
    <>
      <Link
        href={`/supplier/${supplierId}/products`}
        className="inline-flex items-center gap-2 text-dizajno-muted hover:text-dizajno-text font-mono text-xs tracking-widest uppercase mb-6"
      >
        <ArrowLeft size={12} /> Back to products
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div className="min-w-0">
          <h2 className="font-mono text-2xl tracking-wide text-dizajno-text truncate">
            {p.name}
          </h2>
          <p className="font-mono text-[10px] tracking-widest text-dizajno-muted uppercase mt-1">
            /{p.slug} · {p.family} · {p.categoryName}
          </p>
          <p className="font-mono text-[10px] tracking-widest mt-1.5">
            <StatusBadge status={p.status} />
          </p>
        </div>

        <div className="flex gap-1.5">
          {(p.status === "Draft" || p.status === "Hidden") && (
            <button
              type="button"
              onClick={() => publish.mutate()}
              className="flex items-center gap-2 rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 font-mono text-xs tracking-widest uppercase text-emerald-300 hover:bg-emerald-500/20 transition"
              title={p.status === "Draft" ? "Publish (untrusted suppliers go to Pending review)" : "Re-publish"}
            >
              <Send size={12} />
              {p.status === "Draft" ? "Publish" : "Re-publish"}
            </button>
          )}
          {(p.status === "Published" || p.status === "Pending") && (
            <button
              type="button"
              onClick={() => hide.mutate()}
              className="flex items-center gap-2 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 font-mono text-xs tracking-widest uppercase text-amber-300 hover:bg-amber-500/20 transition"
            >
              <EyeOff size={12} />
              Hide
            </button>
          )}
          {p.status === "Hidden" && (
            <span className="flex items-center gap-2 rounded border border-white/15 bg-black/20 px-3 py-1.5 font-mono text-xs tracking-widest uppercase text-dizajno-muted">
              <Eye size={12} className="opacity-60" />
              Hidden
            </span>
          )}
        </div>
      </div>

      <nav className="flex gap-2 mb-6 border-b border-white/10">
        <TabBtn active={tab === "info"} onClick={() => setTab("info")}>
          Product info
        </TabBtn>
        <TabBtn active={tab === "variants"} onClick={() => setTab("variants")}>
          Variants ({p.variants.length})
        </TabBtn>
      </nav>

      {tab === "info" && (
        <ProductInfoTab supplierId={supplierId} product={p} onSaved={invalidate} />
      )}
      {tab === "variants" && (
        <VariantsTab supplierId={supplierId} product={p} onChanged={invalidate} />
      )}
    </>
  );
}

function StatusBadge({ status }: { status: api.ProductStatus }) {
  const c = {
    Draft: "border-white/20 text-dizajno-muted bg-white/5",
    Pending: "border-amber-500/40 text-amber-300 bg-amber-500/10",
    Published: "border-emerald-500/40 text-emerald-300 bg-emerald-500/10",
    Hidden: "border-white/15 text-dizajno-muted bg-black/20",
    Removed: "border-red-500/40 text-red-300 bg-red-500/10",
  }[status];
  return (
    <span className={`inline-block rounded border px-1.5 py-0.5 font-mono text-[9px] tracking-widest uppercase ${c}`}>
      {status}
    </span>
  );
}

function TabBtn({
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
      className={`px-3 pb-2 -mb-px font-mono text-xs tracking-widest uppercase border-b-2 transition ${
        active
          ? "border-emerald-500 text-emerald-300"
          : "border-transparent text-dizajno-muted hover:text-dizajno-text"
      }`}
    >
      {children}
    </button>
  );
}
