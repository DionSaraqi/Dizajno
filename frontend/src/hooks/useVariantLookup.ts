import { useMemo } from "react";
import { useFurnitureCatalog } from "@/hooks/useFurnitureCatalog";

export interface VariantLookup {
  variantIdForType(type: string): string | undefined;
  typeForVariantId(variantId: string): string | undefined;
}

/**
 * Builds a bi-directional map between catalog slugs (e.g. "sofa") and the
 * backend product-variant uuids the projects API expects on PlacedItem rows.
 *
 * Backed by <see cref="useFurnitureCatalog"/>, so it transparently falls back
 * to the bundled offline catalog while the network request is in flight — in
 * that mode `variantId` is undefined and items will be silently dropped from
 * the API payload by the scene mapper.
 */
export function useVariantLookup(): VariantLookup {
  const { items } = useFurnitureCatalog();

  return useMemo(() => {
    const typeToVariant = new Map<string, string>();
    const variantToType = new Map<string, string>();
    for (const item of items) {
      if (!item.variantId) continue;
      typeToVariant.set(item.type, item.variantId);
      variantToType.set(item.variantId, item.type);
    }
    return {
      variantIdForType: (t) => typeToVariant.get(t),
      typeForVariantId: (v) => variantToType.get(v),
    };
  }, [items]);
}
