# Dizajno Backend

.NET 10 Web API serving the Dizajno room designer. Phase 1 delivers identity, the
catalog API for the existing 12 furniture items, and an idempotent seeder. Later
phases add projects/scenes, sharing, quotes, supplier portal — see the top-level
schema plan for the roadmap.

## Prerequisites

- **.NET 10 SDK** — `dotnet --version` should report `10.0.x`.
  If `dotnet --list-sdks` doesn't show a 10.x line, install with `winget install --id Microsoft.DotNet.SDK.10` (requires admin) or run the user-scope install script:
  `Invoke-WebRequest https://dot.net/v1/dotnet-install.ps1 -OutFile $env:TEMP\dotnet-install.ps1; & "$env:TEMP\dotnet-install.ps1" -Channel 10.0 -InstallDir "$env:LOCALAPPDATA\Microsoft\dotnet"`,
  then prepend `%LOCALAPPDATA%\Microsoft\dotnet` to your PATH.
- **Docker Desktop** — needed for local Postgres and the integration tests
- **PowerShell or Bash** — examples below assume PowerShell on Windows

## Quick start

From `backend/`:

```powershell
# 1. Bring up Postgres + Adminer
docker compose up -d

# 2. Apply migrations
dotnet ef database update --project src/Dizajno.Data --startup-project src/Dizajno.Api

# 3. Run the API (auto-seeds roles, admin user, 12 furniture products on first start)
dotnet run --project src/Dizajno.Api
```

Then:
- API: <http://localhost:5000>
- Swagger: <http://localhost:5000/swagger> (`/` redirects here in Development)
- Adminer: <http://localhost:8081>  → System `PostgreSQL`, Server `postgres`, Username `dizajno`, Password `dizajno-dev`, Database `dizajno`

Default admin: `admin@dizajno.local` / `Admin1234!` (dev only; override via env vars).

## Project layout

```
backend/
├── Dizajno.sln
├── NuGet.config                    pins nuget.org as the package source
├── docker-compose.yml              Postgres 16-alpine + Adminer
├── .config/dotnet-tools.json       local dotnet-ef tool manifest
├── src/
│   ├── Dizajno.Domain/             pure entities + enums (no deps)
│   ├── Dizajno.Dto/                one record per file under Auth/ Catalog/ Project/ Quote/
│   │                               Asset/ Share/ Admin/ Supplier/ — wire-shape DTOs only
│   ├── Dizajno.Application/        business logic
│   │   ├── Interfaces/             IAuthService, ICatalogService, IProjectService, IQuoteService,
│   │   │                           IAssetService, IInviteService, ISharedProjectService,
│   │   │                           IAdmin* (5), ISupplier* (9),
│   │   │                           IJwtTokenService, IAuditLogger, IObjectStorage,
│   │   │                           ISupplierMembershipResolver + SupplierMembershipExtensions
│   │   ├── Options/                JwtOptions, R2Options, InviteOptions
│   │   ├── Services/               21 service implementations (mechanical lift of all controllers)
│   │   │                           plus AnchorParser, InviteTokenFactory, AssetUploadRules helpers
│   │   └── DependencyInjection.cs  AddApplication() — registers all 21 business services
│   ├── Dizajno.Data/               persistence layer
│   │   ├── DizajnoDbContext.cs
│   │   ├── Identity/               ApplicationUser, RefreshToken (kept with DbContext —
│   │   │                           persistence-layer entity types, not Domain)
│   │   ├── Configurations/         24 IEntityTypeConfiguration<T> files
│   │   ├── Migrations/             0001_Foundation … 0010_AssetOwnerNonUnique + snapshot
│   │   ├── Seed/                   IDataSeeder, SeedOptions, DataSeeder + CatalogSeedData
│   │   └── DependencyInjection.cs  AddData() — DbContext + AddIdentityCore + IDataSeeder
│   ├── Dizajno.Infrastructure/     plumbing only
│   │   ├── Auth/JwtTokenService.cs       (impl of IJwtTokenService)
│   │   ├── Audit/AuditLogger.cs          (impl of IAuditLogger)
│   │   ├── Storage/S3ObjectStorage.cs    (impl of IObjectStorage)
│   │   ├── Suppliers/SupplierMembershipResolver.cs (impl of ISupplierMembershipResolver)
│   │   └── DependencyInjection.cs  AddInfrastructure() — 4 plumbing services + IHttpContextAccessor
│   └── Dizajno.Api/                ASP.NET Core host
│       ├── Program.cs              wiring (Swagger, CORS, JWT, seeder invocation),
│       │                           calls AddData → AddApplication → AddInfrastructure
│       ├── Controllers/            21 thin pass-through controllers (each ~30–110 lines)
│       │                           Auth, Catalog, Projects, Quotes, Assets, Invites,
│       │                           SharedProjects, 5 Admin*, 9 Supplier*
│       ├── Properties/launchSettings.json   pins HTTP to :5000
│       ├── appsettings.json
│       └── appsettings.Development.json
└── tests/
    └── Dizajno.IntegrationTests/   Testcontainers + WebApplicationFactory<Program>
                                    122 tests covering all endpoints
```

