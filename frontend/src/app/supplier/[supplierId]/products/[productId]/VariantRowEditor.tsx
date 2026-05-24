"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Image as ImageIcon, Plus, Trash2, Upload, X } from "lucide-react";
import * as api from "@/lib/api";

/**
 * One card per variant. Has: dimensions/price/color edit, GLB upload, SVG
 * preview upload, collision boxes (numeric rows for L-shapes etc.), material
 * slot defaults (named hex colors), and the texture-slot bindings picker.
 *
 * Heavy form, but everything saves through a single `Save variant` button at
 * the bottom (or per-section in the case of asset attaches + slot bindings,
 * which are atomic backend operations).
 */
export default function VariantRowEditor({
  supplierId,
  productId,
  variant,
  onChanged,
  onDeleted,
}: {
  supplierId: string;
  productId: string;
  variant: api.SupplierVariant;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const qc = useQueryClient();

  // Top-level fields
  const [name, setName] = useState(variant.name);
  const [width, setWidth] = useState(variant.width.toString());
  const [depth, setDepth] = useState(variant.depth.toString());
  const [height, setHeight] = useState(variant.height.toString());
  const [color, setColor] = useState(variant.color || "#999999");
  const [basePrice, setBasePrice] = useState(variant.basePrice?.toString() ?? "");
  const [currency, setCurrency] = useState(variant.currency || "EUR");

  // Collision boxes (parsed → editable rows → serialised back)
  const [collisions, setCollisions] = useState<CollisionRow[]>(() =>
    parseCollisionBoxes(variant.collisionBoxes)
  );

  // Material defaults (slotName → hex)
  const [materialSlots, setMaterialSlots] = useState<MaterialRow[]>(() =>
    parseMaterialDefaults(variant.materialDefaults)
  );

  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!savedAt) return;
    const id = setTimeout(() => setSavedAt(null), 2500);
    return () => clearTimeout(id);
  }, [savedAt]);

  const save = useMutation({
    mutationFn: () =>
      api.updateVariant(variant.id, {
        name: name.trim(),
        width: Number(width),
        depth: Number(depth),
        height: Number(height),
        color,
        basePrice: basePrice ? Number(basePrice) : null,
        currency: currency || "EUR",
        collisionBoxes: serializeCollisionBoxes(collisions),
        materialDefaults: serializeMaterialDefaults(materialSlots),
        attributes: variant.attributes,
        sortOrder: variant.sortOrder,
      }),
    onSuccess: () => {
      setSavedAt(Date.now());
      onChanged();
    },
    onError: (e: Error) => setError(e.message),
  });

  const deleteVariant = useMutation({
    mutationFn: () => api.deleteVariant(variant.id),
    onSuccess: onDeleted,
    onError: (e: Error) => alert(e.message),
  });

  // Asset uploads — each handler picks a file, calls the three-step helper,
  // then attaches to the variant. The helper surfaces R2-misconfigured errors
  // as a regular Error so we just alert and bail.
  const attachGlb = useMutation({
    mutationFn: async (file: File) => {
      const asset = await api.uploadSupplierFile(supplierId, file, "Glb");
      await api.attachVariantGlb(variant.id, asset.id);
      return asset;
    },
    onSuccess: onChanged,
    onError: (e: Error) => alert(`GLB upload failed: ${e.message}`),
  });
  const detachGlb = useMutation({
    mutationFn: () => api.attachVariantGlb(variant.id, "00000000-0000-0000-0000-000000000000"),
    onSuccess: onChanged,
    onError: (e: Error) => alert(e.message),
  });
  const attachPreview = useMutation({
    mutationFn: async (file: File) => {
      const asset = await api.uploadSupplierFile(supplierId, file, "SvgPreview");
      await api.attachVariantPreview(variant.id, asset.id);
      return asset;
    },
    onSuccess: onChanged,
    onError: (e: Error) => alert(`SVG upload failed: ${e.message}`),
  });
  const detachPreview = useMutation({
    mutationFn: () => api.attachVariantPreview(variant.id, "00000000-0000-0000-0000-000000000000"),
    onSuccess: onChanged,
    onError: (e: Error) => alert(e.message),
  });

  return (
    <section className="rounded border border-white/15 bg-black/30 px-4 py-4 space-y-4">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h3 className="font-mono text-sm text-dizajno-text">{variant.sku}</h3>
          <p className="font-mono text-[10px] tracking-widest text-dizajno-muted uppercase mt-0.5">
            Variant · sort {variant.sortOrder}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (confirm(`Delete variant ${variant.sku}? Fails if any saved project scene still references it.`)) {
              deleteVariant.mutate();
            }
          }}
          className="rounded border border-white/10 px-2 py-1 text-dizajno-muted hover:text-red-300 hover:border-red-500/40 transition"
          title="Delete variant"
        >
          <Trash2 size={14} />
        </button>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <LabeledInput label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} className="portal-input" />
        </LabeledInput>
        <LabeledInput label="Color (hex)">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-9 h-9 rounded border border-white/10 bg-black/30 cursor-pointer"
            />
            <input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="portal-input flex-1"
            />
          </div>
        </LabeledInput>
        <LabeledInput label="Base price">
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.01"
              min="0"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
              placeholder="—"
              className="portal-input flex-1"
            />
            <input
              value={currency}
              maxLength={3}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              className="portal-input w-16"
            />
          </div>
        </LabeledInput>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <LabeledInput label="Width (m, X)">
          <input
            type="number" step="0.01" min="0.01"
            value={width}
            onChange={(e) => setWidth(e.target.value)}
            className="portal-input"
          />
        </LabeledInput>
        <LabeledInput label="Depth (m, Z)">
          <input
            type="number" step="0.01" min="0.01"
            value={depth}
            onChange={(e) => setDepth(e.target.value)}
            className="portal-input"
          />
        </LabeledInput>
        <LabeledInput label="Height (m, Y)">
          <input
            type="number" step="0.01" min="0.01"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            className="portal-input"
          />
        </LabeledInput>
      </div>

      <CollisionBoxesEditor
        rows={collisions}
        onChange={setCollisions}
      />

      <MaterialSlotsEditor
        rows={materialSlots}
        onChange={setMaterialSlots}
      />

      <AssetSlot
        label="GLB model"
        icon={<Box size={14} />}
        currentUrl={variant.glbAssetUrl}
        currentId={variant.glbAssetId}
        accept="model/gltf-binary,.glb"
        uploading={attachGlb.isPending}
        onUpload={(file) => attachGlb.mutate(file)}
        onDetach={() => detachGlb.mutate()}
      />

      <AssetSlot
        label="SVG preview"
        icon={<ImageIcon size={14} />}
        currentUrl={variant.svgPreviewAssetUrl}
        currentId={variant.svgPreviewAssetId}
        accept="image/svg+xml,.svg"
        uploading={attachPreview.isPending}
        onUpload={(file) => attachPreview.mutate(file)}
        onDetach={() => detachPreview.mutate()}
      />

      <TextureSlotsBinder supplierId={supplierId} variantId={variant.id} />

      {error && <p className="font-mono text-xs text-red-400 break-words">{error}</p>}

      <div className="flex items-center justify-end gap-2">
        {savedAt && (
          <span className="font-mono text-[10px] tracking-widest text-emerald-300 uppercase">
            Saved
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            setError(null);
            save.mutate();
          }}
          disabled={save.isPending}
          className="rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 font-mono text-xs tracking-widest uppercase text-emerald-300 hover:bg-emerald-500/20 transition disabled:opacity-50"
        >
          {save.isPending ? "Saving…" : "Save variant"}
        </button>
      </div>
    </section>
  );
}

