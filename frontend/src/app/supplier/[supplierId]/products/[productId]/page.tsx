"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EyeOff, Send } from "lucide-react";
import * as api from "@/lib/api";
import {
  ApiErrorAlert,
  Badge,
  Button,
  ErrorState,
  PageHeader,
  Spinner,
  Tabs,
} from "@/components/ui";
import ProductInfoTab from "./ProductInfoTab";
import VariantsTab from "./VariantsTab";

type Tab = "info" | "variants";

export default function SupplierProductEditorPage() {
  const params = useParams<{ supplierId: string; productId: string }>();
  const { supplierId, productId } = params;
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("info");
  const [actionError, setActionError] = useState<unknown>(null);

  const product = useQuery({
    queryKey: ["supplier", supplierId, "products", productId],
    queryFn: () => api.getSupplierProduct(productId),
  });

  function invalidate() {
    qc.invalidateQueries({
      queryKey: ["supplier", supplierId, "products", productId],
    });
    qc.invalidateQueries({ queryKey: ["supplier", supplierId, "products"] });
  }

  const publish = useMutation({
    mutationFn: () => api.publishSupplierProduct(productId),
    onSuccess: invalidate,
    meta: { errorHandled: true },
    onError: setActionError,
  });
  const hide = useMutation({
    mutationFn: () => api.hideSupplierProduct(productId),
    onSuccess: invalidate,
    meta: { errorHandled: true },
    onError: setActionError,
  });

  if (product.isLoading) {
    return (
      <div className="py-16 flex items-center justify-center text-dizajno-muted gap-2 text-sm">
        <Spinner /> Loading product…
      </div>
    );
  }
  if (product.error) {
    return (
      <div className="py-12 max-w-xl">
        <ErrorState
          error={product.error}
          action="load this product"
          onRetry={() => void product.refetch()}
        />
      </div>
    );
  }
  if (!product.data) return null;
  const p = product.data;

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Products", href: `/supplier/${supplierId}/products` },
          { label: p.name },
        ]}
        title={p.name}
        description={
          <span className="inline-flex items-center gap-2 flex-wrap mt-1">
            <span className="font-mono text-[12.5px] text-dizajno-muted">
              /{p.slug}
            </span>
            <span className="text-dizajno-muted-subtle">·</span>
            <span className="text-[12.5px] text-dizajno-muted">{p.family}</span>
            <span className="text-dizajno-muted-subtle">·</span>
            <span className="text-[12.5px] text-dizajno-muted">
              {p.categoryName}
            </span>
            <StatusBadge status={p.status} />
          </span>
        }
        actions={
          <>
            {(p.status === "Draft" || p.status === "Hidden") && (
              <Button
                variant="primary"
                leftIcon={<Send />}
                loading={publish.isPending}
                onClick={() => publish.mutate()}
              >
                {p.status === "Draft" ? "Publish" : "Re-publish"}
              </Button>
            )}
            {(p.status === "Published" || p.status === "Pending") && (
              <Button
                variant="secondary"
                leftIcon={<EyeOff />}
                loading={hide.isPending}
                onClick={() => hide.mutate()}
              >
                Hide
              </Button>
            )}
          </>
        }
        bottom={
          <Tabs
            value={tab}
            onChange={(v) => setTab(v as Tab)}
            tabs={[
              { value: "info", label: "Product info" },
              {
                value: "variants",
                label: "Variants",
                count: p.variants.length,
              },
            ]}
          />
        }
        divided={false}
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

        {tab === "info" && (
          <ProductInfoTab
            supplierId={supplierId}
            product={p}
            onSaved={invalidate}
          />
        )}
        {tab === "variants" && (
          <VariantsTab
            supplierId={supplierId}
            product={p}
            onChanged={invalidate}
          />
        )}
      </section>
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