Clean Architecture-ish layering (DAG, no cycles):

- **Api** → Dto + Application + Data + Infrastructure
- **Application** → Domain + Dto + Data (services use DbContext directly per
  the mechanical-lift refactor; ActionResult<T> via Microsoft.AspNetCore.App framework ref)
- **Infrastructure** → Application + Domain + Data (services use DbContext + ApplicationUser)
- **Data** → Domain
- **Dto** → Domain (enum references)
- **Domain** depends on nothing

## Configuration

All configuration is bound from `appsettings*.json` plus environment variables.
Environment variables use the standard double-underscore syntax:
`DIZAJNO_ConnectionStrings__Dizajno=...`.

| Section / Key | Required | Default (Development) | Notes |
|---|---|---|---|
| `ConnectionStrings:Dizajno` | yes | localhost:5433 dizajno/dizajno-dev | Postgres connection string |
| `JwtSettings:Issuer` | yes | `dizajno` | |
| `JwtSettings:Audience` | yes | `dizajno-clients` | |
| `JwtSettings:SigningKey` | yes | dev-only string | **Override in production** (≥32 bytes for HMAC-SHA256) |
| `JwtSettings:AccessTokenLifetimeMinutes` | no | `15` | |
| `JwtSettings:RefreshTokenLifetimeDays` | no | `30` | |
| `Seed:AdminEmail` | yes | `admin@dizajno.local` | |
| `Seed:AdminPassword` | yes | `Admin1234!` (Development only) | **Override in production** |
| `Seed:AdminDisplayName` | no | `Dizajno Admin` | |
| `R2:AccountId` | no¹ | empty | Cloudflare account id |
| `R2:AccessKeyId` | no¹ | empty | R2 API token access key |
| `R2:SecretAccessKey` | no¹ | empty | R2 API token secret |
| `R2:Bucket` | no¹ | empty | Bucket name (e.g. `dizajno-assets`) |
| `R2:PublicBaseUrl` | no¹ | empty | Public asset base URL (R2.dev or custom domain), no trailing slash |
| `R2:PresignedUrlLifetimeMinutes` | no | `10` | TTL for presigned PUT URLs |

¹ `R2:*` keys are only required if you call the asset upload endpoints
(`/api/admin/assets/*`). The API boots fine without them; the endpoints surface a
clear configuration error on first use.

Production: set `Seed:AdminPassword` and `JwtSettings:SigningKey` via environment
variables or a secret manager — never check the production values into git.

## Database

### Migrations

```powershell
# Apply pending migrations
dotnet ef database update --project src/Dizajno.Data --startup-project src/Dizajno.Api

# Create a new migration
dotnet ef migrations add MigrationName --project src/Dizajno.Data --startup-project src/Dizajno.Api --output-dir Migrations

# Roll back to a specific migration
dotnet ef database update 0002_RefreshTokens --project src/Dizajno.Data --startup-project src/Dizajno.Api

# List migrations
dotnet ef migrations list --project src/Dizajno.Data --startup-project src/Dizajno.Api
```

`dotnet ef` is installed as a local tool (manifest at `backend/.config/dotnet-tools.json`).
If you clone the repo on a fresh machine, run `dotnet tool restore` once from `backend/`.

### Seeder

Runs on every API startup via `IDataSeeder.SeedAsync`. Idempotent — each step
skips when its data is already present.

What gets seeded:

1. Roles `Admin`, `User`
2. Admin user from `Seed:AdminEmail` / `Seed:AdminPassword` (assigned both roles)
3. Supplier `dizajno`
4. Furniture categories: Bedroom, Seating, Storage, Tables
5. 12 furniture products from `Dizajno.Data.Seed.CatalogSeedData`

