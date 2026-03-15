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
}

export type FurnitureCategory = "Seating" | "Tables" | "Bedroom" | "Storage";

export interface FurnitureCatalogItem {
  type: string;
  label: string;
  width: number;
  depth: number;
  height: number;
  color: string;
  icon: string;
  category: FurnitureCategory;
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

  // Drop zone support — NDC coordinates from the HTML overlay
  pendingDrop: { type: string; ndcX: number; ndcY: number } | null;
}
