import { useMemo } from "react";
import { useFurnitureCatalog } from "@/hooks/useFurnitureCatalog";

export interface VariantLookup {
  /**
   * True once the catalog fetch has settled (success or error). Scene
   * hydration must wait for this: mapping a loaded scene against a not-yet-
   * fetched catalog drops every placed item (the offline fallback has no
   * variant ids), and the next autosave would persist that loss.
   */
  isReady: boolean;
  /**
   * True when the catalog fetch settled with an error. Hydration must treat
   * this as fatal, not proceed with the empty fallback lookup — the failure
   * mode is identical to the not-yet-fetched case (all items dropped, then
   * persisted away by autosave).
   */
  isError: boolean;
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
  const { items, isFetched, isError } = useFurnitureCatalog();

  return useMemo(() => {
    const typeToVariant = new Map<string, string>();
    const variantToType = new Map<string, string>();
    for (const item of items) {
      if (!item.variantId) continue;
      typeToVariant.set(item.type, item.variantId);
      variantToType.set(item.variantId, item.type);
    }
    return {
      isReady: isFetched,
      isError,
      variantIdForType: (t) => typeToVariant.get(t),
      typeForVariantId: (v) => variantToType.get(v),
    };
  }, [items, isFetched, isError]);
}
