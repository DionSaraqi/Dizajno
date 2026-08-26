"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Lightbulb } from "lucide-react";
import * as api from "@/lib/api";
import {
  ApiErrorAlert,
  Button,
  Card,
  CardBody,
  FormField,
  Input,
  Modal,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui";

const FAMILIES: api.ProductFamily[] = [
  "Furniture",
  "Lighting",
  "Appliance",
  "BuildingMaterial",
  "Fixture",
];

const UNITS: api.UnitOfSale[] = [
  "Piece",
  "SquareMeter",
  "Liter",
  "LinearMeter",
  "Kilogram",
];

export default function NewProductPage() {
  const params = useParams<{ supplierId: string }>();
  const supplierId = params.supplierId;
  const router = useRouter();
  const qc = useQueryClient();

  const [family, setFamily] = useState<api.ProductFamily>("Furniture");
  const [categoryId, setCategoryId] = useState<string>("");
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [unitOfSale, setUnitOfSale] = useState<api.UnitOfSale>("Piece");
  const [coverageRate, setCoverageRate] = useState<string>("");
  const [wasteFactor, setWasteFactor] = useState<string>("0");
  const [leadTimeDays, setLeadTimeDays] = useState<string>("");
  const [textureUrl, setTextureUrl] = useState<string>("");
  const [error, setError] = useState<unknown>(null);
  const [showSuggest, setShowSuggest] = useState(false);

  const categories = useQuery({
    queryKey: ["catalog", "categories", family],
    queryFn: () => api.listCategories(family),
  });

  const categoryOptions = useMemo(
    () =>
      (categories.data ?? [])
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [categories.data],
  );

  useEffect(() => {
    if (
      categoryOptions.length > 0 &&
      !categoryOptions.some((c) => c.id === categoryId)
    ) {
      setCategoryId("");
    }
  }, [categoryOptions, categoryId]);

  const create = useMutation({
    mutationFn: async () => {
      if (!categoryId) throw new Error("Pick a category.");
      return api.createSupplierProduct({
        supplierId,
        family,
        categoryId,
        slug: slug.trim().toLowerCase(),
        name: name.trim(),
        description: description.trim() || null,
        unitOfSale,
        coverageRate: coverageRate ? Number(coverageRate) : null,
        wasteFactor: Number(wasteFactor || "0"),
        leadTimeDays: leadTimeDays ? Number(leadTimeDays) : null,
        textureUrl: textureUrl.trim() || null,
        attributes: null,
      });
    },
    onSuccess: (dto) => {
      qc.invalidateQueries({ queryKey: ["supplier", supplierId, "products"] });
      router.replace(`/supplier/${supplierId}/products/${dto.id}`);
    },
    meta: { errorHandled: true },
    onError: setError,
  });

  const isBuildingMaterial = family === "BuildingMaterial";
  const isLiter = unitOfSale === "Liter";

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Products", href: `/supplier/${supplierId}/products` },
          { label: "New" },
        ]}
        title="Create a product"
        description="Saves as a Draft. Once you add a variant and publish, trusted suppliers go live immediately; new suppliers route through admin review first."
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          create.mutate();
        }}
        className="py-6 max-w-3xl space-y-6"
      >
        <Card>
          <CardBody className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Family" htmlFor="family" required>
                <Select
                  id="family"
                  value={family}
                  onChange={(e) => setFamily(e.target.value as api.ProductFamily)}
                >
                  {FAMILIES.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Unit of sale" htmlFor="unit" required>
                <Select
                  id="unit"
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

            <FormField
              label="Category"
              htmlFor="category"
              required
              rightLabel={
                <button
                  type="button"
                  onClick={() => setShowSuggest(true)}
                  className="inline-flex items-center gap-1 text-dizajno-accent hover:text-dizajno-accent-hover transition-colors"
                >
                  <Lightbulb size={11} />
                  Suggest a new one
                </button>
              }
            >
              <Select
                id="category"
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">— Pick one —</option>
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Slug"
                htmlFor="slug"
                required
                hint="URL fragment, lowercase, dashes"
              >
                <Input
                  id="slug"
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="acme-lounge-sofa"
                  pattern="^[a-z0-9-]+$"
                />
              </FormField>
              <FormField label="Display name" htmlFor="name" required>
                <Input
                  id="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Acme Lounge Sofa"
                />
              </FormField>
            </div>

            <FormField label="Description" htmlFor="description" hint="Optional">
              <Textarea
                id="description"
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
                Coverage + waste are used by the quote calculator when this is a
                paint or flooring product.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {isBuildingMaterial && isLiter && (
                <FormField label="Coverage rate" hint="m² per liter">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={coverageRate}
                    onChange={(e) => setCoverageRate(e.target.value)}
                    placeholder="10"
                  />
                </FormField>
              )}
              <FormField label="Waste factor" hint="0.10 = 10% overage">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={wasteFactor}
                  onChange={(e) => setWasteFactor(e.target.value)}
                />
              </FormField>
              <FormField label="Lead time" hint="Days, optional">
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
                hint="Tileable JPG/PNG. Walls + floors in the designer skin with this finish."
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

        {error != null && (
          <ApiErrorAlert error={error} action="create this product" size="sm" />
        )}

        <div className="flex justify-end gap-2">
          <Link href={`/supplier/${supplierId}/products`}>
            <Button variant="ghost">Cancel</Button>
          </Link>
          <Button
            type="submit"
            variant="primary"
            loading={create.isPending}
            leftIcon={!create.isPending ? <Plus /> : undefined}
          >
            {create.isPending ? "Saving…" : "Create draft"}
          </Button>
        </div>
      </form>

      {showSuggest && (
        <SuggestCategoryModal
          supplierId={supplierId}
          family={family}
          onClose={() => setShowSuggest(false)}
        />
      )}
    </>
  );
}

function SuggestCategoryModal({
  supplierId,
  family,
  onClose,
}: {
  supplierId: string;
  family: api.ProductFamily;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState(false);
  const suggest = useMutation({
    mutationFn: () =>
      api.suggestCategory({
        supplierId,
        family,
        parentCategoryId: null,
        name: name.trim(),
      }),
    onSuccess: () => setDone(true),
    meta: { errorHandled: true },
    onError: setError,
  });

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={done ? "Submitted for review" : `Suggest a new ${family} category`}
      description={
        done
          ? "An admin needs to approve it before products can attach. We'll show it in the picker once it's approved."
          : "We'll send it to admin moderation. While it's pending, you can't attach products to it."
      }
      size="sm"
      footer={
        done ? (
          <Button variant="primary" onClick={onClose}>
            Got it
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={suggest.isPending}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={suggest.isPending}
              onClick={() => {
                setError(null);
                suggest.mutate();
              }}
            >
              Submit
            </Button>
          </>
        )
      }
    >
      {!done && (
        <div className="space-y-3">
          <FormField label="Display name" htmlFor="cat-name">
            <Input
              id="cat-name"
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Pendant Lights"
            />
          </FormField>
          {error != null && (
            <ApiErrorAlert error={error} action="suggest this category" size="sm" />
          )}
        </div>
      )}
    </Modal>
  );
}