`CatalogSeedData.cs` mirrors `frontend/src/utils/furnitureCatalog.ts` — SVG previews
included verbatim as raw string literals. Once a supplier portal lands, this file
becomes obsolete.

### Connection string

`appsettings.Development.json` points at the Docker container on **port 5433**
(not 5432) because most dev machines already have a Postgres service on 5432.
If you change the host port in `docker-compose.yml`, update the connection string
in `appsettings.Development.json` to match.

## Endpoints

### Health

- `GET /health` — `{ status: "ok", service, timeUtc }`
- `GET /` — 302 redirect to `/swagger` (Development only)

### Auth (`/api/auth`)

- `POST /register` — `{ email, password, displayName?, locale? }` → 201 with `AuthResponse` + `dizajno_rt` HttpOnly cookie
- `POST /login` — `{ email, password }` → 200 with `AuthResponse` + cookie
- `POST /refresh` — cookie only → 200 with rotated `AuthResponse` + new cookie
- `POST /logout` — cookie only → 204; revokes the refresh token
- `GET /me` — `[Authorize]` → `UserSummary` of the bearer subject

Tokens:

- Access: HS256 JWT, 15 min, claims `sub` / `email` / `jti` + roles
- Refresh: 32 random bytes, base64url, SHA-256 hashed in `refresh_tokens`. Rotated
  on every refresh, with `replaced_by_token_id` linking the chain for audit.

Cookie: `dizajno_rt`, HttpOnly, SameSite=Lax, Secure in non-Development, Path=`/api/auth`.

### Catalog (`/api/catalog`)

All GET, no auth required in Phase 1.

- `GET /products[?family=&category=]` → `FurnitureItemDto[]`
- `GET /products/{slug}` → `FurnitureItemDto` or 404
- `GET /categories[?family=]` → `CategoryDto[]`
- `GET /suppliers` → `SupplierDto[]`

DTO shape mirrors `frontend/src/types/designer.ts` `FurnitureCatalogItem` so the
frontend can deserialize without renaming. Phase 6 added four fields:

- `family` — `Furniture | Lighting | Appliance | BuildingMaterial | Fixture`. Frontend uses this to filter the place-furniture sidebar (Furniture only) and the branded-fixture picker (Fixture only) and the materials section (BuildingMaterial only).
- `unitOfSale` — `Piece | SquareMeter | Liter | LinearMeter | Kilogram`. Drives the materials-section quantity calculation + the `quantityUnit` token sent on aggregated material quote lines.
- `coverageRate` — nullable numeric, m² per Liter; only set for paint/sealant rows. Used to suggest paint quantity from paintable wall area.
- `wasteFactor` — numeric overage suggestion (e.g. `0.10` = +10%). Applied to the auto-suggested material quantity at quote time.
- `textureUrl` — nullable varchar (Phase 6.5). Tileable image URL the `FloorMesh` / `WallMesh` renderer loads via `THREE.TextureLoader` with `RepeatWrapping`. When null or the file is missing, the renderer falls back to the variant's solid `color`. Today the URLs point at `frontend/public/textures/{slug}.jpg`; the JPG files are user-provided.

Current Phase 6 catalog rows (priced in EUR):

- `solid-oak-door` (€220), `pvc-window` (€135) — Fixture, Piece
- `interior-matt-paint` (€4/L, 10 m²/L coverage, 10% waste), `premium-eco-paint` (€9/L, 12 m²/L, 10%), `exterior-weather-paint` (€6/L, 8 m²/L, 10%) — BuildingMaterial, Liter
- `oak-laminate-flooring` (€18/m², 5% waste), `budget-vinyl-flooring` (€11/m², 7%), `engineered-hardwood` (€45/m², 5%) — BuildingMaterial, SquareMeter

The 12 Phase-1 furniture rows default to `family = "Furniture"`, `unitOfSale = "Piece"`, `coverageRate = null`, `wasteFactor = 0`, and now also carry concrete `basePrice` values (sofa €499, bed €380, chair €120, …) so the request-quote dialog shows real per-supplier subtotals. `DataSeeder.BackfillVariantPricesAsync` runs at startup and writes prices into any existing variant rows where `BasePrice IS NULL` — so an existing dev DB picks up the pricing pass without a wipe.

### Projects (`/api/projects`)

