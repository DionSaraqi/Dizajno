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

- **Per-supplier texture library.** Each Supplier owns its own `SupplierTexture` rows; `ProductVariantTextureSlot` can only reference textures from the variant's product's supplier (enforced by a Postgres BEFORE INSERT/UPDATE trigger on `product_variant_texture_slots`). **Why:** matches reality — each company has its own fabrics. *Built in Phase 4 via migration `0006_CustomizerTextures`. Phase 1 stuffed `textureSlots` into `ProductVariant.attributes` jsonb as a placeholder; the seeder now creates a `SupplierTexture` (under the seed supplier) + an `Asset` per distinct texture URL, plus `ProductVariantTextureSlot` rows per (variant, slot, texture). The catalog DTO still emits `TextureSlots: Record<slotName, string[]>` with `""` prepended for the "None" option so the frontend is unchanged.*
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
  is_trusted        bool default false       -- Phase 7a; flips per-supplier moderation
  suspended_at      timestamptz nullable     -- Phase 7a; non-null = admin-suspended
  created_at        timestamptz default now()
  index (suspended_at)

supplier_members
  id                uuid pk
  supplier_id       uuid → suppliers (cascade)
  user_id           uuid → AspNetUsers
  role              enum-as-string  Owner | Staff
  created_at        timestamptz default now()
  unique (supplier_id, user_id)

supplier_invites                                   -- Phase 7a
  id                uuid pk
  supplier_id       uuid → suppliers (cascade)
  role              enum-as-string  Owner | Staff
  invited_email     varchar(320)             -- label only; no SMTP delivery
  token_hash        varchar(128) unique      -- SHA-256(raw token), base64
  expires_at        timestamptz
  accepted_at       timestamptz nullable
  accepted_by_user_id uuid nullable
  revoked_at        timestamptz nullable
  created_by_user_id uuid
  created_at        timestamptz default now()
  index (supplier_id, accepted_at, revoked_at)
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
  status            enum-as-string  Pending | Approved   -- Phase 7a; admin/seed = Approved
  suggested_by_supplier_id uuid → suppliers (set null)   -- Phase 7a; null = admin/seed
  unique (family, slug)
  index path
  index status
  index suggested_by_supplier_id

products
  id                uuid pk
  supplier_id       uuid → suppliers (restrict)
  family            enum-as-string
  category_id       uuid → categories (restrict)
  slug              varchar(160) unique
  status            enum-as-string  Draft | Published | Hidden | Removed | Pending   -- Pending added Phase 7a
  unit_of_sale      enum-as-string  Piece | SquareMeter | Liter | LinearMeter | Kilogram
  coverage_rate     numeric(10,3)   -- paint/sealant m² per L
  waste_factor      numeric(5,3)    -- 0.10 = 10% overage default for area products
  lead_time_days    int             -- nullable
  name              varchar(200)
  description       text
  preview_svg       text            -- inline SVG markup; moves to Asset rows once CAD conversion ships
  texture_url       varchar(500)    -- nullable; tileable image for FloorMesh/WallMesh skinning (Phase 6.5)
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

Built in Phase 4 (migration `0006_CustomizerTextures`). The previous Phase 1 placeholder — `{"textureSlots": ...}` stashed in `product_variants.attributes` — has been removed; the seeder now writes the relational rows directly. Cross-supplier slot inserts are blocked by trigger `trg_pv_texture_slot_supplier_match`.

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
  paint_product_variant_id uuid → product_variants (nullable, SetNull)  -- Phase 6.5

floors
  id                uuid pk
  project_id        uuid → projects
  vertices          jsonb                 -- [[x,z], [x,z], ...]
  flooring_product_variant_id uuid → product_variants (nullable, SetNull)  -- Phase 6.5

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

### Quoting (`✓ built` — Phase 5; migration `0007_Quoting`)

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

### Cross-cutting (`✓ built` — Phase 7a)

```
audit_log
  id                uuid pk
  actor_user_id     uuid (nullable)                  -- null = system action; pulled from JWT claims at write time
  action            varchar(64)                      -- 'supplier.suspend', 'product.approve', 'supplier_invite.accept', ...
  entity_type       varchar(64)
  entity_id         uuid
  diff              jsonb (nullable)                 -- before/after or context payload, camelCase JSON
  ip_address        varchar(64) (nullable)           -- HttpContext.Connection.RemoteIpAddress
  user_agent        text (nullable)                  -- truncated to 1024 chars
  created_at        timestamptz default now()
  index (entity_type, entity_id, created_at desc)
  index (actor_user_id, created_at desc)
  index (action, created_at desc)
```

