# Dizajno — Product & Schema Master Plan

Living document for everyone working on Dizajno's data layer and feature roadmap. This is the source of truth for product/schema decisions; if a future change contradicts something here, update this file in the same PR.

For implementation reference, see:

- [CLAUDE.md](../CLAUDE.md) — repo overview, conventions, frontend architecture
- [backend/BACKEND.md](../backend/BACKEND.md) — backend setup, endpoints, env vars, migrations, troubleshooting
- [frontend/src/types/designer.ts](../frontend/src/types/designer.ts) — frontend types that mirror backend DTOs
- [backend/src/Dizajno.Infrastructure/Persistence/Seed/CatalogSeedData.cs](../backend/src/Dizajno.Infrastructure/Persistence/Seed/CatalogSeedData.cs) — initial catalog data

---

## What Dizajno is

A browser-based 2D/3D room designer + multi-supplier furniture/fixtures marketplace, currently EU/Albania-focused. Users draw a room, drop in products from the catalog, and request quotes. Suppliers list products (furniture, lighting, appliances, building materials, fixtures) and respond to quote requests.

The frontend (Next.js 14 + Three.js / React Three Fiber) handles the designer UX. The backend (.NET 8 + Postgres) owns the catalog, identity, and — in later phases — projects, sharing, and quoting.

---

## Part 1 — Design decisions

Each entry: **what we chose** + **why** + **status**. Decisions are grouped thematically, not chronologically.

### Tenancy & marketplace

- **Marketplace, admin-curated to start.** Schema treats `Supplier` as a first-class entity from day one. In MVP only admins create suppliers and upload their products; the supplier-self-serve portal lands in a later phase. **Why:** different product families come from different supplier types — paint companies aren't furniture companies. A single curated catalog would make Dizajno the bottleneck for every new SKU. The "filter for sofas → multiple suppliers" UX *is* marketplace UX. Quote/RFQ is naturally a marketplace flow. *Built in Phase 1.*

### Product taxonomy

- **Five families on the roadmap:** Furniture, Lighting, Appliances, Building materials, Fixtures (doors/windows/plumbing). **Why:** these were the user's confirmed targets for the next ~12 months. Heterogeneous attributes (paint coverage m²/L, energy class for appliances, lumen for lighting) drive the JSON-attributes-on-Product pattern. *Furniture seeded in Phase 1; others land alongside the supplier portal.*
- **Hybrid variants.** `Product` is the model line; `ProductVariant` is an SKU keyed by physical differences (2-seat vs 3-seat). Soft finishes (fabric color, leg color) are not separate variants — they're customizer choices selected at quote time. **Why:** matches how suppliers actually price (size = different SKU, fabric color = same SKU). Avoids combinatorial explosion. *Built in Phase 1, no supplier UI yet.*
- **Hierarchical category tree per family.** `Category` has `family` + nullable `parentCategoryId` + materialized `path` for fast subtree queries (`WHERE path LIKE '/furniture/%'`). **Why:** matches how users browse. Tags can be added later (pure-additive `Tag` + `ProductTag` join, no migration cost). *Phase 1 ships a flat list with only top-level categories; tree depth grows when needed.*

### Commerce scope

- **Quote / RFQ only.** No cart, payment, or shipping in the MVP. Products carry suggested prices; the actual quote happens out-of-band per supplier. **Why:** lower legal/regulatory surface, matches the marketplace shape (Dizajno is matchmaker, not seller). *Quote tables planned for Phase 5.*
- **One quote → many QuoteRequests (auto-split per supplier).** User sees a single "Quote" parent in their inbox; backend fans out a `QuoteRequest` per supplier whose products are in the cart. Each supplier responds independently. User sees all responses in one thread. **Why:** mirrors how Fiverr / B2B marketplaces work. Suppliers never see each other's prices.

### Data layer