All endpoints require a bearer token. Ownership is enforced server-side — a
project belonging to user A 404s for user B (no distinction from "not found",
which avoids id enumeration).

- `GET /` `?skip&take` — paginated list of the caller's non-deleted projects,
  most-recently-updated first (`ProjectSummaryDto[]`)
- `POST /` — `{ name }` → 201 `ProjectDetailDto` with an empty scene
- `GET /{id}` → `ProjectDetailDto` (full scene + version summaries)
- `PUT /{id}` — `{ name?, thumbnailAssetId? }` → 200 `ProjectSummaryDto`
- `PUT /{id}/scene` — replace-all of walls/floors/openings/placedItems; `{ scene: { walls, floors, openings, placedItems } }` → 200 `ProjectDetailDto`
- `POST /{id}/versions` — `{ label }` → 201 `ProjectVersionSummaryDto`; snapshots the live scene as jsonb
- `POST /{id}/versions/{versionId}/restore` → 200 `ProjectDetailDto`; restores the snapshot in place
- `DELETE /{id}` → 204; soft-delete (`deleted_at` set, row stays for audit)

Scene shape:
- The client owns ids — all wall/floor/opening/placedItem ids are uuids generated
  client-side and round-trip unchanged on PUT/GET. Openings reference walls by
  uuid; the server rejects a PUT that contains an opening pointing at a wall id
  not present in the same payload.
- `PUT /{id}/scene` is a full replace inside a single transaction: existing
  walls/floors/openings/placedItems are deleted, the new set is inserted. There
  is no PATCH today; small edits should debounce on the client and resend the
  whole scene.
- Phase 6.5: `WallDto.paintProductVariantId` and `FloorDto.flooringProductVariantId`
  are optional nullable FKs to a Paint / Flooring variant. When set, the renderer
  skins the surface with the variant's texture (see "Catalog" above) and the
  quote-fan-out picks the assignment up as an aggregated material line. The
  scene endpoint round-trips them via `PUT /scene` like any other field.

### Admin assets (`/api/admin/assets`)

All endpoints require the `Admin` role.

- `POST /presign` — `{ kind, contentType, sizeBytes, originalFileName?, checksumSha256? }`
  → `{ key, uploadUrl, expiresAt, publicUrl, requiredHeaders }`. Returns a short-lived
  PUT URL the client uses to upload the file directly to R2. Per-kind MIME and size
  caps are enforced before signing (see `AssetUploadRules` in `AssetsController.cs`).
- `POST /` — `{ key, kind, mimeType, sizeBytes, checksumSha256?, productId?, variantId?, ownerSupplierId?, sortOrder }`
  → 201 `AssetDto`. Records the completed upload as an `Asset` row whose URL is
  derived from `R2:PublicBaseUrl` + `key`.

Upload flow:

1. Client `POST /presign` with the file's `Content-Type` and `sizeBytes`.
2. Client PUTs the bytes to `uploadUrl` with every header from `requiredHeaders`
   (notably `Content-Type` and `Content-Length` — the signature includes them).
3. Once the PUT returns 200, client `POST /` with the same `key` to persist
   the `Asset` row.

### Quotes (`/api/quotes`, `/api/projects/{id}/quotes`)

Requester side — all endpoints require a bearer token, ownership 404s on foreign
ids. See [QuotesController.cs](src/Dizajno.Api/Controllers/QuotesController.cs).

- `POST /api/projects/{id}/quotes` — `{ message?, manualLines? }` → 201 `QuoteDetailDto`.
  Folds five sources into a single line stream and groups by `variant.product.supplier_id`:
  - the project's `placed_items` (Phase 5)
  - `openings WHERE product_variant_id IS NOT NULL` (Phase 6 branded fixtures)
  - the optional `manualLines: [{ productVariantId, quantity, quantityUnit }]` array
    (Phase 6 — preserved as a legacy API surface; the Phase-6.5 dialog no longer uses it)
  - `floors WHERE flooring_product_variant_id IS NOT NULL` — aggregated one line per
    distinct flooring variant; `quantity = Σ(floorArea) × (1 + wasteFactor)` m²
  - `walls WHERE paint_product_variant_id IS NOT NULL` — aggregated one line per
    distinct paint variant; `quantity = ceil(Σ(paintableWallArea) / coverageRate × (1 + wasteFactor))` L,
    where `paintableWallArea = length × height − Σ(opening areas on that wall)`

  Inserts one `Quote` parent + N `QuoteRequest` rows + M `QuoteLine` rows in one
  transaction. Each line gets a frozen `variant_snapshot` jsonb so the supplier
  view stays meaningful even if the catalog changes. 400 if **all five** sources
  are empty. 400 if any manual-line `productVariantId` is missing or its product
  isn't `Published`.
