"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import * as api from "@/lib/api";

const FAMILIES: api.ProductFamily[] = [
  "Furniture",
  "Lighting",
  "Appliance",
  "BuildingMaterial",
  "Fixture",
];

const UNITS: api.UnitOfSale[] = [
  "Piece",
  "SquareMeter",
  "Liter",
  "LinearMeter",
  "Kilogram",
];

/**
 * Product create form. Family + category drive a few conditional fields:
 *   - BuildingMaterial w/ Liter unit → CoverageRate (m² per liter) is meaningful for paints.
 *   - BuildingMaterial → TextureUrl shows the wall/floor designer skin hint.
 *
 * Categories load fresh whenever family changes. Suppliers can suggest a new
 * category inline — the row lands in admin moderation (Phase 7a) and isn't
 * pickable until approved.
 */
export default function NewProductPage() {
  const params = useParams<{ supplierId: string }>();
  const supplierId = params.supplierId;
  const router = useRouter();
  const qc = useQueryClient();

  const [family, setFamily] = useState<api.ProductFamily>("Furniture");
  const [categoryId, setCategoryId] = useState<string>("");
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [unitOfSale, setUnitOfSale] = useState<api.UnitOfSale>("Piece");
  const [coverageRate, setCoverageRate] = useState<string>("");
  const [wasteFactor, setWasteFactor] = useState<string>("0");
  const [leadTimeDays, setLeadTimeDays] = useState<string>("");
  const [textureUrl, setTextureUrl] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [showSuggest, setShowSuggest] = useState(false);

  const categories = useQuery({
    queryKey: ["catalog", "categories", family],
    queryFn: () => api.listCategories(family),
  });

  const categoryOptions = useMemo(
    () => (categories.data ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)),
    [categories.data]
  );

  useEffect(() => {
    // Reset selected category when family changes; the previous pick is now
    // foreign and would be rejected by the API.
    if (categoryOptions.length > 0 && !categoryOptions.some((c) => c.id === categoryId)) {
      setCategoryId("");
    }
  }, [categoryOptions, categoryId]);

  const create = useMutation({
    mutationFn: async () => {
      if (!categoryId) throw new Error("Pick a category.");
      return api.createSupplierProduct({
        supplierId,
        family,
        categoryId,
        slug: slug.trim().toLowerCase(),
        name: name.trim(),
        description: description.trim() || null,
        unitOfSale,
        coverageRate: coverageRate ? Number(coverageRate) : null,
        wasteFactor: Number(wasteFactor || "0"),
        leadTimeDays: leadTimeDays ? Number(leadTimeDays) : null,
        textureUrl: textureUrl.trim() || null,
        attributes: null,
      });
    },
    onSuccess: (dto) => {
      qc.invalidateQueries({ queryKey: ["supplier", supplierId, "products"] });
      router.replace(`/supplier/${supplierId}/products/${dto.id}`);
    },
    onError: (e: Error) => setError(e.message),
  });

  const isBuildingMaterial = family === "BuildingMaterial";
  const isLiter = unitOfSale === "Liter";

  return (
    <>
      <Link
        href={`/supplier/${supplierId}/products`}
        className="inline-flex items-center gap-2 text-dizajno-muted hover:text-dizajno-text font-mono text-xs tracking-widest uppercase mb-6"
      >
        <ArrowLeft size={12} /> Back to products
      </Link>

      <h2 className="font-mono text-2xl tracking-wide text-dizajno-text mb-1">
        New product
      </h2>
      <p className="font-mono text-[10px] tracking-widest text-dizajno-muted uppercase mb-6">
        Saves as Draft. Add a variant + publish to send to review (or auto-publish if trusted).
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          create.mutate();
        }}
        className="space-y-5 max-w-2xl"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Family">
            <select
              value={family}
              onChange={(e) => setFamily(e.target.value as api.ProductFamily)}
              className="portal-input"
            >
              {FAMILIES.map((f) => (
                <option key={f} value={f}>
                  {f}
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

        <Field
          label="Category"
          hint={
            <button
              type="button"
              onClick={() => setShowSuggest(true)}
              className="text-emerald-300 hover:underline"
            >
              Suggest a new category
            </button>
          }
        >
          <select
            required
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="portal-input"
          >
            <option value="">— Pick one —</option>
            {categoryOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Slug (URL fragment, lowercase)">
            <input
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="acme-lounge-sofa"
              pattern="^[a-z0-9-]+$"
              className="portal-input"
            />
          </Field>
          <Field label="Display name">
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Lounge Sofa"
              className="portal-input"
            />
          </Field>
        </div>

        <Field label="Description (optional)">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="portal-input resize-none"
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {isBuildingMaterial && isLiter && (
            <Field label="Coverage rate (m² per liter)">
              <input
                type="number"
                step="0.01"
                min="0"
                value={coverageRate}
                onChange={(e) => setCoverageRate(e.target.value)}
                placeholder="10"
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
          <Field label="Lead time (days, optional)">
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
            label="Texture URL (optional)"
            hint="Tileable JPG/PNG. Lets walls + floors in the designer skin themselves with this finish."
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

        {error && (
          <p className="font-mono text-xs text-red-400 break-words">{error}</p>
        )}

        <div className="flex justify-end gap-2">
          <Link
            href={`/supplier/${supplierId}/products`}
            className="rounded border border-white/10 px-3 py-1.5 font-mono text-xs tracking-widest uppercase text-dizajno-muted hover:text-dizajno-text transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={create.isPending}
            className="rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 font-mono text-xs tracking-widest uppercase text-emerald-300 hover:bg-emerald-500/20 transition disabled:opacity-50"
          >
            {create.isPending ? "Saving…" : "Create draft"}
          </button>
        </div>
      </form>

      {showSuggest && (
        <SuggestCategoryModal
          supplierId={supplierId}
          family={family}
          onClose={() => setShowSuggest(false)}
          onSuggested={() => {
            setShowSuggest(false);
            alert(
              "Category suggested. It needs admin approval before products can attach to it."
            );
          }}
        />
      )}

      <style jsx global>{`
        .portal-input {
          width: 100%;
          border-radius: 4px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(0, 0, 0, 0.3);
          padding: 0.375rem 0.75rem;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 0.875rem;
          color: rgb(229 231 235);
        }
        .portal-input:focus {
          outline: none;
          border-color: rgba(255, 255, 255, 0.3);
        }
      `}</style>
    </>
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

function SuggestCategoryModal({
  supplierId,
  family,
  onClose,
  onSuggested,
}: {
  supplierId: string;
  family: api.ProductFamily;
  onClose: () => void;
  onSuggested: () => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const suggest = useMutation({
    mutationFn: () =>
      api.suggestCategory({
        supplierId,
        family,
        parentCategoryId: null,
        name: name.trim(),
      }),
    onSuccess: () => onSuggested(),
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur px-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          suggest.mutate();
        }}
        className="w-full max-w-md rounded border border-white/15 bg-dizajno-bg px-6 py-6 space-y-4"
      >
        <h2 className="font-mono text-sm tracking-widest text-dizajno-text uppercase">
          Suggest category — {family}
        </h2>
        <Field label="Display name">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Pendant Lights"
            className="portal-input"
          />
        </Field>
        {error && (
          <p className="font-mono text-xs text-red-400 break-words">{error}</p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-white/10 px-3 py-1.5 font-mono text-xs tracking-widest uppercase text-dizajno-muted hover:text-dizajno-text transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={suggest.isPending}
            className="rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 font-mono text-xs tracking-widest uppercase text-emerald-300 hover:bg-emerald-500/20 transition disabled:opacity-50"
          >
            {suggest.isPending ? "Sending…" : "Submit for review"}
          </button>
        </div>
      </form>
    </div>
  );
}