- **PostgreSQL 16 + EF Core 8.** **Why:** best-in-class `jsonb` + GIN indexing for the heterogeneous product attributes (paint coverage, energy class, lumen, etc.). EF Core support is excellent. *Built in Phase 1.*
- **Polymorphic catalog via JSON attributes.** Most-queried fields (`unitOfSale`, dimensions, price, category, supplier) are real columns. Family-specific extras (`lumen`, `energyClass`, `coverageRate`) live in `Product.attributes` / `ProductVariant.attributes` jsonb. **Why:** keeps the common queries fast and indexable, adds new families without migrations. *Built in Phase 1; only `icon` and `textureSlots` used so far.*
- **i18n via overlay.** Albanian (default) text lives directly on the entity (`Product.name`, `Category.name`, etc.). English (and any future language) is layered in a separate `Translation` table keyed by `(entityType, entityId, field, lang)`. **Why:** default-language queries stay simple; adding languages is additive. *Schema in Phase 1; English translations not yet seeded.*
- **Single currency.** EUR for now. **Why:** Albania-adjacent market, simplest schema. Multi-currency adds Price-per-Variant-per-currency rows + FX layer; deferred until needed.
- **No geography.** Any supplier visible to any user. **Why:** scoped MVP. `ServiceArea` join table can be added later if needed.

### Identity & auth

- **ASP.NET Core Identity** (the built-in framework), extended via `ApplicationUser : IdentityUser<Guid>` with `DisplayName`, `Locale`, `CreatedAt`, `DeletedAt`. **Why:** zero-cost, well-supported, plugs straight into EF stores. *Built in Phase 1.*
- **JWT bearer auth with rotating refresh tokens.** Access token = HS256 JWT, 15-min lifetime, claims `sub`/`email`/`jti`+roles, validated against `IOptions<JwtOptions>` at request time. Refresh token = 32 random bytes, base64url, **SHA-256 hashed** at rest in `refresh_tokens`. Rotated on every refresh with `replaced_by_token_id` linking the chain for audit. Stored in an HttpOnly `dizajno_rt` cookie scoped to `/api/auth`. **Why:** OWASP-recommended hybrid (no localStorage XSS exposure, same-site cookie blocks CSRF on the refresh endpoint). *Built in Phase 1.*

### Users & projects

- **Multi-project per user.** Each user can have many projects (rooms, flats, etc.). *Schema planned for Phase 2.*
- **Sharing: public link OR email invite.** `ProjectShare` carries either a token (view/comment public link) or an `invitedEmail` / `invitedUserId` (login-gated). Comments by anon link visitors store `guestName` + `guestEmail`; comments by signed-in users FK to `User`. **Why:** balances low-friction sharing with secure invites for serious clients. No real-time collab (deliberately out of scope).
- **Comments: flat thread + optional spatial anchor.** Each `ProjectComment` has `parentCommentId` for threading and `anchor jsonb null` for Figma-style pins (`{type: 'item'|'wall'|'point', ...}`). Most comments are general chat; pins are opt-in.
- **Versioning: live state + named snapshots.** The current scene lives in normal relational rows (`Wall`, `Floor`, `Opening`, `PlacedItem`). The user can press "Save as version" to freeze a JSONB `sceneSnapshot` on `ProjectVersion`. Restore overwrites the live tables from the snapshot. **Why:** fast live editing + low-cost versioning. No autosave history bloat in Phase 1.

### Catalog assets & previews

- **Cloudflare R2 for blob storage.** GLBs, textures, CAD source files, product images, project thumbnails. DB stores `{ url, sizeBytes, checksum, mimeType }`. **Why:** S3-compatible, zero egress fees. *Deferred to Phase 1.5 — Phase 1 stores frontend-relative URLs (`/models/x.glb`) that the Next.js dev server serves.*
- **Pre-converted GLB + SVG only for MVP.** Suppliers (or admins on their behalf) upload finished GLB + SVG preview, not CAD source. **Why:** building a DXF/DWG → GLB pipeline is a project of its own. Schema already supports `AssetKind.CadSource` for the day we add conversion.
- **Inline SVG on Product, not Asset.** `Product.previewSvg` is a `text` column holding the raw markup. **Why:** these strings exceed `Asset.url`'s 1000-char cap. When CAD conversion ships, SVGs move to Asset rows. *Built in Phase 1 via the `0003_ProductPreviewSvg` migration.*
- **Project thumbnails: client-uploaded.** The frontend exports a PNG from the R3F canvas and uploads to R2 on save. **Why:** zero server-side render infrastructure. *Planned for Phase 2.*

### Customizer (materials & textures)