Phase 7a scope: supplier lifecycle (`supplier.{create,update,suspend,restore,trust,untrust}`), role / membership changes (`supplier_invite.{create,revoke,accept}`), product status transitions (`product.{approve,reject}` plus future supplier-initiated transitions in 7b), category lifecycle (`category.{approve,reject}`). Phase 7a deliberately does **not** capture every QuoteResponse upsert — noisy, low signal-per-row. Add if dispute volume grows.

### `QuoteRequest` (Phase 7a addition)

`QuoteRequest.cancellation_reason varchar(64)` was added so the supplier-suspension flow can record `supplier_suspended` when it auto-expires still-Pending requests. Frontend can render this differently from "expired by timeout" once the inbox supports the distinction.

---

## Part 3 — Roadmap

| Phase | Status | Deliverables |
|---|---|---|
| 1 — Foundation | ✓ Done | Identity, JWT auth, catalog API, seeder for 12 furniture items, frontend swap, integration tests |
| 1.5 — Cloudflare R2 | ✓ Done | `IObjectStorage` + AWSSDK.S3 R2 client; admin presign + asset-create endpoints; integration tests with mocked storage. Bulk migration of seeded `/models/*.glb` URLs still pending an R2 bucket. |
| 2 — Projects | ✓ Done | Backend: `projects`/`project_versions`/`walls`/`floors`/`openings`/`placed_items` tables (migration `0004_Projects`), full CRUD + scene replace-all + version snapshot/restore at `/api/projects/*`, thumbnail presign + attach endpoints. Frontend: auth store with HttpOnly-cookie refresh bootstrap, login + register pages, `/projects` list with create/delete, `/projects/[id]` designer that loads a scene and auto-saves on changes (1.5 s debounce), 800×600 canvas capture auto-uploaded to R2 throttled to one per 30 s. |
| 3 — Sharing | ✓ Done (pin overlay deferred) | Backend: `project_shares` + `project_comments` (migration `0005_Sharing`), owner-side share CRUD + comment inbox under `/api/projects/{id}`, public token-scoped scene load + comment list/post under `/api/share/{token}`. Comment mode required for posts; anon posters supply `guestName`. Frontend: Share dialog in designer header (link + email modes), `/share/[token]` read-only viewer using the same R3F canvas in select mode, right-rail CommentsPanel that polls every 15 s and supports both signed-in + guest authors. Anchor JSON is round-tripped; rendering pins on the canvas is the only piece deferred. |
| 4 — Customizer textures | ✓ Done | Backend: `supplier_textures` + `product_variant_texture_slots` (migration `0006_CustomizerTextures`) with a Postgres trigger enforcing variant.product.supplier ≡ supplier_texture.supplier. Seeder upserts one `SupplierTexture` (+ backing `Asset`) per distinct catalog texture URL under the `dizajno` supplier and writes `ProductVariantTextureSlot` rows per (variant, slot, url), marking the first non-empty url per slot as default. `CatalogController` joins the new tables and emits the same `TextureSlots: Record<slotName, string[]>` DTO shape (with `""` prepended for "None"), so the frontend keeps using `def.textureSlots` and `materialTextures` unchanged. |
| 5 — Quoting | ✓ Done | Backend: `quotes`/`quote_requests`/`quote_lines`/`quote_responses`/`quote_response_assets` (migration `0007_Quoting`); `ISupplierMembershipResolver` gating `/api/supplier/*`; user controller (create/list/detail/cancel/close) + supplier controller (inbox/detail/respond-upsert/decline) + supplier-scoped asset uploads. Phase-5 admin stopgap `POST /api/admin/supplier-members` until the Phase 7 portal lands. `UserSummary.supplierMemberships` drives frontend nav. Frontend: `RequestQuoteDialog` in the designer header (grouped per-supplier preview + subtotals), `/quotes` + `/quotes/[id]` for requesters, `/supplier/quotes` + `/supplier/quotes/[id]` for responders with response composer + attachment dropzone. 30 s polling on inbox routes. |
| 6 — Fixtures & building materials | ✓ Done (lighting/appliance seed deferred) | Catalog seed grew Family/UnitOfSale/CoverageRate/WasteFactor/BasePrice; 7 new products + 4 new categories under Fixture + BuildingMaterial families (2 fixtures, 3 paints with 8/10/12 m²/L coverage, 3 flooring tiers €11/18/45 m²). All 20 seeded rows now carry BasePrice so the request-quote dialog renders real subtotals; `BackfillVariantPricesAsync` upgrades existing dev DBs without a wipe. `FurnitureItemDto` exposes Family/UnitOfSale/CoverageRate/WasteFactor. `POST /api/projects/{id}/quotes` fans out branded openings + an optional `manualLines` array alongside placed items. Sidebar opening properties gain a "Branded fixture (optional)" picker filtered by family + door-vs-window; `WallOpening.tsx` reads the picked variant's color. `RequestQuoteDialog` "Materials & finishes" section shows per-unit price, line subtotal, and a materials subtotal footer; selections fold into the per-supplier subtotal preview. Lighting + appliance entries deferred until GLB models exist. |
| 7a — Admin tooling | ✓ Done | Migration `0009_AdminAndPortal` adds `audit_log`, `supplier_invites`, `Supplier.isTrusted`, `Supplier.suspendedAt`, `Category.status`, `Category.suggestedBySupplierId`, `QuoteRequest.cancellationReason`, `ProductStatus.Pending`. `IAuditLogger` writes per-action rows with actor/IP/UA pulled from `IHttpContextAccessor`. Admin endpoints under `/api/admin/{suppliers,invites,moderation,audit-log}` for supplier suspend/restore/trust/untrust, tokenized member invites (SHA-256 hash at rest; raw + acceptUrl returned exactly once), product + category moderation queues, paginated audit-log search. Public invite preview + accept at `/api/invites/{token}` (preview anonymous, accept signed-in). Suspension side-effects wired: catalog filter hides suspended suppliers + pending categories, supplier-portal endpoints reject memberships where `isSuspended`, pending QuoteRequests auto-expire with `cancellation_reason='supplier_suspended'`. `UserSummary.supplierMemberships[].isSuspended` flag added so the frontend can grey out portal entries. `DataSeeder` writes `isTrusted=true` on the dizajno seed supplier (also backfilled by migration SQL). Frontend `/admin/{suppliers,suppliers/[id],moderation,audit-log}` + `/invite/[token]` accept page + Admin nav entry for users with the Admin role. 20 new integration tests (99 total green). |
| 7b — Supplier portal | pending | Self-serve supplier portal at `/supplier/[supplierId]/{products,textures,members,profile}`: full product + variant CRUD (incl. GLB upload via R2 presign), `SupplierTexture` library CRUD with per-variant slot pickers, Owner-only member management (last-Owner protection), supplier-suggested categories. Untrusted suppliers' new products go to `Pending`; admin queue from Phase 7a picks them up. |
| 7c — Designer-applicable materials | pending | Wall paints + floor finishes via supplier-uploaded `BuildingMaterial` products with `TextureUrl`; furniture-slot textures via `SupplierTexture` + `ProductVariantTextureSlot` rows (DB trigger already enforces cross-supplier isolation). All five families (Furniture/Lighting/Appliance/BuildingMaterial/Fixture) accept supplier-uploaded products with appropriate per-family editor UIs. |

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

