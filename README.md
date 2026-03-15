# Dizajno - Room Designer

A browser-based 2D/3D room designer. Draw walls, place furniture, and visualize your space.

## Features

- **Landing Page** — Animated 3D house scene with sketch/chalk aesthetic on a blueprint grid background. Click the blue door to enter the designer.
- **Wall Drawing** — Click and drag to draw walls on a grid. Walls snap to grid and show live measurements.
- **Auto Floor Detection** — Floors are generated automatically when walls form a closed polygon.
- **Furniture Placement** — Drag furniture from the sidebar catalog into your room, or click to place. 8 procedural furniture models (bed, table, chair, sofa, wardrobe, desk, bookshelf, nightstand).
- **2D/3D Toggle** — Switch between a top-down floor plan view and a 3D perspective view.
- **Multi-Select** — Shift+click for multi-select, with batch operations.
- **Undo/Redo** — Full history with Ctrl+Z / Ctrl+Shift+Z.
- **Keyboard Shortcuts** — D (draw), V (select), R (rotate), Delete, Escape, G (snap toggle), Ctrl+A (select all).
- **Properties Panel** — View and edit selected furniture dimensions, position, and rotation.
- **Collision Detection** — Real-time AABB collision feedback when placing or moving furniture.

## Tech Stack

- **Framework:** [Next.js 14](https://nextjs.org) (App Router)
- **Language:** TypeScript
- **3D Rendering:** [Three.js](https://threejs.org) + [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) + [drei](https://github.com/pmndrs/drei)
- **State Management:** [Zustand](https://github.com/pmndrs/zustand) with [zundo](https://github.com/charkour/zundo) (temporal undo/redo)
- **Styling:** [Tailwind CSS](https://tailwindcss.com)
- **Icons:** [Lucide React](https://lucide.dev)

## Project Structure

```
src/
  app/
    page.tsx                  # Landing page (3D house scene)
    designer/page.tsx         # Designer app
    login/page.tsx            # Login placeholder
    profile/page.tsx          # Profile placeholder
  components/
    designer/                 # Designer UI (Sidebar, Toolbar, StatusBar, PropertiesPanel, CanvasDropZone)
    three/                    # 3D components (DrawingSurface, Room, Door, walls, floors, furniture)
    three/landing/            # Landing page 3D scene (SketchMaterial, House, BlueDoor, Yard)
    ui/                       # Reusable UI primitives (Button, Toggle, Slider, Panel, SearchInput, ContextMenu)
  hooks/                      # Custom hooks (useKeyboardShortcuts, useFurnitureCatalog)
  store/                      # Zustand store (useDesignerStore)
  types/                      # Shared TypeScript types
  utils/                      # Utilities (collision, wallGraph, snapToGrid, furnitureCatalog)
```

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the landing page. Click the door to enter the designer.

## Design System

The app uses a custom dark theme with semantic color tokens (`dizajno-*`) defined in `tailwind.config.js`:

- `dizajno-bg` — App background
- `dizajno-surface` — Panel backgrounds
- `dizajno-elevated` — Toolbar/sidebar backgrounds
- `dizajno-accent` — Primary accent (indigo)
- `dizajno-text` — Primary text
- `dizajno-muted` — Secondary text

Fonts: Inter (UI) and JetBrains Mono (measurements, code).
