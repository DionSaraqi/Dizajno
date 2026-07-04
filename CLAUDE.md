# Dizajno — Room Designer

A browser-based 2D/3D room designer where users draw walls, place furniture via drag-and-drop, and visualize rooms in 3D.

## Repo Layout

The repository is a pnpm workspace split into two top-level packages:

- `frontend/` — Next.js 14 application (the existing codebase). All paths in this document are relative to `frontend/` unless prefixed otherwise.
- `backend/` — .NET 10 Web API. Through Phase 7c: catalog + auth + R2 + projects/scene + sharing + customizer textures + quoting + branded fixtures + scene-assigned materials + admin dashboard + supplier portal backend + Owner-side invites. See [backend/BACKEND.md](backend/BACKEND.md) for the full backend reference (endpoints, env vars, migrations, troubleshooting).
- `docs/` — product + schema master plan. **[docs/PLAN.md](docs/PLAN.md)** is the source of truth for design decisions and the 7-phase roadmap — read it first when picking up the project cold or starting a new chat.

Root-level convenience scripts re-export the frontend's most common commands so you can run them from the repo root.

## Git Workflow

**Never push directly to main.** Always:
1. Create a feature branch (e.g. `feat/...`, `fix/...`)
2. Commit and push to that branch
3. **Ask the user before merging** into main

## Commands

Run from the repo root (uses pnpm workspace scripts):

```bash
pnpm dev          # Start frontend dev server (localhost:3000)
pnpm build        # Production build (frontend)
pnpm lint         # ESLint (frontend)
```

Or scope to a package explicitly:

```bash
pnpm --filter dizajno dev
cd frontend && pnpm dev
```

Backend commands (from `backend/` — full reference in [backend/BACKEND.md](backend/BACKEND.md)):

```bash
docker compose up -d                                         # Postgres on host port 5433 + Adminer on 8081
dotnet ef database update --project src/Dizajno.Data --startup-project src/Dizajno.Api
dotnet run --project src/Dizajno.Api                          # API on http://localhost:5000
dotnet test tests/Dizajno.IntegrationTests                    # Testcontainers + WebApplicationFactory
```

Seeded admin (dev only): `admin@dizajno.local` / `Admin1234!`. The frontend reads the
API base URL from `NEXT_PUBLIC_API_URL` (see `frontend/.env.example`).

## Tech Stack

**Frontend** (`frontend/`):
- **Framework**: Next.js 14 (App Router) + React 18 + TypeScript
- **3D**: Three.js 0.171, React Three Fiber, Drei
- **State**: Zustand + Zundo (undo/redo via temporal middleware)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Notifications**: Sonner
- **Data fetching**: TanStack React Query (v5)

**Backend** (`backend/`):
- **Framework**: .NET 10, ASP.NET Core Web API
- **ORM**: EF Core 8 + Npgsql (snake_case via EFCore.NamingConventions)
- **Identity**: ASP.NET Core Identity (extended `ApplicationUser : IdentityUser<Guid>`)
- **Auth**: JWT bearer (15-min access) + rotating refresh tokens (30 days, SHA-256 hashed at rest)
- **Database**: PostgreSQL 16 (Docker)
- **Tests**: xUnit + FluentAssertions + Microsoft.AspNetCore.Mvc.Testing + Testcontainers.PostgreSql
- **DI/Options**: built-in `Microsoft.Extensions.*` + Options pattern

## Project Structure

