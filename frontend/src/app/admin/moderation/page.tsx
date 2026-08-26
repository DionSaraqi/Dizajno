"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, FileQuestion, Sparkles, X } from "lucide-react";
import * as api from "@/lib/api";
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconButton,
  PageHeader,
  Skeleton,
  Tabs,
  Tooltip,
} from "@/components/ui";

type Tab = "products" | "categories";

export default function ModerationPage() {
  const [tab, setTab] = useState<Tab>("products");
  const productsCount = useQuery({
    queryKey: ["admin", "moderation", "products"],
    queryFn: () => api.listPendingProducts(),
  }).data?.length;
  const categoriesCount = useQuery({
    queryKey: ["admin", "moderation", "categories"],
    queryFn: () => api.listPendingCategories(),
  }).data?.length;

  return (
    <>
      <PageHeader
        eyebrow="Queue"
        title="Moderation"
        description="Review supplier-submitted products and category suggestions before they appear in the catalog."
        bottom={
          <Tabs
            value={tab}
            onChange={(v) => setTab(v as Tab)}
            tabs={[
              {
                value: "products",
                label: "Products",
                count: productsCount,
              },
              {
                value: "categories",
                label: "Categories",
                count: categoriesCount,
              },
            ]}
          />
        }
        divided={false}
      />
      <section className="py-6">
        {tab === "products" ? <PendingProducts /> : <PendingCategories />}
      </section>
    </>
  );
}

function PendingProducts() {
  const qc = useQueryClient();
  const products = useQuery({
    queryKey: ["admin", "moderation", "products"],
    queryFn: () => api.listPendingProducts(),
  });
  const approve = useMutation({
    mutationFn: (id: string) => api.approveProduct(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["admin", "moderation", "products"] }),
  });
  const reject = useMutation({
    mutationFn: (id: string) => api.rejectProduct(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["admin", "moderation", "products"] }),
  });

  if (products.isLoading) {
    return <QueueSkeleton />;
  }
  // Without this the list below renders empty, which reads as "nothing to
  // moderate" — the worst possible misreading of a failed fetch on a queue.
  if (products.error) {
    return (
      <ErrorState
        error={products.error}
        action="load the moderation queue"
        onRetry={() => void products.refetch()}
      />
    );
  }
  if (products.data?.length === 0) {
    return (
      <EmptyState
        icon={<Sparkles />}
        title="No pending products"
        description="When a supplier publishes a product, it shows up here. Approve to send live; reject to hide."
      />
    );
  }

  return (
    <Card flush>
      <ul className="divide-y divide-dizajno-border">
        {products.data?.map((p) => (
          <li key={p.id} className="px-5 py-4 flex items-center gap-4">
            <Avatar
              size={36}
              shape="square"
              fallback={p.name.slice(0, 2)}
              alt={p.name}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium text-dizajno-text truncate">
                {p.name}
              </p>
              <p className="mt-0.5 text-[12px] text-dizajno-muted truncate">
                <span>{p.family}</span>
                <span className="mx-1.5 text-dizajno-muted-subtle">·</span>
                <span>{p.category}</span>
                <span className="mx-1.5 text-dizajno-muted-subtle">·</span>
                <span className="text-dizajno-text-subtle">{p.supplierName}</span>
                <span className="mx-1.5 text-dizajno-muted-subtle">·</span>
                <span>{new Date(p.createdAt).toLocaleDateString()}</span>
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Tooltip content="Reject → Hidden">
                <IconButton
                  variant="danger"
                  size="sm"
                  onClick={() => reject.mutate(p.id)}
                  disabled={reject.isPending}
                >
                  <X />
                </IconButton>
              </Tooltip>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Check />}
                loading={approve.isPending}
                onClick={() => approve.mutate(p.id)}
              >
                Approve
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function PendingCategories() {
  const qc = useQueryClient();
  const cats = useQuery({
    queryKey: ["admin", "moderation", "categories"],
    queryFn: () => api.listPendingCategories(),
  });
  const approve = useMutation({
    mutationFn: (id: string) => api.approveCategory(id),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: ["admin", "moderation", "categories"],
      }),
  });
  const reject = useMutation({
    mutationFn: (id: string) => api.rejectCategory(id),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: ["admin", "moderation", "categories"],
      }),
    // No local handler: the global mutation net toasts this, the same way it
    // does for the other three queue actions on this page. Previously only
    // this one spoke up, and it did so through a native alert().
  });

  if (cats.isLoading) return <QueueSkeleton />;
  if (cats.error) {
    return (
      <ErrorState
        error={cats.error}
        action="load category suggestions"
        onRetry={() => void cats.refetch()}
      />
    );
  }
  if (cats.data?.length === 0) {
    return (
      <EmptyState
        icon={<FileQuestion />}
        title="No pending category suggestions"
        description="When a supplier suggests a new category from their portal, it lands here for approval."
      />
    );
  }

  return (
    <Card flush>
      <ul className="divide-y divide-dizajno-border">
        {cats.data?.map((c) => (
          <li key={c.id} className="px-5 py-4 flex items-center gap-4">
            <div className="w-9 h-9 rounded-lg bg-dizajno-elevated text-dizajno-muted flex items-center justify-center shrink-0">
              <FileQuestion size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium text-dizajno-text truncate">
                {c.name}
              </p>
              <p className="mt-0.5 text-[12px] text-dizajno-muted truncate">
                <span>{c.family}</span>
                <span className="mx-1.5 text-dizajno-muted-subtle">·</span>
                <span className="font-mono">{c.path}</span>
                {c.suggestedBySupplierName && (
                  <>
                    <span className="mx-1.5 text-dizajno-muted-subtle">·</span>
                    <span className="text-dizajno-text-subtle">
                      suggested by {c.suggestedBySupplierName}
                    </span>
                  </>
                )}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Tooltip content="Reject (delete)">
                <IconButton
                  variant="danger"
                  size="sm"
                  onClick={() => reject.mutate(c.id)}
                  disabled={reject.isPending}
                >
                  <X />
                </IconButton>
              </Tooltip>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Check />}
                loading={approve.isPending}
                onClick={() => approve.mutate(c.id)}
              >
                Approve
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function QueueSkeleton() {
  return (
    <Card flush>
      <ul className="divide-y divide-dizajno-border">
        {[0, 1, 2].map((i) => (
          <li key={i} className="px-5 py-4 flex items-center gap-4">
            <Skeleton className="w-9 h-9 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
