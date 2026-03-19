/**
 * Local furniture catalog — static data used while the backend API is not yet available.
 *
 * FUTURE INTEGRATION NOTE:
 * This catalog is intentionally structured to mirror the shape of the furniture API
 * that will be provided by local furniture companies and manufacturers.
 *
 * When the API is ready, replace this static array with a fetch call:
 *   const res = await fetch('/api/furniture');
 *   const catalog: FurnitureCatalogItem[] = await res.json();
 *
 * Each item's `svgPreview` will be auto-generated server-side from the company's
 * CAD files (DXF/DWG), producing a top-down 2D floor-plan SVG thumbnail.
 * The `modelUrl` field will point to a GLTF/GLB 3D model served from the same API.
 *
 * The hook `useFurnitureCatalog` (src/hooks/useFurnitureCatalog.ts) is already
 * structured with `isLoading` to support the async API transition.
 */

import type { FurnitureCatalogItem, FurnitureCategory } from "@/types/designer";

// ── SVG Previews ─────────────────────────────────────────────────────────────
// All SVGs use a 100×100 viewBox. Shapes are top-down (floor-plan) views.
// Stroke color uses currentColor so it adapts to active/inactive state.

const svgPreviews: Record<string, string> = {
  bed: `<svg viewBox="0 0 100 80" xmlns="http://www.w3.org/2000/svg" fill="none">
    <!-- Mattress -->
    <rect x="4" y="4" width="92" height="72" rx="4" fill="#c8a882" stroke="currentColor" stroke-width="2"/>
    <!-- Headboard -->
    <rect x="4" y="4" width="92" height="16" rx="3" fill="#8B6340" stroke="currentColor" stroke-width="2"/>
    <!-- Pillows -->
    <rect x="12" y="26" width="30" height="18" rx="4" fill="#f0e8dc" stroke="currentColor" stroke-width="1.5"/>
    <rect x="58" y="26" width="30" height="18" rx="4" fill="#f0e8dc" stroke="currentColor" stroke-width="1.5"/>
    <!-- Blanket fold line -->
    <line x1="4" y1="54" x2="96" y2="54" stroke="currentColor" stroke-width="1" stroke-dasharray="4 3"/>
  </svg>`,

  nightstand: `<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg" fill="none">
    <!-- Top surface -->
    <rect x="4" y="4" width="52" height="52" rx="3" fill="#c4a97a" stroke="currentColor" stroke-width="2"/>
    <!-- Drawer line -->
    <line x1="4" y1="32" x2="56" y2="32" stroke="currentColor" stroke-width="1.5"/>
    <!-- Drawer handle -->
    <rect x="22" y="38" width="16" height="4" rx="2" fill="currentColor" opacity="0.4"/>
    <!-- Lamp circle (optional object on top) -->
    <circle cx="30" cy="18" r="8" fill="#f5e6c8" stroke="currentColor" stroke-width="1.5"/>
  </svg>`,

  chair: `<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg" fill="none">
    <!-- Seat -->
    <rect x="8" y="14" width="44" height="38" rx="5" fill="#8B6340" stroke="currentColor" stroke-width="2"/>
    <!-- Back rest -->
    <rect x="8" y="4" width="44" height="14" rx="4" fill="#6B4226" stroke="currentColor" stroke-width="2"/>
    <!-- Seat cushion detail -->
    <rect x="14" y="20" width="32" height="26" rx="3" fill="#a07850" stroke="currentColor" stroke-width="1"/>
    <!-- Legs (corners) -->
    <circle cx="12" cy="48" r="3" fill="currentColor" opacity="0.5"/>
    <circle cx="48" cy="48" r="3" fill="currentColor" opacity="0.5"/>
  </svg>`,

  sofa: `<svg viewBox="0 0 120 60" xmlns="http://www.w3.org/2000/svg" fill="none">
    <!-- Back rest -->
    <rect x="4" y="4" width="112" height="18" rx="5" fill="#3d5a64" stroke="currentColor" stroke-width="2"/>
    <!-- Seat area -->
    <rect x="4" y="20" width="112" height="32" rx="4" fill="#4A6670" stroke="currentColor" stroke-width="2"/>
    <!-- Left arm -->
    <rect x="4" y="20" width="14" height="32" rx="3" fill="#3d5a64" stroke="currentColor" stroke-width="1.5"/>
    <!-- Right arm -->
    <rect x="102" y="20" width="14" height="32" rx="3" fill="#3d5a64" stroke="currentColor" stroke-width="1.5"/>
    <!-- Seat divider -->
    <line x1="62" y1="22" x2="62" y2="50" stroke="currentColor" stroke-width="1" stroke-dasharray="3 2"/>
    <!-- Cushion left -->
    <rect x="20" y="24" width="38" height="22" rx="3" fill="#557080" stroke="currentColor" stroke-width="1"/>
    <!-- Cushion right -->
    <rect x="62" y="24" width="38" height="22" rx="3" fill="#557080" stroke="currentColor" stroke-width="1"/>
  </svg>`,

  table: `<svg viewBox="0 0 100 70" xmlns="http://www.w3.org/2000/svg" fill="none">
    <!-- Table top -->
    <rect x="6" y="6" width="88" height="58" rx="4" fill="#c4975a" stroke="currentColor" stroke-width="2"/>
    <!-- Wood grain lines -->
    <line x1="6" y1="22" x2="94" y2="22" stroke="currentColor" stroke-width="0.8" opacity="0.3"/>
    <line x1="6" y1="35" x2="94" y2="35" stroke="currentColor" stroke-width="0.8" opacity="0.3"/>
    <line x1="6" y1="48" x2="94" y2="48" stroke="currentColor" stroke-width="0.8" opacity="0.3"/>
    <!-- Legs (corners) -->
    <circle cx="14" cy="14" r="4" fill="#8B6340" stroke="currentColor" stroke-width="1.5"/>
    <circle cx="86" cy="14" r="4" fill="#8B6340" stroke="currentColor" stroke-width="1.5"/>
    <circle cx="14" cy="56" r="4" fill="#8B6340" stroke="currentColor" stroke-width="1.5"/>
    <circle cx="86" cy="56" r="4" fill="#8B6340" stroke="currentColor" stroke-width="1.5"/>
  </svg>`,

  desk: `<svg viewBox="0 0 110 60" xmlns="http://www.w3.org/2000/svg" fill="none">
    <!-- Desk surface -->
    <rect x="4" y="4" width="102" height="52" rx="3" fill="#d4b896" stroke="currentColor" stroke-width="2"/>
    <!-- Drawer unit on right -->
    <rect x="74" y="8" width="28" height="44" rx="2" fill="#b8956a" stroke="currentColor" stroke-width="1.5"/>
    <!-- Drawer lines -->
    <line x1="74" y1="22" x2="102" y2="22" stroke="currentColor" stroke-width="1"/>
    <line x1="74" y1="36" x2="102" y2="36" stroke="currentColor" stroke-width="1"/>
    <!-- Drawer handles -->
    <rect x="83" y="27" width="10" height="3" rx="1.5" fill="currentColor" opacity="0.4"/>
    <rect x="83" y="41" width="10" height="3" rx="1.5" fill="currentColor" opacity="0.4"/>
    <!-- Monitor outline on surface -->
    <rect x="20" y="10" width="40" height="26" rx="2" fill="#c8ad8a" stroke="currentColor" stroke-width="1" stroke-dasharray="3 2"/>
  </svg>`,

  wardrobe: `<svg viewBox="0 0 80 60" xmlns="http://www.w3.org/2000/svg" fill="none">
    <!-- Body -->
    <rect x="4" y="4" width="72" height="52" rx="3" fill="#6B5040" stroke="currentColor" stroke-width="2"/>
    <!-- Center divider -->
    <line x1="40" y1="4" x2="40" y2="56" stroke="currentColor" stroke-width="1.5"/>
    <!-- Left door handle -->
    <rect x="32" y="26" width="5" height="8" rx="2.5" fill="currentColor" opacity="0.5"/>
    <!-- Right door handle -->
    <rect x="43" y="26" width="5" height="8" rx="2.5" fill="currentColor" opacity="0.5"/>
    <!-- Top shelf line -->
    <line x1="4" y1="18" x2="76" y2="18" stroke="currentColor" stroke-width="1" stroke-dasharray="3 2"/>
    <!-- Leg indicators -->
    <rect x="8" y="52" width="8" height="4" rx="1" fill="#4a3828" stroke="currentColor" stroke-width="1"/>
    <rect x="64" y="52" width="8" height="4" rx="1" fill="#4a3828" stroke="currentColor" stroke-width="1"/>
  </svg>`,

  bookshelf: `<svg viewBox="0 0 70 80" xmlns="http://www.w3.org/2000/svg" fill="none">
    <!-- Body -->
    <rect x="4" y="4" width="62" height="72" rx="3" fill="#8B7040" stroke="currentColor" stroke-width="2"/>
    <!-- Shelves -->
    <line x1="4" y1="22" x2="66" y2="22" stroke="currentColor" stroke-width="2"/>
    <line x1="4" y1="40" x2="66" y2="40" stroke="currentColor" stroke-width="2"/>
    <line x1="4" y1="58" x2="66" y2="58" stroke="currentColor" stroke-width="2"/>
    <!-- Books row 1 -->
    <rect x="8" y="9" width="6" height="12" rx="1" fill="#c05030"/>
    <rect x="16" y="10" width="5" height="11" rx="1" fill="#3060a0"/>
    <rect x="23" y="9" width="7" height="12" rx="1" fill="#40904a"/>
    <rect x="32" y="10" width="4" height="11" rx="1" fill="#9030a0"/>
    <rect x="38" y="9" width="6" height="12" rx="1" fill="#c09020"/>
    <rect x="46" y="10" width="5" height="11" rx="1" fill="#308080"/>
    <rect x="53" y="9" width="7" height="12" rx="1" fill="#a04030"/>
    <!-- Books row 2 (simplified) -->
    <rect x="8" y="27" width="8" height="12" rx="1" fill="#3060a0" opacity="0.7"/>
    <rect x="18" y="27" width="5" height="12" rx="1" fill="#c05030" opacity="0.7"/>
    <rect x="25" y="27" width="7" height="12" rx="1" fill="#40904a" opacity="0.7"/>
    <rect x="34" y="27" width="6" height="12" rx="1" fill="#c09020" opacity="0.7"/>
    <rect x="42" y="27" width="5" height="12" rx="1" fill="#9030a0" opacity="0.7"/>
    <rect x="49" y="27" width="9" height="12" rx="1" fill="#308080" opacity="0.7"/>
    <!-- Books row 3 (simplified) -->
    <rect x="8" y="45" width="6" height="12" rx="1" fill="#a04030" opacity="0.6"/>
    <rect x="16" y="45" width="9" height="12" rx="1" fill="#3060a0" opacity="0.6"/>
    <rect x="27" y="45" width="5" height="12" rx="1" fill="#40904a" opacity="0.6"/>
    <rect x="34" y="45" width="7" height="12" rx="1" fill="#c05030" opacity="0.6"/>
    <rect x="43" y="45" width="6" height="12" rx="1" fill="#9030a0" opacity="0.6"/>
    <rect x="51" y="45" width="7" height="12" rx="1" fill="#c09020" opacity="0.6"/>
  </svg>`,
};

