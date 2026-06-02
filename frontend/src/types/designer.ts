// ── Designer Types ──────────────────────────────────────────────────────────

export interface WallData {
  id: string;
  start: [number, number]; // [x, z]
  end: [number, number];
  thickness: number;
  height: number;
  /**
   * Phase 6.5: optional FK to a Paint variant in the catalog. When set,
   * the wall renders with the variant's texture/color in 3D and shows up
   * as a quote line (aggregated with other walls sharing the same paint).
   */
  paintVariantId?: string | null;
}

export interface FloorData {
  id: string;
  vertices: [number, number][];
  /**
   * Phase 6.5: optional FK to a Flooring variant in the catalog. Same
   * mechanics as `WallData.paintVariantId` but for floor polygons.
   */
  flooringVariantId?: string | null;
}

export interface FurnitureData {
  id: string;
  type: string;
  position: [number, number]; // [x, z]
  rotation: number; // radians, multiples of PI/2
  width: number;
  depth: number;
  height: number;
  color: string;
  /** When false/undefined the item is a ghost being placed; true means it is permanently placed */
  locked?: boolean;
  /** Uniform scale multiplier (default 1.0). Affects width/depth/height proportionally. */
  scale?: number;
  /**
   * Vertical "levitation" offset in meters (default 0). Raises the model above
   * the floor — Planner5D-style. Edited via the bottom selection bar.
   */
  elevation?: number;
  /** Per-material color overrides keyed by material name in the GLB */
  materialColors?: Record<string, string>;
  /** Per-material texture URL overrides keyed by material name in the GLB */
  materialTextures?: Record<string, string>;
}

export type FurnitureCategory = "Seating" | "Tables" | "Bedroom" | "Storage";

/**
 * Represents a single furniture item in the catalog.
 *
 * NOTE: This structure is designed to be API-compatible.
 * In the future, furniture items will be fetched from a backend API that serves
 * CAD files (e.g. .dxf/.dwg) from local furniture companies (manufacturers/retailers).
 * The `svgPreview` field will eventually be generated server-side from those CAD files
 * as a top-down 2D floor-plan representation. The `modelUrl` field will point to a
 * 3D model asset (e.g. GLTF/GLB) served from the same API.
 *
 * Planned API shape (future):
 *   GET /api/furniture                  → FurnitureCatalogItem[]
 *   GET /api/furniture/:type            → FurnitureCatalogItem
 *   GET /api/furniture/:type/model.glb  → 3D model binary
 */
/**
 * Sub-box for composite collision shapes (e.g., L-shaped furniture).
 * Offsets are relative to the item's center position.
 */
export interface CollisionBox {
  offsetX: number;
  offsetZ: number;
  width: number;
  depth: number;
}

