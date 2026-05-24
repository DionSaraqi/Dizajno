"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import * as api from "@/lib/api";

const UNITS: api.UnitOfSale[] = [
  "Piece",
  "SquareMeter",
  "Liter",
  "LinearMeter",
  "Kilogram",
];

/**
 * Edit-in-place product info form. Family + slug are immutable (slug for URL
 * stability + audit-log entity-id semantics, family because changing it would
 * scramble the catalog).
 */
export default function ProductInfoTab({
  supplierId,
  product,
  onSaved,
}: {
  supplierId: string;
  product: api.SupplierProductDetail;
  onSaved: () => void;
}) {
  void supplierId; // future: used for permission-aware rendering
  const [categoryId, setCategoryId] = useState(product.categoryId);
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description ?? "");
  const [unitOfSale, setUnitOfSale] = useState<api.UnitOfSale>(product.unitOfSale);
  const [coverageRate, setCoverageRate] = useState(product.coverageRate?.toString() ?? "");
  const [wasteFactor, setWasteFactor] = useState(product.wasteFactor.toString());
  const [leadTimeDays, setLeadTimeDays] = useState(product.leadTimeDays?.toString() ?? "");
  const [previewSvg, setPreviewSvg] = useState(product.previewSvg ?? "");
  const [textureUrl, setTextureUrl] = useState(product.textureUrl ?? "");
  const [attributes, setAttributes] = useState(product.attributes);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const categories = useQuery({
    queryKey: ["catalog", "categories", product.family],
    queryFn: () => api.listCategories(product.family),
  });
  const categoryOptions = useMemo(
    () => (categories.data ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)),
    [categories.data]
  );

  useEffect(() => {
    if (!savedAt) return;
    const id = setTimeout(() => setSavedAt(null), 2500);
    return () => clearTimeout(id);
  }, [savedAt]);

  const save = useMutation({
    mutationFn: () =>
      api.updateSupplierProduct(product.id, {
        categoryId,
        name: name.trim(),
        description: description.trim() || null,
        unitOfSale,
        coverageRate: coverageRate ? Number(coverageRate) : null,
        wasteFactor: Number(wasteFactor || "0"),
        leadTimeDays: leadTimeDays ? Number(leadTimeDays) : null,
        previewSvg: previewSvg.trim() || null,
        textureUrl: textureUrl.trim() || null,
        attributes: attributes.trim() || null,
      }),
    onSuccess: () => {
      setSavedAt(Date.now());
      onSaved();
    },
    onError: (e: Error) => setError(e.message),
  });

  const isBuildingMaterial = product.family === "BuildingMaterial";
  const isLiter = unitOfSale === "Liter";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        save.mutate();
      }}
      className="space-y-5 max-w-2xl"
    >
      <Field label="Family / slug (read-only)">
        <div className="font-mono text-sm text-dizajno-muted">
          {product.family} · /{product.slug}
        </div>
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Category">
          <select
            required
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="portal-input"
          >
            {categoryOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Unit of sale">
          <select
            value={unitOfSale}
            onChange={(e) => setUnitOfSale(e.target.value as api.UnitOfSale)}
            className="portal-input"
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Display name">
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="portal-input"
        />
      </Field>

      <Field label="Description">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="portal-input resize-none"
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {isBuildingMaterial && isLiter && (
          <Field label="Coverage rate (m²/L)">
            <input
              type="number"
              step="0.01"
              min="0"
              value={coverageRate}
              onChange={(e) => setCoverageRate(e.target.value)}
              className="portal-input"
            />
          </Field>
        )}
        <Field label="Waste factor (0.10 = 10%)">
          <input
            type="number"
            step="0.01"
            min="0"
            max="1"
            value={wasteFactor}
            onChange={(e) => setWasteFactor(e.target.value)}
            className="portal-input"
          />
        </Field>
        <Field label="Lead time (days)">
          <input
            type="number"
            min="0"
            value={leadTimeDays}
            onChange={(e) => setLeadTimeDays(e.target.value)}
            className="portal-input"
          />
        </Field>
      </div>

      {isBuildingMaterial && (
        <Field
          label="Texture URL"
          hint="Tileable image used by FloorMesh + WallMesh in the designer."
        >
          <input
            type="url"
            value={textureUrl}
            onChange={(e) => setTextureUrl(e.target.value)}
            placeholder="/textures/your-paint.jpg"
            className="portal-input"
          />
        </Field>
      )}

      <Field
        label="Preview SVG (raw markup)"
        hint="Top-down 2D thumbnail shown in the designer sidebar."
      >
        <textarea
          value={previewSvg}
          onChange={(e) => setPreviewSvg(e.target.value)}
          rows={3}
          spellCheck={false}
          className="portal-input resize-none font-mono text-[11px]"
        />
      </Field>

      <Field
        label="Attributes (JSON)"
        hint="Family-specific fields like {icon, lumen, energyClass}. Defaults to {}."
      >
        <textarea
          value={attributes}
          onChange={(e) => setAttributes(e.target.value)}
          rows={3}
          spellCheck={false}
          className="portal-input resize-none font-mono text-[11px]"
        />
      </Field>

      {error && <p className="font-mono text-xs text-red-400 break-words">{error}</p>}

      <div className="flex items-center justify-end gap-2">
        {savedAt && (
          <span className="font-mono text-[10px] tracking-widest text-emerald-300 uppercase">
            Saved
          </span>
        )}
        <button
          type="submit"
          disabled={save.isPending}
          className="rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 font-mono text-xs tracking-widest uppercase text-emerald-300 hover:bg-emerald-500/20 transition disabled:opacity-50"
        >
          {save.isPending ? "Saving…" : "Save info"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <label className="font-mono text-[10px] tracking-widest text-dizajno-muted uppercase">
          {label}
        </label>
        {hint && (
          <span className="font-mono text-[10px] text-dizajno-muted/80">{hint}</span>
        )}
      </div>
      {children}
    </div>
  );
}