```
.
├── frontend/                              # Next.js 14 app
│   ├── public/                            # Static assets — GLBs in models/, textures in textures/
│   ├── .env.example                       # NEXT_PUBLIC_API_URL template
│   └── src/
│       ├── app/                           # Next.js App Router pages
│       │   ├── page.tsx                   # Landing page (3D house scene)
│       │   ├── layout.tsx                 # Root layout, wraps children in <Providers>
│       │   ├── providers.tsx              # QueryClientProvider ('use client')
│       │   ├── admin/                     # /admin/* — suppliers, moderation, audit-log (Phase 7a, Admin role only)
│       │   ├── designer/                  # Designer page (room editor)
│       │   ├── invite/[token]/            # Public invite accept (Phase 7a)
│       │   ├── login/                     # Login page
│       │   ├── profile/                   # Profile page (placeholder)
│       │   └── supplier/                  # /supplier/* — portal: picker + per-supplier products/textures/members/profile (Phase 7c)
│       ├── components/
│       │   ├── designer/                  # Sidebar, Toolbar, PropertiesPanel, StatusBar
│       │   ├── landing/                   # Landing page (/) sections + its 3D scene
│       │   │   ├── LandingChrome/Header/Nav/Aside/Canvas  # Sectioned 2D shell pieces
│       │   │   ├── navItems.ts            # Left "drawing index" nav data
│       │   │   └── three/                 # Landing 3D: LandingScene, House, Door, Lights, SketchMaterial
│       │   ├── three/                     # Designer R3F 3D components
│       │   │   ├── furniture/             # 3D furniture models (BedModel, ChairModel, GLTFModel, ...)
│       │   │   ├── DrawingSurface         # Wall drawing canvas (2D mode)
│       │   │   ├── FloorMesh              # Auto-generated floor polygons
│       │   │   ├── WallMesh               # 3D wall rendering
│       │   │   ├── CameraController       # Bounded OrbitControls for 3D mode
│       │   │   └── GridPlane              # Snap grid overlay
│       │   └── ui/                        # Reusable UI primitives
│       ├── hooks/                         # useFurnitureCatalog (TanStack Query), useCatalogVersion, useKeyboardShortcuts
│       ├── lib/
│       │   └── api.ts                     # Typed backend fetch client (listProducts, listCategories, ...)
│       ├── store/                         # Zustand store (useDesignerStore)
│       ├── types/                         # designer.ts — FurnitureCatalogItem mirrors backend DTOs
│       └── utils/
│           ├── wallGraph.ts               # Planar face traversal for floor detection
│           ├── collision.ts               # Furniture/wall collision detection
│           ├── furnitureCatalog.ts        # Fallback baseline for the API (see Known Patterns)
│           ├── catalogRegistry.ts         # Runtime catalog registry (fetched catalog for sync lookups)
│           └── snapToGrid.ts              # Grid snapping helpers
│
├── backend/                               # .NET 10 Web API — full reference: backend/BACKEND.md
│   ├── Dizajno.sln
│   ├── docker-compose.yml                 # Postgres 16-alpine on host 5433 + Adminer on 8081
│   ├── NuGet.config                       # pins nuget.org as the source
│   ├── .config/dotnet-tools.json          # local dotnet-ef tool manifest
│   ├── src/
│   │   ├── Dizajno.Api/                   # ASP.NET Core host
│   │   │   ├── Program.cs                 # AddData + AddApplication + AddInfrastructure, Swagger, CORS, JWT, seeder invocation
│   │   │   ├── Controllers/               # 21 thin pass-throughs delegating to Application services
│   │   │   ├── appsettings.json
│   │   │   └── appsettings.Development.json
│   │   ├── Dizajno.Dto/                   # Wire-shape DTOs (78 records, one file each), grouped by area
│   │   │   ├── Auth/ Catalog/ Project/ Quote/ Asset/ Share/ Admin/ Supplier/
│   │   ├── Dizajno.Application/           # Business logic + service contracts
│   │   │   ├── Interfaces/                # 21 service interfaces (I*Service) + IAuditLogger, IJwtTokenService, IObjectStorage, ISupplierMembershipResolver, SupplierMembershipExtensions
│   │   │   ├── Options/                   # JwtOptions, R2Options, InviteOptions
│   │   │   ├── Services/                  # 21 service implementations (DizajnoDbContext-backed) + AnchorParser, InviteTokenFactory, AssetUploadRules
│   │   │   └── DependencyInjection.cs     # AddApplication() — registers all 21 services
│   │   ├── Dizajno.Domain/                # Pure entities + enums (no deps)
│   │   │   ├── Entities/                  # Supplier, Category, Product, ProductVariant, Asset, Translation, SupplierInvite, AuditLogEntry, …
│   │   │   └── Enums/                     # ProductFamily, ProductStatus (incl. Pending), CategoryStatus, UnitOfSale, AssetKind, …
│   │   ├── Dizajno.Data/                  # Persistence layer
│   │   │   ├── DizajnoDbContext.cs
│   │   │   ├── Identity/                  # ApplicationUser, RefreshToken (alongside the DbContext)
│   │   │   ├── Configurations/            # 24 IEntityTypeConfiguration<T> files
│   │   │   ├── Migrations/                # 0001_Foundation … 0010_AssetOwnerNonUnique + snapshot
│   │   │   ├── Seed/                      # IDataSeeder, SeedOptions, DataSeeder + CatalogSeedData
│   │   │   └── DependencyInjection.cs     # AddData() — DbContext + AddIdentityCore + IDataSeeder
│   │   └── Dizajno.Infrastructure/        # Technical plumbing only (post-overhaul)
│   │       ├── Audit/AuditLogger.cs       # Resolves actor/IP/UA from IHttpContextAccessor
│   │       ├── Auth/JwtTokenService.cs
│   │       ├── Storage/S3ObjectStorage.cs
│   │       ├── Suppliers/SupplierMembershipResolver.cs
│   │       └── DependencyInjection.cs     # AddInfrastructure() — 4 plumbing services + IHttpContextAccessor
│   └── tests/Dizajno.IntegrationTests/    # xUnit + Testcontainers + WebApplicationFactory<Program>
│
├── docs/
│   └── PLAN.md                            # Product + schema master plan (source of truth for decisions)
│
├── package.json                           # Root pnpm workspace (re-exports frontend scripts)
├── pnpm-workspace.yaml
├── CLAUDE.md                              # This file
└── README.md
```