- `GET /api/quotes?status=&skip=&take=` — paginated list of the caller's quotes
  with per-status supplier roll-up counts.
- `GET /api/quotes/{id}` → `QuoteDetailDto` — every QuoteRequest (supplier name +
  status), lines, response + attachment URLs.
- `POST /api/quotes/{id}/cancel` → 204; sets `status = Cancelled` and propagates
  `Expired` to still-`Pending` children so suppliers see the request is gone.
- `POST /api/quotes/{id}/close` → 204; requires ≥1 response. 409 otherwise.

### Supplier quotes (`/api/supplier/quotes`)

Gated by `ISupplierMembershipResolver` — endpoints 403 the caller if they have
no `supplier_members` rows. Admins are **not** implicit suppliers (they must be
bound explicitly).

- `GET /api/supplier/quotes?status=&skip=&take=` → `SupplierQuoteRequestSummaryDto[]`.
  Returns only `QuoteRequest`s whose supplier the caller is a member of.
- `GET /api/supplier/quotes/{requestId}` → `SupplierQuoteRequestDetailDto`. Lines
  + prior response. Does **not** expose sibling-supplier lines or prices.
- `POST /api/supplier/quotes/{requestId}/respond` —
  `{ totalPrice, currency, body?, attachmentAssetIds }` → 200 `QuoteResponseDto`.
  Upserts on the unique `(quote_request_id)` so the same endpoint also serves as
  the edit path. Attachments must be assets with `owner_supplier_id == membership.supplier_id`;
  foreign asset ids return 400. 409 if the parent quote is `Closed | Cancelled`.
- `POST /api/supplier/quotes/{requestId}/decline` — `{ reason? }` → 204; status
  flips to `Declined` and a zero-priced response captures the reason for the
  requester's inbox.

### Supplier assets (`/api/supplier/assets`)

Supplier-scoped wrapper around the R2 presign + finalize flow. Used by quote
responses today; Phase 7 will reuse it for product uploads from the portal.

- `POST /api/supplier/assets/presign` —
  `{ supplierId, kind, contentType, sizeBytes, originalFileName?, checksumSha256? }`
  → `PresignAssetUploadResponse`. Caller must be a member of `supplierId`;
  `kind` is restricted to `Image | Doc | Attachment`. Keys live under
  `suppliers/{supplierId}/{kind}/…`.
- `POST /api/supplier/assets` —
  `{ supplierId, key, kind, mimeType, sizeBytes, checksumSha256? }` → 201 `AssetDto`.
  Persists with `owner_supplier_id = supplierId` once the R2 PUT has completed.

### Admin supplier members (`/api/admin/supplier-members`)

Phase-5 stopgap. Phase 7a ships the proper tokenized invite flow alongside;
this endpoint is still useful for direct binding from tests + Swagger.

- `GET /api/admin/supplier-members?supplierId=&userId=` → `SupplierMemberDto[]`.
- `POST /api/admin/supplier-members` — `{ supplierId, userId, role: Owner|Staff }`
  → 201 (or 200 on idempotent re-bind, updating the role).
- `DELETE /api/admin/supplier-members/{id}` → 204.

### Admin suppliers (`/api/admin/suppliers`) — Phase 7a

All endpoints require the `Admin` role. Every state-changing action writes an
`audit_log` row via `IAuditLogger`.

- `GET /` — list (filters: `search`, `suspended`, `trusted`). Returns
  `AdminSupplierDto[]` with `memberCount` + `productCount`.
- `GET /{id}` — detail row.
- `POST /` — `{ slug, name, description?, websiteUrl?, contactEmail?, contactPhone? }`.
  Returns 201 + `AdminSupplierDto`; 409 on duplicate slug.
- `PUT /{id}` — update profile (name, description, contact info). Slug is immutable.
- `POST /{id}/suspend` — sets `suspended_at = now()`. Side-effects: catalog
  filter drops the supplier's products, supplier-portal endpoints reject
  members, every still-`Pending` `QuoteRequest` flips to `Expired` with
  `cancellation_reason = 'supplier_suspended'`. Idempotent.