- **Per-supplier texture library.** Each Supplier owns its own `SupplierTexture` rows; `ProductVariantTextureSlot` can only reference textures from the variant's product's supplier (enforced by trigger). **Why:** matches reality — each company has its own fabrics. *Planned for Phase 4. Phase 1 stuffs `textureSlots` into `ProductVariant.attributes` jsonb as a temporary fix; the migration to proper tables is destructive but contained.*
- **Material slots = named colors on the model.** `ProductVariant.materialDefaults` is `{slotName: hexColor}`. Per-placed-item overrides on `PlacedItem.materialColors`. **Why:** matches the existing frontend customizer UX. *Built in Phase 1.*
- **Custom scaled sizes flow into the quote.** The designer lets users scale items 50–200%. `QuoteLine` carries `scaledWidth/Depth/Height` separately from the variant's stock dims. If they differ, the supplier sees a "custom size" badge and decides. **Why:** maximum flexibility, supplier owns the call. *Planned for Phase 5.*

### Doors, windows & fixtures

- **`Opening` + optional `productVariantId` FK.** The existing structural Opening (the hole in the wall: `wallId`, `offsetFromStart`, `width`, `height`, `sillHeight`) gains an optional FK to a `ProductVariant` for branded fixtures. Null = generic door/window. Non-null = a specific product fills the hole. **Why:** backwards-compatible with today's frontend; one concept, one row. *Schema planned for Phase 6; current `Opening` model in the frontend is unchanged.*

### Operational concerns

- **Soft delete: user-facing only.** `deletedAt` lives on `User`, `Project`, `ProjectComment`, `ProjectShare`. Catalog (Product/Variant/Supplier) is hard-deleted. **Why:** GDPR-aware on user data, simple on catalog. *Quote durability comes from snapshots, see below.*
- **`QuoteLine.variantSnapshot jsonb`.** Quote lines snapshot the product at quote-time (name, dims, supplier name, material/texture overrides). If a supplier later deletes a variant, historical quotes don't break. **Why:** decouples historical records from current catalog state. *Planned for Phase 5.*
- **Audit log: sensitive actions only.** `AuditLog { actorUserId?, action, entityType, entityId, diff jsonb?, ip?, ua?, createdAt }`. Tracks: role changes, supplier create/delete, product publish/hide/remove, quote responses. **Why:** legal/incident traceability without logging every UPDATE. *Planned for Phase 7.*
- **Product moderation: admin-only adds in MVP.** `Product.status` enum (`Draft|Published|Hidden|Removed`). The supplier portal (later phase) adds a `Pending` state for review. *Built in Phase 1.*

### Localization & defaults

- Languages on day one: **Albanian + English**. Default = Albanian (text lives on entity), English via Translation overlay.
- Currency: **single, EUR.**
- Units: **metric** (meters for dimensions, m² for area-sold products).

### Build & infrastructure

- **Monorepo: `frontend/` + `backend/` + `docs/`.** pnpm workspace at repo root with convenience scripts. **Why:** one git history, one PR per cross-cutting change. *Built in Phase 1.*
- **Local dev: Docker Compose** spins up Postgres 16 + Adminer. Host port 5433 (not 5432) to avoid the common collision with a host Postgres install. **Why:** isolates Dizajno from other Postgres-using projects on the dev machine. *Built in Phase 1.*
- **dotnet-ef as a local tool** via `backend/.config/dotnet-tools.json`. **Why:** clones get the right version with `dotnet tool restore`.
- **NuGet feed pinned via `backend/NuGet.config`.** **Why:** dev machines occasionally have empty/broken global NuGet config — the repo carries its own.

---

## Part 2 — Schema reference

Tables grouped by domain. **`✓ built`** means in Phase 1; **`planned`** means designed but not migrated; column types are PG.

### Identity (`✓ built`)

ASP.NET Identity tables (`AspNetUsers`, `AspNetRoles`, …) live alongside the rest. `ApplicationUser` extends `IdentityUser<Guid>` with:

| Column | Type | Notes |
|---|---|---|
| `display_name` | varchar(200) | nullable |
| `locale` | varchar(5) | ISO 639-1; default `sq` |
| `created_at` | timestamptz | `now()` default |
| `deleted_at` | timestamptz | nullable; soft delete |

### Suppliers (`✓ built`)