## Architecture

### Catalog API integration
- The catalog (12 furniture items + categories + suppliers) is **owned by the backend** and served from `GET /api/catalog/products|categories|suppliers`.
- The frontend's `useFurnitureCatalog` hook fetches via TanStack Query with a 60s staleTime and `retry: 1`.
- API client lives in `lib/api.ts` — base URL from `NEXT_PUBLIC_API_URL` (default `http://localhost:5000`).
- DTOs returned by the API map 1:1 onto `FurnitureCatalogItem` in `types/designer.ts` — no transformation needed.
- `utils/furnitureCatalog.ts` is a **fallback baseline** used during the initial fetch and when the backend is offline. `getFurnitureDef(type)` (synchronous, called by collision and store mutations) reads the **runtime catalog registry** (`utils/catalogRegistry.ts`) first — populated by `useFurnitureCatalog` on every successful fetch — and falls back per-type to this bundled array. This is what lets supplier-uploaded products (types that don't exist in the bundled file) render in the designer.
- Components that call `getFurnitureDef` during render subscribe via `hooks/useCatalogVersion.ts` (`useSyncExternalStore`) so a catalog that arrives after mount re-renders them (`FurnitureItem3D`, `RadialMenu`; `SelectionBar` is already reactive through `useFurnitureCatalog`).
- **Scene hydration waits for the catalog**: `useVariantLookup().isReady` (true once the catalog query settles) gates the load effects in `/projects/[id]` and `/share/[token]` — hydrating against an empty variant lookup would silently drop every placed item and the next autosave would persist the loss.
- **GLB loads degrade gracefully**: `components/three/furniture/ModelErrorBoundary.tsx` wraps `GLTFModel` in `FurnitureItem3D` and the drag ghost — a model URL that 404s, fails CORS, or fails to parse falls back to the procedural model (or a `FallbackBox` at catalog dimensions) instead of unmounting the canvas. Supplier GLBs served from R2 require the bucket to allow cross-origin `GET` from the app origin.
- The seeded backend rows are sourced from `backend/src/Dizajno.Data/Seed/CatalogSeedData.cs`, which mirrors the frontend fallback file. Keep both in sync until the supplier portal ships (Phase 7 of the master plan).

### Supplier-side endpoints (Phase 5)
- `/api/supplier/*` endpoints are gated by `ISupplierMembershipResolver` (Application layer) — every controller action loads the caller's `supplier_members` rows and checks the target supplier id is in the list. Admins are **not** implicit suppliers; they must be bound via the Phase-5 stopgap `POST /api/admin/supplier-members` endpoint or the Phase 7a tokenized invite flow.
- Phase 7a added `SupplierMembership.isSuspended` (filled from the supplier's `suspended_at`). The portal-gating helper `SupplierMembershipExtensions.ActiveSupplierIds()` filters those out; suspended-supplier members get 403 on every `/api/supplier/*` action until the admin restores them.
- The frontend conditionally surfaces the `/supplier/quotes` nav by reading `useAuthStore().user?.supplierMemberships` — empty list → no nav, no inbox.
- The full self-serve supplier portal (product/variant CRUD with GLB upload, texture library, member management UI) lands in Phase 7b.

### Admin tooling (Phase 7a)
- `/api/admin/*` (Admin role required): suppliers list+CRUD + suspend/restore + trust/untrust, tokenized member invites (`/api/admin/invites`; raw token + `acceptUrl` returned once, only SHA-256 hash persisted), product + category moderation queues (`/api/admin/moderation/{products,categories}/{id}/{approve,reject}`), filterable audit-log search (`/api/admin/audit-log`). Every state change writes an `audit_log` row via `IAuditLogger` (actor + IP + UA pulled from `IHttpContextAccessor`).
- Suspension side-effects: catalog filter hides suspended suppliers + pending categories, supplier-portal endpoints reject the suspended supplier's members, every still-Pending `QuoteRequest` flips to `Expired` with `cancellation_reason='supplier_suspended'`.
- `Supplier.isTrusted` toggles whether new supplier-created products land as `Published` (trusted) or `Pending` (untrusted). The seeded `dizajno` supplier is trusted.
- Frontend admin dashboard: `/admin/suppliers` (list + create + suspend/trust buttons), `/admin/suppliers/[id]` (members + invites + create-invite modal that displays the raw `acceptUrl` exactly once with a clipboard-copy button), `/admin/moderation` (tabbed pending products/categories), `/admin/audit-log` (paginated search). `/invite/[token]` is a standalone accept page that handles invalid / expired / revoked / already-accepted / ready-to-accept states.

### Supplier portal backend (Phase 7b)
- `/api/supplier/*` controllers added: `products` (CRUD + Draft↔Pending↔Published↔Hidden↔Removed transitions), `variants` (CRUD + GLB/SVG asset attach + scene-references-protected delete), `textures` (library CRUD + per-variant slot bindings, full replacement), `categories` (suggest-only — creates `Pending` row for admin moderation), `members` (Owner-only with last-Owner protection on demote/remove), `profile` (Owner-only edit, slug immutable). `SupplierAssetsController` now accepts `AssetKind.Glb` + `AssetKind.SvgPreview`.
- `SupplierMembershipExtensions` gained `IsActiveMemberOf(supplierId)` + `IsActiveOwnerOf(supplierId)` helpers used across all the new controllers.
- Publish on a `Draft` product lands in `Pending` for untrusted suppliers (admin moderation picks up) or `Published` for trusted. Publish on `Hidden` always goes to `Published` — already moderated once. Variant delete refuses if any `PlacedItem` / `Opening` / `Wall` / `Floor` references it (preserve existing project scenes). Cross-supplier asset attaches + cross-supplier texture-slot references both fail fast with 400 before reaching the DB trigger.
- Migration `0010_AssetOwnerNonUnique` fixes a Phase-1 schema bug: EF was auto-pairing `Asset.OwnerSupplier` (single nav) with `Supplier.LogoAsset` (single nav) and inferring a 1:1, which made `ix_assets_owner_supplier_id` UNIQUE — every supplier was limited to one owned asset. Fixed by adding `Supplier.OwnedAssets` collection + `HasMany().WithOne()` so EF tracks it as 1:N, then dropping + recreating the index as non-unique.

### Supplier portal UI (Phase 7c)
- Full self-serve UI at `/supplier/[supplierId]/{products,products/new,products/[id],textures,members,profile}` + a `/supplier` picker that auto-redirects single-supplier users. Layout enforces active membership, gates Owner-only tabs (Members + Profile), and shows a polite block screen for suspended suppliers.
- Product editor has tabbed Info + Variants. Variants tab includes numeric collision-box rows (defaults to empty for rectangular furniture per the planning decision), material-slot defaults rows (slot name + hex color), per-variant GLB + SVG-preview upload via the three-step presign helper, and a texture-slot binder that picks from the supplier's library.
- Inline "Suggest a new category" modal on the product create form fires off `POST /api/supplier/categories`. The suggested row lands in admin moderation; until approved it doesn't appear in the picker.
- Owners can issue tokenized member invites from `/supplier/[supplierId]/members` via a new backend endpoint `POST /api/supplier/invites` (mirrors the admin one but Owner-gated; audit log uses `supplier_invite.create_by_owner` to differentiate).
- `lib/api.ts` got `uploadSupplierFile(supplierId, file, kind)` which wraps presign → PUT to R2 → finalize into one call. Used by all four file-upload entry points (variant GLB, variant SVG preview, texture image, supplier logo). R2-misconfigured errors surface as a regular `Error` so the UI can alert gracefully.
- `CategoryDto` (public catalog DTO) gained `id` so the create-product form can drive its category picker by id instead of string-matching by name. Additive, no migration.
- `/projects` nav button "Supplier portal" routes to `/supplier` for users with memberships (replaces the old "Inbox" link).

### Catalog families & scene materials (Phase 6 + 6.5)
- The catalog covers five families (`Furniture`, `Lighting`, `Appliance`, `BuildingMaterial`, `Fixture`). Today the seed ships 12 furniture rows + 2 fixtures + 6 building materials (3 paint tiers + 3 flooring tiers); lighting and appliance entries are deferred until GLB models exist.
- `FurnitureItemDto` (frontend `FurnitureCatalogItem`) carries `family`, `unitOfSale`, `coverageRate`, `wasteFactor`, `basePrice`, `currency`, `textureUrl`. The frontend uses these to (1) hide non-furniture items from the place-furniture sidebar tabs, (2) populate the branded-fixture picker on a selected opening, and (3) populate the per-floor/wall material pickers + drive the auto-quantity math at quote time.
- **Branded openings** (`OpeningData.productVariantId`): variant color overrides the default frame color in `WallOpening.tsx`.
- **Scene materials (Phase 6.5)**: walls and floors carry optional FKs to a Paint or Flooring variant (`paint_product_variant_id`, `flooring_product_variant_id`). Floors are selectable (`select` mode); a "Paint" picker lives in wall properties and a "Flooring" picker lives in floor properties. `FloorMesh` + `WallMesh` share `hooks/useMaterialTexture.ts` to load the variant's `textureUrl` via `THREE.TextureLoader` with `RepeatWrapping`; missing textures fall back to `variant.color`.
- **Quote fan-out** aggregates per-material across the whole project — one quote line per distinct flooring/paint variant. Floor area = shoelace; paintable wall = `length × height − Σ(opening areas on that wall)`. Quantities apply the product's `wasteFactor` automatically.
- **Texture image files** live in `frontend/public/textures/{slug}.jpg`. They're user-provided assets — the seed writes the URL but doesn't carry the JPGs. Missing files = silent fallback to color, never a fatal error.

### State Management
All designer state lives in `src/store/useDesignerStore.ts` (Zustand). Undo/redo is provided by Zundo's `temporal` middleware. The store manages walls, floors, furniture, selections, modes, and UI settings.

### Designer Modes
- `draw` — Left-click-hold-drag to draw walls
- `select` — Click to select; hold-click and drag to move furniture
- `furniture` — Drag from sidebar to place furniture

### Furniture Drag Behavior
Furniture movement uses a **hold-to-drag** pattern (not instant drag on click):
1. Click on an item → selects it (no movement)
2. Hold left click + move mouse beyond a 0.05 world-unit threshold → drag begins
3. Release → item drops at the new position (or snaps back if collision)
- Uses `useFrame` + ground-plane raycast for smooth movement
- A window-level `pointerup` listener ensures drag ends even when released outside the item mesh
- Camera is locked (`isDragging` state) during drag to prevent orbit conflicts

### Wall Drag Behavior (resize rooms)
Walls of closed rooms are draggable in **2D select mode** (same hold-to-drag
pattern and 0.05 threshold); dragging moves the wall perpendicular to its axis
and resizes the room live:
- The wall's **collinear chain** moves as one straight line (a side split by a
  neighbor's T-junction never kinks); attached walls stretch/shrink to stay welded.
- A **shared wall resizes both rooms** — one grows, the neighbor shrinks. The
  typed W×L inputs (`resizeRectRoom`) are built on the same primitive, so they
  work on shared/split-side rooms too (clamped by neighbors, with a toast).
- Clamps are live hard-stops (red tint at the limit): ≥0.5 m usable span per
  affected room, no wall segment under 0.05 m, a dead zone before parallel
  foreign walls, and a flush stop against furniture collision boxes.
- Openings on the dragged wall ride along; openings on shrinking side walls
  tint red when they won't survive and are dropped with a toast on commit.
- Preview never writes the store; `dragWall` commits once on release (one undo
  entry, one autosave). Escape cancels; arrow keys nudge the selected wall.
- Core geometry: `utils/wallDrag.ts` (pure, unit-tested); gesture state machine:
  `components/three/useWallDrag.ts`. 2D-only for now — see `docs/KNOWN_ISSUES.md`.

### Floor Detection
When walls form a closed polygon, `wallGraph.ts` uses a planar face traversal algorithm to automatically detect enclosed rooms and generate floor geometry.

### Collision System
`collision.ts` prevents furniture from overlapping walls or other furniture.
- Uses **Liang-Barsky line-segment-to-AABB** intersection for walls (handles diagonal walls correctly)
- Has a `COLLISION_INSET` tolerance (0.02) so flush/touching placement is allowed but actual overlap is blocked
- Furniture-to-furniture uses AABB overlap with the same inset tolerance

### Snap System
`snapToGrid.ts` provides a multi-level snap pipeline via `smartSnap()`:
1. **Wall snap** — Checks each axis independently: vertical walls snap X, horizontal walls snap Z
2. **Corner snap** — When near two walls on different axes, snaps both X and Z simultaneously (flush to corner)
3. **Furniture snap** — Snaps edges to adjacent furniture on any unsnapped axis
4. **Grid snap** — Fallback for any axis not snapped by walls/furniture
- Snap threshold is 0.3 units
- Wall snap uses the wall's AABB expanded by half-thickness
- The snap and collision tolerances are coordinated: snap places items flush, collision allows it

### Wall Intersection Handling
`wallGraph.ts` provides `addWallWithIntersections()`:
- **Corner merging**: Wall endpoints within 0.2 units of existing corners snap to them
- **Crossing splits**: When walls cross, both are split at the intersection
- **T-junctions**: When an endpoint lands on another wall's interior, that wall is split

### 3D Rendering
- All 3D components use React Three Fiber (R3F)
- `DrawingSurface.tsx` is loaded with `dynamic()` (no SSR) since R3F requires browser APIs
- `FloorMesh` creates `THREE.Shape` geometry and rotates from XY to XZ plane — note: Z coordinates must be negated when creating shapes due to `rotateX(-PI/2)` mapping
- Ghost preview shows actual furniture model during placement (semi-transparent, red if collision)
- `DragGhost` component shows preview during HTML drag-and-drop from sidebar

### GLTF Model Pipeline
`GLTFModel.tsx` loads `.glb` files from `public/models/`, auto-scales uniformly to fit target dimensions.

#### Adding a New GLB Model

**Step 1: Process the GLB file**
Many GLB files (especially from AI generators like Tripo) have issues that must be fixed before use:

1. **Check for node-level transforms** — Use `gltf-transform` (with `@gltf-transform/core`, `@gltf-transform/extensions`, `draco3dgltf`) to inspect node rotations/scales. Non-identity transforms inflate the AABB and cause oversized hitboxes.
2. **Bake node transforms into vertex data** — Apply any node rotation/scale to vertex positions and normals using quaternion math, then reset the node transforms to identity.
3. **Remove stale Draco extension** — When gltf-transform decodes Draco-compressed meshes and writes them back, the `KHR_draco_mesh_compression` extension declaration persists even though the output is uncompressed. This causes Three.js GLTFLoader to fail silently. Always `dispose()` the Draco extension before saving.
4. **Verify file size** — A properly saved uncompressed GLB for furniture models should be ~5–15 MB. If the output is suspiciously small (e.g. 843 KB vs 9 MB expected), the data is likely corrupt.

**Step 2: Measure and compute catalog dimensions**
```bash
# Install measurement tools (remove after use):
pnpm add -D @gltf-transform/core @gltf-transform/extensions draco3dgltf

# Measure raw vertex bounds after processing:
node -e "..." # iterate all mesh primitives, read POSITION attribute, compute min/max

# After measurement, remove dev deps:
pnpm remove -D @gltf-transform/core @gltf-transform/extensions draco3dgltf
```

After measuring raw vertex bounds (rawX, rawY, rawZ):
1. Pick a uniform scale factor (e.g. 2.5 to match other sectional sofas)
2. Set catalog: `width = rawX × scale`, `height = rawY × scale`, `depth = rawZ × scale`
3. Verify all three scale ratios (`width/rawX`, `height/rawY`, `depth/rawZ`) are nearly equal (within 1%) — if not, the hitbox will have dead space

**Step 3: Define collision boxes**
- For rectangular furniture: the default single AABB from `width × depth` is sufficient
- For non-rectangular shapes (L-shaped sofas etc): visualize the XZ vertex footprint and define `collisionBoxes` — array of `{ offsetX, offsetZ, width, depth }` sub-boxes that tightly fit the actual geometry
- `collisionBoxes` scale with the `scale` field and rotate with the item

**Step 4: Add to catalog**
Add the entry to `utils/furnitureCatalog.ts` with all computed values. Include `modelUrl`, `collisionBoxes` (if non-rectangular), `materialSlots` (for color customization), and `textureSlots` (for texture customization).

#### Material System
- Materials are deep-cloned per instance (ghost vs placed don't bleed)
- Collision red uses emissive tint, not color replacement
- `materialSlots` in the catalog defines named material slots with default hex colors — enables per-material color picker in the sidebar
- `materialColors` on each furniture item stores per-material color overrides
- Color acts as a **tint** that multiplies with the texture (`mat.color × mat.map`) — darker colors darken the texture, hue shifts tint it

#### Texture System
- `textureSlots` in the catalog defines available textures per material slot — array of URLs (first entry can be `""` for "None")
- `materialTextures` on each furniture item stores per-material texture URL overrides
- Textures are loaded with `THREE.TextureLoader`, applied with `RepeatWrapping` (4×4 tiling), `SRGBColorSpace`
- Selecting "None" disposes the texture, removes `mat.map`, and restores the original material color
- The texture and color effects run independently — changing a color doesn't reload the texture
- Texture files live in `public/textures/`

#### Key Constraints
- **Catalog width/depth must match the actual rendered model size.** The model is uniformly scaled by `Math.min(targetW/rawW, targetH/rawH, targetD/rawD)`. Mismatched dimensions cause the hitbox to be larger than the visible model.
- The SelectionBar furniture editor exposes raw width/depth/height fields **and** a "Size" grow/shrink stepper (`growFurniture` store action) that scales the item uniformly by ±5% per click, preserving any custom aspect ratio and clamped to 50–200% of the catalog base on every axis
- **Wall-hugging items** (`wallHugging` flag on the catalog item — wardrobe + bookshelf today) auto-orient on placement/drag so their longest side runs parallel to the wall they snap to. `smartSnap(..., wallHug)` returns the chosen rotation; the flag is sourced from the backend `Product.Attributes` jsonb (same pattern as `icon`) and mirrored in the frontend fallback catalog

### Landing Page
- `app/page.tsx` is a thin client shell (blueprint-grid backdrop + cursor tracking) that composes sections from `components/landing/`: `LandingChrome` (aurora + sweep + crosshairs), `LandingHeader`, `LandingNav`, `LandingAside`, and `LandingCanvas`.
- `LandingCanvas` mounts the 3D scene `components/landing/three/LandingScene.tsx` → `House` + `Door` + `Lights`, all shaded by `components/landing/three/SketchMaterial.tsx`. (This 3D code lives under `components/landing/three/`, separate from the designer's `components/three/`.)
- Animated 3D house scene with rotatable house (Y-axis only, camera fixed)
- Clicking the door → house rotates back to home → camera moves to front → door opens → fade → navigate to `/designer`
- Grid background has a cursor-following white glow effect (CSS `mask-image`)
- `SketchMaterial` is a self-lit world-space toon shader (rotation-stable): warm-lit / cool-indigo-shadow 2-temperature, fresnel rim (gated via `rim`), and `emissive`/`emissiveStrength` for the glowing windows + breathing door. Uniforms: `baseColor, opacity, transparent, depthWrite, side, shadowTint, rimColor, emissive, emissiveStrength, rim, aoFloorY, aoRange`.

## Conventions

- Use `@/*` path alias for imports (maps to `src/*`)
- Coordinates are `[x, z]` tuples in the XZ plane (Y is up)
- IDs use `type-timestamp` format (e.g., `wall-1718234567890`)
- All 3D canvas components must be client-side only (`"use client"` or dynamic import with `ssr: false`)
- Wall endpoints snap to grid and to existing corners when snap is enabled
- Package manager is **pnpm** (not npm)

## Known Patterns

- The designer has two parallel state systems: the older `DesignerProvider` (React Context + useReducer in `components/designer/`) and the newer Zustand store (`store/useDesignerStore.ts`). The Zustand store is the canonical one going forward.
- **Adding a new furniture item**: add it to **both** `frontend/src/utils/furnitureCatalog.ts` (fallback + sync lookups via `getFurnitureDef`) **and** `backend/src/Dizajno.Data/Seed/CatalogSeedData.cs` (backend seed). The seeder is idempotent — restart the API to pick up the new item; existing seeded rows are not touched. Supplier-uploaded products don't need either file: they flow through the runtime catalog registry (`utils/catalogRegistry.ts`) and render via their attached GLB's `modelUrl`.
- Each catalog item has `svgPreview` for the sidebar thumbnail, optional `modelUrl` for GLTF loading, `materialSlots` for color customization, and `textureSlots` for texture customization.
- Properties panel is a collapsible section inside the left sidebar (not a separate right panel).
- **Backend port collision**: Postgres runs on host port **5433** (not 5432) to avoid colliding with host-installed Postgres services. The API runs on **5000** in dev. Frontend dev server picks 3000 unless taken (Next auto-increments).
- **Backend layering** (Clean Architecture-ish, post-overhaul): `Api` → `Dto` + `Application` + `Data` + `Infrastructure`; `Application` → `Dto` + `Domain` + `Data`; `Infrastructure` → `Application` + `Domain` + `Data`; `Data` → `Domain`; `Dto` → `Domain`; `Domain` depends on nothing. Controllers are thin pass-throughs delegating to `I*Service` business services in `Dizajno.Application/Services/`; `DizajnoDbContext`, EF Configurations, Migrations, the `IDataSeeder`, and the Identity entities (`ApplicationUser`, `RefreshToken`) live in `Dizajno.Data`; plumbing interfaces (`IJwtTokenService`, `IAuditLogger`, `IObjectStorage`, `ISupplierMembershipResolver`) are declared in `Application/Interfaces/` and implemented in `Dizajno.Infrastructure`.
- **JWT options** are configured via `IOptions<JwtOptions>` at request time — not captured at startup. This is deliberate so `WebApplicationFactory` config overrides in tests apply uniformly to both token issuance and validation.

## Troubleshooting

- **Stale `.next` cache** — If you get `Cannot find module './719.js'` or similar webpack errors, stop the dev server, run `rm -rf .next` (or PowerShell `Remove-Item -Recurse -Force .next`), and restart. This happens when the cache gets corrupted (e.g. after installing/removing packages).
- **Chrome DevTools 404** — `GET /.well-known/appspecific/com.chrome.devtools.json 404` is harmless; Chrome checks for this automatically. Ignore it.
- **Backend issues** — see the troubleshooting section in [backend/BACKEND.md](backend/BACKEND.md#troubleshooting). Covers: `.NET` PATH staleness after install, the Postgres 5432 collision, MSB3027 file-locking during `dotnet ef` while the API is running, missing NuGet sources, and the JWT validation race that broke tests in Step 7.