// ── Asset slot ──────────────────────────────────────────────────────────────

function AssetSlot({
  label, icon, currentUrl, currentId, accept, uploading, onUpload, onDetach,
}: {
  label: string;
  icon: React.ReactNode;
  currentUrl: string | null;
  currentId: string | null;
  accept: string;
  uploading: boolean;
  onUpload: (file: File) => void;
  onDetach: () => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <label className="flex items-center gap-2 font-mono text-[10px] tracking-widest text-dizajno-muted uppercase">
          {icon}
          {label}
        </label>
      </div>
      <div className="flex items-center justify-between gap-3 rounded border border-white/10 bg-black/40 px-3 py-2">
        <div className="min-w-0 flex-1">
          {currentUrl ? (
            <a
              href={currentUrl}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[11px] text-emerald-300 hover:underline break-all"
            >
              {currentUrl}
            </a>
          ) : (
            <span className="font-mono text-[11px] text-dizajno-muted">— Not set —</span>
          )}
        </div>
        <div className="flex gap-1.5">
          <label
            className={`flex items-center gap-1 rounded border border-white/10 px-2 py-1 font-mono text-[10px] tracking-widest uppercase cursor-pointer transition ${
              uploading
                ? "text-dizajno-muted opacity-50 cursor-wait"
                : "text-dizajno-muted hover:text-emerald-300 hover:border-emerald-500/40"
            }`}
            title="Upload via R2 presign"
          >
            <Upload size={12} />
            {uploading ? "…" : "Upload"}
            <input
              type="file"
              accept={accept}
              disabled={uploading}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f);
                e.target.value = "";
              }}
            />
          </label>
          {currentId && (
            <button
              type="button"
              onClick={onDetach}
              className="rounded border border-white/10 px-2 py-1 text-dizajno-muted hover:text-red-300 hover:border-red-500/40 transition"
              title="Detach"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Collision boxes ─────────────────────────────────────────────────────────

type CollisionRow = { offsetX: string; offsetZ: string; width: string; depth: string };

function CollisionBoxesEditor({
  rows,
  onChange,
}: {
  rows: CollisionRow[];
  onChange: (rows: CollisionRow[]) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <label className="font-mono text-[10px] tracking-widest text-dizajno-muted uppercase">
          Collision sub-boxes (optional)
        </label>
        <span className="font-mono text-[10px] text-dizajno-muted/80">
          Leave empty for rectangular furniture — the renderer uses width × depth automatically.
        </span>
      </div>
      <div className="rounded border border-white/10 bg-black/40 px-3 py-3 space-y-2">
        {rows.length === 0 && (
          <p className="font-mono text-[11px] text-dizajno-muted">
            No sub-boxes. Add one if the visible model is L-shaped or curved.
          </p>
        )}
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-5 gap-2 items-center">
            <NumCell value={r.offsetX} placeholder="offsetX" onChange={(v) => updateRow(i, "offsetX", v)} />
            <NumCell value={r.offsetZ} placeholder="offsetZ" onChange={(v) => updateRow(i, "offsetZ", v)} />
            <NumCell value={r.width} placeholder="width" onChange={(v) => updateRow(i, "width", v)} />
            <NumCell value={r.depth} placeholder="depth" onChange={(v) => updateRow(i, "depth", v)} />
            <button
              type="button"
              onClick={() => onChange(rows.filter((_, j) => j !== i))}
              className="rounded border border-white/10 px-2 py-1 text-dizajno-muted hover:text-red-300 hover:border-red-500/40 transition"
              title="Remove sub-box"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...rows, { offsetX: "0", offsetZ: "0", width: "1", depth: "1" }])}
          className="flex items-center gap-1.5 rounded border border-white/10 px-2 py-1 font-mono text-[10px] tracking-widest uppercase text-dizajno-muted hover:text-dizajno-text hover:border-white/20 transition"
        >
          <Plus size={12} /> Add sub-box
        </button>
      </div>
    </div>
  );

  function updateRow(index: number, key: keyof CollisionRow, val: string) {
    onChange(rows.map((r, i) => (i === index ? { ...r, [key]: val } : r)));
  }
}