```
suppliers
  id                uuid pk
  slug              varchar(120) unique
  name              varchar(200)
  description       text
  logo_asset_id     uuid → assets (set null)
  website_url       varchar(500)
  contact_email     varchar(320)
  contact_phone     varchar(50)
  created_at        timestamptz default now()

supplier_members           (empty in MVP; seeds future portal)
  id                uuid pk
  supplier_id       uuid → suppliers (cascade)
  user_id           uuid → AspNetUsers
  role              enum-as-string  Owner | Staff
  created_at        timestamptz default now()
  unique (supplier_id, user_id)
```

### Catalog (`✓ built` for furniture)

```
categories
  id                uuid pk
  family            enum-as-string  Furniture | Lighting | Appliance | BuildingMaterial | Fixture
  parent_category_id uuid → categories (restrict)
  slug              varchar(120)
  name              varchar(200)
  path              varchar(500)    -- materialized: '/furniture/seating/sofas/'
  sort_order        int
  unique (family, slug)
  index path

products
  id                uuid pk
  supplier_id       uuid → suppliers (restrict)
  family            enum-as-string
  category_id       uuid → categories (restrict)
  slug              varchar(160) unique
  status            enum-as-string  Draft | Published | Hidden | Removed
  unit_of_sale      enum-as-string  Piece | SquareMeter | Liter | LinearMeter | Kilogram
  coverage_rate     numeric(10,3)   -- paint/sealant m² per L
  waste_factor      numeric(5,3)    -- 0.10 = 10% overage default for area products
  lead_time_days    int             -- nullable
  name              varchar(200)
  description       text
  preview_svg       text            -- inline SVG markup; moves to Asset rows once CAD conversion ships
  attributes        jsonb           -- family-specific: {"icon": "sofa"}, future: lumen, energyClass, ...
  created_at, updated_at
  index (status, family, category_id)
  index (supplier_id, status)

product_variants
  id                uuid pk
  product_id        uuid → products (cascade)
  sku               varchar(120) unique
  name              varchar(200)
  width, depth, height   numeric(8,3)   -- stock dims in meters
  color             varchar(16)         -- default hex
  base_price        numeric(12,2)       -- nullable
  currency          char(3)             -- 'EUR'
  glb_asset_id      uuid → assets (set null)
  svg_preview_asset_id uuid → assets (set null)   -- reserved for CAD-derived previews
  collision_boxes   jsonb               -- [{offsetX, offsetZ, width, depth}] for L-shapes
  material_defaults jsonb               -- {slotName: hexColor}
  attributes        jsonb               -- variant-specific
  sort_order        int
  created_at, updated_at
  index (product_id, sort_order)

assets
  id                uuid pk
  product_id        uuid → products (set null)
  variant_id        uuid → product_variants (set null)
  owner_supplier_id uuid → suppliers (set null)
  kind              enum-as-string  Glb | SvgPreview | Image | CadSource | Doc | Attachment
  url               varchar(1000)
  mime_type         varchar(120)
  size_bytes        bigint
  checksum_sha256   varchar(64)
  sort_order        int
  created_at        timestamptz default now()
```

### Customizer textures (`planned` — Phase 4)

```
supplier_textures
  id                uuid pk
  supplier_id       uuid → suppliers
  name              varchar(200)
  asset_id          uuid → assets
  thumbnail_asset_id uuid → assets (nullable)
  tags              text[]
  repeat_u, repeat_v int default 4
  unique (supplier_id, name)

product_variant_texture_slots
  id                uuid pk
  variant_id        uuid → product_variants
  slot_name         varchar              -- e.g. 'Body', 'Pillows'
  supplier_texture_id uuid → supplier_textures
  is_default        bool
  -- trigger: variant.product.supplier_id MUST equal supplier_texture.supplier_id
```

Phase 1 placeholder: texture options stored as JSON in `product_variants.attributes` (`{"textureSlots": {"Body": ["", "/textures/x.jpg"]}}`). Migration to proper tables is part of Phase 4.

### i18n (`✓ built`)

```
translations
  id                uuid pk
  entity_type       varchar(64)    -- 'Product' | 'ProductVariant' | 'Category' | 'Supplier'
  entity_id         uuid
  field             varchar(64)    -- 'Name' | 'Description'
  lang              varchar(5)     -- 'en' (default 'sq' stays on the entity)
  value             text
  unique (entity_type, entity_id, field, lang)
  index (entity_type, entity_id, lang)
```

