"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  ChevronRight,
  Plus,
  RotateCcw,
  ShieldCheck,
  ShieldOff,
  Store,
} from "lucide-react";
import * as api from "@/lib/api";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  FormField,
  IconButton,
  Input,
  Modal,
  PageHeader,
  SearchInput,
  Skeleton,
  Textarea,
  Tooltip,
} from "@/components/ui";

export default function AdminSuppliersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [suspendTarget, setSuspendTarget] = useState<api.AdminSupplierListItem | null>(
    null,
  );

  const suppliers = useQuery({
    queryKey: ["admin", "suppliers", { search }],
    queryFn: () => api.listAdminSuppliers({ search: search || undefined }),
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["admin", "suppliers"] });
  }
  const suspend = useMutation({
    mutationFn: (id: string) => api.suspendSupplier(id),
    onSuccess: () => {
      invalidate();
      setSuspendTarget(null);
    },
  });
  const restore = useMutation({
    mutationFn: (id: string) => api.restoreSupplier(id),
    onSuccess: invalidate,
  });
  const trust = useMutation({
    mutationFn: (id: string) => api.trustSupplier(id),
    onSuccess: invalidate,
  });
  const untrust = useMutation({
    mutationFn: (id: string) => api.untrustSupplier(id),
    onSuccess: invalidate,
  });

  return (
    <>
      <PageHeader
        eyebrow="Marketplace"
        title="Suppliers"
        description="Curate the suppliers that show up in the catalog. Suspended suppliers vanish from buyers; trusted suppliers' new products auto-publish without review."
        actions={
          <Button
            variant="primary"
            leftIcon={<Plus />}
            onClick={() => setShowCreate(true)}
          >
            New supplier
          </Button>
        }
        bottom={
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by name or slug"
            className="w-80"
          />
        }
      />

      <section className="py-6">
        {suppliers.isLoading && (
          <Card flush>
            <ul className="divide-y divide-dizajno-border">
              {[0, 1, 2].map((i) => (
                <li key={i} className="px-5 py-4 flex items-center gap-4">
                  <Skeleton shape="circle" className="w-9 h-9" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {suppliers.error && (
          <div className="rounded-xl border border-dizajno-danger/30 bg-dizajno-danger-soft px-4 py-3 text-[13px] text-dizajno-danger">
            {(suppliers.error as Error).message}
          </div>
        )}

        {suppliers.data && suppliers.data.length === 0 && (
          <EmptyState
            icon={<Store />}
            title={search ? "No suppliers match" : "No suppliers yet"}
            description={
              search
                ? "Try a different search term."
                : "Create the first supplier — once it has at least one product, it shows up in the catalog filter."
            }
            action={
              !search ? (
                <Button
                  variant="primary"
                  leftIcon={<Plus />}
                  onClick={() => setShowCreate(true)}
                >
                  New supplier
                </Button>
              ) : undefined
            }
          />
        )}

        {suppliers.data && suppliers.data.length > 0 && (
          <Card flush>
            <ul className="divide-y divide-dizajno-border">
              {suppliers.data.map((s) => (
                <li
                  key={s.id}
                  className="group flex items-center gap-4 px-5 py-4 hover:bg-dizajno-bg/40 transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-dizajno-elevated text-dizajno-muted flex items-center justify-center shrink-0">
                    <Store size={16} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/admin/suppliers/${s.id}`}
                        className="text-[14px] font-medium text-dizajno-text truncate hover:text-dizajno-accent transition-colors"
                      >
                        {s.name}
                      </Link>
                      {s.isTrusted && (
                        <Badge tone="success" size="sm" dot>
                          Trusted
                        </Badge>
                      )}
                      {s.suspendedAt && (
                        <Badge tone="danger" size="sm" dot>
                          Suspended
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-[12px] text-dizajno-muted truncate">
                      <span className="font-mono">/{s.slug}</span>
                      <span className="mx-1.5 text-dizajno-muted-subtle">·</span>
                      {s.productCount} product{s.productCount === 1 ? "" : "s"}
                      <span className="mx-1.5 text-dizajno-muted-subtle">·</span>
                      {s.memberCount} member{s.memberCount === 1 ? "" : "s"}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {s.isTrusted ? (
                      <Tooltip content="Untrust — new products will go through review">
                        <IconButton
                          variant="ghost"
                          size="sm"
                          onClick={() => untrust.mutate(s.id)}
                          className="hover:text-dizajno-warning"
                        >
                          <ShieldOff />
                        </IconButton>
                      </Tooltip>
                    ) : (
                      <Tooltip content="Trust — new products auto-publish">
                        <IconButton
                          variant="ghost"
                          size="sm"
                          onClick={() => trust.mutate(s.id)}
                          className="hover:text-dizajno-success"
                        >
                          <ShieldCheck />
                        </IconButton>
                      </Tooltip>
                    )}
                    {s.suspendedAt ? (
                      <Tooltip content="Restore">
                        <IconButton
                          variant="ghost"
                          size="sm"
                          onClick={() => restore.mutate(s.id)}
                          className="hover:text-dizajno-success"
                        >
                          <RotateCcw />
                        </IconButton>
                      </Tooltip>
                    ) : (
                      <Tooltip content="Suspend">
                        <IconButton
                          variant="danger"
                          size="sm"
                          onClick={() => setSuspendTarget(s)}
                        >
                          <Ban />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Link href={`/admin/suppliers/${s.id}`}>
                      <IconButton variant="ghost" size="sm">
                        <ChevronRight />
                      </IconButton>
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      {showCreate && (
        <CreateSupplierModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            invalidate();
          }}
        />
      )}

      <ConfirmDialog
        open={!!suspendTarget}
        title="Suspend supplier?"
        description={
          suspendTarget
            ? `"${suspendTarget.name}" will be hidden from the catalog, all members will lose portal access, and any pending quote requests for them auto-expire with reason "supplier_suspended".`
            : ""
        }
        confirmLabel="Suspend"
        confirmTone="danger"
        busy={suspend.isPending}
        onConfirm={() => suspendTarget && suspend.mutate(suspendTarget.id)}
        onCancel={() => setSuspendTarget(null)}
      />
    </>
  );
}

function CreateSupplierModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      api.createAdminSupplier({
        slug: slug.trim().toLowerCase(),
        name: name.trim(),
        description: description.trim() || null,
      }),
    onSuccess: () => onCreated(),
    onError: (e: Error) => setError(e.message),
  });

  return (
    <Modal
      open={true}
      onClose={onClose}
      title="New supplier"
      description="Suppliers start untrusted — new products land in moderation. Toggle trust on the supplier list once they're vetted."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="supplier-create-form"
            variant="primary"
            loading={create.isPending}
          >
            Create
          </Button>
        </>
      }
    >
      <form
        id="supplier-create-form"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          create.mutate();
        }}
        className="space-y-3"
      >
        <FormField label="Slug" hint="URL-safe, lowercase, dashes" required>
          <Input
            required
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="acme-furniture"
            pattern="^[a-z0-9-]+$"
            className="font-mono"
          />
        </FormField>
        <FormField label="Display name" required>
          <Input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme Furniture"
          />
        </FormField>
        <FormField label="Description" hint="Optional">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </FormField>
        {error && (
          <div className="rounded-lg border border-dizajno-danger/30 bg-dizajno-danger-soft px-3 py-2 text-[13px] text-dizajno-danger">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}
