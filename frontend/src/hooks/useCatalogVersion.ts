"use client";

import { useSyncExternalStore } from "react";
import { subscribeToCatalog, getCatalogVersion } from "@/utils/catalogRegistry";

/**
 * Re-renders the calling component whenever the runtime furniture catalog
 * changes. Components that call `getFurnitureDef` during render must use this,
 * otherwise items restored before the catalog fetch resolves keep rendering
 * with the stale (bundled-fallback) definition.
 */
export function useCatalogVersion(): number {
  return useSyncExternalStore(subscribeToCatalog, getCatalogVersion, getCatalogVersion);
}