### Refresh tokens (`✓ built`)

```
refresh_tokens
  id                uuid pk
  user_id           uuid → AspNetUsers
  token_hash        varchar(128) unique    -- SHA-256(rawToken), base64
  expires_at        timestamptz
  created_at        timestamptz default now()
  created_by_ip     varchar(64)
  revoked_at        timestamptz
  revoked_by_ip     varchar(64)
  replaced_by_token_id uuid (nullable)     -- rotation chain
  index (user_id, revoked_at)
```

### Projects (`planned` — Phase 2)

```
projects
  id                uuid pk
  owner_user_id     uuid → AspNetUsers
  name              varchar(200)
  thumbnail_asset_id uuid → assets (nullable)
  deleted_at        timestamptz (nullable)
  created_at, updated_at
  index (owner_user_id, deleted_at, updated_at desc)

project_versions
  id                uuid pk
  project_id        uuid → projects
  label             varchar(200)
  scene_snapshot    jsonb                 -- full scene frozen
  created_by_user_id uuid → AspNetUsers
  created_at        timestamptz

walls
  id                uuid pk
  project_id        uuid → projects
  start_x, start_z, end_x, end_z   numeric(10,4)
  thickness, height                 numeric(6,3)

floors
  id                uuid pk
  project_id        uuid → projects
  vertices          jsonb                 -- [[x,z], [x,z], ...]

openings
  id                uuid pk
  project_id        uuid → projects
  wall_id           uuid → walls
  type              enum-as-string  Door | Window
  offset_from_start, width, height, sill_height   numeric
  product_variant_id uuid → product_variants (nullable)   -- branded fixture, Phase 6
  material_overrides jsonb (nullable)

placed_items
  id                uuid pk
  project_id        uuid → projects
  product_variant_id uuid → product_variants
  position_x, position_z   numeric(10,4)
  rotation          numeric(8,5)          -- radians
  scale             numeric(5,3) default 1.000
  scaled_width, scaled_depth, scaled_height   numeric(8,3)   -- cached for quote
  material_colors   jsonb (nullable)
  material_textures jsonb (nullable)
  created_at, updated_at
```

### Sharing & comments (`planned` — Phase 3)

```
project_shares
  id                uuid pk
  project_id        uuid → projects
  mode              enum-as-string  View | Comment
  token             varchar unique (nullable)    -- link mode
  invited_email     varchar (nullable)
  invited_user_id   uuid → AspNetUsers (nullable)
  expires_at        timestamptz (nullable)
  created_by_user_id uuid → AspNetUsers
  created_at, revoked_at
  check ((token IS NOT NULL) <> (invited_email IS NOT NULL OR invited_user_id IS NOT NULL))

project_comments
  id                uuid pk
  project_id        uuid → projects
  parent_comment_id uuid → project_comments (nullable)
  author_user_id    uuid → AspNetUsers (nullable)
  guest_name        varchar (nullable)
  guest_email       varchar (nullable)
  share_id          uuid → project_shares (nullable)
  body              text
  anchor            jsonb (nullable)       -- {type, id?, x?, z?}
  resolved_at, deleted_at, created_at
  index (project_id, created_at)
```

### Quoting (`planned` — Phase 5)

```
quotes                                    -- user-facing parent
  id                uuid pk
  project_id        uuid → projects
  requester_user_id uuid → AspNetUsers
  status            enum  Open | Closed | Cancelled
  message           text (nullable)
  created_at, closed_at
  index (requester_user_id, created_at desc)

quote_requests                            -- per-supplier child
  id                uuid pk
  quote_id          uuid → quotes
  supplier_id       uuid → suppliers
  status            enum  Pending | Responded | Declined | Expired
  expires_at        timestamptz (nullable)
  created_at
  unique (quote_id, supplier_id)
  index (supplier_id, status, created_at desc)

quote_lines
  id                uuid pk
  quote_request_id  uuid → quote_requests
  product_variant_id uuid → product_variants
  variant_snapshot  jsonb                  -- name/supplier/stock dims/currency at quote time
  quantity          numeric(12,3)
  quantity_unit     varchar
  material_overrides jsonb
  scaled_width, scaled_depth, scaled_height   numeric(8,3) (nullable)
  is_custom_size    bool computed
  suggested_price   numeric(12,2)
  currency          char(3)

quote_responses
  id                uuid pk
  quote_request_id  uuid → quote_requests unique   -- one response per request
  responded_by_user_id uuid → AspNetUsers
  total_price       numeric(14,2)
  currency          char(3)
  body              text
  responded_at      timestamptz
  -- attachments tracked via Asset rows joined by a quote_response_assets table
```

