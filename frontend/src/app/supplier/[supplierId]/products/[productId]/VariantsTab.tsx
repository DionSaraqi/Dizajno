"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import * as api from "@/lib/api";
import {
  Button,
  Card,
  CardBody,
  EmptyState,
  FormField,
  Input,
} from "@/components/ui";
import { Boxes } from "lucide-react";
import VariantRowEditor from "./VariantRowEditor";

export default function VariantsTab({
  supplierId,
  product,
  onChanged,
}: {
  supplierId: string;
  product: api.SupplierProductDetail;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(product.variants.length === 0);

  return (
    <div className="max-w-4xl space-y-5">
      {showAdd ? (
        <NewVariantForm
          productId={product.id}
          onCancel={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false);
            onChanged();
          }}
        />
      ) : (
        <div className="flex items-center justify-between">
          <p className="text-[13px] text-dizajno-muted">
            {product.variants.length} variant
            {product.variants.length === 1 ? "" : "s"} attached
          </p>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus />}
            onClick={() => setShowAdd(true)}
          >
            Add variant
          </Button>
        </div>
      )}

      {product.variants.length === 0 && !showAdd && (
        <EmptyState
          icon={<Boxes />}
          title="No variants yet"
          description="Products need at least one variant before they can be published."
          action={
            <Button
              variant="primary"
              leftIcon={<Plus />}
              onClick={() => setShowAdd(true)}
            >
              Add variant
            </Button>
          }
        />
      )}

      {product.variants.map((v) => (
        <VariantRowEditor
          key={v.id}
          supplierId={supplierId}
          productId={product.id}
          variant={v}
          onChanged={onChanged}
          onDeleted={() => {
            qc.invalidateQueries({
              queryKey: ["supplier", supplierId, "products", product.id],
            });
            onChanged();
          }}
        />
      ))}
    </div>
  );
}

function NewVariantForm({
  productId,
  onCancel,
  onCreated,
}: {
  productId: string;
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [sku, setSku] = useState("");
  const [name, setName] = useState("Standard");
  const [width, setWidth] = useState("1");
  const [depth, setDepth] = useState("1");
  const [height, setHeight] = useState("1");
  const [color, setColor] = useState("#999999");
  const [basePrice, setBasePrice] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      api.createVariant(productId, {
        sku: sku.trim(),
        name: name.trim(),
        width: Number(width),
        depth: Number(depth),
        height: Number(height),
        color,
        basePrice: basePrice ? Number(basePrice) : null,
        currency: "EUR",
      }),
    onSuccess: onCreated,
    onError: (e: Error) => setError(e.message),
  });

  return (
    <Card accentStripe>
      <CardBody>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            create.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <h3 className="text-[14px] font-semibold text-dizajno-text">
              New variant
            </h3>
            <p className="text-[12.5px] text-dizajno-muted mt-0.5">
              The SKU stays with this row forever — pick carefully.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label="SKU" required>
              <Input
                required
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="ACME-LS-2S"
              />
            </FormField>
            <FormField label="Variant name" required>
              <Input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </FormField>
            <FormField label="Color" hint="Hex">
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#999999"
              />
            </FormField>

            <FormField label="Width" hint="metres" required>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={width}
                onChange={(e) => setWidth(e.target.value)}
              />
            </FormField>
            <FormField label="Depth" hint="metres" required>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={depth}
                onChange={(e) => setDepth(e.target.value)}
              />
            </FormField>
            <FormField label="Height" hint="metres" required>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={height}
                onChange={(e) => setHeight(e.target.value)}
              />
            </FormField>

            <FormField
              label="Base price"
              hint="EUR, optional"
              className="sm:col-span-2"
            >
              <Input
                type="number"
                step="0.01"
                min="0"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                placeholder="0.00"
              />
            </FormField>
          </div>

          {error && (
            <div className="rounded-lg border border-dizajno-danger/30 bg-dizajno-danger-soft px-3 py-2 text-[13px] text-dizajno-danger">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={onCancel} type="button">
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={create.isPending}
              leftIcon={!create.isPending ? <Plus /> : undefined}
            >
              {create.isPending ? "Adding…" : "Add variant"}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
