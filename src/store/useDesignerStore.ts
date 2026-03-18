import { create } from "zustand";
import { temporal } from "zundo";
import type {
  DesignerState,
  WallData,
  FloorData,
  FurnitureData,
  DesignerMode,
} from "@/types/designer";

// ── Actions Interface ───────────────────────────────────────────────────────

interface DesignerActions {
  // Wall actions
  addWall: (wall: WallData) => void;
  removeWall: (id: string) => void;
  setDrawingFrom: (point: [number, number] | null) => void;
  setFloors: (floors: FloorData[]) => void;

  // Furniture actions
  placeFurniture: (item: FurnitureData) => void;
  moveFurniture: (id: string, position: [number, number]) => void;
  rotateFurniture: (id: string) => void;
  removeFurniture: (id: string) => void;
  duplicateFurniture: (id: string) => void;
  deleteSelected: () => void;

  // Selection actions
  select: (id: string | null) => void;
  selectMultiple: (ids: string[]) => void;
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;

  // Mode & UI
  setMode: (mode: DesignerMode) => void;
  setActiveFurniture: (furnitureType: string | null) => void;
  toggleIs3D: () => void;
  setSnap: (snap: boolean) => void;
  setGridSize: (size: number) => void;
  setWallThickness: (thickness: number) => void;
  setWallHeight: (height: number) => void;

  // Interaction lock (disables camera while dragging/placing furniture)
  setDragging: (dragging: boolean) => void;

  // Drop zone
  setPendingDrop: (drop: { type: string; ndcX: number; ndcY: number } | null) => void;

  // Bulk
  clearAll: () => void;
}

type DesignerStore = DesignerState & DesignerActions;

// ── Initial State ───────────────────────────────────────────────────────────

const initialState: DesignerState = {
  walls: [],
  floors: [],
  furniture: [],
  drawingFrom: null,
  activeFurnitureType: null,
  mode: "draw",
  is3D: false,
  selectedIds: [],
  snap: true,
  gridSize: 1,
  wallThickness: 0.15,
  wallHeight: 2.5,
  isDragging: false,
  pendingDrop: null,
};

// ── Store ───────────────────────────────────────────────────────────────────

export const useDesignerStore = create<DesignerStore>()(
  temporal(
    (set, get) => ({
      ...initialState,

      // Wall actions
      addWall: (wall) => set((s) => ({ walls: [...s.walls, wall] })),
      removeWall: (id) => set((s) => ({ walls: s.walls.filter((w) => w.id !== id) })),
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
          selectedIds: [],
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

      // Mode & UI
      setMode: (mode) =>
        set({ mode, activeFurnitureType: null, selectedIds: [] }),
      setActiveFurniture: (furnitureType) =>
        set({ activeFurnitureType: furnitureType, mode: "furniture" }),
      toggleIs3D: () => set((s) => ({ is3D: !s.is3D })),
      setSnap: (snap) => set({ snap }),
      setGridSize: (size) => set({ gridSize: size }),
      setWallThickness: (thickness) => set({ wallThickness: thickness }),
      setWallHeight: (height) => set({ wallHeight: height }),

      // Interaction lock
      setDragging: (dragging) => set({ isDragging: dragging }),

      // Drop zone
      setPendingDrop: (drop) => set({ pendingDrop: drop }),

      // Bulk
      clearAll: () => set({ ...initialState }),
    }),
    {
      // Only track changes to these fields for undo/redo
      partialize: (state) => ({
        walls: state.walls,
        floors: state.floors,
        furniture: state.furniture,
      }),
      limit: 50,
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