### Cross-cutting (`planned` — Phase 7)

```
audit_log
  id                uuid pk
  actor_user_id     uuid → AspNetUsers (nullable)   -- null = system action
  action            varchar                          -- 'product.publish', 'user.role_grant', ...
  entity_type       varchar
  entity_id         uuid
  diff              jsonb (nullable)                 -- before/after for sensitive fields
  ip_address        inet (nullable)
  user_agent        text (nullable)
  created_at        timestamptz
  index (entity_type, entity_id, created_at desc)
  index (actor_user_id, created_at desc)
```

---

## Part 3 — Roadmap

| Phase | Status | Deliverables |
|---|---|---|
| 1 — Foundation | ✓ Done | Identity, JWT auth, catalog API, seeder for 12 furniture items, frontend swap, integration tests |
| 1.5 — Cloudflare R2 | pending | Asset uploads via presigned URLs; migrate seeded GLB/texture URLs to R2 |
| 2 — Projects | pending | `Project` + scene tables, save/load endpoints, thumbnail upload, named versions |
| 3 — Sharing | pending | `ProjectShare`, `ProjectComment`, share-link routes, comment thread UI, spatial anchors |
| 4 — Customizer textures | pending | `SupplierTexture` + `ProductVariantTextureSlot`, move Phase 1's jsonb textureSlots into proper tables |
| 5 — Quoting | pending | `Quote` fan-out, `QuoteRequest`/`QuoteLine`/`QuoteResponse`, inbox UIs |
| 6 — Fixtures & building materials | pending | `Opening.productVariantId`, paint/flooring quantity calc, lighting/appliance/building-material catalog data |
| 7 — Admin tooling | pending | `AuditLog`, admin dashboard; `SupplierMember` portal for self-serve onboarding |

### Phase 1 — Foundation ✓ Done

Branch: `feat/backend-foundation`. Commits `fd2dccb` through `8ca0ffd`. Eight commits, all green.

Built:
- Repo split into `frontend/` + `backend/` (pnpm workspace at root)
- .NET 8 solution with Clean Architecture layering (Api / Application / Domain / Infrastructure) under `backend/src/`
- Postgres 16 + Adminer via `backend/docker-compose.yml`, host port 5433
- `Dizajno.Infrastructure/Migrations`: `0001_Foundation`, `0002_RefreshTokens`, `0003_ProductPreviewSvg`
- ASP.NET Identity + JWT bearer + rotating refresh tokens (`POST /api/auth/register|login|refresh|logout`, `GET /api/auth/me`)
- Catalog API (`GET /api/catalog/products|categories|suppliers`) with the 12 furniture items seeded
- Frontend's `useFurnitureCatalog` now fetches from `/api/catalog/products` via TanStack Query
- Integration tests: 21 passing (catalog + auth) via Testcontainers Postgres
- `backend/BACKEND.md` setup + troubleshooting reference

Phase 1 done-bar: **the designer renders its catalog from the live API**. Hit.

### Phase 1.5 — Cloudflare R2 (deferred from Phase 1)

Add R2 client (AWS S3 SDK against R2 endpoint), `POST /api/admin/assets/presign` for admin uploads, migrate the seeded `/models/*.glb` URLs to R2. ~1–2 days.

### Phase 2 — Projects

**Goal:** users can save a room design and re-open it later.

New tables: `projects`, `project_versions`, `walls`, `floors`, `openings`, `placed_items`.

New endpoints (`/api/projects`):
- `GET /` — list current user's projects (paginated)
- `POST /` — create a new project (returns id + empty scene)
- `GET /{id}` — load full scene
- `PUT /{id}/scene` — replace live scene state (called on autosave + explicit save)
- `POST /{id}/versions` — name a version (snapshots the live scene to `project_versions`)
- `POST /{id}/versions/{versionId}/restore` — restore live scene from a version
- `DELETE /{id}` — soft delete

