"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageOff, Palette, Plus, Trash2, Upload } from "lucide-react";
import * as api from "@/lib/api";
import {
  ApiErrorAlert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FormField,
  IconButton,
  Input,
  Modal,
  PageHeader,
  Skeleton,
  Tooltip,
} from "@/components/ui";

export default function SupplierTexturesPage() {
  const params = useParams<{ supplierId: string }>();
  const supplierId = params.supplierId;
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<api.SupplierTextureRow | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);

  const textures = useQuery({
    queryKey: ["supplier", supplierId, "textures"],
    queryFn: () => api.listSupplierTextures(supplierId),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteSupplierTexture(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplier", supplierId, "textures"] });
      setDeleteTarget(null);
    },
    meta: { errorHandled: true },
    onError: setActionError,
  });

  return (
    <>
      <PageHeader
        eyebrow="Customizer"
        title="Texture library"
        description="Upload tileable images, name and tag them, then bind them to variant slots from the product editor."
        actions={
          <Button
            variant="primary"
            leftIcon={<Plus />}
            onClick={() => setShowCreate(true)}
          >
            New texture
          </Button>
        }
      />

      <section className="py-6">
        {actionError != null && (
          <ApiErrorAlert
            error={actionError}
            size="sm"
            className="mb-4"
            onDismiss={() => setActionError(null)}
          />
        )}

        {textures.error && (
          <ErrorState
            error={textures.error}
            action="load your texture library"
            onRetry={() => void textures.refetch()}
          />
        )}

        {textures.isLoading && (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <li key={i}>
                <Card flush>
                  <Skeleton className="aspect-square rounded-t-xl" />
                  <div className="px-4 py-3 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}

        {textures.data && textures.data.length === 0 && (
          <EmptyState
            icon={<Palette />}
            title="No textures uploaded yet"
            description="Add fabric, wood, paint, and finish swatches. Once they're in the library, you can bind them to material slots on any variant."
            action={
              <Button
                variant="primary"
                leftIcon={<Plus />}
                onClick={() => setShowCreate(true)}
              >
                Upload texture
              </Button>
            }
          />
        )}

        {textures.data && textures.data.length > 0 && (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {textures.data.map((t) => (
              <li key={t.id}>
                <Card flush className="overflow-hidden group hover:shadow-card transition-shadow">
                  <div className="aspect-square relative bg-dizajno-elevated border-b border-dizajno-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={t.thumbnailAssetUrl ?? t.assetUrl}
                      alt={t.name}
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={(e) => {
                        const img = e.currentTarget as HTMLImageElement;
                        img.style.display = "none";
                        const fallback = img.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = "flex";
                      }}
                    />
                    <div
                      style={{ display: "none" }}
                      className="absolute inset-0 items-center justify-center text-dizajno-muted-subtle flex-col gap-1.5"
                    >
                      <ImageOff size={20} strokeWidth={1.5} />
                      <span className="text-[10px] uppercase tracking-label font-medium">
                        Missing asset
                      </span>
                    </div>
                  </div>
                  <div className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13.5px] font-medium text-dizajno-text truncate">
                        {t.name}
                      </p>
                      <Tooltip
                        content={
                          t.slotBindingCount > 0
                            ? `Bound to ${t.slotBindingCount} variant slot${t.slotBindingCount === 1 ? "" : "s"}`
                            : "Delete texture"
                        }
                      >
                        <IconButton
                          variant="danger"
                          size="sm"
                          onClick={() => setDeleteTarget(t)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 />
                        </IconButton>
                      </Tooltip>
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                      <Badge tone="neutral" size="sm" mono>
                        {t.repeatU}×{t.repeatV}
                      </Badge>
                      {t.slotBindingCount > 0 && (
                        <Badge tone="accent" size="sm">
                          {t.slotBindingCount} binding
                          {t.slotBindingCount === 1 ? "" : "s"}
                        </Badge>
                      )}
                    </div>
                    {t.tags.length > 0 && (
                      <p className="mt-2 text-[11.5px] text-dizajno-muted truncate">
                        {t.tags.join(" · ")}
                      </p>
                    )}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {showCreate && (
        <CreateTextureModal
          supplierId={supplierId}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            qc.invalidateQueries({
              queryKey: ["supplier", supplierId, "textures"],
            });
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete texture?"
        description={
          deleteTarget
            ? deleteTarget.slotBindingCount > 0
              ? `"${deleteTarget.name}" is bound to ${deleteTarget.slotBindingCount} variant slot${deleteTarget.slotBindingCount === 1 ? "" : "s"}. Remove those bindings first.`
              : `"${deleteTarget.name}" will be removed from your library.`
            : ""
        }
        confirmLabel="Delete"
        confirmTone="danger"
        busy={remove.isPending}
        confirmDisabled={deleteTarget?.slotBindingCount ? deleteTarget.slotBindingCount > 0 : false}
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
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
  const [error, setError] = useState<unknown>(null);
  const [uploading, setUploading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) {
      setError(new Error("Pick an image file first."));
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
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        repeatU,
        repeatV,
      });
      onCreated();
    } catch (err) {
      setError(err);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Modal
      open={true}
      onClose={onClose}
      title="Upload texture"
      description="JPEG or PNG, tileable. Use repeats to control how often the image tiles across a surface."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={uploading}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="texture-upload-form"
            variant="primary"
            loading={uploading}
            leftIcon={!uploading ? <Upload /> : undefined}
          >
            {uploading ? "Uploading…" : "Upload"}
          </Button>
        </>
      }
    >
      <form
        id="texture-upload-form"
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <FormField label="Image file" required>
          <label className="block">
            <div className="relative rounded-lg border-2 border-dashed border-dizajno-border hover:border-dizajno-accent/50 transition-colors bg-dizajno-bg/40 px-4 py-6 cursor-pointer">
              <div className="flex flex-col items-center text-center">
                <Upload className="text-dizajno-muted mb-2" size={20} />
                <p className="text-[13px] font-medium text-dizajno-text">
                  {file ? file.name : "Choose an image"}
                </p>
                <p className="text-[11.5px] text-dizajno-muted mt-0.5">
                  {file
                    ? `${(file.size / 1024).toFixed(0)} KB`
                    : "PNG, JPEG, or WebP"}
                </p>
              </div>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                required
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </div>
          </label>
        </FormField>

        <FormField label="Name" required>
          <Input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Walnut veneer"
          />
        </FormField>

        <FormField label="Tags" hint="Comma-separated">
          <Input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="wood, dark, matte"
          />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Repeat U">
            <Input
              type="number"
              min={1}
              max={32}
              value={repeatU}
              onChange={(e) => setRepeatU(Number(e.target.value))}
            />
          </FormField>
          <FormField label="Repeat V">
            <Input
              type="number"
              min={1}
              max={32}
              value={repeatV}
              onChange={(e) => setRepeatV(Number(e.target.value))}
            />
          </FormField>
        </div>

        {error != null && (
          <ApiErrorAlert error={error} action="upload this texture" size="sm" />
        )}
      </form>
    </Modal>
  );
}
