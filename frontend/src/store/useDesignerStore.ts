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
// (no extra imports needed — OpeningData already covers the reassign helper)
import { getFurnitureDef } from "@/utils/furnitureCatalog";
import { newId } from "@/utils/ids";
import {
  addWallWithIntersections,
  findFloors,
  reassignOpeningsAfterWallChange,
} from "@/utils/wallGraph";
import {
  usablePolygonToWalls,
  centerlineToWalls,
  rectCenterlineVerts,
  boundingWalls,
  vertsCentroid,
  isAxisAlignedRect,
} from "@/utils/roomBuilder";

// ── Actions Interface ───────────────────────────────────────────────────────

interface DesignerActions {
  // Wall actions
  addWall: (wall: WallData) => void;
  removeWall: (id: string) => void;
  setWalls: (walls: WallData[]) => void;
  setWallsAndFloors: (
    walls: WallData[],
    floors: FloorData[],
    openings?: OpeningData[]
  ) => void;
  updateWall: (
    id: string,
    changes: Partial<Pick<WallData, "thickness" | "height" | "paintVariantId">>
  ) => void;
  setDrawingFrom: (point: [number, number] | null) => void;
  setFloors: (floors: FloorData[]) => void;

  // Room tool
  addRoom: (usableVerts: [number, number][]) => void;
  addRectRoom: (usableWidth: number, usableLength: number) => void;
  resizeRectRoom: (floorId: string, usableWidth: number, usableLength: number) => void;
  setRoomDraft: (points: [number, number][] | null) => void;
  removeFloor: (id: string) => void;
  updateFloor: (
    id: string,
    changes: Partial<Pick<FloorData, "flooringVariantId">>
  ) => void;

  // Furniture actions
  placeFurniture: (item: FurnitureData) => void;
  moveFurniture: (id: string, position: [number, number]) => void;
  rotateFurniture: (id: string) => void;
  setFurnitureRotation: (id: string, rotation: number) => void;
  scaleFurniture: (id: string, scale: number) => void;
  resizeFurniture: (
    id: string,
    dims: Partial<Pick<FurnitureData, "width" | "depth" | "height">>
  ) => void;
  setFurnitureElevation: (id: string, elevation: number) => void;
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

  // Planner5D-style UI state
  setActivePanel: (panel: DesignerState["activePanel"]) => void;
  setShowDimensions: (show: boolean) => void;
  setDimensionFace: (face: DesignerState["dimensionFace"]) => void;

  // Interaction lock (disables camera while dragging/placing furniture)
  setDragging: (dragging: boolean) => void;

  // Read-only mode (share viewer): blocks pointer-driven edits on the canvas
  setReadOnly: (readOnly: boolean) => void;

  // Drop zone
  setPendingDrop: (drop: { type: string; ndcX: number; ndcY: number } | null) => void;
  setDragPreview: (preview: { ndcX: number; ndcY: number } | null) => void;

  // Bulk
  clearAll: () => void;
}

type DesignerStore = DesignerState & DesignerActions;

// Commit a batch of generated room walls atomically: merge each through the
// intersection pipeline, re-derive floors, reassign openings, and select the
// floor nearest the requested footprint. Returns the partial state to `set`.
function commitRoom(
  s: DesignerState,
  generated: WallData[],
  target: [number, number]
): Partial<DesignerState> {
  let walls = s.walls;
  for (const w of generated) walls = addWallWithIntersections(w, walls);
  const floors = findFloors(walls);
  const openings = reassignOpeningsAfterWallChange(s.openings, s.walls, walls);
  let selId: string | null = null;
  let bestD = Infinity;
  for (const f of floors) {
    const fc = vertsCentroid(f.vertices);
    const d = (fc[0] - target[0]) ** 2 + (fc[1] - target[1]) ** 2;
    if (d < bestD) {
      bestD = d;
      selId = f.id;
    }
  }
  return {
    walls,
    floors: floors.length > 0 ? floors : s.floors,
    openings,
    selectedIds: selId ? [selId] : [],
  };
}

// ── Initial State ───────────────────────────────────────────────────────────

