# Dizajno — Room Designer

A browser-based 2D/3D room designer where users draw walls, place furniture via drag-and-drop, and visualize rooms in 3D.

## Commands

```bash
npm run dev      # Start dev server (localhost:3000)
npm run build    # Production build
npm run lint     # ESLint
```

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
src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx            # Landing page (3D house scene)
│   ├── designer/           # Designer page (room editor)
│   ├── login/              # Login page (placeholder)
│   └── profile/            # Profile page (placeholder)
├── components/
│   ├── designer/           # Designer UI panels (Sidebar, Toolbar, PropertiesPanel, StatusBar)
│   ├── three/              # R3F 3D components
│   │   ├── landing/        # Landing page 3D scene (House, BlueDoor, Yard, HouseScene)
│   │   ├── furniture/      # 3D furniture models (BedModel, ChairModel, etc.)
│   │   ├── DrawingSurface  # Wall drawing canvas (2D mode)
│   │   ├── FloorMesh       # Auto-generated floor polygons
│   │   ├── WallMesh        # 3D wall rendering
│   │   ├── CameraController# Bounded OrbitControls for 3D mode
│   │   └── GridPlane       # Snap grid overlay
│   └── ui/                 # Reusable UI primitives (Button, Panel, Slider, etc.)
├── hooks/                  # Custom hooks (useFurnitureCatalog, useKeyboardShortcuts)
├── store/                  # Zustand store (useDesignerStore)
├── types/                  # TypeScript types (designer.ts)
└── utils/                  # Pure utilities
    ├── wallGraph.ts        # Planar face traversal for floor detection
    ├── collision.ts        # Furniture/wall collision detection
    ├── furnitureCatalog.ts # Furniture catalog definitions
    └── snapToGrid.ts       # Grid snapping helpers
```

## Architecture

### State Management
All designer state lives in `src/store/useDesignerStore.ts` (Zustand). Undo/redo is provided by Zundo's `temporal` middleware. The store manages walls, floors, furniture, selections, modes, and UI settings.

### Designer Modes
- `draw` — Left-click-hold-drag to draw walls
- `select` — Click to select/move furniture
- `furniture` — Drag from sidebar to place furniture

### Floor Detection
When walls form a closed polygon, `wallGraph.ts` uses a planar face traversal algorithm to automatically detect enclosed rooms and generate floor geometry.

### Collision System
`collision.ts` prevents furniture from overlapping walls or other furniture using AABB intersection checks.

### 3D Rendering
- All 3D components use React Three Fiber (R3F)
- `DrawingSurface.jsx` is loaded with `dynamic()` (no SSR) since R3F requires browser APIs
- `FloorMesh` creates `THREE.Shape` geometry and rotates from XY to XZ plane — note: Z coordinates must be negated when creating shapes due to `rotateX(-PI/2)` mapping

### Landing Page
Animated 3D house scene. Clicking the door triggers a camera animation → door opening → fade to black → navigate to `/designer`.

## Conventions

- Use `@/*` path alias for imports (maps to `src/*`)
- Coordinates are `[x, z]` tuples in the XZ plane (Y is up)
- IDs use `type-timestamp` format (e.g., `wall-1718234567890`)
- Furniture models are simple Three.js box geometries with color
- All 3D canvas components must be client-side only (`"use client"` or dynamic import with `ssr: false`)
- Wall endpoints snap to grid when snap is enabled

## Known Patterns

- The designer has two parallel state systems: the older `DesignerProvider` (React Context + useReducer in `components/designer/`) and the newer Zustand store (`store/useDesignerStore.ts`). The Zustand store is the canonical one going forward.
- Furniture catalog is defined in `utils/furnitureCatalog.ts` — add new furniture types there.