- `POST /{id}/restore` — clears `suspended_at`. Idempotent.
- `POST /{id}/trust` — `is_trusted = true`. Untrusted suppliers' new products
  go to `Pending`; trusted suppliers auto-publish.
- `POST /{id}/untrust` — `is_trusted = false`.

### Admin invites (`/api/admin/invites`) — Phase 7a

Tokenized supplier-member invites. The raw token + `acceptUrl` are returned
**exactly once** on create — only `SHA-256(token)` is persisted.

- `POST /` — `{ supplierId, email, role: Owner|Staff, expiresInDays?: 1–90 }`.
  Returns 201 + `SupplierInviteDto` with `token` + `acceptUrl` populated. The
  email is a label only (no SMTP delivery).
- `GET /?supplierId=&includeRevoked=&includeAccepted=` — lists invites without
  the plaintext token.
- `DELETE /{id}` — sets `revoked_at`. Idempotent.

`InviteOptions` (bound from the `Invites` config section) controls
`AcceptUrlTemplate` (default `http://localhost:3000/invite/{token}`) and
`DefaultLifetimeDays` (14, clamped 1–90 per call).

### Public invite (`/api/invites/{token}`) — Phase 7a

- `GET /{token}` — anonymous. Returns `InvitePreviewDto` (supplier name + role
  + expiry status) so the accept page can render before forcing login.
- `POST /{token}/accept` — `[Authorize]`. Binds the caller as a
  `SupplierMember`. Idempotent on re-accept by the same user (NoContent).
  Returns 409 if a different user already accepted, 410 if revoked/expired.

### Admin moderation (`/api/admin/moderation`) — Phase 7a

- `GET /products` — `PendingProductDto[]` (every product with `status = Pending`).
- `POST /products/{id}/approve` → `Status.Published` (409 if not Pending).
- `POST /products/{id}/reject` → `Status.Hidden` (409 if not Pending).
- `GET /categories` — `PendingCategoryDto[]` with `suggestedBySupplierName` joined.
- `POST /categories/{id}/approve` → `CategoryStatus.Approved`.
- `POST /categories/{id}/reject` — deletes the row; 409 if any product still
  references the category.

### Admin audit-log (`/api/admin/audit-log`) — Phase 7a

- `GET /?actorUserId=&action=&entityType=&entityId=&from=&to=&page=&pageSize=`
  → `AuditLogPageDto`. Page size capped at 200; actor email is joined from
  Identity in a single second trip.

### Supplier products (`/api/supplier/products`) — Phase 7b

All endpoints require an active membership in the target supplier (suspended
members get 403). Lifecycle is supplier-driven: `Draft → Pending|Published →
Hidden ↔ Published → Removed`. Publish on a `Draft` lands in `Pending` for
untrusted suppliers (admin moderation queue picks up) or `Published` for
trusted suppliers. Publish on `Hidden` always goes to `Published` — already
moderated once. Removed is terminal; historical `QuoteLine.variant_snapshot`
preserves past quotes.

- `GET /?supplierId=&status=&search=` — list owned products (any status except
  Removed by default).
- `GET /{id}` — full detail with eager-loaded variants + assets.
- `POST /` — create as `Draft`. Slug must be unique across the catalog; category
  must be in the same `Family` + `Status = Approved`.
- `PUT /{id}` — update profile fields; family is immutable.
- `POST /{id}/publish` — Draft → Pending|Published (see lifecycle); 409 if no
  variants.
- `POST /{id}/hide` — Published → Hidden.
- `POST /{id}/remove` — terminal.

### Supplier variants (`/api/supplier/products/{productId}/variants` + `/api/supplier/variants/{id}`) — Phase 7b

- `POST /products/{productId}/variants` — create. SKU global-unique; SortOrder
  auto-increments.
- `PUT /variants/{id}` — update dimensions, color, base price, JSON fields.
- `DELETE /variants/{id}` — hard delete; 409 if any `PlacedItem` / `Opening` /
  `Wall.paint_product_variant_id` / `Floor.flooring_product_variant_id`
  references it.
- `POST /variants/{id}/attach-glb` — `{ assetId }`. Asset must be
  `Kind = Glb` AND `OwnerSupplierId = variant.product.supplierId`. Pass
  `Guid.Empty` to detach.
- `POST /variants/{id}/attach-preview` — same shape, expects `Kind = SvgPreview`.