Frontend changes:
- New `/projects` route — list user's projects (thumbnail grid)
- New `/projects/[id]` route — loads scene into the existing designer
- Replace the in-memory Zustand store with persistence: on every store change, debounced `PUT /{id}/scene`
- Thumbnail: client-side export PNG from R3F canvas on save
- Login required → also implies the **login/register UI** (placeholder pages from Phase 1 get filled in)

### Phase 3 — Sharing

**Goal:** owners can share a project read-only or comment-only via link or invite.

New tables: `project_shares`, `project_comments`.

New endpoints:
- `POST /api/projects/{id}/shares` — create share (link or invite)
- `GET /api/share/{token}` — load shared scene (no login required)
- `POST /api/share/{token}/comments` — anon or logged-in comment
- `GET /api/projects/{id}/comments` — owner inbox

Frontend:
- "Share" button in the designer header
- Shared-view route `/share/[token]` — read-only or comment-able
- Comment overlay on the canvas (Figma-style pins) + thread sidebar

### Phase 4 — Customizer textures

**Goal:** suppliers maintain their own texture library; products opt in to specific textures per material slot.

New tables: `supplier_textures`, `product_variant_texture_slots`.

Migration: pull `textureSlots` JSON out of `product_variants.attributes` and into the relational tables. Backfill the Phase 1 seed (the corduroy texture on `colorable-sectional-sofa`).

### Phase 5 — Quoting

**Goal:** user clicks "Request quote on this room", suppliers respond independently, user sees all responses in one inbox.

New tables: `quotes`, `quote_requests`, `quote_lines`, `quote_responses`.

New endpoints:
- `POST /api/projects/{id}/quotes` — fan out one `QuoteRequest` per supplier in the scene; returns the parent `Quote` id
- `GET /api/quotes/{id}` — user's view (all responses)
- `GET /api/supplier/quotes` — supplier's inbox of `QuoteRequest`s
- `POST /api/supplier/quotes/{requestId}/respond` — submit price + body + attachments

Frontend:
- "Request quote" CTA in the designer
- User quote inbox at `/quotes`
- Supplier quote inbox (separate area, gated by supplier-member role)

### Phase 6 — Fixtures & building materials

**Goal:** the catalog grows beyond furniture; doors/windows become real products; paint/flooring quote lines auto-calc quantity from room geometry.

Schema:
- `Opening.product_variant_id` (nullable FK) — branded fixture filling the hole
- No new tables; lighting/appliance/building-material rows just populate the existing `products`/`product_variants` with their family + jsonb attributes

Frontend:
- Quantity calculator: when adding flooring/paint to the cart, compute m² from room geometry × waste factor, suggest a number, let user override
- Branded door/window picker in the opening sidebar

### Phase 7 — Admin tooling & supplier portal

New table: `audit_log`.

New features:
- Admin dashboard (web UI): supplier list, product moderation queue, audit log search
- Supplier portal: each `supplier_members.role = Owner` user can add/edit their products self-serve
- `Product.status = Pending` becomes a real state once the portal exists (admin must approve before publish)

---

## Open questions (parked)

These don't block any current phase but should be revisited:

1. **Notifications** — in-app + email outbox for quote responses, comment replies. Defer until Phase 3/5.
2. **Search engine** — Postgres `tsvector` + GIN will carry to ~100k products. Migrate to Meilisearch/Algolia later if scale demands.
3. **Reviews / ratings** — out of scope for the master plan. Easy to add: `product_reviews`, `supplier_reviews` tables. No impact on current design.
4. **Wishlists / saved products** — trivial: `saved_products(user_id, product_id, created_at)`. Anytime.
5. **Tags** — flat tag system layered on the category tree when product count per family approaches hundreds. Pure-additive `tags` + `product_tags`.
6. **Lead-time** — `Product.lead_time_days` is a catalog hint; authoritative answer comes in `QuoteResponse`.
7. **GDPR data export / right-to-be-forgotten** — `UserDeletionRequest` workflow + admin tooling, when needed.
8. **Production database hosting** — currently deferred. Options when ready: Supabase, Neon, Azure DB for Postgres, RDS, self-hosted. Schema is portable.
9. **CI pipeline** — no `.github/workflows` yet. Suggested: GitHub Actions running `dotnet test` + `pnpm build` on PRs.
