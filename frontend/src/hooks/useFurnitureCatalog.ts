import { useMemo } from "react";
import { furnitureCatalog } from "@/utils/furnitureCatalog";
import type { FurnitureCatalogItem, FurnitureCategory } from "@/types/designer";

export interface UseFurnitureCatalogResult {
  items: FurnitureCatalogItem[];
  isLoading: boolean;
  categories: FurnitureCategory[];
}

export function useFurnitureCatalog(): UseFurnitureCatalogResult {
  const items = useMemo(() => furnitureCatalog, []);

  const categories = useMemo(() => {
    const unique = new Set(items.map((item) => item.category));
    return Array.from(unique).sort() as FurnitureCategory[];
  }, [items]);

  return {
    items,
    isLoading: false,
    categories,
  };
}
