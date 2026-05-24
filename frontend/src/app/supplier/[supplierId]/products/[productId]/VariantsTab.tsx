"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import * as api from "@/lib/api";
import VariantRowEditor from "./VariantRowEditor";

/**
 * Variants tab. Inline grid of one card per variant. Adding a variant pops a
 * minimal new-variant form at the top; the rest of the page keeps showing the
 * existing variants so the supplier can copy SKUs/dimensions across by eye.
 */
export default function VariantsTab({
  supplierId,
  product,
  onChanged,
}: {
  supplierId: string;
  product: api.SupplierProductDetail;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(product.variants.length === 0);

  return (
    <div className="space-y-6">
      {showAdd ? (
        <NewVariantForm
          productId={product.id}
          onCancel={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false);
            onChanged();
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 font-mono text-xs tracking-widest uppercase text-emerald-300 hover:bg-emerald-500/20 transition"
        >
          <Plus size={12} /> Add variant
        </button>
      )}

      {product.variants.length === 0 && !showAdd && (
        <p className="font-mono text-sm text-dizajno-muted">
          Add at least one variant — products can&apos;t be published without one.
        </p>
      )}

      {product.variants.map((v) => (
        <VariantRowEditor
          key={v.id}
          supplierId={supplierId}
          productId={product.id}
          variant={v}
          onChanged={onChanged}
          onDeleted={() => {
            qc.invalidateQueries({ queryKey: ["supplier", supplierId, "products", product.id] });
            onChanged();
          }}
        />
      ))}
    </div>
  );
}

function NewVariantForm({
  productId,
  onCancel,
  onCreated,
}: {
  productId: string;
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [sku, setSku] = useState("");
  const [name, setName] = useState("Standard");
  const [width, setWidth] = useState("1");
  const [depth, setDepth] = useState("1");
  const [height, setHeight] = useState("1");
  const [color, setColor] = useState("#999999");
  const [basePrice, setBasePrice] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      api.createVariant(productId, {
        sku: sku.trim(),
        name: name.trim(),
        width: Number(width),
        depth: Number(depth),
        height: Number(height),
        color,
        basePrice: basePrice ? Number(basePrice) : null,
        currency: "EUR",
      }),
    onSuccess: onCreated,
    onError: (e: Error) => setError(e.message),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        create.mutate();
      }}
      className="rounded border border-emerald-500/30 bg-emerald-500/5 px-4 py-4 space-y-4"
    >
      <h3 className="font-mono text-xs tracking-widest text-emerald-300 uppercase">
        New variant
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input
          required
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          placeholder="SKU"
          className="portal-input"
        />
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="portal-input"
        />
        <input
          type="text"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          placeholder="#999999"
          className="portal-input"
        />
        <input
          type="number"
          step="0.01"
          min="0.01"
          required
          value={width}
          onChange={(e) => setWidth(e.target.value)}
          placeholder="Width (m)"
          className="portal-input"
        />
        <input
          type="number"
          step="0.01"
          min="0.01"
          required
          value={depth}
          onChange={(e) => setDepth(e.target.value)}
          placeholder="Depth (m)"
          className="portal-input"
        />
        <input
          type="number"
          step="0.01"
          min="0.01"
          required
          value={height}
          onChange={(e) => setHeight(e.target.value)}
          placeholder="Height (m)"
          className="portal-input"
        />
        <input
          type="number"
          step="0.01"
          min="0"
          value={basePrice}
          onChange={(e) => setBasePrice(e.target.value)}
          placeholder="Base price (EUR, optional)"
          className="portal-input col-span-1 sm:col-span-2"
        />
      </div>
      {error && <p className="font-mono text-xs text-red-400">{error}</p>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-white/10 px-3 py-1.5 font-mono text-xs tracking-widest uppercase text-dizajno-muted hover:text-dizajno-text transition"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={create.isPending}
          className="rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 font-mono text-xs tracking-widest uppercase text-emerald-300 hover:bg-emerald-500/20 transition disabled:opacity-50"
        >
          {create.isPending ? "Adding…" : "Add variant"}
        </button>
      </div>
    </form>
  );
}
