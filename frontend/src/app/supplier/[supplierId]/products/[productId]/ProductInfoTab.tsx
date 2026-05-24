"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import * as api from "@/lib/api";
import {
  Button,
  Card,
  CardBody,
  FormField,
  Input,
  Select,
  Textarea,
} from "@/components/ui";

const UNITS: api.UnitOfSale[] = [
  "Piece",
  "SquareMeter",
  "Liter",
  "LinearMeter",
  "Kilogram",
];

export default function ProductInfoTab({
  supplierId,
  product,
  onSaved,
}: {
  supplierId: string;
  product: api.SupplierProductDetail;
  onSaved: () => void;
}) {
  void supplierId;
  const [categoryId, setCategoryId] = useState(product.categoryId);
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description ?? "");
  const [unitOfSale, setUnitOfSale] = useState<api.UnitOfSale>(product.unitOfSale);
  const [coverageRate, setCoverageRate] = useState(
    product.coverageRate?.toString() ?? "",
  );
  const [wasteFactor, setWasteFactor] = useState(product.wasteFactor.toString());
  const [leadTimeDays, setLeadTimeDays] = useState(
    product.leadTimeDays?.toString() ?? "",
  );
  const [previewSvg, setPreviewSvg] = useState(product.previewSvg ?? "");
  const [textureUrl, setTextureUrl] = useState(product.textureUrl ?? "");
  const [attributes, setAttributes] = useState(product.attributes);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const categories = useQuery({
    queryKey: ["catalog", "categories", product.family],
    queryFn: () => api.listCategories(product.family),
  });
  const categoryOptions = useMemo(
    () =>
      (categories.data ?? [])
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [categories.data],
  );

  useEffect(() => {
    if (!savedAt) return;
    const id = setTimeout(() => setSavedAt(null), 2500);
    return () => clearTimeout(id);
  }, [savedAt]);

  const save = useMutation({
    mutationFn: () =>
      api.updateSupplierProduct(product.id, {
        categoryId,
        name: name.trim(),
        description: description.trim() || null,
        unitOfSale,
        coverageRate: coverageRate ? Number(coverageRate) : null,
        wasteFactor: Number(wasteFactor || "0"),
        leadTimeDays: leadTimeDays ? Number(leadTimeDays) : null,
        previewSvg: previewSvg.trim() || null,
        textureUrl: textureUrl.trim() || null,
        attributes: attributes.trim() || null,
      }),
    onSuccess: () => {
      setSavedAt(Date.now());
      onSaved();
    },
    onError: (e: Error) => setError(e.message),
  });

  const isBuildingMaterial = product.family === "BuildingMaterial";
  const isLiter = unitOfSale === "Liter";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        save.mutate();
      }}
      className="max-w-3xl space-y-6"
    >
      <Card>
        <CardBody className="space-y-5">
          <FormField label="Family / slug" hint="Read-only">
            <div className="text-[13px] font-mono text-dizajno-text-subtle">
              {product.family} <span className="text-dizajno-muted-subtle">·</span>{" "}
              /{product.slug}
            </div>
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Category">
              <Select
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Unit of sale">
              <Select
                value={unitOfSale}
                onChange={(e) => setUnitOfSale(e.target.value as api.UnitOfSale)}
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <FormField label="Display name">
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </FormField>

          <FormField label="Description">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </FormField>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-5">
          <div>
            <h3 className="text-[14px] font-semibold text-dizajno-text">
              Commerce
            </h3>
            <p className="text-[12.5px] text-dizajno-muted mt-0.5">
              Drives quote calculations for paints (coverage), flooring (waste),
              and lead-time hints across all variants.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {isBuildingMaterial && isLiter && (
              <FormField label="Coverage rate" hint="m²/L">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={coverageRate}
                  onChange={(e) => setCoverageRate(e.target.value)}
                />
              </FormField>
            )}
            <FormField label="Waste factor" hint="0.10 = 10%">
              <Input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={wasteFactor}
                onChange={(e) => setWasteFactor(e.target.value)}
              />
            </FormField>
            <FormField label="Lead time" hint="Days">
              <Input
                type="number"
                min="0"
                value={leadTimeDays}
                onChange={(e) => setLeadTimeDays(e.target.value)}
              />
            </FormField>
          </div>

          {isBuildingMaterial && (
            <FormField
              label="Texture URL"
              description="Tileable image used by FloorMesh + WallMesh in the designer to skin walls and floors."
            >
              <Input
                type="url"
                value={textureUrl}
                onChange={(e) => setTextureUrl(e.target.value)}
                placeholder="/textures/your-paint.jpg"
              />
            </FormField>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-5">
          <div>
            <h3 className="text-[14px] font-semibold text-dizajno-text">
              Catalog assets
            </h3>
            <p className="text-[12.5px] text-dizajno-muted mt-0.5">
              SVG preview is the top-down icon shown in the designer's catalog
              sidebar. Attributes is family-specific JSON.
            </p>
          </div>
          <FormField
            label="Preview SVG"
            description="Raw markup. Pasted directly into the catalog DTO."
          >
            <Textarea
              value={previewSvg}
              onChange={(e) => setPreviewSvg(e.target.value)}
              rows={4}
              spellCheck={false}
              className="font-mono text-[11.5px]"
            />
          </FormField>

          <FormField
            label="Attributes"
            description="Family-specific JSON — {icon, lumen, energyClass, …}. Defaults to {}."
          >
            <Textarea
              value={attributes}
              onChange={(e) => setAttributes(e.target.value)}
              rows={3}
              spellCheck={false}
              className="font-mono text-[11.5px]"
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
        <Button
          type="submit"
          variant="primary"
          loading={save.isPending}
        >
          Save changes
        </Button>
      </div>
    </form>
  );
}
