/**
 * Runtime furniture-catalog registry.
 *
 * Non-React code (collision, store mutations, scene mapping) looks furniture
 * definitions up synchronously via `getFurnitureDef`. That lookup used to
 * search only the bundled fallback catalog, so supplier-uploaded products
 * (which exist only in the backend) never reached the 3D scene. This registry
 * holds the latest catalog fetched from the backend: `useFurnitureCatalog`
 * publishes into it, and `getFurnitureDef` reads it first, falling back
 * per-type to the bundled catalog (offline / in-flight fetch).
 *
 * React components that call `getFurnitureDef` during render subscribe via
 * `useCatalogVersion` (hooks/useCatalogVersion.ts) so a late-arriving catalog
 * re-renders them.
 */

import type { FurnitureCatalogItem } from "@/types/designer";

let runtimeItems: readonly FurnitureCatalogItem[] | null = null;
let byType: ReadonlyMap<string, FurnitureCatalogItem> = new Map();
let version = 0;
const listeners = new Set<() => void>();

function notify(): void {
  version += 1;
  for (const listener of listeners) listener();
}

/**
 * Publish a freshly fetched catalog. No-ops when the same reference is set
 * again — this relies on React Query's default `structuralSharing`, which
 * keeps `query.data` referentially stable across refetches with unchanged
 * content. If that default is ever disabled, or `listProducts()` starts
 * mapping the response into new objects, every periodic refetch would notify
 * all subscribed scene components for content that didn't change.
 */
export function setRuntimeCatalog(items: readonly FurnitureCatalogItem[]): void {
  if (items === runtimeItems) return;
  runtimeItems = items;
  byType = new Map(items.map((item) => [item.type, item] as const));
  notify();
}

/** Reset to the pristine no-runtime-catalog state (test isolation). */
export function clearRuntimeCatalog(): void {
  if (runtimeItems === null) return;
  runtimeItems = null;
  byType = new Map();
  notify();
}

export function lookupRuntimeDef(type: string): FurnitureCatalogItem | undefined {
  return byType.get(type);
}

export function getRuntimeCatalog(): readonly FurnitureCatalogItem[] | null {
  return runtimeItems;
}

/** Subscribe to catalog updates. Returns the unsubscribe function. */
export function subscribeToCatalog(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Monotonic counter, bumped on every catalog change — `useSyncExternalStore` snapshot. */
export function getCatalogVersion(): number {
  return version;
}