### Supplier textures (`/api/supplier/textures` + `/api/supplier/variants/{id}/texture-slots`) — Phase 7b

Library entries reference an `Asset` of `Kind = Image` owned by the same
supplier. Per-variant slot bindings (e.g. `Body`, `Pillows` → which textures
are picker options) are stored as a list; the PUT endpoint replaces all
existing rows in one transaction.

- `GET /textures?supplierId=` — list.
- `POST /textures` — `{ supplierId, name, assetId, thumbnailAssetId?, tags[],
  repeatU, repeatV }`. `(supplierId, name)` unique.
- `PUT /textures/{id}` — update name/tags/repeat/thumbnail.
- `DELETE /textures/{id}` — 409 if any variant slot still references it.
- `GET /variants/{id}/texture-slots` — list slot bindings for one variant.
- `PUT /variants/{id}/texture-slots` — `{ slots: [{ slotName, supplierTextureId,
  isDefault }] }`. Full replacement. Cross-supplier texture refs 400 fail fast
  (DB trigger `trg_pv_texture_slot_supplier_match` is the belt-and-suspenders).

### Supplier categories (`/api/supplier/categories`) — Phase 7b

- `GET /?supplierId=` — list the supplier's suggestions (Pending + Approved).
- `POST /` — `{ supplierId, family, parentCategoryId?, name }`. Slug derived
  from name (`Pendant Lights` → `pendant-lights`); 409 on collision within the
  family. Parent (if specified) must already be `Approved` + same family.
  Lands as `CategoryStatus.Pending` with `SuggestedBySupplierId = supplierId`;
  admin moderation queue picks up.

### Supplier members (`/api/supplier/members`, Owner-only mutations) — Phase 7b

Both Owner and Staff can `GET`; only Owners can mutate. **Last-Owner
protection**: demoting or removing the last remaining Owner returns 409 with a
directive to promote another member first.

- `GET /?supplierId=` — roster.
- `PUT /{id}/role` — `{ role: Owner|Staff }`.
- `DELETE /{id}` — remove member.

### Supplier profile (`/api/supplier/profile/{supplierId}`, Owner-only edit) — Phase 7b

- `GET /{supplierId}` — visible to any active member.
- `PUT /{supplierId}` — `{ name, description, websiteUrl, contactEmail,
  contactPhone, logoAssetId? }`. Slug is immutable; `IsTrusted` + `SuspendedAt`
  stay admin-only. Logo asset must be `Kind = Image` owned by the same supplier.

### Supplier invites (`/api/supplier/invites`, Owner-only create/revoke) — Phase 7c

Owner-side mirror of `/api/admin/invites`. Same tokenized flow: 32 random bytes
base64url-encoded, only SHA-256 hash persisted, raw token + `acceptUrl`
returned exactly once. Audit-log actions are `supplier_invite.create_by_owner`
+ `supplier_invite.revoke_by_owner` so admins can tell apart admin-issued vs
supplier-issued invites in the trail.

- `GET /?supplierId=&includeRevoked=&includeAccepted=` — visible to any active
  member.
- `POST /` — `{ supplierId, email, role: Owner|Staff, expiresInDays?: 1–90 }`.
  Owner role required.
- `DELETE /{id}` — revoke. Owner role required. Already-accepted invites are
  no-op (204).

The accept side of the flow (`/api/invites/{token}/accept`) is the same Phase
7a endpoint — works for both admin-issued and supplier-issued invites.

### Migrating the Phase 1 seed assets to R2

The Phase 1 seeder stores frontend-relative URLs (e.g. `/models/sofa.glb`) on
catalog rows. After R2 is provisioned:

1. Configure `R2:*` env vars (or `appsettings.Development.json` overrides).
2. Run `dotnet run --project src/Dizajno.Api` and obtain an admin bearer token
   from `POST /api/auth/login`.
3. For each file under `frontend/public/models/` and `frontend/public/textures/`:
   - `POST /api/admin/assets/presign` with the appropriate `kind` / `contentType`.
   - PUT the bytes to the returned `uploadUrl`.
   - `POST /api/admin/assets` to persist.
4. Update `CatalogSeedData.cs` so `GlbAssetUrl` / texture URLs point at the new
   R2 public URLs, then drop and re-seed (or write a one-shot migration to UPDATE
   the existing rows).

`frontend/public/` files can stay in place as an offline-dev fallback until the
supplier portal (Phase 7) replaces the seeded catalog.