function NumCell({
  value, placeholder, onChange,
}: { value: string; placeholder: string; onChange: (v: string) => void }) {
  return (
    <input
      type="number"
      step="0.01"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="portal-input font-mono text-xs"
    />
  );
}

function parseCollisionBoxes(json: string | null): CollisionRow[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return [];
    return arr.map((b: { offsetX: number; offsetZ: number; width: number; depth: number }) => ({
      offsetX: String(b.offsetX),
      offsetZ: String(b.offsetZ),
      width: String(b.width),
      depth: String(b.depth),
    }));
  } catch {
    return [];
  }
}

function serializeCollisionBoxes(rows: CollisionRow[]): string | null {
  const valid = rows
    .map((r) => ({
      offsetX: Number(r.offsetX || "0"),
      offsetZ: Number(r.offsetZ || "0"),
      width: Number(r.width || "0"),
      depth: Number(r.depth || "0"),
    }))
    .filter((b) => b.width > 0 && b.depth > 0);
  return valid.length > 0 ? JSON.stringify(valid) : null;
}

// ── Material slot defaults ──────────────────────────────────────────────────

type MaterialRow = { slot: string; color: string };

function MaterialSlotsEditor({
  rows,
  onChange,
}: {
  rows: MaterialRow[];
  onChange: (rows: MaterialRow[]) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <label className="font-mono text-[10px] tracking-widest text-dizajno-muted uppercase">
          Material slot defaults (optional)
        </label>
        <span className="font-mono text-[10px] text-dizajno-muted/80">
          Per-slot hex defaults. Surfaces in the customizer&apos;s slot picker.
        </span>
      </div>
      <div className="rounded border border-white/10 bg-black/40 px-3 py-3 space-y-2">
        {rows.length === 0 && (
          <p className="font-mono text-[11px] text-dizajno-muted">
            No slots. Add one for each named material on the GLB (e.g. Body, Pillows, Legs).
          </p>
        )}
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_8rem_auto] gap-2 items-center">
            <input
              type="text"
              value={r.slot}
              onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, slot: e.target.value } : x)))}
              placeholder="Slot name (e.g. Body)"
              className="portal-input"
            />
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={r.color}
                onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, color: e.target.value } : x)))}
                className="w-9 h-9 rounded border border-white/10 bg-black/30 cursor-pointer"
              />
              <input
                type="text"
                value={r.color}
                onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, color: e.target.value } : x)))}
                className="portal-input font-mono text-xs"
              />
            </div>
            <button
              type="button"
              onClick={() => onChange(rows.filter((_, j) => j !== i))}
              className="rounded border border-white/10 px-2 py-1 text-dizajno-muted hover:text-red-300 hover:border-red-500/40 transition"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...rows, { slot: "", color: "#888888" }])}
          className="flex items-center gap-1.5 rounded border border-white/10 px-2 py-1 font-mono text-[10px] tracking-widest uppercase text-dizajno-muted hover:text-dizajno-text hover:border-white/20 transition"
        >
          <Plus size={12} /> Add slot
        </button>
      </div>
    </div>
  );
}