const initialState: DesignerState = {
  walls: [],
  floors: [],
  furniture: [],
  openings: [],
  drawingFrom: null,
  activeFurnitureType: null,
  pendingOpeningType: null,
  roomDraft: null,
  mode: "draw",
  is3D: false,
  selectedIds: [],
  hoveredId: null,
  snap: true,
  gridSize: 1,
  wallThickness: 0.15,
  wallHeight: 2.5,
  activePanel: "furnish",
  showDimensions: true,
  dimensionFace: "outer",
  isDragging: false,
  readOnly: false,
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
      setWallsAndFloors: (walls, floors, openings) =>
        set((s) => ({ walls, floors, openings: openings ?? s.openings })),
      updateWall: (id, changes) => set((s) => ({
        walls: s.walls.map((w) => w.id === id ? { ...w, ...changes } : w),
      })),
      setDrawingFrom: (point) => set({ drawingFrom: point }),
      setFloors: (floors) => set({ floors }),

      // ── Room tool ──
      setRoomDraft: (points) => set({ roomDraft: points }),
      // Custom (arbitrary) room: the drawn polygon is the usable footprint;
      // walls are offset outward to centerlines.
      addRoom: (usableVerts) => {
        if (usableVerts.length < 3) return;
        const s = get();
        const generated = usablePolygonToWalls(usableVerts, s.wallThickness, s.wallHeight);
        if (generated.length < 3) return;
        set({
          ...commitRoom(s, generated, vertsCentroid(usableVerts)),
          mode: "select",
          roomDraft: null,
        });
      },
      // Rectangle room from an exact usable W×L (cm-exact centerlines).
      addRectRoom: (usableWidth, usableLength) => {
        const s = get();
        const cl = rectCenterlineVerts(usableWidth, usableLength, s.wallThickness, 0, 0);
        const generated = centerlineToWalls(cl, s.wallThickness, s.wallHeight);
        if (generated.length < 3) return;
        set({ ...commitRoom(s, generated, vertsCentroid(cl)), mode: "select", roomDraft: null });
      },
      resizeRectRoom: (floorId, usableWidth, usableLength) => {
        const s = get();
        const floor = s.floors.find((f) => f.id === floorId);
        if (!floor || !isAxisAlignedRect(floor.vertices)) return;

        const xs = floor.vertices.map((v) => v[0]);
        const zs = floor.vertices.map((v) => v[1]);
        const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
        const cz = (Math.min(...zs) + Math.max(...zs)) / 2;

        const bw = boundingWalls(floor.vertices, s.walls);
        const t = bw.length > 0 ? bw[0].thickness : s.wallThickness;
        // cm-exact new centerline bbox (preserves usable size precisely).
        const cl = rectCenterlineVerts(usableWidth, usableLength, t, cx, cz);
        const nMinX = cl[0][0];
        const nMinZ = cl[0][1];
        const nMaxX = cl[2][0];
        const nMaxZ = cl[2][1];

        const movedIds = new Set(bw.map((w) => w.id));
        const walls = s.walls.map((w) => {
          if (!movedIds.has(w.id)) return w;
          const horizontal =
            Math.abs(w.end[0] - w.start[0]) >= Math.abs(w.end[1] - w.start[1]);
          if (horizontal) {
            const z = (w.start[1] + w.end[1]) / 2 > cz ? nMaxZ : nMinZ;
            return { ...w, start: [nMinX, z] as [number, number], end: [nMaxX, z] as [number, number] };
          }
          const x = (w.start[0] + w.end[0]) / 2 > cx ? nMaxX : nMinX;
          return { ...w, start: [x, nMinZ] as [number, number], end: [x, nMaxZ] as [number, number] };
        });

        const floors = findFloors(walls);
        const openings = reassignOpeningsAfterWallChange(s.openings, s.walls, walls);
        let selId: string | null = null;
        let bestD = Infinity;
        for (const f of floors) {
          const fc = vertsCentroid(f.vertices);
          const d = (fc[0] - cx) ** 2 + (fc[1] - cz) ** 2;
          if (d < bestD) {
            bestD = d;
            selId = f.id;
          }
        }
        set({
          walls,
          floors: floors.length > 0 ? floors : s.floors,
          openings,
          selectedIds: selId ? [selId] : s.selectedIds,
        });
      },
      removeFloor: (id) => set((s) => ({
        floors: s.floors.filter((f) => f.id !== id),
        selectedIds: s.selectedIds.filter((sid) => sid !== id),
      })),
      updateFloor: (id, changes) => set((s) => ({
        floors: s.floors.map((f) => f.id === id ? { ...f, ...changes } : f),
      })),

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
      setFurnitureRotation: (id, rotation) =>
        set((s) => ({
          furniture: s.furniture.map((f) =>
            f.id === id ? { ...f, rotation } : f
          ),
        })),
      resizeFurniture: (id, dims) =>
        set((s) => ({
          furniture: s.furniture.map((f) => {
            if (f.id !== id) return f;
            const def = getFurnitureDef(f.type);
            // Non-rectangular items carry composite collision boxes that scale
            // uniformly with the catalog base; editing one axis independently
            // would break the hitbox, so we resize them proportionally instead.
            if (def?.collisionBoxes && def.collisionBoxes.length > 0) {
              const target =
                dims.width ?? dims.depth ?? dims.height ?? null;
              const base =
                dims.width !== undefined
                  ? def.width
                  : dims.depth !== undefined
                  ? def.depth
                  : def.height;
              if (target === null || base <= 0) return f;
              const scale = target / base;
              return {
                ...f,
                scale,
                width: def.width * scale,
                depth: def.depth * scale,
                height: def.height * scale,
              };
            }
            return {
              ...f,
              width: dims.width ?? f.width,
              depth: dims.depth ?? f.depth,
              height: dims.height ?? f.height,
            };
          }),
        })),
      setFurnitureElevation: (id, elevation) =>
        set((s) => ({
          furniture: s.furniture.map((f) =>
            f.id === id ? { ...f, elevation: Math.max(0, elevation) } : f
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
          id: newId(),
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
        set({
          mode,
          activeFurnitureType: null,
          pendingOpeningType: null,
          selectedIds: [],
          roomDraft: mode === "room" ? [] : null,
        }),
      setActiveFurniture: (furnitureType) =>
        set({ activeFurnitureType: furnitureType, mode: "furniture" }),
      setPendingOpeningType: (type) =>
        set({ pendingOpeningType: type, mode: "opening", activeFurnitureType: null, selectedIds: [] }),
      toggleIs3D: () => set((s) => ({ is3D: !s.is3D })),
      setSnap: (snap) => set({ snap }),
      setGridSize: (size) => set({ gridSize: size }),
      setWallThickness: (thickness) => set({ wallThickness: thickness }),
      setWallHeight: (height) => set({ wallHeight: height }),

      // Planner5D-style UI state
      setActivePanel: (panel) => set({ activePanel: panel }),
      setShowDimensions: (show) => set({ showDimensions: show }),
      setDimensionFace: (face) => set({ dimensionFace: face }),

      // Interaction lock
      setDragging: (dragging) => set({ isDragging: dragging }),

      // Read-only mode
      setReadOnly: (readOnly) => set({ readOnly }),

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
export const useReadOnly = () => useDesignerStore((s) => s.readOnly);
export const usePendingDrop = () => useDesignerStore((s) => s.pendingDrop);
export const useDragPreview = () => useDesignerStore((s) => s.dragPreview);
export const useOpenings = () => useDesignerStore((s) => s.openings);
export const useHoveredId = () => useDesignerStore((s) => s.hoveredId);
export const usePendingOpeningType = () => useDesignerStore((s) => s.pendingOpeningType);
export const useRoomDraft = () => useDesignerStore((s) => s.roomDraft);
export const useActivePanel = () => useDesignerStore((s) => s.activePanel);
export const useShowDimensions = () => useDesignerStore((s) => s.showDimensions);
export const useDimensionFace = () => useDesignerStore((s) => s.dimensionFace);
