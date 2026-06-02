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

// Access token is set by the auth store once the user has logged in. The
// module-scoped variable is mutated via setAccessToken so apiFetch can attach
// the Bearer header without taking a hard dependency on the store.
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

interface ApiFetchOptions extends RequestInit {
  auth?: boolean;
  jsonBody?: unknown;
}

async function apiFetch<T>(path: string, init?: ApiFetchOptions): Promise<T> {
  const url = `${getBaseUrl()}${path}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  let body: BodyInit | null | undefined = init?.body;
  if (init?.jsonBody !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.jsonBody);
  }
  if (init?.auth && accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers,
      body,
      // Always include the refresh-token cookie on auth endpoints.
      credentials: "include",
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

  // 204 No Content: nothing to parse.
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

// ── Catalog ───────────────────────────────────────────────────────────────

export interface CategoryDto {
  id: string;
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

// ── Auth ──────────────────────────────────────────────────────────────────

export type SupplierMemberRole = "Owner" | "Staff";

export interface SupplierMembership {
  supplierId: string;
  supplierSlug: string;
  supplierName: string;
  role: SupplierMemberRole;
  isSuspended: boolean;
}

export interface UserSummary {
  id: string;
  email: string;
  displayName: string | null;
  locale: string;
  roles: string[];
  supplierMemberships: SupplierMembership[];
}

export interface AuthResponse {
  accessToken: string;
  accessTokenExpiresAt: string;
  user: UserSummary;
}

export interface RegisterRequest {
  email: string;
  password: string;
  displayName?: string | null;
  locale?: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export function register(input: RegisterRequest): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/api/auth/register", {
    method: "POST",
    jsonBody: input,
  });
}

export function login(input: LoginRequest): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/api/auth/login", {
    method: "POST",
    jsonBody: input,
  });
}

/**
 * Uses the HttpOnly refresh cookie to obtain a new access token. Returns null
 * on 401 so the caller can treat "no session" as a normal state.
 */
export async function refresh(): Promise<AuthResponse | null> {
  try {
    return await apiFetch<AuthResponse>("/api/auth/refresh", { method: "POST" });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }
    throw error;
  }
}

export function logout(): Promise<void> {
  return apiFetch<void>("/api/auth/logout", { method: "POST" });
}

export function me(): Promise<UserSummary> {
  return apiFetch<UserSummary>("/api/auth/me", { auth: true });
}

// ── Projects ──────────────────────────────────────────────────────────────

export interface ProjectSummary {
  id: string;
  name: string;
  thumbnailUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectVersionSummary {
  id: string;
  label: string;
  createdByUserId: string;
  createdAt: string;
}

export interface WallApi {
  id: string;
  startX: number;
  startZ: number;
  endX: number;
  endZ: number;
  thickness: number;
  height: number;
  paintProductVariantId?: string | null;
}

export interface FloorApi {
  id: string;
  vertices: number[][];
  flooringProductVariantId?: string | null;
}

export type OpeningTypeApi = "Door" | "Window";

export interface OpeningApi {
  id: string;
  wallId: string;
  type: OpeningTypeApi;
  offsetFromStart: number;
  width: number;
  height: number;
  sillHeight: number;
  productVariantId: string | null;
  materialOverrides: Record<string, string> | null;
}

export interface PlacedItemApi {
  id: string;
  productVariantId: string;
  positionX: number;
  positionZ: number;
  rotation: number;
  /** Vertical "levitation" offset above the floor, in meters. */
  elevation: number;
  scale: number;
  scaledWidth: number;
  scaledDepth: number;
  scaledHeight: number;
  materialColors: Record<string, string> | null;
  materialTextures: Record<string, string> | null;
}

export interface SceneApi {
  walls: WallApi[];
  floors: FloorApi[];
  openings: OpeningApi[];
  placedItems: PlacedItemApi[];
}

export interface ProjectDetail {
  id: string;
  name: string;
  thumbnailUrl: string | null;
  thumbnailAssetId: string | null;
  createdAt: string;
  updatedAt: string;
  scene: SceneApi;
  versions: ProjectVersionSummary[];
}

export function listProjects(skip = 0, take = 50): Promise<ProjectSummary[]> {
  return apiFetch<ProjectSummary[]>(`/api/projects?skip=${skip}&take=${take}`, {
    auth: true,
  });
}

export function createProject(name: string): Promise<ProjectDetail> {
  return apiFetch<ProjectDetail>("/api/projects", {
    method: "POST",
    auth: true,
    jsonBody: { name },
  });
}

export function getProject(id: string): Promise<ProjectDetail> {
  return apiFetch<ProjectDetail>(`/api/projects/${id}`, { auth: true });
}

export function replaceScene(
  id: string,
  scene: SceneApi
): Promise<ProjectDetail> {
  return apiFetch<ProjectDetail>(`/api/projects/${id}/scene`, {
    method: "PUT",
    auth: true,
    jsonBody: { scene },
  });
}

export function updateProject(
  id: string,
  input: { name?: string | null; thumbnailAssetId?: string | null }
): Promise<ProjectSummary> {
  return apiFetch<ProjectSummary>(`/api/projects/${id}`, {
    method: "PUT",
    auth: true,
    jsonBody: input,
  });
}

export function deleteProject(id: string): Promise<void> {
  return apiFetch<void>(`/api/projects/${id}`, {
    method: "DELETE",
    auth: true,
  });
}

export function createVersion(
  id: string,
  label: string
): Promise<ProjectVersionSummary> {
  return apiFetch<ProjectVersionSummary>(`/api/projects/${id}/versions`, {
    method: "POST",
    auth: true,
    jsonBody: { label },
  });
}

export function restoreVersion(
  id: string,
  versionId: string
): Promise<ProjectDetail> {
  return apiFetch<ProjectDetail>(
    `/api/projects/${id}/versions/${versionId}/restore`,
    { method: "POST", auth: true }
  );
}

// ── Project thumbnails (owner-scoped, no admin role required) ──────────────

export interface PresignProjectThumbnailRequest {
  contentType: string;
  sizeBytes: number;
}

export interface PresignProjectThumbnailResponse {
  key: string;
  uploadUrl: string;
  expiresAt: string;
  publicUrl: string;
  requiredHeaders: Record<string, string>;
}

export interface AttachProjectThumbnailRequest {
  key: string;
  mimeType: string;
  sizeBytes: number;
}

export function presignProjectThumbnail(
  projectId: string,
  input: PresignProjectThumbnailRequest
): Promise<PresignProjectThumbnailResponse> {
  return apiFetch<PresignProjectThumbnailResponse>(
    `/api/projects/${projectId}/thumbnail/presign`,
    { method: "POST", auth: true, jsonBody: input }
  );
}

export function attachProjectThumbnail(
  projectId: string,
  input: AttachProjectThumbnailRequest
): Promise<ProjectSummary> {
  return apiFetch<ProjectSummary>(`/api/projects/${projectId}/thumbnail`, {
    method: "PUT",
    auth: true,
    jsonBody: input,
  });
}

// ── Sharing & comments ────────────────────────────────────────────────────

export type ShareMode = "View" | "Comment";
export type ShareKind = "Link" | "Email";

export interface ShareSummary {
  id: string;
  mode: ShareMode;
  token: string | null;
  invitedEmail: string | null;
  expiresAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

export interface CreateShareRequest {
  mode: ShareMode;
  kind: ShareKind;
  invitedEmail?: string | null;
  expiresAt?: string | null;
}

export function listShares(projectId: string): Promise<ShareSummary[]> {
  return apiFetch<ShareSummary[]>(`/api/projects/${projectId}/shares`, {
    auth: true,
  });
}

export function createShare(
  projectId: string,
  input: CreateShareRequest
): Promise<ShareSummary> {
  return apiFetch<ShareSummary>(`/api/projects/${projectId}/shares`, {
    method: "POST",
    auth: true,
    jsonBody: input,
  });
}

export function revokeShare(projectId: string, shareId: string): Promise<void> {
  return apiFetch<void>(`/api/projects/${projectId}/shares/${shareId}`, {
    method: "DELETE",
    auth: true,
  });
}

export type CommentAnchor =
  | { type: "item"; id: string }
  | { type: "wall"; id: string }
  | { type: "point"; x: number; z: number };

export interface CommentDto {
  id: string;
  parentCommentId: string | null;
  authorUserId: string | null;
  authorDisplayName: string | null;
  guestName: string | null;
  body: string;
  anchor: CommentAnchor | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface PostCommentRequest {
  body: string;
  guestName?: string | null;
  guestEmail?: string | null;
  parentCommentId?: string | null;
  anchor?: CommentAnchor | null;
}

export interface SharedProject {
  projectId: string;
  name: string;
  thumbnailUrl: string | null;
  mode: ShareMode;
  scene: SceneApi;
}

/** Public viewer: load a shared project by its token (no bearer required). */
export function loadSharedProject(token: string): Promise<SharedProject> {
  return apiFetch<SharedProject>(`/api/share/${encodeURIComponent(token)}`);
}

export function listSharedComments(token: string): Promise<CommentDto[]> {
  return apiFetch<CommentDto[]>(
    `/api/share/${encodeURIComponent(token)}/comments`
  );
}

export function postSharedComment(
  token: string,
  input: PostCommentRequest
): Promise<CommentDto> {
  // If the visitor is signed in, attaching the bearer lets the backend record
  // their user id; otherwise they post as a guest.
  return apiFetch<CommentDto>(
    `/api/share/${encodeURIComponent(token)}/comments`,
    { method: "POST", auth: true, jsonBody: input }
  );
}

/** Owner inbox view of every comment on the project. */
export function listProjectComments(projectId: string): Promise<CommentDto[]> {
  return apiFetch<CommentDto[]>(`/api/projects/${projectId}/comments`, {
    auth: true,
  });
}

// ── Admin assets (used by thumbnail upload) ────────────────────────────────

export interface PresignAssetRequest {
  kind:
    | "Glb"
    | "SvgPreview"
    | "Image"
    | "CadSource"
    | "Doc"
    | "Attachment";
  contentType: string;
  sizeBytes: number;
  originalFileName?: string | null;
  checksumSha256?: string | null;
}

export interface PresignAssetResponse {
  key: string;
  uploadUrl: string;
  expiresAt: string;
  publicUrl: string;
  requiredHeaders: Record<string, string>;
}

export interface CreateAssetRequest {
  key: string;
  kind: PresignAssetRequest["kind"];
  mimeType: string;
  sizeBytes: number;
  checksumSha256?: string | null;
  productId?: string | null;
  variantId?: string | null;
  ownerSupplierId?: string | null;
  sortOrder: number;
}

export interface AssetSummary {
  id: string;
  kind: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string | null;
  productId: string | null;
  variantId: string | null;
  ownerSupplierId: string | null;
  sortOrder: number;
  createdAt: string;
}

export function presignAsset(
  input: PresignAssetRequest
): Promise<PresignAssetResponse> {
  return apiFetch<PresignAssetResponse>("/api/admin/assets/presign", {
    method: "POST",
    auth: true,
    jsonBody: input,
  });
}

export function registerAsset(input: CreateAssetRequest): Promise<AssetSummary> {
  return apiFetch<AssetSummary>("/api/admin/assets", {
    method: "POST",
    auth: true,
    jsonBody: input,
  });
}

// ── Quotes (requester side) ────────────────────────────────────────────────

export type QuoteStatus = "Open" | "Closed" | "Cancelled";
export type QuoteRequestStatus = "Pending" | "Responded" | "Declined" | "Expired";

export interface QuoteSummary {
  id: string;
  projectId: string;
  projectName: string;
  projectThumbnailUrl: string | null;
  status: QuoteStatus;
  message: string | null;
  createdAt: string;
  closedAt: string | null;
  supplierCount: number;
  respondedCount: number;
  declinedCount: number;
}

export interface QuoteResponseAttachment {
  id: string;
  assetId: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  sortOrder: number;
}

export interface QuoteResponseDto {
  id: string;
  respondedByUserId: string;
  totalPrice: number;
  currency: string;
  body: string | null;
  respondedAt: string;
  attachments: QuoteResponseAttachment[];
}

export interface QuoteLine {
  id: string;
  productVariantId: string;
  /**
   * Frozen catalog data at quote-creation time. Shape:
   * `{ variantId, sku, name, supplierId, supplierSlug, supplierName,
   *    productSlug, productName, family, stockWidth, stockDepth, stockHeight,
   *    currency, basePrice }`.
   */
  variantSnapshot: {
    variantId: string;
    sku: string;
    name: string;
    supplierId: string;
    supplierSlug: string;
    supplierName: string;
    productSlug: string;
    productName: string;
    family: string;
    stockWidth: number;
    stockDepth: number;
    stockHeight: number;
    currency: string;
    basePrice: number | null;
  };
  quantity: number;
  quantityUnit: string;
  materialOverrides: Record<string, unknown> | null;
  scaledWidth: number | null;
  scaledDepth: number | null;
  scaledHeight: number | null;
  isCustomSize: boolean;
  suggestedPrice: number | null;
  currency: string;
}

export interface QuoteRequestDto {
  id: string;
  supplierId: string;
  supplierSlug: string;
  supplierName: string;
  status: QuoteRequestStatus;
  expiresAt: string | null;
  createdAt: string;
  lines: QuoteLine[];
  response: QuoteResponseDto | null;
}

export interface QuoteDetail {
  id: string;
  projectId: string;
  projectName: string;
  projectThumbnailUrl: string | null;
  requesterUserId: string;
  status: QuoteStatus;
  message: string | null;
  createdAt: string;
  closedAt: string | null;
  requests: QuoteRequestDto[];
}

/** Phase 6: manual material lines (paint, flooring, …) added alongside the
 *  project's placed items and branded openings. The dialog computes a suggested
 *  quantity from room geometry × waste factor; the user can edit and submit. */
export interface ManualQuoteLineInput {
  productVariantId: string;
  quantity: number;
  quantityUnit: string;
}

export function createQuote(
  projectId: string,
  message: string | null,
  manualLines: ManualQuoteLineInput[] = []
): Promise<QuoteDetail> {
  return apiFetch<QuoteDetail>(`/api/projects/${projectId}/quotes`, {
    method: "POST",
    auth: true,
    jsonBody: {
      message,
      manualLines: manualLines.length > 0 ? manualLines : null,
    },
  });
}

export function listQuotes(status?: QuoteStatus): Promise<QuoteSummary[]> {
  const path = status
    ? `/api/quotes?status=${encodeURIComponent(status)}`
    : "/api/quotes";
  return apiFetch<QuoteSummary[]>(path, { auth: true });
}

export function getQuote(id: string): Promise<QuoteDetail> {
  return apiFetch<QuoteDetail>(`/api/quotes/${id}`, { auth: true });
}

export function cancelQuote(id: string): Promise<void> {
  return apiFetch<void>(`/api/quotes/${id}/cancel`, {
    method: "POST",
    auth: true,
  });
}

export function closeQuote(id: string): Promise<void> {
  return apiFetch<void>(`/api/quotes/${id}/close`, {
    method: "POST",
    auth: true,
  });
}

// ── Supplier-side quotes ──────────────────────────────────────────────────

export interface SupplierQuoteRequestSummary {
  id: string;
  quoteId: string;
  supplierId: string;
  supplierName: string;
  status: QuoteRequestStatus;
  createdAt: string;
  expiresAt: string | null;
  projectId: string;
  projectName: string;
  projectThumbnailUrl: string | null;
  requesterDisplayName: string;
  lineCount: number;
  hasResponse: boolean;
}

export interface SupplierQuoteRequestDetail {
  id: string;
  quoteId: string;
  supplierId: string;
  supplierName: string;
  status: QuoteRequestStatus;
  quoteStatus: QuoteStatus;
  createdAt: string;
  expiresAt: string | null;
  projectId: string;
  projectName: string;
  projectThumbnailUrl: string | null;
  requesterDisplayName: string;
  message: string | null;
  lines: QuoteLine[];
  response: QuoteResponseDto | null;
}

export interface SupplierRespondInput {
  totalPrice: number;
  currency: string;
  body: string | null;
  attachmentAssetIds: string[] | null;
}

export function listSupplierQuotes(
  status?: QuoteRequestStatus
): Promise<SupplierQuoteRequestSummary[]> {
  const path = status
    ? `/api/supplier/quotes?status=${encodeURIComponent(status)}`
    : "/api/supplier/quotes";
  return apiFetch<SupplierQuoteRequestSummary[]>(path, { auth: true });
}

export function getSupplierQuote(
  id: string
): Promise<SupplierQuoteRequestDetail> {
  return apiFetch<SupplierQuoteRequestDetail>(`/api/supplier/quotes/${id}`, {
    auth: true,
  });
}

export function respondToSupplierQuote(
  id: string,
  input: SupplierRespondInput
): Promise<QuoteResponseDto> {
  return apiFetch<QuoteResponseDto>(`/api/supplier/quotes/${id}/respond`, {
    method: "POST",
    auth: true,
    jsonBody: input,
  });
}

export function declineSupplierQuote(
  id: string,
  reason: string | null
): Promise<void> {
  return apiFetch<void>(`/api/supplier/quotes/${id}/decline`, {
    method: "POST",
    auth: true,
    jsonBody: { reason },
  });
}

// ── Supplier-scoped asset uploads (for response attachments) ──────────────

/**
 * Phase 7b added Glb + SvgPreview to the supplier-side allow-list so suppliers
 * can upload their own 3D models and 2D floor-plan previews.
 */
export type SupplierAssetKindWire = "Image" | "Doc" | "Attachment" | "Glb" | "SvgPreview";

export interface PresignSupplierAssetInput {
  supplierId: string;
  kind: SupplierAssetKindWire;
  contentType: string;
  sizeBytes: number;
  originalFileName?: string | null;
  checksumSha256?: string | null;
}

export interface CreateSupplierAssetInput {
  supplierId: string;
  key: string;
  kind: SupplierAssetKindWire;
  mimeType: string;
  sizeBytes: number;
  checksumSha256?: string | null;
}

export function presignSupplierAsset(
  input: PresignSupplierAssetInput
): Promise<PresignAssetResponse> {
  return apiFetch<PresignAssetResponse>("/api/supplier/assets/presign", {
    method: "POST",
    auth: true,
    jsonBody: input,
  });
}

export function createSupplierAsset(
  input: CreateSupplierAssetInput
): Promise<AssetSummary> {
  return apiFetch<AssetSummary>("/api/supplier/assets", {
    method: "POST",
    auth: true,
    jsonBody: input,
  });
}

// ── Admin (Phase 5 stopgap for member binding) ────────────────────────────

export interface AdminSupplierMember {
  id: string;
  supplierId: string;
  supplierSlug: string;
  supplierName: string;
  userId: string;
  userEmail: string;
  userDisplayName: string | null;
  role: SupplierMemberRole;
  createdAt: string;
}

export interface CreateSupplierMemberInput {
  supplierId: string;
  userId: string;
  role: SupplierMemberRole;
}

export function listSupplierMembers(filters: {
  supplierId?: string;
  userId?: string;
} = {}): Promise<AdminSupplierMember[]> {
  const search = new URLSearchParams();
  if (filters.supplierId) search.set("supplierId", filters.supplierId);
  if (filters.userId) search.set("userId", filters.userId);
  const query = search.toString();
  return apiFetch<AdminSupplierMember[]>(
    `/api/admin/supplier-members${query ? `?${query}` : ""}`,
    { auth: true }
  );
}

export function bindSupplierMember(
  input: CreateSupplierMemberInput
): Promise<AdminSupplierMember> {
  return apiFetch<AdminSupplierMember>("/api/admin/supplier-members", {
    method: "POST",
    auth: true,
    jsonBody: input,
  });
}

// ── Phase 7a — Admin dashboard ────────────────────────────────────────────

export interface AdminSupplier {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  websiteUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  isTrusted: boolean;
  suspendedAt: string | null;
  memberCount: number;
  productCount: number;
  createdAt: string;
}

export interface CreateSupplierInput {
  slug: string;
  name: string;
  description?: string | null;
  websiteUrl?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
}

export interface UpdateSupplierInput {
  name: string;
  description?: string | null;
  websiteUrl?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
}

export function listAdminSuppliers(filters: {
  search?: string;
  suspended?: boolean;
  trusted?: boolean;
} = {}): Promise<AdminSupplier[]> {
  const q = new URLSearchParams();
  if (filters.search) q.set("search", filters.search);
  if (filters.suspended !== undefined) q.set("suspended", String(filters.suspended));
  if (filters.trusted !== undefined) q.set("trusted", String(filters.trusted));
  const query = q.toString();
  return apiFetch<AdminSupplier[]>(`/api/admin/suppliers${query ? `?${query}` : ""}`, {
    auth: true,
  });
}

export function getAdminSupplier(id: string): Promise<AdminSupplier> {
  return apiFetch<AdminSupplier>(`/api/admin/suppliers/${id}`, { auth: true });
}

export function createAdminSupplier(input: CreateSupplierInput): Promise<AdminSupplier> {
  return apiFetch<AdminSupplier>("/api/admin/suppliers", {
    method: "POST",
    auth: true,
    jsonBody: input,
  });
}

export function updateAdminSupplier(
  id: string,
  input: UpdateSupplierInput
): Promise<AdminSupplier> {
  return apiFetch<AdminSupplier>(`/api/admin/suppliers/${id}`, {
    method: "PUT",
    auth: true,
    jsonBody: input,
  });
}

export function suspendSupplier(id: string): Promise<void> {
  return apiFetch<void>(`/api/admin/suppliers/${id}/suspend`, {
    method: "POST",
    auth: true,
  });
}

export function restoreSupplier(id: string): Promise<void> {
  return apiFetch<void>(`/api/admin/suppliers/${id}/restore`, {
    method: "POST",
    auth: true,
  });
}

export function trustSupplier(id: string): Promise<void> {
  return apiFetch<void>(`/api/admin/suppliers/${id}/trust`, {
    method: "POST",
    auth: true,
  });
}

export function untrustSupplier(id: string): Promise<void> {
  return apiFetch<void>(`/api/admin/suppliers/${id}/untrust`, {
    method: "POST",
    auth: true,
  });
}

// ── Invites ──

export interface SupplierInvite {
  id: string;
  supplierId: string;
  invitedEmail: string;
  role: SupplierMemberRole;
  expiresAt: string;
  acceptedAt: string | null;
  acceptedByUserId: string | null;
  revokedAt: string | null;
  createdAt: string;
  /** Only present on create — never persisted in plaintext. */
  token?: string | null;
  /** Full URL the admin forwards to the invitee. Only present on create. */
  acceptUrl?: string | null;
}

export interface CreateSupplierInviteInput {
  supplierId: string;
  email: string;
  role: SupplierMemberRole;
  expiresInDays?: number;
}

export function listSupplierInvites(filters: {
  supplierId?: string;
  includeRevoked?: boolean;
  includeAccepted?: boolean;
} = {}): Promise<SupplierInvite[]> {
  const q = new URLSearchParams();
  if (filters.supplierId) q.set("supplierId", filters.supplierId);
  if (filters.includeRevoked !== undefined) q.set("includeRevoked", String(filters.includeRevoked));
  if (filters.includeAccepted !== undefined) q.set("includeAccepted", String(filters.includeAccepted));
  const query = q.toString();
  return apiFetch<SupplierInvite[]>(`/api/admin/invites${query ? `?${query}` : ""}`, {
    auth: true,
  });
}

export function createSupplierInvite(input: CreateSupplierInviteInput): Promise<SupplierInvite> {
  return apiFetch<SupplierInvite>("/api/admin/invites", {
    method: "POST",
    auth: true,
    jsonBody: input,
  });
}

export function revokeSupplierInvite(id: string): Promise<void> {
  return apiFetch<void>(`/api/admin/invites/${id}`, { method: "DELETE", auth: true });
}

// ── Public invite (preview + accept) ──

export interface InvitePreview {
  supplierName: string;
  supplierSlug: string;
  role: SupplierMemberRole;
  invitedEmail: string;
  expiresAt: string;
  isExpired: boolean;
  isAccepted: boolean;
  isRevoked: boolean;
}

export function previewInvite(token: string): Promise<InvitePreview> {
  return apiFetch<InvitePreview>(`/api/invites/${encodeURIComponent(token)}`);
}

export function acceptInvite(token: string): Promise<void> {
  return apiFetch<void>(`/api/invites/${encodeURIComponent(token)}/accept`, {
    method: "POST",
    auth: true,
  });
}

// ── Moderation ──

export interface PendingProduct {
  id: string;
  slug: string;
  name: string;
  family: string;
  category: string;
  supplierId: string;
  supplierName: string;
  createdAt: string;
}

export interface PendingCategory {
  id: string;
  slug: string;
  name: string;
  family: string;
  path: string;
  suggestedBySupplierId: string | null;
  suggestedBySupplierName: string | null;
}

export function listPendingProducts(): Promise<PendingProduct[]> {
  return apiFetch<PendingProduct[]>("/api/admin/moderation/products", { auth: true });
}

export function approveProduct(id: string): Promise<void> {
  return apiFetch<void>(`/api/admin/moderation/products/${id}/approve`, {
    method: "POST",
    auth: true,
  });
}

export function rejectProduct(id: string): Promise<void> {
  return apiFetch<void>(`/api/admin/moderation/products/${id}/reject`, {
    method: "POST",
    auth: true,
  });
}

export function listPendingCategories(): Promise<PendingCategory[]> {
  return apiFetch<PendingCategory[]>("/api/admin/moderation/categories", { auth: true });
}

export function approveCategory(id: string): Promise<void> {
  return apiFetch<void>(`/api/admin/moderation/categories/${id}/approve`, {
    method: "POST",
    auth: true,
  });
}

export function rejectCategory(id: string): Promise<void> {
  return apiFetch<void>(`/api/admin/moderation/categories/${id}/reject`, {
    method: "POST",
    auth: true,
  });
}

// ── Audit log ──

export interface AuditLogEntry {
  id: string;
  actorUserId: string | null;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string;
  diff: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface AuditLogPage {
  entries: AuditLogEntry[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface AuditLogFilters {
  actorUserId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export function searchAuditLog(filters: AuditLogFilters = {}): Promise<AuditLogPage> {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  }
  const query = q.toString();
  return apiFetch<AuditLogPage>(`/api/admin/audit-log${query ? `?${query}` : ""}`, {
    auth: true,
  });
}

// ══════════════════════════════════════════════════════════════════════════
// Phase 7b/c — Supplier portal client
// ══════════════════════════════════════════════════════════════════════════

export type ProductStatus = "Draft" | "Pending" | "Published" | "Hidden" | "Removed";
export type CategoryStatus = "Pending" | "Approved";
export type ProductFamily = "Furniture" | "Lighting" | "Appliance" | "BuildingMaterial" | "Fixture";
export type UnitOfSale = "Piece" | "SquareMeter" | "Liter" | "LinearMeter" | "Kilogram";

// ── Products ──

export interface SupplierProductSummary {
  id: string;
  slug: string;
  name: string;
  family: ProductFamily;
  categoryId: string;
  categoryName: string;
  status: ProductStatus;
  unitOfSale: UnitOfSale;
  basePrice: number | null;
  currency: string;
  variantCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierVariant {
  id: string;
  productId: string;
  sku: string;
  name: string;
  width: number;
  depth: number;
  height: number;
  color: string;
  basePrice: number | null;
  currency: string;
  glbAssetId: string | null;
  glbAssetUrl: string | null;
  svgPreviewAssetId: string | null;
  svgPreviewAssetUrl: string | null;
  /** jsonb string: [{ offsetX, offsetZ, width, depth }, …] */
  collisionBoxes: string | null;
  /** jsonb string: {slotName: hexColor} */
  materialDefaults: string | null;
  attributes: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierProductDetail {
  id: string;
  supplierId: string;
  slug: string;
  name: string;
  family: ProductFamily;
  categoryId: string;
  categoryName: string;
  status: ProductStatus;
  unitOfSale: UnitOfSale;
  coverageRate: number | null;
  wasteFactor: number;
  leadTimeDays: number | null;
  description: string | null;
  previewSvg: string | null;
  textureUrl: string | null;
  attributes: string;
  variants: SupplierVariant[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductInput {
  supplierId: string;
  family: ProductFamily;
  categoryId: string;
  slug: string;
  name: string;
  description?: string | null;
  unitOfSale: UnitOfSale;
  coverageRate?: number | null;
  wasteFactor: number;
  leadTimeDays?: number | null;
  previewSvg?: string | null;
  textureUrl?: string | null;
  attributes?: string | null;
}

export interface UpdateProductInput {
  categoryId: string;
  name: string;
  description?: string | null;
  unitOfSale: UnitOfSale;
  coverageRate?: number | null;
  wasteFactor: number;
  leadTimeDays?: number | null;
  previewSvg?: string | null;
  textureUrl?: string | null;
  attributes?: string | null;
}

export function listSupplierProducts(filters: {
  supplierId?: string;
  status?: ProductStatus;
  search?: string;
} = {}): Promise<SupplierProductSummary[]> {
  const q = new URLSearchParams();
  if (filters.supplierId) q.set("supplierId", filters.supplierId);
  if (filters.status) q.set("status", filters.status);
  if (filters.search) q.set("search", filters.search);
  const query = q.toString();
  return apiFetch<SupplierProductSummary[]>(
    `/api/supplier/products${query ? `?${query}` : ""}`,
    { auth: true }
  );
}

export function getSupplierProduct(id: string): Promise<SupplierProductDetail> {
  return apiFetch<SupplierProductDetail>(`/api/supplier/products/${id}`, { auth: true });
}

export function createSupplierProduct(input: CreateProductInput): Promise<SupplierProductDetail> {
  return apiFetch<SupplierProductDetail>("/api/supplier/products", {
    method: "POST",
    auth: true,
    jsonBody: input,
  });
}

export function updateSupplierProduct(id: string, input: UpdateProductInput): Promise<SupplierProductDetail> {
  return apiFetch<SupplierProductDetail>(`/api/supplier/products/${id}`, {
    method: "PUT",
    auth: true,
    jsonBody: input,
  });
}

export function publishSupplierProduct(id: string): Promise<void> {
  return apiFetch<void>(`/api/supplier/products/${id}/publish`, { method: "POST", auth: true });
}

export function hideSupplierProduct(id: string): Promise<void> {
  return apiFetch<void>(`/api/supplier/products/${id}/hide`, { method: "POST", auth: true });
}

export function removeSupplierProduct(id: string): Promise<void> {
  return apiFetch<void>(`/api/supplier/products/${id}/remove`, { method: "POST", auth: true });
}

// ── Variants ──

export interface CreateVariantInput {
  sku: string;
  name: string;
  width: number;
  depth: number;
  height: number;
  color: string;
  basePrice?: number | null;
  currency: string;
  collisionBoxes?: string | null;
  materialDefaults?: string | null;
  attributes?: string | null;
  sortOrder?: number | null;
}

export interface UpdateVariantInput {
  name: string;
  width: number;
  depth: number;
  height: number;
  color: string;
  basePrice?: number | null;
  currency: string;
  collisionBoxes?: string | null;
  materialDefaults?: string | null;
  attributes?: string | null;
  sortOrder?: number | null;
}

export function createVariant(productId: string, input: CreateVariantInput): Promise<SupplierVariant> {
  return apiFetch<SupplierVariant>(`/api/supplier/products/${productId}/variants`, {
    method: "POST",
    auth: true,
    jsonBody: input,
  });
}

export function updateVariant(id: string, input: UpdateVariantInput): Promise<SupplierVariant> {
  return apiFetch<SupplierVariant>(`/api/supplier/variants/${id}`, {
    method: "PUT",
    auth: true,
    jsonBody: input,
  });
}

export function deleteVariant(id: string): Promise<void> {
  return apiFetch<void>(`/api/supplier/variants/${id}`, { method: "DELETE", auth: true });
}

export function attachVariantGlb(id: string, assetId: string): Promise<void> {
  return apiFetch<void>(`/api/supplier/variants/${id}/attach-glb`, {
    method: "POST",
    auth: true,
    jsonBody: { assetId },
  });
}

export function attachVariantPreview(id: string, assetId: string): Promise<void> {
  return apiFetch<void>(`/api/supplier/variants/${id}/attach-preview`, {
    method: "POST",
    auth: true,
    jsonBody: { assetId },
  });
}

// ── Textures ──

export interface SupplierTextureRow {
  id: string;
  supplierId: string;
  name: string;
  assetId: string;
  assetUrl: string;
  thumbnailAssetId: string | null;
  thumbnailAssetUrl: string | null;
  tags: string[];
  repeatU: number;
  repeatV: number;
  slotBindingCount: number;
  createdAt: string;
}

export interface CreateTextureInput {
  supplierId: string;
  name: string;
  assetId: string;
  thumbnailAssetId?: string | null;
  tags?: string[];
  repeatU?: number;
  repeatV?: number;
}

export interface UpdateTextureInput {
  name: string;
  thumbnailAssetId?: string | null;
  tags?: string[];
  repeatU?: number;
  repeatV?: number;
}

export interface VariantTextureSlot {
  id: string;
  variantId: string;
  slotName: string;
  supplierTextureId: string;
  supplierTextureName: string;
  assetUrl: string;
  isDefault: boolean;
}

export function listSupplierTextures(supplierId?: string): Promise<SupplierTextureRow[]> {
  const q = supplierId ? `?supplierId=${supplierId}` : "";
  return apiFetch<SupplierTextureRow[]>(`/api/supplier/textures${q}`, { auth: true });
}

export function createSupplierTexture(input: CreateTextureInput): Promise<SupplierTextureRow> {
  return apiFetch<SupplierTextureRow>("/api/supplier/textures", {
    method: "POST",
    auth: true,
    jsonBody: input,
  });
}

export function updateSupplierTexture(id: string, input: UpdateTextureInput): Promise<SupplierTextureRow> {
  return apiFetch<SupplierTextureRow>(`/api/supplier/textures/${id}`, {
    method: "PUT",
    auth: true,
    jsonBody: input,
  });
}

export function deleteSupplierTexture(id: string): Promise<void> {
  return apiFetch<void>(`/api/supplier/textures/${id}`, { method: "DELETE", auth: true });
}

export function listVariantTextureSlots(variantId: string): Promise<VariantTextureSlot[]> {
  return apiFetch<VariantTextureSlot[]>(`/api/supplier/variants/${variantId}/texture-slots`, { auth: true });
}

export function replaceVariantTextureSlots(
  variantId: string,
  slots: { slotName: string; supplierTextureId: string; isDefault: boolean }[]
): Promise<VariantTextureSlot[]> {
  return apiFetch<VariantTextureSlot[]>(`/api/supplier/variants/${variantId}/texture-slots`, {
    method: "PUT",
    auth: true,
    jsonBody: { slots },
  });
}

// ── Categories (supplier-suggested) ──

export interface SuggestedCategoryRow {
  id: string;
  family: ProductFamily;
  parentCategoryId: string | null;
  slug: string;
  name: string;
  path: string;
  status: CategoryStatus;
  suggestedBySupplierId: string | null;
}

export function listSuggestedCategories(supplierId?: string): Promise<SuggestedCategoryRow[]> {
  const q = supplierId ? `?supplierId=${supplierId}` : "";
  return apiFetch<SuggestedCategoryRow[]>(`/api/supplier/categories${q}`, { auth: true });
}

export function suggestCategory(input: {
  supplierId: string;
  family: ProductFamily;
  parentCategoryId?: string | null;
  name: string;
}): Promise<SuggestedCategoryRow> {
  return apiFetch<SuggestedCategoryRow>("/api/supplier/categories", {
    method: "POST",
    auth: true,
    jsonBody: input,
  });
}

// ── Members + Owner-side invites ──

export interface SupplierMemberRow {
  id: string;
  supplierId: string;
  userId: string;
  userEmail: string;
  userDisplayName: string | null;
  role: SupplierMemberRole;
  createdAt: string;
}

export function listSupplierPortalMembers(supplierId: string): Promise<SupplierMemberRow[]> {
  return apiFetch<SupplierMemberRow[]>(`/api/supplier/members?supplierId=${supplierId}`, { auth: true });
}

export function changeSupplierMemberRole(memberId: string, role: SupplierMemberRole): Promise<void> {
  return apiFetch<void>(`/api/supplier/members/${memberId}/role`, {
    method: "PUT",
    auth: true,
    jsonBody: { role },
  });
}

export function removeSupplierMember(memberId: string): Promise<void> {
  return apiFetch<void>(`/api/supplier/members/${memberId}`, { method: "DELETE", auth: true });
}

export function listSupplierPortalInvites(
  supplierId: string,
  opts: { includeRevoked?: boolean; includeAccepted?: boolean } = {}
): Promise<SupplierInvite[]> {
  const q = new URLSearchParams({ supplierId });
  if (opts.includeRevoked !== undefined) q.set("includeRevoked", String(opts.includeRevoked));
  if (opts.includeAccepted !== undefined) q.set("includeAccepted", String(opts.includeAccepted));
  return apiFetch<SupplierInvite[]>(`/api/supplier/invites?${q}`, { auth: true });
}

export function createSupplierPortalInvite(input: CreateSupplierInviteInput): Promise<SupplierInvite> {
  return apiFetch<SupplierInvite>("/api/supplier/invites", {
    method: "POST",
    auth: true,
    jsonBody: input,
  });
}

export function revokeSupplierPortalInvite(id: string): Promise<void> {
  return apiFetch<void>(`/api/supplier/invites/${id}`, { method: "DELETE", auth: true });
}

// ── Profile (Owner-only edit) ──

export interface SupplierProfile {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  websiteUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  logoAssetId: string | null;
  logoAssetUrl: string | null;
  isTrusted: boolean;
  suspendedAt: string | null;
}

export interface UpdateProfileInput {
  name: string;
  description?: string | null;
  websiteUrl?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  logoAssetId?: string | null;
}

export function getSupplierProfile(supplierId: string): Promise<SupplierProfile> {
  return apiFetch<SupplierProfile>(`/api/supplier/profile/${supplierId}`, { auth: true });
}

export function updateSupplierProfile(
  supplierId: string,
  input: UpdateProfileInput
): Promise<SupplierProfile> {
  return apiFetch<SupplierProfile>(`/api/supplier/profile/${supplierId}`, {
    method: "PUT",
    auth: true,
    jsonBody: input,
  });
}

// ── Upload helper: presign → PUT to R2 → finalize ──────────────────────────
//
// Wraps the three-step asset upload flow into a single async call that returns
// the new asset row. Callers pass the supplier id + a File and pick the right
// AssetKind; the helper figures out content type + size from the File metadata.
//
// Throws ApiError if presign or finalize fails. If the R2 PUT itself fails
// (e.g. dev environment has no real bucket), the error surfaces as a regular
// Error from fetch — the UI should handle both gracefully.

export interface UploadedAsset {
  id: string;
  url: string;
  kind: SupplierAssetKindWire;
  mimeType: string;
  sizeBytes: number;
}

export async function uploadSupplierFile(
  supplierId: string,
  file: File,
  kind: SupplierAssetKindWire
): Promise<UploadedAsset> {
  const contentType = file.type || "application/octet-stream";
  const presign = await presignSupplierAsset({
    supplierId,
    kind,
    contentType,
    sizeBytes: file.size,
    originalFileName: file.name,
  });

  const putResponse = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: presign.requiredHeaders,
    body: file,
  });
  if (!putResponse.ok) {
    throw new Error(
      `Upload to object storage failed (${putResponse.status}). ` +
        `If this is local dev, R2 may not be configured.`
    );
  }

  const asset = await createSupplierAsset({
    supplierId,
    key: presign.key,
    kind,
    mimeType: contentType,
    sizeBytes: file.size,
  });
  return {
    id: asset.id,
    url: asset.url,
    kind: kind,
    mimeType: contentType,
    sizeBytes: file.size,
  };
}
