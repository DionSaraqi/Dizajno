import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listProducts } from "@/lib/api";
import { furnitureCatalog } from "@/utils/furnitureCatalog";
import type { FurnitureCatalogItem, FurnitureCategory } from "@/types/designer";

export interface UseFurnitureCatalogResult {
  items: FurnitureCatalogItem[];
  isLoading: boolean;
  isError: boolean;
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

  const categories = useMemo(() => {
    const unique = new Set(items.map((item) => item.category));
    return Array.from(unique).sort() as FurnitureCategory[];
  }, [items]);

  return {
    items,
    isLoading: query.isLoading,
    isError: query.isError,
    categories,
  };
}
