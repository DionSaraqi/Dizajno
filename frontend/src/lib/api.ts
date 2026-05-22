/**
 * Thin client for the Dizajno backend API.
 *
 * Base URL comes from `NEXT_PUBLIC_API_URL` (set in `.env.local`). Falls back to
 * `http://localhost:5000` for the typical dev setup.
 */

import type { FurnitureCatalogItem } from "@/types/designer";

const FALLBACK_BASE_URL = "http://localhost:5000";

function getBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url || url.trim().length === 0) {
    return FALLBACK_BASE_URL;
  }
  return url.replace(/\/$/, "");
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly path: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${getBaseUrl()}${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Network request failed";
    throw new ApiError(message, 0, path);
  }

  if (!response.ok) {
    let detail = "";
    try {
      detail = await response.text();
    } catch {
      // ignore — already have a status
    }
    throw new ApiError(
      `Request failed: ${response.status} ${response.statusText}${detail ? ` — ${detail}` : ""}`,
      response.status,
      path
    );
  }

  return (await response.json()) as T;
}

// ── Catalog ───────────────────────────────────────────────────────────────

export interface CategoryDto {
  slug: string;
  name: string;
  family: string;
}

export interface SupplierDto {
  slug: string;
  name: string;
  logoUrl: string | null;
}

export interface ListProductsParams {
  family?: string;
  category?: string;
}

export async function listProducts(
  params: ListProductsParams = {}
): Promise<FurnitureCatalogItem[]> {
  const search = new URLSearchParams();
  if (params.family) search.set("family", params.family);
  if (params.category) search.set("category", params.category);
  const query = search.toString();
  const path = `/api/catalog/products${query ? `?${query}` : ""}`;
  return apiFetch<FurnitureCatalogItem[]>(path);
}

export async function getProductBySlug(
  slug: string
): Promise<FurnitureCatalogItem> {
  return apiFetch<FurnitureCatalogItem>(
    `/api/catalog/products/${encodeURIComponent(slug)}`
  );
}

export async function listCategories(
  family?: string
): Promise<CategoryDto[]> {
  const path = family
    ? `/api/catalog/categories?family=${encodeURIComponent(family)}`
    : "/api/catalog/categories";
  return apiFetch<CategoryDto[]>(path);
}

export async function listSuppliers(): Promise<SupplierDto[]> {
  return apiFetch<SupplierDto[]>("/api/catalog/suppliers");
}
