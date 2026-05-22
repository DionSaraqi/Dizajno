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
│   │   └── Migrations/             0001_Foundation, 0002_RefreshTokens, 0003_ProductPreviewSvg
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
frontend can deserialize without renaming.

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

Two test classes today:
- `CatalogEndpointsTests` — 12 tests
- `AuthEndpointsTests` — 9 tests

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
