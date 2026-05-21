import { create } from "zustand";
import { temporal } from "zundo";
import type {
  DesignerState,
  WallData,
  FloorData,
  FurnitureData,
  OpeningData,
  OpeningType,
  DesignerMode,
} from "@/types/designer";
import { getFurnitureDef } from "@/utils/furnitureCatalog";

// ── Actions Interface ───────────────────────────────────────────────────────

interface DesignerActions {
  // Wall actions
  addWall: (wall: WallData) => void;
  removeWall: (id: string) => void;
  setWalls: (walls: WallData[]) => void;
  setWallsAndFloors: (walls: WallData[], floors: FloorData[]) => void;
  updateWall: (id: string, changes: Partial<Pick<WallData, "thickness" | "height">>) => void;
  setDrawingFrom: (point: [number, number] | null) => void;
  setFloors: (floors: FloorData[]) => void;

  // Furniture actions
  placeFurniture: (item: FurnitureData) => void;
  moveFurniture: (id: string, position: [number, number]) => void;
  rotateFurniture: (id: string) => void;
  scaleFurniture: (id: string, scale: number) => void;
  setFurnitureMaterialColors: (id: string, colors: Record<string, string>) => void;
  setFurnitureMaterialTextures: (id: string, textures: Record<string, string>) => void;
  removeFurniture: (id: string) => void;
  duplicateFurniture: (id: string) => void;
  deleteSelected: () => void;

  // Opening actions
  addOpening: (opening: OpeningData) => void;
  removeOpening: (id: string) => void;
  updateOpening: (id: string, changes: Partial<Omit<OpeningData, "id" | "wallId">>) => void;

  // Selection actions
  select: (id: string | null) => void;
  selectMultiple: (ids: string[]) => void;
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;

  // Hover
  setHoveredId: (id: string | null) => void;

  // Mode & UI
  setMode: (mode: DesignerMode) => void;
  setActiveFurniture: (furnitureType: string | null) => void;
  setPendingOpeningType: (type: OpeningType | null) => void;
  toggleIs3D: () => void;
  setSnap: (snap: boolean) => void;
  setGridSize: (size: number) => void;
  setWallThickness: (thickness: number) => void;
  setWallHeight: (height: number) => void;

  // Interaction lock (disables camera while dragging/placing furniture)
  setDragging: (dragging: boolean) => void;

  // Drop zone
  setPendingDrop: (drop: { type: string; ndcX: number; ndcY: number } | null) => void;
  setDragPreview: (preview: { ndcX: number; ndcY: number } | null) => void;

  // Bulk
  clearAll: () => void;
}

type DesignerStore = DesignerState & DesignerActions;

// ── Initial State ───────────────────────────────────────────────────────────

const initialState: DesignerState = {
  walls: [],
  floors: [],
  furniture: [],
  openings: [],
  drawingFrom: null,
  activeFurnitureType: null,
  pendingOpeningType: null,
  mode: "draw",
  is3D: false,
  selectedIds: [],
  hoveredId: null,
  snap: true,
  gridSize: 1,
  wallThickness: 0.15,
  wallHeight: 2.5,
  isDragging: false,
  pendingDrop: null,
  dragPreview: null,
};

// ── Store ───────────────────────────────────────────────────────────────────

