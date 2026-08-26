"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Boxes,
  EyeOff,
  Pencil,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import * as api from "@/lib/api";
import {
  ApiErrorAlert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  IconButton,
  PageHeader,
  SearchInput,
  Select,
  Skeleton,
  Tooltip,
} from "@/components/ui";

type StatusFilter = api.ProductStatus | "All";

export default function SupplierProductsPage() {
  const params = useParams<{ supplierId: string }>();
  const supplierId = params.supplierId;
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [search, setSearch] = useState("");
  const [removeTarget, setRemoveTarget] = useState<api.SupplierProductSummary | null>(
    null,
  );
  const [actionError, setActionError] = useState<unknown>(null);

  const products = useQuery({
    queryKey: ["supplier", supplierId, "products", statusFilter, search],
    queryFn: () =>
      api.listSupplierProducts({
        supplierId,
        status: statusFilter === "All" ? undefined : statusFilter,
        search: search || undefined,
      }),
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["supplier", supplierId, "products"] });
  }
  // Shown in the dismissible alert above the list; the global toast net
  // stands down for these via `meta.errorHandled`.
  function handleError(error: unknown) {
    setActionError(error);
  }

  const publish = useMutation({
    mutationFn: (id: string) => api.publishSupplierProduct(id),
    onSuccess: invalidate,
    meta: { errorHandled: true },
    onError: handleError,
  });
  const hide = useMutation({
    mutationFn: (id: string) => api.hideSupplierProduct(id),
    onSuccess: invalidate,
    meta: { errorHandled: true },
    onError: handleError,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.removeSupplierProduct(id),
    onSuccess: () => {
      invalidate();
      setRemoveTarget(null);
    },
    meta: { errorHandled: true },
    onError: handleError,
  });

  return (
    <>
      <PageHeader
        eyebrow="Catalog"
        title="Products"
        description="Manage your published catalog, drafts, and items still under admin review."
        actions={
          <Link href={`/supplier/${supplierId}/products/new`}>
            <Button variant="primary" leftIcon={<Plus />}>
              New product
            </Button>
          </Link>
        }
        bottom={
          <div className="flex items-center gap-3 flex-wrap">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search by name or slug"
              className="w-72"
            />
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="w-44"
            >
              <option value="All">All statuses</option>
              <option value="Draft">Draft</option>
              <option value="Pending">Pending review</option>
              <option value="Published">Published</option>
              <option value="Hidden">Hidden</option>
            </Select>
          </div>
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

        {products.isLoading && (
          <Card flush>
            <ul className="divide-y divide-dizajno-border">
              {[0, 1, 2, 3].map((i) => (
                <li key={i} className="px-5 py-4 flex items-center gap-4">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-4 w-16 ml-auto" />
                </li>
              ))}
            </ul>
          </Card>
        )}

        {products.error && (
          <ErrorState
            error={products.error}
            action="load your products"
            onRetry={() => void products.refetch()}
          />
        )}

        {products.data && products.data.length === 0 && (
          <EmptyState
            icon={<Boxes />}
            title={
              search || statusFilter !== "All"
                ? "No products match this filter"
                : "Your catalog is empty"
            }
            description={
              search || statusFilter !== "All"
                ? "Try a different search term or status."
                : "Add your first product — variants, GLB files, and material slots all in one place."
            }
            action={
              !search && statusFilter === "All" ? (
                <Link href={`/supplier/${supplierId}/products/new`}>
                  <Button variant="primary" leftIcon={<Plus />}>
                    New product
                  </Button>
                </Link>
              ) : undefined
            }
          />
        )}

        {products.data && products.data.length > 0 && (
          <Card flush>
            <ul className="divide-y divide-dizajno-border">
              {products.data.map((p) => (
                <li
                  key={p.id}
                  className="group flex items-center gap-4 px-5 py-4 hover:bg-dizajno-bg/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/supplier/${supplierId}/products/${p.id}`}
                        className="text-[14px] font-medium text-dizajno-text truncate hover:text-dizajno-accent transition-colors"
                      >
                        {p.name}
                      </Link>
                      <StatusBadge status={p.status} />
                    </div>
                    <p className="mt-1 text-[12px] text-dizajno-muted truncate">
                      <span className="font-mono">/{p.slug}</span>
                      <span className="mx-1.5 text-dizajno-muted-subtle">·</span>
                      <span>{p.family}</span>
                      <span className="mx-1.5 text-dizajno-muted-subtle">·</span>
                      <span>{p.categoryName}</span>
                      <span className="mx-1.5 text-dizajno-muted-subtle">·</span>
                      <span>
                        {p.variantCount} variant
                        {p.variantCount === 1 ? "" : "s"}
                      </span>
                      {p.basePrice != null && (
                        <>
                          <span className="mx-1.5 text-dizajno-muted-subtle">·</span>
                          <span className="font-mono text-dizajno-text-subtle">
                            {formatPrice(p.basePrice, p.currency)}
                          </span>
                        </>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Tooltip content="Edit">
                      <Link href={`/supplier/${supplierId}/products/${p.id}`}>
                        <IconButton variant="ghost" size="sm">
                          <Pencil />
                        </IconButton>
                      </Link>
                    </Tooltip>
                    {(p.status === "Draft" || p.status === "Hidden") && (
                      <Tooltip
                        content={
                          p.status === "Draft"
                            ? "Publish (may go to review)"
                            : "Re-publish"
                        }
                      >
                        <IconButton
                          variant="ghost"
                          size="sm"
                          onClick={() => publish.mutate(p.id)}
                          disabled={publish.isPending}
                          className="hover:text-dizajno-accent"
                        >
                          <Send />
                        </IconButton>
                      </Tooltip>
                    )}
                    {(p.status === "Published" || p.status === "Pending") && (
                      <Tooltip content="Hide from catalog">
                        <IconButton
                          variant="ghost"
                          size="sm"
                          onClick={() => hide.mutate(p.id)}
                          disabled={hide.isPending}
                          className="hover:text-dizajno-warning"
                        >
                          <EyeOff />
                        </IconButton>
                      </Tooltip>
                    )}
                    {p.status !== "Published" && p.status !== "Pending" && (
                      <Tooltip content="Remove (terminal)">
                        <IconButton
                          variant="danger"
                          size="sm"
                          onClick={() => setRemoveTarget(p)}
                        >
                          <Trash2 />
                        </IconButton>
                      </Tooltip>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <ConfirmDialog
        open={!!removeTarget}
        title="Remove product?"
        description={
          removeTarget
            ? `"${removeTarget.name}" will be permanently removed. Historical quotes already snapshot the variant data so past orders survive.`
            : ""
        }
        confirmLabel="Remove product"
        confirmTone="danger"
        busy={remove.isPending}
        onConfirm={() => removeTarget && remove.mutate(removeTarget.id)}
        onCancel={() => setRemoveTarget(null)}
      />
    </>
  );
}

function StatusBadge({ status }: { status: api.ProductStatus }) {
  const map = {
    Draft: { tone: "neutral", label: "Draft" },
    Pending: { tone: "warning", label: "Pending review" },
    Published: { tone: "success", label: "Published" },
    Hidden: { tone: "outline", label: "Hidden" },
    Removed: { tone: "danger", label: "Removed" },
  } as const;
  const entry = map[status];
  return (
    <Badge tone={entry.tone} size="sm" dot>
      {entry.label}
    </Badge>
  );
}

function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-EU", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
