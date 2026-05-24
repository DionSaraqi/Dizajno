"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Upload, X } from "lucide-react";
import * as api from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";

/**
 * Owner-only profile editor. Staff get bounced — Staff cannot reach this
 * route via the layout's nav, but URL-hackers see a 403 from the API and we
 * surface a polite message.
 *
 * Logo upload goes through the standard supplier-asset presign flow with
 * `kind = Image`; the asset id is stored on Supplier.LogoAssetId.
 */
export default function SupplierProfilePage() {
  const params = useParams<{ supplierId: string }>();
  const router = useRouter();
  const supplierId = params.supplierId;
  const user = useAuthStore((s) => s.user);
  const myMembership = user?.supplierMemberships.find((m) => m.supplierId === supplierId);
  const isOwner = myMembership?.role === "Owner";

  useEffect(() => {
    if (myMembership && !isOwner) {
      // Staff hit this via URL hack — bounce back to products.
      router.replace(`/supplier/${supplierId}/products`);
    }
  }, [myMembership, isOwner, supplierId, router]);

  const profile = useQuery({
    queryKey: ["supplier", supplierId, "profile"],
    queryFn: () => api.getSupplierProfile(supplierId),
    enabled: isOwner,
  });

  if (!isOwner) {
    return <p className="font-mono text-sm text-dizajno-muted">Redirecting…</p>;
  }
  if (profile.isLoading) {
    return <p className="font-mono text-sm text-dizajno-muted">Loading…</p>;
  }
  if (!profile.data) return null;
  return <ProfileForm supplierId={supplierId} initial={profile.data} />;
}

function ProfileForm({
  supplierId,
  initial,
}: {
  supplierId: string;
  initial: api.SupplierProfile;
}) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(initial.websiteUrl ?? "");
  const [contactEmail, setContactEmail] = useState(initial.contactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(initial.contactPhone ?? "");
  const [logoAssetId, setLogoAssetId] = useState<string | null>(initial.logoAssetId);
  const [logoUrl, setLogoUrl] = useState<string | null>(initial.logoAssetUrl);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!savedAt) return;
    const id = setTimeout(() => setSavedAt(null), 2500);
    return () => clearTimeout(id);
  }, [savedAt]);

  const save = useMutation({
    mutationFn: () =>
      api.updateSupplierProfile(supplierId, {
        name: name.trim(),
        description: description.trim() || null,
        websiteUrl: websiteUrl.trim() || null,
        contactEmail: contactEmail.trim() || null,
        contactPhone: contactPhone.trim() || null,
        logoAssetId,
      }),
    onSuccess: (dto) => {
      setSavedAt(Date.now());
      setLogoUrl(dto.logoAssetUrl);
    },
    onError: (e: Error) => setError(e.message),
  });

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const asset = await api.uploadSupplierFile(supplierId, file, "Image");
      setLogoAssetId(asset.id);
      setLogoUrl(asset.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        save.mutate();
      }}
      className="space-y-5 max-w-2xl"
    >
      <div className="rounded border border-white/10 bg-black/30 px-4 py-3 flex items-center gap-4">
        <div className="w-20 h-20 rounded border border-white/10 bg-black/40 overflow-hidden flex items-center justify-center">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
          ) : (
            <span className="font-mono text-[10px] text-dizajno-muted tracking-widest uppercase">
              No logo
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            className={`flex items-center gap-2 rounded border border-white/10 px-3 py-1.5 font-mono text-xs tracking-widest uppercase cursor-pointer transition ${
              uploading
                ? "text-dizajno-muted opacity-50 cursor-wait"
                : "text-dizajno-muted hover:text-emerald-300 hover:border-emerald-500/40"
            }`}
          >
            <Upload size={12} />
            {uploading ? "Uploading…" : logoUrl ? "Replace logo" : "Upload logo"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={uploading}
              onChange={handleLogoUpload}
              className="hidden"
            />
          </label>
          {logoAssetId && (
            <button
              type="button"
              onClick={() => {
                setLogoAssetId(null);
                setLogoUrl(null);
              }}
              className="flex items-center gap-1 self-start rounded border border-white/10 px-2 py-1 font-mono text-[10px] tracking-widest uppercase text-dizajno-muted hover:text-red-300 hover:border-red-500/40 transition"
            >
              <X size={10} /> Remove
            </button>
          )}
        </div>
      </div>

      <Field label="Display name">
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="portal-input"
        />
      </Field>

      <Field label={`Slug (immutable: ${initial.slug})`} />

      <Field label="Description">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="portal-input resize-none"
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Website">
          <input
            type="url"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://acme.example"
            className="portal-input"
          />
        </Field>
        <Field label="Contact email">
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            className="portal-input"
          />
        </Field>
      </div>

      <Field label="Contact phone">
        <input
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
          className="portal-input"
        />
      </Field>

      {(initial.isTrusted || initial.suspendedAt) && (
        <div className="rounded border border-white/10 bg-black/20 px-3 py-2 space-y-1 font-mono text-[11px] text-dizajno-muted">
          {initial.isTrusted && (
            <p>
              <span className="text-emerald-300">Trusted</span> — new products auto-publish without
              admin review.
            </p>
          )}
          {initial.suspendedAt && (
            <p>
              <span className="text-red-300">Suspended</span> since{" "}
              {new Date(initial.suspendedAt).toLocaleDateString()} — products hidden from catalog.
            </p>
          )}
        </div>
      )}

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
          {save.isPending ? "Saving…" : "Save profile"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="font-mono text-[10px] tracking-widest text-dizajno-muted uppercase">
        {label}
      </label>
      {children}
    </div>
  );
}
