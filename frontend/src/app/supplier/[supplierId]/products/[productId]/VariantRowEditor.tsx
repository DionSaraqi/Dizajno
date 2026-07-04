"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Box,
  Check,
  Eye,
  ImageIcon,
  Layers,
  Palette,
  Plus,
  Ruler,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import * as api from "@/lib/api";
import { analyzeGlbFile, analyzeGlbUrl } from "@/utils/glbAnalysis";
import {
  collectGlbWarnings,
  measuredDimsForApply,
  type GlbMeasurement,
} from "@/utils/glbChecks";
import {
  Badge,
  Button,
  Card,
  CardBody,
  ConfirmDialog,
  FormField,
  IconButton,
  Input,
  Select,
  Spinner,
  Tooltip,
} from "@/components/ui";

// R3F needs the browser — never render the preview during SSR.
const GlbPreview = dynamic(() => import("./GlbPreview"), { ssr: false });

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

  // Collision boxes / material slots
  const [collisions, setCollisions] = useState<CollisionRow[]>(() =>
    parseCollisionBoxes(variant.collisionBoxes),
  );
  const [materialSlots, setMaterialSlots] = useState<MaterialRow[]>(() =>
    parseMaterialDefaults(variant.materialDefaults),
  );

  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // GLB analysis: run on file pick (parse failure blocks the upload — the
  // designer would fail to render the model too) or on demand for the
  // already-attached asset. Warnings recompute live as the dims fields change.
  const [glbCheck, setGlbCheck] = useState<GlbMeasurement | null>(null);
  const [glbCheckError, setGlbCheckError] = useState<string | null>(null);
  const [checkingGlb, setCheckingGlb] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Revoke a picked file's blob URL when it's replaced or the row unmounts.
  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const typedDims = useMemo(() => {
    const w = Number(width);
    const h = Number(height);
    const d = Number(depth);
    return w > 0 && h > 0 && d > 0 ? { width: w, height: h, depth: d } : null;
  }, [width, height, depth]);

  const glbWarnings = useMemo(
    () => (glbCheck && typedDims ? collectGlbWarnings(glbCheck, typedDims) : []),
    [glbCheck, typedDims],
  );

  useEffect(() => {
    if (!savedAt) return;
    const id = setTimeout(() => setSavedAt(null), 2500);
    return () => clearTimeout(id);
  }, [savedAt]);

  void productId; // referenced via parent's invalidation key

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
    onSuccess: () => {
      onDeleted();
      setDeleteOpen(false);
    },
    onError: (e: Error) => setError(e.message),
  });

  // Asset uploads — each handler picks a file, calls the three-step helper,
  // then attaches to the variant. R2-misconfigured errors surface as a regular
  // Error so we can show them inline.
  const attachGlb = useMutation({
    mutationFn: async (file: File) => {
      const asset = await api.uploadSupplierFile(supplierId, file, "Glb");
      await api.attachVariantGlb(variant.id, asset.id);
      return asset;
    },
    onSuccess: onChanged,
    onError: (e: Error) => setError(`GLB upload failed: ${e.message}`),
  });
  const detachGlb = useMutation({
    mutationFn: () =>
      api.attachVariantGlb(variant.id, "00000000-0000-0000-0000-000000000000"),
    onSuccess: onChanged,
    onError: (e: Error) => setError(e.message),
  });
  const attachPreview = useMutation({
    mutationFn: async (file: File) => {
      const asset = await api.uploadSupplierFile(
        supplierId,
        file,
        "SvgPreview",
      );
      await api.attachVariantPreview(variant.id, asset.id);
      return asset;
    },
    onSuccess: onChanged,
    onError: (e: Error) => setError(`SVG upload failed: ${e.message}`),
  });
  const detachPreview = useMutation({
    mutationFn: () =>
      api.attachVariantPreview(
        variant.id,
        "00000000-0000-0000-0000-000000000000",
      ),
    onSuccess: onChanged,
    onError: (e: Error) => setError(e.message),
  });

  async function handleGlbSelected(file: File) {
    setGlbCheckError(null);
    setCheckingGlb(true);
    try {
      const measurement = await analyzeGlbFile(file);
      setGlbCheck(measurement);
      setPreviewUrl(URL.createObjectURL(file));
      setPreviewOpen(true);
      // Warnings are advisory — upload proceeds; only a parse failure blocks.
      attachGlb.mutate(file);
    } catch (e: unknown) {
      setGlbCheck(null);
      setGlbCheckError(
        e instanceof Error ? e.message : "Could not analyze the model.",
      );
    } finally {
      setCheckingGlb(false);
    }
  }

  async function checkCurrentGlb() {
    if (!variant.glbAssetUrl) return;
    setGlbCheckError(null);
    setCheckingGlb(true);
    try {
      const measurement = await analyzeGlbUrl(variant.glbAssetUrl);
      setGlbCheck(measurement);
      setPreviewUrl(variant.glbAssetUrl);
      setPreviewOpen(true);
    } catch (e: unknown) {
      setGlbCheckError(
        e instanceof Error ? e.message : "Could not analyze the model.",
      );
    } finally {
      setCheckingGlb(false);
    }
  }

  function applyMeasuredDims() {
    if (!glbCheck) return;
    const dims = measuredDimsForApply(typedDims, glbCheck.size);
    if (!dims) return;
    const format = (v: number) => String(Math.round(v * 1000) / 1000);
    setWidth(format(dims.width));
    setHeight(format(dims.height));
    setDepth(format(dims.depth));
  }

  function addMaterialSlotsFromModel() {
    if (!glbCheck) return;
    const existing = new Set(materialSlots.map((r) => r.slot.trim()));
    const additions = glbCheck.materialNames
      .filter((n) => !existing.has(n))
      .map((n) => ({ slot: n, color: "#888888" }));
    if (additions.length > 0) setMaterialSlots([...materialSlots, ...additions]);
  }

  return (
    <>
      <Card>
        <CardBody className="space-y-6">
          {/* Header */}
          <header className="flex items-start justify-between gap-3 pb-4 border-b border-dizajno-border-subtle">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-[15px] font-semibold text-dizajno-text font-mono">
                  {variant.sku}
                </h3>
                <Badge tone="neutral" size="sm" mono>
                  sort {variant.sortOrder}
                </Badge>
              </div>
              <p className="text-[12.5px] text-dizajno-muted mt-0.5">
                Variant SKU is immutable — saved as-is.
              </p>
            </div>
            <Tooltip content="Delete this variant">
              <IconButton
                variant="danger"
                size="sm"
                onClick={() => setDeleteOpen(true)}
                disabled={deleteVariant.isPending}
              >
                <Trash2 />
              </IconButton>
            </Tooltip>
          </header>

          {/* Basic fields */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </FormField>
            <FormField label="Color" hint="Hex">
              <ColorInput value={color} onChange={setColor} />
            </FormField>
            <FormField label="Base price" hint="Currency code → 3 letters">
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                  placeholder="—"
                />
                <Input
                  value={currency}
                  maxLength={3}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                  className="w-20 font-mono"
                />
              </div>
            </FormField>
          </div>

          {/* Dimensions */}
          <div>
            <p className="text-[11px] font-medium uppercase tracking-label text-dizajno-muted mb-2">
              Dimensions
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label="Width" hint="m, X axis" required>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                />
              </FormField>
              <FormField label="Depth" hint="m, Z axis" required>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={depth}
                  onChange={(e) => setDepth(e.target.value)}
                />
              </FormField>
              <FormField label="Height" hint="m, Y axis" required>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                />
              </FormField>
            </div>
          </div>

          <CollisionBoxesEditor rows={collisions} onChange={setCollisions} />

          <MaterialSlotsEditor
            rows={materialSlots}
            onChange={setMaterialSlots}
          />

          <AssetSlot
            label="GLB model"
            icon={<Box />}
            currentUrl={variant.glbAssetUrl}
            currentId={variant.glbAssetId}
            accept="model/gltf-binary,.glb"
            uploading={attachGlb.isPending || detachGlb.isPending || checkingGlb}
            onUpload={(file) => void handleGlbSelected(file)}
            onDetach={() => detachGlb.mutate()}
          />

          {/* Model check: measured bounds vs typed dims + live 3D preview */}
          {(checkingGlb || glbCheckError || glbCheck || variant.glbAssetUrl) && (
            <div className="rounded-lg border border-dizajno-border bg-dizajno-bg/40 px-3 py-3 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-[11px] font-medium uppercase tracking-label text-dizajno-muted flex items-center gap-1.5">
                  <Ruler size={11} />
                  Model check
                </p>
                <div className="flex gap-1.5">
                  {/* Also gated on the upload mutations: while a just-picked
                      file is still uploading, glbAssetUrl points at the OLD
                      asset — measuring it would overwrite the new file's
                      stats and preview with stale ones. */}
                  {variant.glbAssetUrl &&
                    !checkingGlb &&
                    !attachGlb.isPending &&
                    !detachGlb.isPending && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => void checkCurrentGlb()}>
                      Measure current model
                    </Button>
                  )}
                  {previewUrl && typedDims && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      leftIcon={<Eye />}
                      onClick={() => setPreviewOpen((v) => !v)}
                    >
                      {previewOpen ? "Hide preview" : "Preview"}
                    </Button>
                  )}
                </div>
              </div>

              {checkingGlb && (
                <div className="flex items-center gap-2 text-[12.5px] text-dizajno-muted">
                  <Spinner size={12} /> Analyzing model…
                </div>
              )}

              {glbCheckError && (
                <div className="rounded-md border border-dizajno-danger/30 bg-dizajno-danger-soft px-3 py-2 text-[12.5px] text-dizajno-danger">
                  {glbCheckError}
                </div>
              )}

              {glbCheck && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[12.5px] text-dizajno-text-subtle">
                    <div>
                      <span className="text-dizajno-muted">Bounding box: </span>
                      <span className="font-mono">
                        {glbCheck.size.map((v) => v.toFixed(3)).join(" × ")}
                      </span>{" "}
                      <span className="text-dizajno-muted">(file units, X×Y×Z)</span>
                    </div>
                    <div>
                      <span className="text-dizajno-muted">Triangles: </span>
                      <span className="font-mono">{glbCheck.triangleCount.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-dizajno-muted">Materials: </span>
                      <span className="font-mono">
                        {glbCheck.materialNames.length > 0
                          ? glbCheck.materialNames.join(", ")
                          : "none named"}
                      </span>
                    </div>
                  </div>

                  {glbWarnings.length > 0 && (
                    <ul className="space-y-1">
                      {glbWarnings.map((w) => (
                        <li
                          key={w}
                          className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[12.5px] text-amber-600 dark:text-amber-400"
                        >
                          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                          <span>{w}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="flex gap-1.5 flex-wrap">
                    <Button type="button" variant="secondary" size="sm" onClick={applyMeasuredDims}>
                      Apply measured dimensions
                    </Button>
                    {glbCheck.materialNames.length > 0 && (
                      <Button type="button" variant="ghost" size="sm" onClick={addMaterialSlotsFromModel}>
                        Add material slots from model
                      </Button>
                    )}
                  </div>
                </>
              )}

              {previewOpen && previewUrl && typedDims && (
                <GlbPreview
                  url={previewUrl}
                  width={typedDims.width}
                  depth={typedDims.depth}
                  height={typedDims.height}
                />
              )}
            </div>
          )}

          <AssetSlot
            label="SVG preview"
            icon={<ImageIcon />}
            currentUrl={variant.svgPreviewAssetUrl}
            currentId={variant.svgPreviewAssetId}
            accept="image/svg+xml,.svg"
            uploading={attachPreview.isPending || detachPreview.isPending}
            onUpload={(file) => attachPreview.mutate(file)}
            onDetach={() => detachPreview.mutate()}
          />

          <TextureSlotsBinder supplierId={supplierId} variantId={variant.id} qc={qc} />

          {error && (
            <div className="rounded-lg border border-dizajno-danger/30 bg-dizajno-danger-soft px-3 py-2 text-[13px] text-dizajno-danger flex items-start justify-between gap-3">
              <span>{error}</span>
              <button
                onClick={() => setError(null)}
                className="text-dizajno-danger/70 hover:text-dizajno-danger text-[12px] font-medium shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-dizajno-border-subtle">
            {savedAt && (
              <span className="inline-flex items-center gap-1.5 text-[12.5px] text-dizajno-success">
                <Check size={14} /> Saved
              </span>
            )}
            <Button
              type="button"
              variant="primary"
              loading={save.isPending}
              onClick={() => {
                setError(null);
                save.mutate();
              }}
            >
              Save variant
            </Button>
          </div>
        </CardBody>
      </Card>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete variant?"
        description={`Variant "${variant.sku}" will be permanently removed. This will fail if any saved project scene still references it — hide the parent product instead if that's the case.`}
        confirmLabel="Delete variant"
        confirmTone="danger"
        busy={deleteVariant.isPending}
        onConfirm={() => deleteVariant.mutate()}
        onCancel={() => setDeleteOpen(false)}
      />
    </>
  );
}

// ── Color input ─────────────────────────────────────────────────────────────

function ColorInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-2 items-center">
      <label className="relative shrink-0 cursor-pointer">
        <span
          className="block w-9 h-9 rounded-md border border-dizajno-border shadow-card-sm"
          style={{ background: value }}
        />
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
      </label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="font-mono"
        placeholder="#999999"
      />
    </div>
  );
}

// ── Asset slot ──────────────────────────────────────────────────────────────

function AssetSlot({
  label,
  icon,
  currentUrl,
  currentId,
  accept,
  uploading,
  onUpload,
  onDetach,
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
    <div>
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-label text-dizajno-muted mb-2">
        <span className="[&_svg]:size-3.5">{icon}</span>
        {label}
      </div>
      <div className="rounded-lg border border-dizajno-border bg-dizajno-bg/40 px-3 py-2.5 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          {currentUrl ? (
            <a
              href={currentUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[12px] text-dizajno-accent hover:underline break-all font-mono"
            >
              {currentUrl}
            </a>
          ) : (
            <span className="text-[12.5px] text-dizajno-muted">Not set</span>
          )}
        </div>
        <div className="flex gap-1.5 shrink-0">
          <label className="inline-flex">
            <span
              className={[
                "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border text-[12px] font-medium transition-colors cursor-pointer",
                uploading
                  ? "border-dizajno-border bg-dizajno-elevated text-dizajno-muted cursor-wait"
                  : "border-dizajno-border bg-dizajno-surface hover:bg-dizajno-elevated text-dizajno-text-subtle hover:text-dizajno-text",
              ].join(" ")}
            >
              {uploading ? <Spinner size={12} /> : <Upload size={12} />}
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
            </span>
          </label>
          {currentId && (
            <Tooltip content="Detach">
              <IconButton variant="danger" size="sm" onClick={onDetach}>
                <X />
              </IconButton>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Collision boxes ─────────────────────────────────────────────────────────

type CollisionRow = {
  offsetX: string;
  offsetZ: string;
  width: string;
  depth: string;
};

function CollisionBoxesEditor({
  rows,
  onChange,
}: {
  rows: CollisionRow[];
  onChange: (rows: CollisionRow[]) => void;
}) {
  function updateRow(index: number, key: keyof CollisionRow, val: string) {
    onChange(rows.map((r, i) => (i === index ? { ...r, [key]: val } : r)));
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <p className="text-[11px] font-medium uppercase tracking-label text-dizajno-muted">
          Collision sub-boxes
        </p>
        <p className="text-[12px] text-dizajno-muted">
          Leave empty for rectangular furniture — width × depth is used by default.
        </p>
      </div>
      <div className="rounded-lg border border-dizajno-border bg-dizajno-bg/40 px-3 py-3 space-y-2">
        {rows.length === 0 && (
          <p className="text-[12.5px] text-dizajno-muted">
            No sub-boxes. Add one if the visible model is L-shaped or curved.
          </p>
        )}
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-center">
            <Input
              size="sm"
              type="number"
              step="0.01"
              placeholder="offsetX"
              value={r.offsetX}
              onChange={(e) => updateRow(i, "offsetX", e.target.value)}
              className="font-mono"
            />
            <Input
              size="sm"
              type="number"
              step="0.01"
              placeholder="offsetZ"
              value={r.offsetZ}
              onChange={(e) => updateRow(i, "offsetZ", e.target.value)}
              className="font-mono"
            />
            <Input
              size="sm"
              type="number"
              step="0.01"
              placeholder="width"
              value={r.width}
              onChange={(e) => updateRow(i, "width", e.target.value)}
              className="font-mono"
            />
            <Input
              size="sm"
              type="number"
              step="0.01"
              placeholder="depth"
              value={r.depth}
              onChange={(e) => updateRow(i, "depth", e.target.value)}
              className="font-mono"
            />
            <Tooltip content="Remove sub-box">
              <IconButton
                variant="danger"
                size="sm"
                onClick={() => onChange(rows.filter((_, j) => j !== i))}
              >
                <Trash2 />
              </IconButton>
            </Tooltip>
          </div>
        ))}
        <div className="pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            leftIcon={<Plus />}
            onClick={() =>
              onChange([
                ...rows,
                { offsetX: "0", offsetZ: "0", width: "1", depth: "1" },
              ])
            }
          >
            Add sub-box
          </Button>
        </div>
      </div>
    </div>
  );
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
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <p className="text-[11px] font-medium uppercase tracking-label text-dizajno-muted flex items-center gap-1.5">
          <Palette size={11} />
          Material slot defaults
        </p>
        <p className="text-[12px] text-dizajno-muted">
          One hex per named material in the GLB (e.g. Body, Pillows, Legs).
        </p>
      </div>
      <div className="rounded-lg border border-dizajno-border bg-dizajno-bg/40 px-3 py-3 space-y-2">
        {rows.length === 0 && (
          <p className="text-[12.5px] text-dizajno-muted">
            No slots. Surfaces in the customizer&apos;s color picker.
          </p>
        )}
        {rows.map((r, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_minmax(11rem,12rem)_auto] gap-2 items-center"
          >
            <Input
              size="sm"
              value={r.slot}
              onChange={(e) =>
                onChange(
                  rows.map((x, j) => (j === i ? { ...x, slot: e.target.value } : x)),
                )
              }
              placeholder="Slot name (e.g. Body)"
            />
            <ColorInput
              value={r.color}
              onChange={(v) =>
                onChange(
                  rows.map((x, j) => (j === i ? { ...x, color: v } : x)),
                )
              }
            />
            <Tooltip content="Remove slot">
              <IconButton
                variant="danger"
                size="sm"
                onClick={() => onChange(rows.filter((_, j) => j !== i))}
              >
                <Trash2 />
              </IconButton>
            </Tooltip>
          </div>
        ))}
        <div className="pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            leftIcon={<Plus />}
            onClick={() =>
              onChange([...rows, { slot: "", color: "#888888" }])
            }
          >
            Add slot
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Texture slot bindings ───────────────────────────────────────────────────

function TextureSlotsBinder({
  supplierId,
  variantId,
  qc,
}: {
  supplierId: string;
  variantId: string;
  qc: ReturnType<typeof useQueryClient>;
}) {
  const slots = useQuery({
    queryKey: ["supplier", "variant", variantId, "texture-slots"],
    queryFn: () => api.listVariantTextureSlots(variantId),
  });
  const textures = useQuery({
    queryKey: ["supplier", supplierId, "textures"],
    queryFn: () => api.listSupplierTextures(supplierId),
  });

  const [draft, setDraft] = useState<
    { slotName: string; supplierTextureId: string; isDefault: boolean }[]
  >([]);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (slots.data) {
      setDraft(
        slots.data.map((s) => ({
          slotName: s.slotName,
          supplierTextureId: s.supplierTextureId,
          isDefault: s.isDefault,
        })),
      );
    }
  }, [slots.data]);

  const save = useMutation({
    mutationFn: () => {
      const cleaned = draft.filter(
        (r) => r.slotName.trim() && r.supplierTextureId,
      );
      return api.replaceVariantTextureSlots(variantId, cleaned);
    },
    onSuccess: () => {
      setSaveError(null);
      qc.invalidateQueries({
        queryKey: ["supplier", "variant", variantId, "texture-slots"],
      });
    },
    onError: (e: Error) => setSaveError(e.message),
  });

  const labelRow = useMemo(
    () => (
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <p className="text-[11px] font-medium uppercase tracking-label text-dizajno-muted flex items-center gap-1.5">
          <Layers size={11} />
          Texture slot bindings
        </p>
        <p className="text-[12px] text-dizajno-muted">
          Maps slot names to textures from your library.
        </p>
      </div>
    ),
    [],
  );

  if (textures.isLoading || slots.isLoading) {
    return (
      <div>
        {labelRow}
        <div className="rounded-lg border border-dizajno-border bg-dizajno-bg/40 px-3 py-3 flex items-center gap-2 text-[12.5px] text-dizajno-muted">
          <Spinner size={12} /> Loading textures…
        </div>
      </div>
    );
  }
  if (!textures.data || textures.data.length === 0) {
    return (
      <div>
        {labelRow}
        <div className="rounded-lg border border-dashed border-dizajno-border bg-dizajno-bg/40 px-3 py-4 text-[12.5px] text-dizajno-muted text-center">
          No textures in the library yet.{" "}
          <a
            href={`/supplier/${supplierId}/textures`}
            className="text-dizajno-accent hover:underline font-medium"
          >
            Upload some via the Textures tab
          </a>{" "}
          to bind them here.
        </div>
      </div>
    );
  }

  return (
    <div>
      {labelRow}
      <div className="rounded-lg border border-dizajno-border bg-dizajno-bg/40 px-3 py-3 space-y-2">
        {draft.length === 0 && (
          <p className="text-[12.5px] text-dizajno-muted">
            No bindings yet. Add one per (slot, texture) pair; mark one default
            per slot.
          </p>
        )}
        {draft.map((row, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center"
          >
            <Input
              size="sm"
              value={row.slotName}
              onChange={(e) =>
                setDraft(
                  draft.map((r, j) =>
                    j === i ? { ...r, slotName: e.target.value } : r,
                  ),
                )
              }
              placeholder="Slot (e.g. Body)"
            />
            <Select
              size="sm"
              value={row.supplierTextureId}
              onChange={(e) =>
                setDraft(
                  draft.map((r, j) =>
                    j === i ? { ...r, supplierTextureId: e.target.value } : r,
                  ),
                )
              }
            >
              <option value="">— Pick texture —</option>
              {textures.data!.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
            <label className="inline-flex items-center gap-1.5 text-[11.5px] text-dizajno-muted whitespace-nowrap select-none cursor-pointer">
              <input
                type="checkbox"
                checked={row.isDefault}
                onChange={(e) =>
                  setDraft(
                    draft.map((r, j) =>
                      j === i ? { ...r, isDefault: e.target.checked } : r,
                    ),
                  )
                }
                className="w-3.5 h-3.5 rounded border-dizajno-border text-dizajno-accent focus:ring-dizajno-accent/40"
              />
              Default
            </label>
            <Tooltip content="Remove binding">
              <IconButton
                variant="danger"
                size="sm"
                onClick={() => setDraft(draft.filter((_, j) => j !== i))}
              >
                <Trash2 />
              </IconButton>
            </Tooltip>
          </div>
        ))}
        {saveError && (
          <div className="rounded-md border border-dizajno-danger/30 bg-dizajno-danger-soft px-3 py-1.5 text-[12px] text-dizajno-danger">
            {saveError}
          </div>
        )}
        <div className="flex items-center justify-between gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            leftIcon={<Plus />}
            onClick={() =>
              setDraft([
                ...draft,
                { slotName: "", supplierTextureId: "", isDefault: false },
              ])
            }
          >
            Add binding
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={save.isPending}
            onClick={() => save.mutate()}
          >
            Save bindings
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Parse / serialise helpers (unchanged from previous version) ─────────────

function parseCollisionBoxes(json: string | null): CollisionRow[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return [];
    return arr.map(
      (b: {
        offsetX: number;
        offsetZ: number;
        width: number;
        depth: number;
      }) => ({
        offsetX: String(b.offsetX),
        offsetZ: String(b.offsetZ),
        width: String(b.width),
        depth: String(b.depth),
      }),
    );
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

function parseMaterialDefaults(json: string | null): MaterialRow[] {
  if (!json) return [];
  try {
    const obj = JSON.parse(json);
    if (typeof obj !== "object" || obj === null) return [];
    return Object.entries(obj).map(([slot, color]) => ({
      slot,
      color: String(color),
    }));
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