// ── Catalog Definition ────────────────────────────────────────────────────────

export const furnitureCatalog: FurnitureCatalogItem[] = [
  // ── Bedroom ─────────────────────────────────────────────────────────────
  {
    type: "bed",
    label: "Bed",
    width: 2.0,
    depth: 1.6,
    height: 0.5,
    color: "#8B4513",
    icon: "bed",
    category: "Bedroom",
    svgPreview: svgPreviews.bed,
  },
  {
    type: "nightstand",
    label: "Nightstand",
    width: 0.5,
    depth: 0.4,
    height: 0.55,
    color: "#A0522D",
    icon: "lamp",
    category: "Bedroom",
    svgPreview: svgPreviews.nightstand,
  },

  // ── Seating ─────────────────────────────────────────────────────────────
  {
    type: "chair",
    label: "Chair",
    width: 0.5,
    depth: 0.5,
    height: 0.9,
    color: "#6B4226",
    icon: "armchair",
    category: "Seating",
    svgPreview: svgPreviews.chair,
  },
  {
    type: "sofa",
    label: "Sofa",
    width: 2.0,
    depth: 0.9,
    height: 0.8,
    color: "#4A6670",
    icon: "sofa",
    category: "Seating",
    svgPreview: svgPreviews.sofa,
  },
  {
    type: "sectional-sofa",
    label: "Sectional Sofa",
    // Actual rendered size after uniform scaling (raw: 0.698 x 0.213 x 1.0, scale: 2.5)
    width: 1.75,
    depth: 2.5,
    height: 0.53,
    color: "#4A5C50",
    icon: "sofa",
    category: "Seating",
    svgPreview: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none">
      <path d="M4 4 L70 4 L70 45 L40 45 L40 96 L4 96 Z" fill="#4A5C50" stroke="currentColor" stroke-width="2"/>
      <path d="M10 10 L64 10 L64 40 L36 40 L36 90 L10 90 Z" fill="#5A6C60" stroke="currentColor" stroke-width="1"/>
    </svg>`,
    modelUrl: "/models/sectional-sofa.glb",
    // L-shape collision: tightly fit the actual model geometry
    // Total footprint: 1.75 x 2.5. L opens bottom-right.
    collisionBoxes: [
      { offsetX: 0, offsetZ: -0.65, width: 1.75, depth: 1.2 },   // top bar (full width, ~half depth)
      { offsetX: -0.44, offsetZ: 0.55, width: 0.87, depth: 1.2 }, // left leg
    ],
  },
  {
    type: "gray-sectional-sofa",
    label: "Gray Sectional",
    // Actual rendered size (raw: 0.988 x 0.291 x 1.0, scale: 2.5)
    width: 2.47,
    depth: 2.5,
    height: 0.73,
    color: "#6B6B6B",
    icon: "sofa",
    category: "Seating",
    svgPreview: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none">
      <path d="M4 4 L96 4 L96 45 L50 45 L50 96 L4 96 Z" fill="#6B6B6B" stroke="currentColor" stroke-width="2"/>
      <path d="M10 10 L90 10 L90 40 L44 40 L44 90 L10 90 Z" fill="#7B7B7B" stroke="currentColor" stroke-width="1"/>
    </svg>`,
    modelUrl: "/models/gray-sectional-sofa.glb",
    // L-shape collision
    collisionBoxes: [
      { offsetX: 0, offsetZ: -0.65, width: 2.47, depth: 1.2 },
      { offsetX: -0.8, offsetZ: 0.55, width: 0.87, depth: 1.2 },
    ],
  },

  // ── Tables ──────────────────────────────────────────────────────────────
  {
    type: "table",
    label: "Dining Table",
    width: 1.2,
    depth: 0.8,
    height: 0.75,
    color: "#A0522D",
    icon: "table",
    category: "Tables",
    svgPreview: svgPreviews.table,
  },
  {
    type: "desk",
    label: "Desk",
    width: 1.4,
    depth: 0.7,
    height: 0.75,
    color: "#DEB887",
    icon: "monitor",
    category: "Tables",
    svgPreview: svgPreviews.desk,
  },

  // ── Storage ─────────────────────────────────────────────────────────────
  {
    type: "wardrobe",
    label: "Wardrobe",
    width: 1.5,
    depth: 0.6,
    height: 2.0,
    color: "#5C4033",
    icon: "door-open",
    category: "Storage",
    svgPreview: svgPreviews.wardrobe,
  },
  {
    type: "bookshelf",
    label: "Bookshelf",
    width: 1.0,
    depth: 0.35,
    height: 1.8,
    color: "#8B6914",
    icon: "book-open",
    category: "Storage",
    svgPreview: svgPreviews.bookshelf,
  },
];

export const furnitureCategories: FurnitureCategory[] = [
  "Seating",
  "Tables",
  "Bedroom",
  "Storage",
];

export function getFurnitureDef(type: string): FurnitureCatalogItem | undefined {
  return furnitureCatalog.find((f) => f.type === type);
}

export function getFurnitureByCategory(
  category: FurnitureCategory
): FurnitureCatalogItem[] {
  return furnitureCatalog.filter((f) => f.category === category);
}
