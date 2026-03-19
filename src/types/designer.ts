// ── Designer Types ──────────────────────────────────────────────────────────

export interface WallData {
  id: string;
  start: [number, number]; // [x, z]
  end: [number, number];
  thickness: number;
  height: number;
}

export interface FloorData {
  id: string;
  vertices: [number, number][];
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
  /** Grouping category for sidebar display */
  category: FurnitureCategory;
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
}

export type DesignerMode = "draw" | "select" | "furniture";

export interface DesignerState {
  walls: WallData[];
  floors: FloorData[];
  furniture: FurnitureData[];

  // Drawing state
  drawingFrom: [number, number] | null;

  // Active furniture type being placed from sidebar
  activeFurnitureType: string | null;

  // UI
  mode: DesignerMode;
  is3D: boolean;
  selectedIds: string[];
  snap: boolean;
  gridSize: number;
  wallThickness: number;
  wallHeight: number;

  // Interaction lock — true while dragging/placing furniture (disables camera)
  isDragging: boolean;

  // Drop zone support — NDC coordinates from the HTML overlay
  pendingDrop: { type: string; ndcX: number; ndcY: number } | null;

  // Live drag preview position (NDC) while HTML dragging over canvas
  dragPreview: { ndcX: number; ndcY: number } | null;
}