export const useDesignerStore = create<DesignerStore>()(
  temporal(
    (set, get) => ({
      ...initialState,

      // Wall actions
      addWall: (wall) => set((s) => ({ walls: [...s.walls, wall] })),
      removeWall: (id) => set((s) => ({
        walls: s.walls.filter((w) => w.id !== id),
        openings: s.openings.filter((o) => o.wallId !== id),
        selectedIds: s.selectedIds.filter((sid) => sid !== id),
      })),
      setWalls: (walls) => set({ walls }),
      setWallsAndFloors: (walls, floors) => set({ walls, floors }),
      updateWall: (id, changes) => set((s) => ({
        walls: s.walls.map((w) => w.id === id ? { ...w, ...changes } : w),
      })),
      setDrawingFrom: (point) => set({ drawingFrom: point }),
      setFloors: (floors) => set({ floors }),

      // Furniture actions
      placeFurniture: (item) =>
        set((s) => ({ furniture: [...s.furniture, item] })),
      moveFurniture: (id, position) =>
        set((s) => ({
          furniture: s.furniture.map((f) =>
            f.id === id ? { ...f, position } : f
          ),
        })),
      rotateFurniture: (id) =>
        set((s) => ({
          furniture: s.furniture.map((f) =>
            f.id === id ? { ...f, rotation: f.rotation + Math.PI / 2 } : f
          ),
        })),
      scaleFurniture: (id, scale) =>
        set((s) => ({
          furniture: s.furniture.map((f) => {
            if (f.id !== id) return f;
            const def = getFurnitureDef(f.type);
            if (!def) return f;
            // Apply uniform scale relative to the catalog base dimensions
            return {
              ...f,
              scale,
              width: def.width * scale,
              depth: def.depth * scale,
              height: def.height * scale,
            };
          }),
        })),
      setFurnitureMaterialColors: (id, colors) =>
        set((s) => ({
          furniture: s.furniture.map((f) =>
            f.id === id ? { ...f, materialColors: { ...f.materialColors, ...colors } } : f
          ),
        })),
      setFurnitureMaterialTextures: (id, textures) =>
        set((s) => ({
          furniture: s.furniture.map((f) =>
            f.id === id ? { ...f, materialTextures: { ...f.materialTextures, ...textures } } : f
          ),
        })),
      removeFurniture: (id) =>
        set((s) => ({
          furniture: s.furniture.filter((f) => f.id !== id),
          selectedIds: s.selectedIds.filter((sid) => sid !== id),
        })),
      duplicateFurniture: (id) => {
        const state = get();
        const item = state.furniture.find((f) => f.id === id);
        if (!item) return;
        const newItem: FurnitureData = {
          ...item,
          id: `furn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          position: [item.position[0] + 0.5, item.position[1] + 0.5],
          locked: true,
        };
        set((s) => ({
          furniture: [...s.furniture, newItem],
          selectedIds: [newItem.id],
        }));
      },
      deleteSelected: () =>
        set((s) => ({
          furniture: s.furniture.filter((f) => !s.selectedIds.includes(f.id)),
          walls: s.walls.filter((w) => !s.selectedIds.includes(w.id)),
          openings: s.openings.filter((o) => {
            // Remove openings for deleted walls AND directly selected openings
            const wallDeleted = s.selectedIds.includes(o.wallId);
            const openingSelected = s.selectedIds.includes(o.id);
            return !wallDeleted && !openingSelected;
          }),
          selectedIds: [],
        })),

      // Opening actions
      addOpening: (opening) => set((s) => ({ openings: [...s.openings, opening] })),
      removeOpening: (id) => set((s) => ({
        openings: s.openings.filter((o) => o.id !== id),
        selectedIds: s.selectedIds.filter((sid) => sid !== id),
      })),
      updateOpening: (id, changes) => set((s) => ({
        openings: s.openings.map((o) => o.id === id ? { ...o, ...changes } : o),
      })),

      // Selection
      select: (id) => set({ selectedIds: id ? [id] : [] }),
      selectMultiple: (ids) => set({ selectedIds: ids }),
      toggleSelect: (id) =>
        set((s) => ({
          selectedIds: s.selectedIds.includes(id)
            ? s.selectedIds.filter((sid) => sid !== id)
            : [...s.selectedIds, id],
        })),
      selectAll: () =>
        set((s) => ({
          selectedIds: [
            ...s.furniture.map((f) => f.id),
            ...s.walls.map((w) => w.id),
          ],
        })),
      clearSelection: () => set({ selectedIds: [] }),

      // Hover
      setHoveredId: (id) => set({ hoveredId: id }),

      // Mode & UI
      setMode: (mode) =>
        set({ mode, activeFurnitureType: null, pendingOpeningType: null, selectedIds: [] }),
      setActiveFurniture: (furnitureType) =>
        set({ activeFurnitureType: furnitureType, mode: "furniture" }),
      setPendingOpeningType: (type) =>
        set({ pendingOpeningType: type, mode: "opening", activeFurnitureType: null, selectedIds: [] }),
      toggleIs3D: () => set((s) => ({ is3D: !s.is3D })),
      setSnap: (snap) => set({ snap }),
      setGridSize: (size) => set({ gridSize: size }),
      setWallThickness: (thickness) => set({ wallThickness: thickness }),
      setWallHeight: (height) => set({ wallHeight: height }),

      // Interaction lock
      setDragging: (dragging) => set({ isDragging: dragging }),

      // Drop zone
      setPendingDrop: (drop) => set({ pendingDrop: drop }),
      setDragPreview: (preview) => set({ dragPreview: preview }),

      // Bulk
      clearAll: () => set({ ...initialState }),
    }),
    {
      // Only track changes to these fields for undo/redo
      partialize: (state) => ({
        walls: state.walls,
        floors: state.floors,
        furniture: state.furniture,
        openings: state.openings,
      }),
      limit: 50,
      // Prevent duplicate undo entries when state hasn't actually changed
      equality: (past, current) =>
        past.walls === current.walls &&
        past.floors === current.floors &&
        past.furniture === current.furniture &&
        past.openings === current.openings,
    }
  )
);

// ── Selector Hooks ──────────────────────────────────────────────────────────

export const useWalls = () => useDesignerStore((s) => s.walls);
export const useFloors = () => useDesignerStore((s) => s.floors);
export const useFurniture = () => useDesignerStore((s) => s.furniture);
export const useMode = () => useDesignerStore((s) => s.mode);
export const useIs3D = () => useDesignerStore((s) => s.is3D);
export const useSnap = () => useDesignerStore((s) => s.snap);
export const useGridSize = () => useDesignerStore((s) => s.gridSize);
export const useSelectedIds = () => useDesignerStore((s) => s.selectedIds);
export const useDrawingFrom = () => useDesignerStore((s) => s.drawingFrom);
export const useActiveFurnitureType = () =>
  useDesignerStore((s) => s.activeFurnitureType);
export const useWallThickness = () =>
  useDesignerStore((s) => s.wallThickness);
export const useWallHeight = () => useDesignerStore((s) => s.wallHeight);
export const useIsDragging = () => useDesignerStore((s) => s.isDragging);
export const usePendingDrop = () => useDesignerStore((s) => s.pendingDrop);
export const useDragPreview = () => useDesignerStore((s) => s.dragPreview);
export const useOpenings = () => useDesignerStore((s) => s.openings);
export const useHoveredId = () => useDesignerStore((s) => s.hoveredId);
export const usePendingOpeningType = () => useDesignerStore((s) => s.pendingOpeningType);
