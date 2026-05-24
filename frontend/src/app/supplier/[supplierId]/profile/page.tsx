"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Building2,
  Check,
  ShieldAlert,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import * as api from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import {
  Badge,
  Button,
  Card,
  CardBody,
  FormField,
  Input,
  PageHeader,
  Spinner,
  Textarea,
} from "@/components/ui";

export default function SupplierProfilePage() {
  const params = useParams<{ supplierId: string }>();
  const router = useRouter();
  const supplierId = params.supplierId;
  const user = useAuthStore((s) => s.user);
  const myMembership = user?.supplierMemberships.find(
    (m) => m.supplierId === supplierId,
  );
  const isOwner = myMembership?.role === "Owner";

  useEffect(() => {
    if (myMembership && !isOwner) {
      router.replace(`/supplier/${supplierId}/products`);
    }
  }, [myMembership, isOwner, supplierId, router]);

  const profile = useQuery({
    queryKey: ["supplier", supplierId, "profile"],
    queryFn: () => api.getSupplierProfile(supplierId),
    enabled: isOwner,
  });

  if (!isOwner) {
    return (
      <div className="py-16 flex items-center justify-center gap-2 text-dizajno-muted text-sm">
        <Spinner /> Redirecting…
      </div>
    );
  }
  if (profile.isLoading) {
    return (
      <div className="py-16 flex items-center justify-center gap-2 text-dizajno-muted text-sm">
        <Spinner /> Loading profile…
      </div>
    );
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
  const [logoAssetId, setLogoAssetId] = useState<string | null>(
    initial.logoAssetId,
  );
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
    <>
      <PageHeader
        eyebrow="Public face"
        title="Supplier profile"
        description="What buyers see in the catalog filter, the quote dialog, and on shared project pages."
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          save.mutate();
        }}
        className="py-6 max-w-3xl space-y-6"
      >
        {(initial.isTrusted || initial.suspendedAt) && (
          <div className="flex items-center gap-2 flex-wrap">
            {initial.isTrusted && (
              <Badge tone="success" dot>
                <ShieldCheck size={11} className="mr-1" />
                Trusted — products auto-publish
              </Badge>
            )}
            {initial.suspendedAt && (
              <Badge tone="danger" dot>
                <ShieldAlert size={11} className="mr-1" />
                Suspended since{" "}
                {new Date(initial.suspendedAt).toLocaleDateString()}
              </Badge>
            )}
          </div>
        )}

        <Card>
          <CardBody className="space-y-5">
            <div>
              <h3 className="text-[14px] font-semibold text-dizajno-text">
                Branding
              </h3>
              <p className="text-[12.5px] text-dizajno-muted mt-0.5">
                Square logo at 1:1 ratio works best. Used in the catalog and
                quote response views.
              </p>
            </div>
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-xl border border-dizajno-border bg-dizajno-elevated overflow-hidden flex items-center justify-center shrink-0">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Building2
                    size={24}
                    className="text-dizajno-muted-subtle"
                    strokeWidth={1.5}
                  />
                )}
              </div>
              <div className="flex flex-col gap-2 items-start">
                <label className="inline-flex">
                  <Button
                    variant="secondary"
                    leftIcon={uploading ? undefined : <Upload />}
                    loading={uploading}
                    type="button"
                    onClick={(e) => {
                      const input = (
                        e.currentTarget.parentElement as HTMLLabelElement
                      ).querySelector("input");
                      input?.click();
                    }}
                  >
                    {uploading
                      ? "Uploading…"
                      : logoUrl
                        ? "Replace logo"
                        : "Upload logo"}
                  </Button>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={uploading}
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </label>
                {logoAssetId && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    leftIcon={<X />}
                    onClick={() => {
                      setLogoAssetId(null);
                      setLogoUrl(null);
                    }}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-5">
            <div>
              <h3 className="text-[14px] font-semibold text-dizajno-text">
                Identity
              </h3>
              <p className="text-[12.5px] text-dizajno-muted mt-0.5">
                The slug is immutable — it lives in URLs and audit records.
              </p>
            </div>

            <FormField label="Display name" required>
              <Input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </FormField>

            <FormField label="Slug" hint="Immutable">
              <Input
                value={initial.slug}
                disabled
                className="font-mono"
              />
            </FormField>

            <FormField label="Description">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Short pitch buyers will read in the catalog filter."
              />
            </FormField>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-5">
            <div>
              <h3 className="text-[14px] font-semibold text-dizajno-text">
                Contact
              </h3>
              <p className="text-[12.5px] text-dizajno-muted mt-0.5">
                How buyers reach out for quote follow-ups.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Website">
                <Input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://acme.example"
                />
              </FormField>
              <FormField label="Contact email">
                <Input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="hello@acme.example"
                />
              </FormField>
            </div>

            <FormField label="Contact phone">
              <Input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+355 …"
              />
            </FormField>
          </CardBody>
        </Card>

        {error && (
          <div className="rounded-lg border border-dizajno-danger/30 bg-dizajno-danger-soft px-4 py-3 text-[13px] text-dizajno-danger">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          {savedAt && (
            <span className="inline-flex items-center gap-1.5 text-[12.5px] text-dizajno-success">
              <Check size={14} /> Saved
            </span>
          )}
          <Button type="submit" variant="primary" loading={save.isPending}>
            Save profile
          </Button>
        </div>
      </form>
    </>
  );
}
