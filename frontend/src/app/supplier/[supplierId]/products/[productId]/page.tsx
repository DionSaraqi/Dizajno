"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EyeOff, Send } from "lucide-react";
import * as api from "@/lib/api";
import {
  Badge,
  Button,
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    onError: (e: Error) => setErrorMessage(e.message),
  });
  const hide = useMutation({
    mutationFn: () => api.hideSupplierProduct(productId),
    onSuccess: invalidate,
    onError: (e: Error) => setErrorMessage(e.message),
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
        <div className="rounded-xl border border-dizajno-danger/30 bg-dizajno-danger-soft px-4 py-3 text-[13px] text-dizajno-danger">
          {(product.error as Error).message}
        </div>
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
        {errorMessage && (
          <div className="mb-4 rounded-lg border border-dizajno-danger/30 bg-dizajno-danger-soft px-4 py-3 text-[13px] text-dizajno-danger flex items-start justify-between gap-3">
            <span>{errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-dizajno-danger/70 hover:text-dizajno-danger text-[12px] font-medium"
            >
              Dismiss
            </button>
          </div>
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