function parseMaterialDefaults(json: string | null): MaterialRow[] {
  if (!json) return [];
  try {
    const obj = JSON.parse(json);
    if (typeof obj !== "object" || obj === null) return [];
    return Object.entries(obj).map(([slot, color]) => ({ slot, color: String(color) }));
  } catch {
    return [];
  }
}

function serializeMaterialDefaults(rows: MaterialRow[]): string | null {
  const valid = rows.filter((r) => r.slot.trim().length > 0);
  if (valid.length === 0) return null;
  const obj: Record<string, string> = {};
  for (const r of valid) obj[r.slot.trim()] = r.color;
  return JSON.stringify(obj);
}

// ── Texture slot bindings ───────────────────────────────────────────────────

function TextureSlotsBinder({
  supplierId,
  variantId,
}: {
  supplierId: string;
  variantId: string;
}) {
  const qc = useQueryClient();

  const slots = useQuery({
    queryKey: ["supplier", "variant", variantId, "texture-slots"],
    queryFn: () => api.listVariantTextureSlots(variantId),
  });
  const textures = useQuery({
    queryKey: ["supplier", supplierId, "textures"],
    queryFn: () => api.listSupplierTextures(supplierId),
  });

  // Edit state mirrors the server list so users can add/remove rows before
  // saving in one shot.
  const [draft, setDraft] = useState<
    { slotName: string; supplierTextureId: string; isDefault: boolean }[]
  >([]);

  // Reset draft whenever the server state lands.
  useEffect(() => {
    if (slots.data) {
      setDraft(
        slots.data.map((s) => ({
          slotName: s.slotName,
          supplierTextureId: s.supplierTextureId,
          isDefault: s.isDefault,
        }))
      );
    }
  }, [slots.data]);

  const save = useMutation({
    mutationFn: () => {
      // Strip empty rows before sending so users can leave a half-edited row
      // in-progress without the backend erroring on the empty values.
      const cleaned = draft.filter((r) => r.slotName.trim() && r.supplierTextureId);
      return api.replaceVariantTextureSlots(variantId, cleaned);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["supplier", "variant", variantId, "texture-slots"] }),
    onError: (e: Error) => alert(e.message),
  });

  if (textures.isLoading || slots.isLoading) {
    return (
      <div className="rounded border border-white/10 bg-black/40 px-3 py-3 font-mono text-[11px] text-dizajno-muted">
        Loading textures…
      </div>
    );
  }
  if (!textures.data || textures.data.length === 0) {
    return (
      <div className="rounded border border-white/10 bg-black/40 px-3 py-3 font-mono text-[11px] text-dizajno-muted">
        No textures in the library yet. Upload some via the{" "}
        <a href={`/supplier/${supplierId}/textures`} className="text-emerald-300 hover:underline">
          Textures tab
        </a>{" "}
        to bind them here.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <label className="font-mono text-[10px] tracking-widest text-dizajno-muted uppercase">
          Texture slot bindings
        </label>
        <span className="font-mono text-[10px] text-dizajno-muted/80">
          Maps slot names (Body, Pillows…) to textures from your library.
        </span>
      </div>
      <div className="rounded border border-white/10 bg-black/40 px-3 py-3 space-y-2">
        {draft.length === 0 && (
          <p className="font-mono text-[11px] text-dizajno-muted">
            No bindings yet. Add one per (slot, texture) pair; mark one default per slot.
          </p>
        )}
        {draft.map((row, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center">
            <input
              type="text"
              value={row.slotName}
              onChange={(e) =>
                setDraft(draft.map((r, j) => (j === i ? { ...r, slotName: e.target.value } : r)))
              }
              placeholder="Slot (e.g. Body)"
              className="portal-input"
            />
            <select
              value={row.supplierTextureId}
              onChange={(e) =>
                setDraft(draft.map((r, j) => (j === i ? { ...r, supplierTextureId: e.target.value } : r)))
              }
              className="portal-input"
            >
              <option value="">— Pick texture —</option>
              {textures.data!.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1 font-mono text-[10px] tracking-widest text-dizajno-muted uppercase">
              <input
                type="checkbox"
                checked={row.isDefault}
                onChange={(e) =>
                  setDraft(draft.map((r, j) => (j === i ? { ...r, isDefault: e.target.checked } : r)))
                }
              />
              Default
            </label>
            <button
              type="button"
              onClick={() => setDraft(draft.filter((_, j) => j !== i))}
              className="rounded border border-white/10 px-2 py-1 text-dizajno-muted hover:text-red-300 hover:border-red-500/40 transition"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        <div className="flex items-center justify-between gap-2 pt-2">
          <button
            type="button"
            onClick={() => setDraft([...draft, { slotName: "", supplierTextureId: "", isDefault: false }])}
            className="flex items-center gap-1.5 rounded border border-white/10 px-2 py-1 font-mono text-[10px] tracking-widest uppercase text-dizajno-muted hover:text-dizajno-text hover:border-white/20 transition"
          >
            <Plus size={12} /> Add binding
          </button>
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 font-mono text-[10px] tracking-widest uppercase text-emerald-300 hover:bg-emerald-500/20 transition disabled:opacity-50"
          >
            {save.isPending ? "Saving…" : "Save bindings"}
          </button>
        </div>
      </div>
    </div>
  );
}

function LabeledInput({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="font-mono text-[10px] tracking-widest text-dizajno-muted uppercase">
        {label}
      </label>
      {children}
    </div>
  );
}