### Phase 1.5 — Cloudflare R2 ✓ Done

Branch: `feat/backend-foundation`. Built on top of Phase 1.

Built:
- `IObjectStorage` abstraction in `Dizajno.Application/Storage/` + matching `R2Options`
- `S3ObjectStorage` in `Dizajno.Infrastructure/Storage/` using `AWSSDK.S3` against the R2 endpoint (`https://{accountId}.r2.cloudflarestorage.com`, `ForcePathStyle = true`)
- `POST /api/admin/assets/presign` — admin-only; validates per-`AssetKind` MIME + size caps, returns a short-lived PUT URL plus the derived public URL and the headers the client must echo
- `POST /api/admin/assets` — admin-only; persists an `Asset` row with the public URL derived from `R2:PublicBaseUrl` + the key
- `FakeObjectStorage` registered via `ConfigureTestServices` so the integration tests never hit the wire
- 8 new integration tests covering auth gating, MIME/size validation, and persistence — full suite is 29 green
- Refactored `AddInfrastructure` to resolve the connection string from `IConfiguration` at DbContext construction time so test config overrides (including R2 settings) take effect uniformly

Outstanding (parked until an R2 bucket is provisioned):
- Upload the seeded `frontend/public/models/*.glb` + `textures/*.jpg` to R2 and update `CatalogSeedData.cs` to point at the R2 URLs. The migration recipe is documented in [backend/BACKEND.md](../backend/BACKEND.md#migrating-the-phase-1-seed-assets-to-r2).

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

### Phase 4 — Customizer textures ✓ Done

Branch: `feat/backend-foundation`. Built on top of Phase 3.

Goal: suppliers maintain their own texture library; products opt in to specific textures per material slot.

Built:

- New entities `SupplierTexture` (`SupplierId`, `Name`, `AssetId`, `ThumbnailAssetId?`, `Tags text[]`, `RepeatU`/`RepeatV` defaulting to 4) and `ProductVariantTextureSlot` (`VariantId`, `SlotName`, `SupplierTextureId`, `IsDefault`) under `Dizajno.Domain.Entities`, with EF configurations + DbSets on `DizajnoDbContext`.
- Migration `0006_CustomizerTextures` creates both tables and installs trigger `trg_pv_texture_slot_supplier_match` (BEFORE INSERT OR UPDATE) so the database itself rejects any `product_variant_texture_slot` whose variant's product belongs to a different supplier than the referenced `supplier_texture`.
- `DataSeeder` no longer writes `{"textureSlots": ...}` into `ProductVariant.Attributes`. Instead it walks `CatalogSeedData.Items[*].TextureSlots`, upserts one `SupplierTexture` + backing `Asset` (`AssetKind.Image`) per distinct URL under the seed supplier, and creates one `ProductVariantTextureSlot` per (variant, slot, non-empty url). The first non-empty url per slot is marked `IsDefault`.
- `CatalogController` reads texture options via a bulk join over `ProductVariantTextureSlot → SupplierTexture → Asset`, groups by `(variant, slot)`, sorts by `IsDefault DESC, Name`, and prepends `""` so the DTO shape (`TextureSlots: Record<slotName, string[]>`) matches Phase 1 — the frontend, `materialTextures` round-trip, and existing tests are unchanged.
- Integration tests in `CustomizerTexturesTests`: catalog DTO exposes the seeded corduroy texture on Body + Pillows; products without slots return null; `ProductVariant.Attributes` no longer contains the `textureSlots` key; the seeder library + per-variant slot rows are present; the supplier-match trigger raises a `PostgresException` on cross-supplier inserts. Suite is **55 tests** across **6 classes**.

Out of scope this phase (slots into Phase 7): admin/supplier CRUD for `SupplierTexture` and per-variant slot bindings, a dedicated `AssetKind.Texture`, and exposing `RepeatU/RepeatV`/`Tags` on the catalog DTO.

### Phase 5 — Quoting ✓ Done

Branch: `feat/backend-foundation`. Built on top of Phase 4.

**Goal:** a user clicks "Request quote" in the designer, the backend fans the room out into one `QuoteRequest` per supplier whose products are in the scene, each supplier responds independently, and the requester sees all responses in a single inbox. Quote lines snapshot the variant + user choices at quote-time so historical records survive catalog churn.

Built:

- Domain entities `Quote`, `QuoteRequest`, `QuoteLine`, `QuoteResponse`, `QuoteResponseAsset` + matching EF configurations + DbSets on `DizajnoDbContext`. Migration `0007_Quoting` creates all five tables with the indexes documented below.
- `ISupplierMembershipResolver` (Application) + `SupplierMembershipResolver` (Infrastructure) — single lookup that returns `IReadOnlyList<SupplierMembership>` for a given user id. Injected into every controller that needs to gate by supplier membership.
- `QuotesController` (user side) exposes `POST /api/projects/{id}/quotes` (fan-out + transactional insert), `GET /api/quotes`, `GET /api/quotes/{id}`, `POST /api/quotes/{id}/cancel`, `POST /api/quotes/{id}/close`. Cancel propagates `Expired` to still-`Pending` children; close requires ≥1 response.
- `SupplierQuotesController` exposes `GET /api/supplier/quotes` (inbox), `GET /api/supplier/quotes/{requestId}`, `POST /respond` (upsert — same row updated on re-post), `POST /decline` (status → `Declined`, reason persisted as a zero-priced response so the requester sees it uniformly). Cross-supplier visibility is blocked at every action — non-members hit 403, foreign requests 404, and the `respond` endpoint validates attachment ownership against `Asset.owner_supplier_id`.
- `SupplierAssetsController` mirrors the admin R2 presign + finalize flow but takes a supplier id from the body and validates it against the caller's memberships. Keys live under `suppliers/{supplierId}/{kind}/…`. Accepts `Image | Doc | Attachment` kinds.
- `AdminSupplierMembersController` ships the Phase-5 stopgap binding endpoint at `POST /api/admin/supplier-members` (idempotent; updates role on existing rows). Admin role required.
- `AuthController` now resolves the caller's `supplierMemberships` on every login / refresh / `me` call. `UserSummary` gained a `SupplierMembership[]` field; the frontend uses it to conditionally render the supplier-inbox nav entry.
- `CatalogController` DTO gained `SupplierId`, `SupplierName`, `BasePrice`, `Currency` so the `RequestQuoteDialog` can group items by supplier and show subtotals without an extra round-trip.
- Frontend: `lib/api.ts` grew the full quote + supplier-quote + supplier-asset + admin-binding client surface. `RequestQuoteDialog` (new) plugs into the project designer header next to "Share" and groups the live store's `furniture` by supplier with subtotals; submit POSTs `/api/projects/{id}/quotes` and routes to `/quotes/{id}`. Routes `/quotes`, `/quotes/[id]`, `/supplier/quotes`, `/supplier/quotes/[id]` are all live with 30 s `refetchInterval` polling and per-supplier accordion / response composer. The supplier composer uploads attachments through the new supplier presign flow.
- Tests: new `QuotesEndpointsTests` (13 tests) cover fan-out + ownership + cancel propagation + close-before-response 409 + close-after-decline succeeds + `IsCustomSize` flip + supplier inbox member gating + happy-path respond + idempotent upsert + cross-supplier attachment 400 + cancelled-quote response 409 + admin-bind RBAC 403. `AuthEndpointsTests` got a `UserSummary.SupplierMemberships` empty-by-default assertion. Suite is now **69 tests** across **7 classes**.

Out of scope this phase (parked):

- **Notifications** — no email or in-app push; suppliers poll the inbox at 30 s. (PLAN.md Open Questions #1.)
- **Multi-currency** — `currency` column exists, FX/locale conversion does not.
- **Paint/flooring quantity calculator from wall/floor geometry** — Phase 6.
- **Full supplier portal** (self-serve products, member CRUD UI) — Phase 7. Phase 5 ships the admin binding endpoint as a stopgap.
- **Quote PDF export / order workflow** — never on the roadmap; Dizajno is matchmaker, not seller.

### Phase 6 — Fixtures & building materials ✓ Done

Branch: `feat/backend-foundation`. Built on top of Phase 5.

**Goal:** the catalog gained its first non-furniture members. Doors and windows can carry a branded variant that shows up in quote responses. Paint and flooring can be requested with a quantity auto-calculated from room geometry (`floor m²`, `paintable wall m²`) and a per-product waste factor — user can override the suggested number before submit.

Built:

- **Migration-free phase.** All required columns (`Opening.ProductVariantId`, `Product.CoverageRate`, `Product.WasteFactor`, `QuoteLine.QuantityUnit`) and the `ProductFamily` / `UnitOfSale` enums were already shipped in earlier phases.
- **Catalog seed.** `ItemSeed` grew `Family`, `UnitOfSale`, `CoverageRate?`, `WasteFactor` fields (default to Furniture / Piece / null / 0 — additive for existing rows). `CatalogSeedData.Categories` flipped from `string[]` to `IReadOnlyList<CategorySeed>` so categories carry their `ProductFamily`. Four new products: `solid-oak-door` and `pvc-window` (Fixture, Piece), `interior-matt-paint` (BuildingMaterial, Liter, coverage 10 m²/L, waste 10%), `oak-laminate-flooring` (BuildingMaterial, SquareMeter, waste 5%). Four new categories: Doors, Windows, Paint, Flooring.
- **`DataSeeder`** keys categories on `(Family, Name)` instead of just Name; category paths are now `"/{family}/{slug}/"`. Product seeding writes `seed.Family`, `seed.UnitOfSale`, `seed.CoverageRate`, `seed.WasteFactor` rather than hardcoding furniture defaults.
- **`FurnitureItemDto`** grew four fields: `Family`, `UnitOfSale`, `CoverageRate?`, `WasteFactor`. Existing furniture rows return `Family = "Furniture"`, `UnitOfSale = "Piece"`, `CoverageRate = null`, `WasteFactor = 0` so the change is invisible to the existing place-furniture sidebar.
- **`POST /api/projects/{id}/quotes` extended.** Body grew an optional `manualLines: [{ productVariantId, quantity, quantityUnit }]` array. The fan-out now folds three sources into a single line stream:
  - `placed_items` (Phase 5 behaviour, unchanged)
  - `openings WHERE product_variant_id IS NOT NULL` (Phase 6 branded fixtures — `quantity = 1, quantityUnit = "piece"`, `scaledWidth/Height` reflect the wall cut-out)
  - `manualLines` (paint, flooring — `IsCustomSize = false`)
  Each source flows through a shared `VariantSnapshotSource` projection so `variant_snapshot.productSlug` etc. land identically regardless of where the line came from. Empty-scene check now requires zero from *all three* sources to 400. Manual lines that reference an unknown or unpublished variant return 400.
- **Frontend types.** `FurnitureCatalogItem` grew the four catalog fields; `OpeningData` grew `productVariantId?: string | null`; `sceneMapper` round-trips it through `PUT /scene`.
- **Sidebar opening properties.** New "Branded fixture (optional)" `<select>` between the sill-height slider and the Delete button. Populated from the live catalog filtered to `family === "Fixture"` AND `category === (opening.type === "door" ? "Doors" : "Windows")`. Picking a row calls `updateOpening(id, { productVariantId })`; clearing it sets the field back to null.
- **`WallOpening.tsx`** reads `productVariantId`, looks the variant's `color` up in the TanStack Query catalog cache, and tints the frame with it. Generic openings render identically to before.
- **`RequestQuoteDialog`** grew a "Materials & finishes" section. New helper `frontend/src/utils/areaCalc.ts` exports `computeRoomAreas(scene) → { floorAreaM2, paintableWallM2, openingAreaM2 }` (shoelace per floor polygon, `Σ(wall × height) − Σ(opening areas)` for walls), `suggestMaterialQuantity(unitOfSale, coverageRate, wasteFactor, areas)`, plus `unitLabel`/`quantityUnitToken` for display + API serialisation. Materials are checkbox-selected; selected ones submit as `manualLines`. Quote button on the project header re-enables based on `placedCount + wallCount + openingCount > 0` so users with walls but no furniture can still request paint/flooring.
- **Tests.** `CatalogEndpointsTests` grew 4: `GetProducts_FiltersByFamily_FixtureReturnsDoorAndWindow`, `GetProducts_FiltersByFamily_BuildingMaterialExposesUnitAndCoverage`, `GetCategories_Unfiltered_IncludesPhase6Families`, plus `GetProducts_ExposesBasePrices` (regression guard). The "all twelve" + "four furniture categories" assertions were updated to reflect the new totals (20 products: 12 furniture + 2 fixtures + 6 building-material tiers; 4 furniture-filtered categories vs 8 unfiltered). `QuotesEndpointsTests` grew 3: `Create_WithBrandedOpening_IncludesItInFanOut`, `Create_WithManualMaterialLines_AppendsThemToFanOut`, `Create_RejectsManualLineWithUnknownVariant`. Suite is now **76 tests** across **7 classes**.

- **Pricing pass + showcase tier (post-Phase 6 polish).** All 12 Phase-1 furniture rows + the 4 Phase-6 rows + 3 new material variants got concrete `BasePrice` values so the request-quote dialog renders real subtotals. New `DataSeeder.BackfillVariantPricesAsync` step updates null prices on existing dev DBs without requiring a `docker compose down -v`. Three new building-material tiers (`premium-eco-paint`, `exterior-weather-paint`, `budget-vinyl-flooring`, `engineered-hardwood`) showcase the calculator with distinct per-unit prices: paint coverage rates of 8/10/12 m²/L produce visibly different per-line totals; flooring tiers span €11 → €45/m².

- **Scene-assigned materials redesign (post-Phase 6 polish).** Migration `0008_SceneMaterials` adds nullable FKs `walls.paint_product_variant_id` and `floors.flooring_product_variant_id` plus a `products.texture_url` column. The full Materials & finishes workflow flipped from dialog-driven to designer-driven:
  - **Designer.** Floors become selectable in `select` mode. Wall properties grow a "Paint (optional)" picker; floor properties grow a "Flooring (optional)" picker. Both filter the live catalog by family + category. The catalog DTO grew a `textureUrl` field.
  - **Renderer.** `FloorMesh` and `WallMesh` share a new `useMaterialTexture(variantId)` hook that loads the variant's `textureUrl` via `THREE.TextureLoader` with `RepeatWrapping` + SRGB, dispatches sensible tile-per-meter repeats, and falls back to the variant's solid `color` when the texture file is missing (Three.js logs but never throws). Floor UVs are remapped from the polygon's bounding box so tiles align across rotated rooms.
  - **Backend fan-out.** `POST /api/projects/{id}/quotes` now folds five sources into the line stream: placed items, branded openings, manual lines (legacy API surface, no longer used by the dialog), **and** scene-assigned flooring + paint. Material lines aggregate one per distinct variant: flooring = `Σ(floorArea) × (1 + waste)` m², paint = `ceil(Σ(paintableWallArea) / coverageRate × (1 + waste))` L where paintable = `length × height − Σ(openingArea on that wall)`.
  - **Dialog rewrite.** `RequestQuoteDialog` is now a read-only summary: per-supplier accordion with placed items, branded openings, and aggregated material lines side-by-side, each row showing `label × quantity unit · price`. Submit just sends `{ message }`; the backend recomputes everything from the persisted scene.
  - **Seed.** TextureUrl is set on every BuildingMaterial row (slug-based paths under `/textures/`). A companion `BackfillProductTextureUrlsAsync` step stamps the URLs onto existing dev DBs at startup.
  - **Tests.** 3 new `QuotesEndpointsTests`: flooring aggregates floor area into one line, paint aggregates across walls, opening area is subtracted from paintable surface. Suite is now **79 tests** across **7 classes**.
  - **Asset gap.** Texture image files (`/textures/{slug}.jpg`) are user-provided assets — the seed wires the URLs but the JPGs need to be dropped into `frontend/public/textures/`. When a file is missing, surfaces render in the variant's solid color (fallback path); no broken images, just no plank/finish detail.

Out of scope this phase (parked):

- **Lighting & Appliance seed data** — these need GLB models which are a per-item project. Easy follow-up when models exist.
- **`project_materials` persistence** — selections would survive page reload but adds a migration + endpoint surface not in PLAN.md. Possible Phase 6.5.
- **GLB-in-hole branded doors** — real door panels with handles + a hole-cutter in the renderer. Defer.
- **LinearMeter products (skirting, trim)** — schema supports it via wall-perimeter calc; no seeded examples this phase.

#### Decisions made during planning

- **Branded fixture render:** the variant's `color` overrides the hardcoded gold-brown frame color in `WallOpening.tsx`. No GLB-in-hole this phase (that would need new GLBs + a hole-cutter in the renderer, a project of its own).
- **Picker location:** "Branded fixture (optional)" dropdown in the **Sidebar properties panel for a selected opening**, filtered to `family === "Fixture"` AND `category` matching `door` vs `window`.
- **Material persistence:** dialog-only. The user picks paint/flooring each time they open the request-quote dialog; quantities are recomputed from current geometry. The resulting `quote_lines` are persisted via the existing variant-snapshot freeze. A `project_materials` persistence layer is parked as a possible Phase 6.5.
- **Seed scope:** 4 products. Lighting + appliance entries deferred until GLB models exist.

### Phase 7a — Admin tooling ✓ Done

Branch: `feat/backend-foundation`. Built on top of Phase 6.5.

**Goal:** the platform is now a real marketplace. Admin can curate suppliers (suspend bad actors, flip trust), moderate the products + categories that suppliers will soon create (Phase 7b), and audit every sensitive action. The Phase-5 stopgap `POST /api/admin/supplier-members` stays for direct binding, but the actual onboarding flow now runs through tokenized invites.

Built:

- **Migration `0009_AdminAndPortal`** adds `audit_log`, `supplier_invites`, `Supplier.isTrusted` (default false, dizajno seed supplier backfilled to true), `Supplier.suspendedAt` (nullable), `Category.status` (Pending|Approved, default Approved) + `Category.suggestedBySupplierId`, `QuoteRequest.cancellationReason`. `ProductStatus.Pending = 4` added without renumbering existing values. `Category.Status` uses `HasSentinel(Approved)` so EF actually persists Pending rows (CLR default `0` = Pending would otherwise collide with "use the DB default").
- **`IAuditLogger`** (Application) + `AuditLogger` (Infrastructure). Pulls actor user id from JWT claims, plus IP + (truncated) User-Agent via `IHttpContextAccessor`. Diff payload is serialised camelCase JSON; null = no diff. Indexes on `(entity_type, entity_id, created_at desc)`, `(actor_user_id, created_at desc)`, `(action, created_at desc)`.
- **`/api/admin/suppliers`** — list (search by name/slug, filter by `suspended`/`trusted`), get-by-id, create (409 on duplicate slug), update profile, `/suspend`, `/restore`, `/trust`, `/untrust`. All actions write an `audit_log` row.
- **`/api/admin/invites`** — `POST` issues a 32-byte base64url token, persists only `SHA-256(token)` in `supplier_invites.token_hash`, returns the raw token + a built `AcceptUrl` derived from `InviteOptions.AcceptUrlTemplate` (`http://localhost:3000/invite/{token}` by default). List + `DELETE /{id}` (revoke). `email` is a label only — no SMTP wiring.
- **`/api/invites/{token}`** (public) — anonymous `GET` returns `InvitePreviewDto` so the accept page can render supplier name + role before forcing login. `POST /accept` requires `[Authorize]`, binds the caller as a `SupplierMember` with the invite's role (promotes role on existing memberships), idempotent on re-accept by the same user, 409 on conflict with a different accepter, 410 on revoked/expired.
- **`/api/admin/moderation`** — `GET /products` lists `ProductStatus.Pending` rows, `POST /{id}/approve` flips to `Published`, `POST /{id}/reject` flips to `Hidden` (both 409 if the product isn't actually Pending). Same shape for categories; reject deletes the row but 409s if any product is still attached.
- **`/api/admin/audit-log`** — paginated search filterable by actor, action, entity-type, entity-id, date range. Page size capped at 200.
- **Suspension side-effects.** `CatalogController` filters out products from suspended suppliers and products whose category is still `Pending`; `GET /api/catalog/suppliers` also hides suspended ones. Supplier-portal endpoints (`SupplierQuotesController`, `SupplierAssetsController`) use the new `SupplierMembershipExtensions.ActiveSupplierIds()` helper that drops memberships flagged `IsSuspended`. On suspend, every still-`Pending` `QuoteRequest` for that supplier flips to `Expired` with `cancellation_reason = 'supplier_suspended'` so requesters see a clear reason in their inbox.
- **`SupplierMembership.IsSuspended`** flag added to the Application record + propagated through `UserSummary.SupplierMemberships`. The frontend uses it to grey out portal entries for suspended suppliers without removing them entirely.
- **`InviteOptions`** registered from the `Invites` config section. Template + default lifetime (14 days, clamped 1–90).
- **Frontend.** `lib/api.ts` grew the full admin client surface (suppliers, invites, moderation, audit-log) + public invite preview/accept. New routes: `/admin` (redirects to suppliers), `/admin/suppliers` (list + create modal + per-row trust/suspend buttons), `/admin/suppliers/[id]` (member list + invite list + create-invite modal that shows the raw token + AcceptUrl once with a clipboard-copy button), `/admin/moderation` (tabbed pending products + pending categories with approve/reject), `/admin/audit-log` (filterable + paginated). `/invite/[token]` is a standalone (no admin layout) accept page that handles 4 visual states: invalid, expired/revoked, already-accepted, ready-to-accept (logged in vs logged out). Register page now honours `?redirect=` so invite → register → auto-redirect-to-invite works. Projects page shows an "Admin" nav button to users with the `Admin` role; supplier nav already conditionally renders from `supplierMemberships`.
- **`DataSeeder`** marks the dizajno seed supplier `IsTrusted = true` (idempotent — also backfilled to existing dev DBs by the migration SQL).
- **Tests.** `AdminAndPortalTests`: 20 new integration tests covering admin RBAC, supplier CRUD, suspend hides catalog rows, suspend auto-expires pending QuoteRequests, suspend blocks the suspended supplier's members from `/api/supplier/*`, invite create returns token once / list never includes plaintext token, invite preview returns public metadata, accept binds caller + is idempotent, second-user-accept after first 409s, revoked accept 410s, pending-product approve → Published + reject → Hidden, approve on non-Pending 409s, pending-category approve → Approved + reject-with-attached-products 409s, audit-log records supplier lifecycle and is searchable, audit-log requires Admin role, `UserSummary.SupplierMemberships[].IsSuspended` flips on suspend. Full suite is **99 tests** across **8 classes**.

Out of scope this phase (lands in 7b/7c):

- **Supplier portal UI** — `/supplier/[supplierId]/{products,textures,members,profile}` self-serve CRUD. Phase 7b.
- **Product / variant / texture creation endpoints** — Phase 7b. The moderation queue from 7a will start receiving real rows once suppliers can submit products.
- **Wall paints / floor finishes / furniture-slot textures via supplier** — Phase 7c. Schema is ready (`Product.TextureUrl`, `SupplierTexture`, `ProductVariantTextureSlot` + cross-supplier-blocking trigger).
- **Visual collision-box editor** — see [Open Questions #10](#open-questions-parked). Plain numeric inputs are good enough for v1.

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
10. **Visual collision-box editor for the supplier portal.** The Phase 7 supplier portal ships with plain numeric inputs for `ProductVariant.collisionBoxes` (rows of `{offsetX, offsetZ, width, depth}`). 90%+ of furniture is rectangular and uses the auto-generated single AABB from `width × depth`, so the numeric form is only painful for L-shapes / curved geometry. The richer UX is a Three.js mini-editor embedded in the variant page: render the supplier's uploaded GLB in a preview canvas, let the supplier drag/resize colored rectangles on top of the model's XZ footprint, and write the result back as `collisionBoxes` JSON. Worth ~1 week of focused work and would significantly improve the editor for sectionals, corner desks, modular shelving, etc. Pick this up after Phase 7 lands and once we have real supplier feedback on the numeric form.
