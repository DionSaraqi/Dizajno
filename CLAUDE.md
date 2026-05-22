# Dizajno — Room Designer

A browser-based 2D/3D room designer where users draw walls, place furniture via drag-and-drop, and visualize rooms in 3D.

## Repo Layout

The repository is a pnpm workspace split into two top-level packages:

- `frontend/` — Next.js 14 application (the existing codebase). All paths in this document are relative to `frontend/` unless prefixed otherwise.
- `backend/` — .NET 8 Web API (Phase 1 complete: catalog API + auth). See [backend/BACKEND.md](backend/BACKEND.md) for the full backend reference (endpoints, env vars, migrations, troubleshooting).

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
dotnet ef database update --project src/Dizajno.Infrastructure --startup-project src/Dizajno.Api
dotnet run --project src/Dizajno.Api                          # API on http://localhost:5000
dotnet test tests/Dizajno.IntegrationTests                    # Testcontainers + WebApplicationFactory
```

Seeded admin (dev only): `admin@dizajno.local` / `Admin1234!`. The frontend reads the
API base URL from `NEXT_PUBLIC_API_URL` (see `frontend/.env.example`).

## Tech Stack

- **Framework**: Next.js 14 (App Router) + React 18 + TypeScript
- **3D**: Three.js 0.171, React Three Fiber, Drei
- **State**: Zustand + Zundo (undo/redo via temporal middleware)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Notifications**: Sonner
- **Data fetching**: TanStack React Query

## Project Structure

```
.
├── frontend/                  # Next.js 14 app (active codebase)
│   ├── public/                # Static assets — GLBs in models/, textures in textures/
│   └── src/
│       ├── app/               # Next.js App Router pages
│       │   ├── page.tsx       # Landing page (3D house scene)
│       │   ├── designer/      # Designer page (room editor)
│       │   ├── login/         # Login page (placeholder)
│       │   └── profile/       # Profile page (placeholder)
│       ├── components/
│       │   ├── designer/      # Designer UI panels (Sidebar, Toolbar, PropertiesPanel, StatusBar)
│       │   ├── three/         # R3F 3D components
│       │   │   ├── landing/   # Landing page 3D scene (House, BlueDoor, Yard, HouseScene)
│       │   │   ├── furniture/ # 3D furniture models (BedModel, ChairModel, GLTFModel, etc.)
│       │   │   ├── DrawingSurface  # Wall drawing canvas (2D mode)
│       │   │   ├── FloorMesh       # Auto-generated floor polygons
│       │   │   ├── WallMesh        # 3D wall rendering
│       │   │   ├── CameraController# Bounded OrbitControls for 3D mode
│       │   │   └── GridPlane       # Snap grid overlay
│       │   └── ui/            # Reusable UI primitives (Button, Panel, Slider, etc.)
│       ├── hooks/             # Custom hooks (useFurnitureCatalog, useKeyboardShortcuts)
│       ├── store/             # Zustand store (useDesignerStore)
│       ├── types/             # TypeScript types (designer.ts)
│       └── utils/             # Pure utilities
│           ├── wallGraph.ts       # Planar face traversal for floor detection
│           ├── collision.ts       # Furniture/wall collision detection
│           ├── furnitureCatalog.ts# Furniture catalog definitions
│           └── snapToGrid.ts      # Grid snapping helpers
├── backend/                   # .NET 8 Web API (under construction)
├── package.json               # Root pnpm workspace
├── pnpm-workspace.yaml
└── CLAUDE.md                  # This file
```

## Architecture

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
- Uniform scale slider (50%–200%) in properties panel scales width/depth/height proportionally from catalog base

### Landing Page
- Animated 3D house scene with rotatable house (Y-axis only, camera fixed)
- Clicking the door → house rotates back to home → camera moves to front → door opens → fade → navigate to `/designer`
- Grid background has a cursor-following white glow effect (CSS `mask-image`)
- `SketchMaterial` shader uses world-space normals so wall colors don't change with rotation

## Conventions

- Use `@/*` path alias for imports (maps to `src/*`)
- Coordinates are `[x, z]` tuples in the XZ plane (Y is up)
- IDs use `type-timestamp` format (e.g., `wall-1718234567890`)
- All 3D canvas components must be client-side only (`"use client"` or dynamic import with `ssr: false`)
- Wall endpoints snap to grid and to existing corners when snap is enabled
- Package manager is **pnpm** (not npm)

## Known Patterns

- The designer has two parallel state systems: the older `DesignerProvider` (React Context + useReducer in `components/designer/`) and the newer Zustand store (`store/useDesignerStore.ts`). The Zustand store is the canonical one going forward.
- Furniture catalog is defined in `utils/furnitureCatalog.ts` — add new furniture types there. Each item has an `svgPreview` for the sidebar thumbnail, optional `modelUrl` for GLTF loading, `materialSlots` for color customization, and `textureSlots` for texture customization.
- Properties panel is a collapsible section inside the left sidebar (not a separate right panel).

## Troubleshooting

- **Stale `.next` cache** — If you get `Cannot find module './719.js'` or similar webpack errors, stop the dev server, run `rm -rf .next`, and restart. This happens when the cache gets corrupted (e.g. after installing/removing packages).
- **Chrome DevTools 404** — `GET /.well-known/appspecific/com.chrome.devtools.json 404` is harmless; Chrome checks for this automatically. Ignore it.
