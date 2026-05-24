"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Upload } from "lucide-react";
import * as api from "@/lib/api";

/**
 * Supplier-owned texture library. Each texture references an Asset of
 * kind Image; suppliers upload the image, give it a name + tags + repeat
 * settings, and then bind it to variant slots from the product editor.
 *
 * Deletion is refused if any slot binding still references the texture —
 * surfaces a clear 409 message from the backend rather than a cryptic FK
 * error.
 */
export default function SupplierTexturesPage() {
  const params = useParams<{ supplierId: string }>();
  const supplierId = params.supplierId;
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const textures = useQuery({
    queryKey: ["supplier", supplierId, "textures"],
    queryFn: () => api.listSupplierTextures(supplierId),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteSupplierTexture(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["supplier", supplierId, "textures"] }),
    onError: (e: Error) => alert(e.message),
  });

  return (
    <>
      <div className="flex items-center justify-between gap-4 mb-6">
        <p className="font-mono text-[10px] tracking-widest text-dizajno-muted uppercase">
          {textures.data?.length ?? 0} textures
        </p>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 font-mono text-xs tracking-widest uppercase text-emerald-300 hover:bg-emerald-500/20 transition"
        >
          <Plus size={12} /> New texture
        </button>
      </div>

      {textures.isLoading && (
        <p className="font-mono text-sm text-dizajno-muted">Loading…</p>
      )}

      {textures.data && textures.data.length === 0 && (
        <p className="font-mono text-sm text-dizajno-muted">
          No textures yet. Upload your first finish to start binding it to variant slots.
        </p>
      )}

      {textures.data && textures.data.length > 0 && (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {textures.data.map((t) => (
            <li
              key={t.id}
              className="rounded border border-white/10 bg-black/30 overflow-hidden hover:border-white/20 transition"
            >
              <div className="aspect-square relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={t.thumbnailAssetUrl ?? t.assetUrl}
                  alt={t.name}
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
              <div className="px-3 py-2 border-t border-white/5">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-sm text-dizajno-text truncate">{t.name}</p>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Delete texture "${t.name}"?`)) remove.mutate(t.id);
                    }}
                    className="rounded border border-white/10 px-2 py-1 text-dizajno-muted hover:text-red-300 hover:border-red-500/40 transition"
                    title={t.slotBindingCount > 0
                      ? `Bound to ${t.slotBindingCount} variant slot(s) — remove bindings first.`
                      : "Delete"}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                <p className="font-mono text-[10px] tracking-widest text-dizajno-muted uppercase mt-1">
                  repeat {t.repeatU}×{t.repeatV}
                  {t.slotBindingCount > 0 ? ` · used by ${t.slotBindingCount} slot${t.slotBindingCount === 1 ? "" : "s"}` : ""}
                </p>
                {t.tags.length > 0 && (
                  <p className="font-mono text-[10px] text-dizajno-muted mt-1 truncate">
                    {t.tags.join(", ")}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {showCreate && (
        <CreateTextureModal
          supplierId={supplierId}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            qc.invalidateQueries({ queryKey: ["supplier", supplierId, "textures"] });
          }}
        />
      )}
    </>
  );
}

function CreateTextureModal({
  supplierId,
  onClose,
  onCreated,
}: {
  supplierId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [tags, setTags] = useState("");
  const [repeatU, setRepeatU] = useState(4);
  const [repeatV, setRepeatV] = useState(4);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) {
      setError("Pick an image file first.");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const asset = await api.uploadSupplierFile(supplierId, file, "Image");
      await api.createSupplierTexture({
        supplierId,
        name: name.trim(),
        assetId: asset.id,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        repeatU,
        repeatV,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded border border-white/15 bg-dizajno-bg px-6 py-6 space-y-4"
      >
        <h2 className="font-mono text-sm tracking-widest text-dizajno-text uppercase">
          New texture
        </h2>

        <label className="block space-y-1">
          <span className="font-mono text-[10px] tracking-widest text-dizajno-muted uppercase">
            Image
          </span>
          <div className="flex items-center gap-2 rounded border border-white/10 bg-black/30 px-3 py-2">
            <Upload size={14} className="text-dizajno-muted" />
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              required
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="flex-1 font-mono text-xs text-dizajno-text file:hidden"
            />
          </div>
          {file && (
            <p className="font-mono text-[10px] text-dizajno-muted mt-1">
              {file.name} · {Math.round(file.size / 1024)} KB
            </p>
          )}
        </label>

        <label className="block space-y-1">
          <span className="font-mono text-[10px] tracking-widest text-dizajno-muted uppercase">
            Name
          </span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Walnut"
            className="portal-input"
          />
        </label>

        <label className="block space-y-1">
          <span className="font-mono text-[10px] tracking-widest text-dizajno-muted uppercase">
            Tags (comma-separated)
          </span>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="wood, dark, matte"
            className="portal-input"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="font-mono text-[10px] tracking-widest text-dizajno-muted uppercase">
              Repeat U
            </span>
            <input
              type="number"
              min={1}
              max={32}
              value={repeatU}
              onChange={(e) => setRepeatU(Number(e.target.value))}
              className="portal-input"
            />
          </label>
          <label className="block space-y-1">
            <span className="font-mono text-[10px] tracking-widest text-dizajno-muted uppercase">
              Repeat V
            </span>
            <input
              type="number"
              min={1}
              max={32}
              value={repeatV}
              onChange={(e) => setRepeatV(Number(e.target.value))}
              className="portal-input"
            />
          </label>
        </div>

        {error && <p className="font-mono text-xs text-red-400 break-words">{error}</p>}

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
            disabled={uploading}
            className="rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 font-mono text-xs tracking-widest uppercase text-emerald-300 hover:bg-emerald-500/20 transition disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </div>
      </form>
    </div>
  );
}