## Tests

```powershell
dotnet test tests/Dizajno.IntegrationTests
```

The test project uses:

- **xUnit** + **FluentAssertions**
- **Microsoft.AspNetCore.Mvc.Testing** — `WebApplicationFactory<Program>`
- **Testcontainers.PostgreSql** — spins up a real Postgres per test class

Tests apply migrations to the container DB in the factory's `InitializeAsync`,
then start the API host (which runs the seeder against the freshly migrated DB).
Each test class gets its own container — slower than sharing, but each class
sees a deterministic starting state.

Seven test classes today (79 tests):
- `CatalogEndpointsTests` — 16 tests (Phase 6: filter-by-family Fixture/BuildingMaterial,
  unfiltered categories returns 8 across 3 families, paint exposes coverage + waste,
  flooring exposes m² unit; pricing pass: every seeded variant carries a BasePrice)
- `AuthEndpointsTests` — 10 tests (Phase 5: added `UserSummary.SupplierMemberships` empty-by-default assertion)
- `AssetsEndpointsTests` — 8 tests (presign + finalize; uses `FakeObjectStorage`
  registered via `ConfigureTestServices`, so no live R2 credentials needed)
- `ProjectsEndpointsTests` — 13 tests (CRUD, scene replace-all, version snapshot/restore, ownership 404, thumbnail presign + attach)
- `SharingEndpointsTests` — 8 tests (Phase 3: share CRUD, public token scene load, comment list/post in view vs comment mode)
- `CustomizerTexturesTests` — 5 tests (Phase 4: catalog DTO from relational rows,
  variant attributes no longer stash `textureSlots`, seeder library + slot rows,
  cross-supplier trigger raises `PostgresException`)
- `QuotesEndpointsTests` — 19 tests (Phase 5: fan-out per supplier, ownership 404s,
  cancel propagates Expired, close-before-response 409, close-after-decline succeeds,
  `IsCustomSize` flip, supplier inbox member gating, respond happy path + idempotent
  upsert, cross-supplier attachment 400, cancelled-quote response 409, admin-bind RBAC 403;
  Phase 6: branded opening in fan-out, manual material lines accepted, unknown variant 400;
  Phase 6.5: flooring aggregates floor area, paint aggregates across walls, opening
  area subtracted from paintable surface)

## Troubleshooting

### `dotnet: command not found` after install

Winget installed .NET but PowerShell sessions started before the install still
have a stale PATH. Either:

```powershell
# Refresh PATH in the current session
$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')

# Or use the full path
& 'C:\Program Files\dotnet\dotnet.exe' run --project src/Dizajno.Api
```

Permanent fix: close all terminals (and VS Code if applicable) and reopen.

### `password authentication failed for user "dizajno"`

There's a Postgres service on the host's port 5432 (often `postgresql-x64-NN`)
intercepting connections. Our compose maps the container to host port **5433**.
Check that `appsettings.Development.json` has `Port=5433` and that no other
Postgres is on 5433.

If you want to use 5432: `Stop-Service postgresql-x64-NN` (Windows) and change
the compose mapping and connection string back to 5432.

### `MSB3027: file is locked by Dizajno.Api`

`dotnet ef` runs a build before its command. If `dotnet run` is also running,
the API has the DLLs loaded and the build can't overwrite them. Either:

- Stop the running API (`Ctrl+C`) before running `dotnet ef`, or
- Pass `--no-build` to `dotnet ef` to skip the build (safe if you haven't
  changed the model since the API started).

### `error NU1100: Unable to resolve ...`

No NuGet sources configured. Repo-level `NuGet.config` pins `nuget.org` — if
that file is missing or your global config conflicts, restore it:

```powershell
dotnet nuget add source https://api.nuget.org/v3/index.json --name nuget.org
```

### Migration tries to delete data unexpectedly

EF generates "auto" migration code based on the model snapshot. If a migration
includes `DropColumn` for a column you didn't intend to drop, the model and the
snapshot have drifted. Run `dotnet ef migrations remove` and rebuild.

### Tests fail with `401 Unauthorized` on `/me`

The fix in step 7 makes JWT validation read from `IOptions<JwtOptions>` at
resolution time so test config overrides apply to both issuance and validation.
If you see this again, confirm `Program.cs` doesn't capture `jwtOptions` into a
local variable that gets baked in before the test factory's config provider
is added.