export interface FurnitureCatalogItem {
  /** Unique identifier / furniture type slug (e.g. "sofa", "bed") */
  type: string;
  /**
   * Backend product-variant uuid for the default variant of this product.
   * Required when persisting placed items back to the backend (Phase 2). The
   * offline fallback catalog leaves this empty.
   */
  variantId?: string;
  /** Human-readable display name */
  label: string;
  /** Width in meters (X axis) */
  width: number;
  /** Depth in meters (Z axis) */
  depth: number;
  /** Height in meters (Y axis) */
  height: number;
  /** Default fill color for 3D rendering */
  color: string;
  /** Lucide icon name — kept for fallback rendering */
  icon: string;
  /**
   * Grouping category for sidebar display. Phase 1 furniture uses the four
   * `FurnitureCategory` values; Phase 6 added "Doors", "Windows", "Paint",
   * "Flooring". Typed as a free-form string to keep the place-furniture sidebar
   * narrow while letting the rest of the UI handle the new categories.
   */
  category: string;
  /**
   * Inline SVG string for the top-down 2D floor-plan thumbnail shown in the sidebar.
   * Future: will be auto-generated from CAD files by the backend.
   * The SVG coordinate space is normalised to a 100×100 viewBox.
   */
  svgPreview: string;
  /**
   * Optional URL to a 3D model asset (GLTF/GLB).
   * Future: will be served from the furniture API.
   */
  modelUrl?: string;
  /**
   * Optional composite collision boxes for non-rectangular shapes (e.g., L-shaped sofa).
   * Each box is relative to the item center. If omitted, a single AABB from width/depth is used.
   */
  collisionBoxes?: CollisionBox[];
  /**
   * Named material slots available for color customization.
   * Key = material name in the GLB, value = default hex color.
   * Only models with named PBR materials support this.
   */
  materialSlots?: Record<string, string>;
  /**
   * Named material slots available for texture customization.
   * Key = material name in the GLB, value = array of available texture URLs.
   * The first entry is the default texture (or empty string for no texture).
   */
  textureSlots?: Record<string, string[]>;
  /**
   * Owning supplier id (uuid). Used to group items by supplier in the Phase 5
   * request-quote flow. Optional on the bundled fallback (filled by the API).
   */
  supplierId?: string;
  /** Owning supplier display name. */
  supplierName?: string;
  /** Catalog suggested price, used as the per-line suggestion at quote time. */
  basePrice?: number | null;
  /** ISO 4217 currency code matching `basePrice` (defaults to EUR). */
  currency?: string;
  /**
   * Product family — drives whether the item is placed on the canvas (Furniture,
   * Fixture, Lighting, Appliance) or flows through the materials section in the
   * request-quote dialog (BuildingMaterial). Phase 6 addition.
   */
  family?:
    | "Furniture"
    | "Lighting"
    | "Appliance"
    | "BuildingMaterial"
    | "Fixture";
  /**
   * Unit the supplier sells the product in. Phase 6 paint = "Liter",
   * flooring = "SquareMeter". Furniture is "Piece" by default.
   */
  unitOfSale?: "Piece" | "SquareMeter" | "Liter" | "LinearMeter" | "Kilogram";
  /** m² per Liter — only set for paint/sealant. */
  coverageRate?: number | null;
  /** Suggested overage factor for area/volume materials (e.g. 0.10 = 10%). */
  wasteFactor?: number;
  /**
   * Optional URL to a tileable texture image. Used by `FloorMesh` and
   * `WallMesh` to skin floors / walls that have this variant assigned.
   * When null, the renderer falls back to `color`.
   */
  textureUrl?: string | null;
}

export type OpeningType = "door" | "window";

export interface OpeningData {
  id: string;
  wallId: string;
  type: OpeningType;
  /** Distance from wall start point (meters) to the near edge of the opening */
  offsetFromStart: number;
  /** Opening width in meters */
  width: number;
  /** Opening height in meters */
  height: number;
  /** Distance from floor to bottom of opening — 0 for doors, ~0.9 for windows */
  sillHeight: number;
  /**
   * Phase 6: optional FK to a branded fixture variant (catalog item with
   * `family === "Fixture"`). When set, `WallOpening` renders the frame in
   * the variant's color and the opening becomes a quote-line at fan-out time.
   * Null/undefined = generic door/window (default).
   */
  productVariantId?: string | null;
}

export type DesignerMode = "draw" | "select" | "furniture" | "opening";

export interface DesignerState {
  walls: WallData[];
  floors: FloorData[];
  furniture: FurnitureData[];
  openings: OpeningData[];

  // Drawing state
  drawingFrom: [number, number] | null;

  // Active furniture type being placed from sidebar
  activeFurnitureType: string | null;

  // Active opening type being placed (door or window)
  pendingOpeningType: OpeningType | null;

  // UI
  mode: DesignerMode;
  is3D: boolean;
  selectedIds: string[];
  hoveredId: string | null;
  snap: boolean;
  gridSize: number;
  wallThickness: number;
  wallHeight: number;

  // Planner5D-style UI state (not tracked by undo/redo)
  /** Which floating catalog panel is open in the left dock, if any. */
  activePanel: "build" | "furnish" | "search" | null;
  /** Whether persistent wall dimension arrows are shown in 2D mode. */
  showDimensions: boolean;
  /** Whether wall dimensions measure the inner or outer face. */
  dimensionFace: "inner" | "outer";

  // Interaction lock — true while dragging/placing furniture (disables camera)
  isDragging: boolean;

  // Read-only — set by the share viewer; blocks pointer-driven edits on the canvas
  readOnly: boolean;

  // Drop zone support — NDC coordinates from the HTML overlay
  pendingDrop: { type: string; ndcX: number; ndcY: number } | null;

  // Live drag preview position (NDC) while HTML dragging over canvas
  dragPreview: { ndcX: number; ndcY: number } | null;
}
