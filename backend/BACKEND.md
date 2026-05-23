# Dizajno Backend

.NET 8 Web API serving the Dizajno room designer. Phase 1 delivers identity, the
catalog API for the existing 12 furniture items, and an idempotent seeder. Later
phases add projects/scenes, sharing, quotes, supplier portal — see the top-level
schema plan for the roadmap.

## Prerequisites

- **.NET 8 SDK** — `dotnet --version` should report `8.0.x`
- **Docker Desktop** — needed for local Postgres and the integration tests
- **PowerShell or Bash** — examples below assume PowerShell on Windows

## Quick start

From `backend/`:

```powershell
# 1. Bring up Postgres + Adminer
docker compose up -d

# 2. Apply migrations
dotnet ef database update --project src/Dizajno.Infrastructure --startup-project src/Dizajno.Api

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
│   ├── Dizajno.Domain/             pure entities + enums
│   ├── Dizajno.Application/        contracts: IJwtTokenService, IDataSeeder, options
│   ├── Dizajno.Infrastructure/     EF Core, Identity, JWT impl, seeder
│   │   ├── Auth/                   JwtTokenService
│   │   ├── Identity/               ApplicationUser, RefreshToken
│   │   ├── Persistence/
│   │   │   ├── DizajnoDbContext.cs
│   │   │   ├── Configurations/
│   │   │   └── Seed/               DataSeeder + CatalogSeedData
│   │   └── Migrations/             0001_Foundation, 0002_RefreshTokens, 0003_ProductPreviewSvg, 0004_Projects, 0005_Sharing, 0006_CustomizerTextures, 0007_Quoting
│   └── Dizajno.Api/                ASP.NET Core host
│       ├── Program.cs              wiring (Swagger, CORS, JWT, seeder invocation)
│       ├── Controllers/            AuthController, CatalogController
│       ├── Contracts/              AuthContracts, CatalogContracts (DTOs)
│       ├── Properties/launchSettings.json   pins HTTP to :5000
│       ├── appsettings.json
│       └── appsettings.Development.json
└── tests/
    └── Dizajno.IntegrationTests/   Testcontainers + WebApplicationFactory<Program>
```

Clean Architecture-ish layering:

- **Api** → Application + Infrastructure
- **Application** → Domain
- **Infrastructure** → Application + Domain
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
dotnet ef database update --project src/Dizajno.Infrastructure --startup-project src/Dizajno.Api

# Create a new migration
dotnet ef migrations add MigrationName --project src/Dizajno.Infrastructure --startup-project src/Dizajno.Api --output-dir Migrations

# Roll back to a specific migration
dotnet ef database update 0002_RefreshTokens --project src/Dizajno.Infrastructure --startup-project src/Dizajno.Api

# List migrations
dotnet ef migrations list --project src/Dizajno.Infrastructure --startup-project src/Dizajno.Api
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
5. 12 furniture products from `Dizajno.Infrastructure.Persistence.Seed.CatalogSeedData`

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
- `unitOfSale` — `Piece | SquareMeter | Liter | LinearMeter | Kilogram`. Drives the materials-section quantity calculation + the `quantityUnit` token sent on manual quote lines.
- `coverageRate` — nullable numeric, m² per Liter; only set for paint/sealant rows. Used to suggest paint quantity from paintable wall area.
- `wasteFactor` — numeric overage suggestion (e.g. `0.10` = +10%). Applied to the auto-suggested material quantity in the request-quote dialog.

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
  Folds three sources into a single line stream and groups by `variant.product.supplier_id`:
  - the project's `placed_items` (Phase 5)
  - `openings WHERE product_variant_id IS NOT NULL` (Phase 6 branded fixtures)
  - the optional `manualLines: [{ productVariantId, quantity, quantityUnit }]` array
    (Phase 6 — paint, flooring, anything not placed in the scene)

  Inserts one `Quote` parent + N `QuoteRequest` rows + M `QuoteLine` rows in one
  transaction. Each line gets a frozen `variant_snapshot` jsonb so the supplier
  view stays meaningful even if the catalog changes. 400 if **all three** sources
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

Phase-5 stopgap. The Phase 7 portal will replace this with self-serve member
management.

- `GET /api/admin/supplier-members?supplierId=&userId=` → `SupplierMemberDto[]`.
- `POST /api/admin/supplier-members` — `{ supplierId, userId, role: Owner|Staff }`
  → 201 (or 200 on idempotent re-bind, updating the role).
- `DELETE /api/admin/supplier-members/{id}` → 204.

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

Seven test classes today (76 tests):
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
- `QuotesEndpointsTests` — 16 tests (Phase 5: fan-out per supplier, ownership 404s,
  cancel propagates Expired, close-before-response 409, close-after-decline succeeds,
  `IsCustomSize` flip, supplier inbox member gating, respond happy path + idempotent
  upsert, cross-supplier attachment 400, cancelled-quote response 409, admin-bind RBAC 403;
  Phase 6: branded opening in fan-out, manual material lines accepted, unknown variant 400)

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
