import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listProducts } from "@/lib/api";
import { furnitureCatalog } from "@/utils/furnitureCatalog";
import { setRuntimeCatalog } from "@/utils/catalogRegistry";
import type { FurnitureCatalogItem, FurnitureCategory } from "@/types/designer";

export interface UseFurnitureCatalogResult {
  items: FurnitureCatalogItem[];
  isLoading: boolean;
  isError: boolean;
  /** True once the fetch has settled (success or error). Scene hydration waits on this. */
  isFetched: boolean;
  categories: FurnitureCategory[];
}

/**
 * Loads the furniture catalog from the backend.
 *
 * Falls back to the bundled static catalog (`utils/furnitureCatalog`) during the
 * initial fetch and when the backend is unreachable — the bundled copy is the
 * seed source of truth, so the shape matches and the sidebar still renders.
 */
export function useFurnitureCatalog(): UseFurnitureCatalogResult {
  const query = useQuery({
    queryKey: ["catalog", "products"],
    queryFn: () => listProducts(),
  });

  const items = query.data ?? furnitureCatalog;

  // Publish into the sync registry so non-React lookups (getFurnitureDef in
  // collision / store mutations) and render-time consumers see supplier
  // products, not just the bundled fallback.
  useEffect(() => {
    if (query.data) setRuntimeCatalog(query.data);
  }, [query.data]);

  const categories = useMemo(() => {
    const unique = new Set(items.map((item) => item.category));
    return Array.from(unique).sort() as FurnitureCategory[];
  }, [items]);

  return {
    items,
    isLoading: query.isLoading,
    isError: query.isError,
    isFetched: query.isFetched,
    categories,
  };
}
