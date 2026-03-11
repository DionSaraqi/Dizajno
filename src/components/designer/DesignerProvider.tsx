"use client";

import React, { createContext, useContext, useReducer, type Dispatch } from "react";

// ── Types ──────────────────────────────────────────────────────────────────
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

export interface DesignerState {
  walls: WallData[];
  floors: FloorData[];
  furniture: FurnitureData[];

  // Drawing state
  drawingFrom: [number, number] | null;

  // Active furniture type being placed from sidebar
  activeFurnitureType: string | null;

  // UI
  mode: "draw" | "select" | "furniture";
  is3D: boolean;
  selectedId: string | null;
  snap: boolean;
  gridSize: number;
  wallThickness: number;
  wallHeight: number;
}

// ── Actions ────────────────────────────────────────────────────────────────
export type DesignerAction =
  | { type: "ADD_WALL"; wall: WallData }
  | { type: "REMOVE_WALL"; id: string }
  | { type: "SET_DRAWING_FROM"; point: [number, number] | null }
  | { type: "SET_FLOORS"; floors: FloorData[] }
  | { type: "PLACE_FURNITURE"; item: FurnitureData }
  | { type: "MOVE_FURNITURE"; id: string; position: [number, number] }
  | { type: "ROTATE_FURNITURE"; id: string }
  | { type: "REMOVE_FURNITURE"; id: string }
  | { type: "SELECT"; id: string | null }
  | { type: "SET_MODE"; mode: DesignerState["mode"] }
  | { type: "SET_ACTIVE_FURNITURE"; furnitureType: string | null }
  | { type: "TOGGLE_3D" }
  | { type: "SET_SNAP"; snap: boolean }
  | { type: "SET_GRID_SIZE"; size: number }
  | { type: "SET_WALL_THICKNESS"; thickness: number }
  | { type: "SET_WALL_HEIGHT"; height: number }
  | { type: "CLEAR_ALL" }
  | { type: "UNDO" };

// ── Initial state ──────────────────────────────────────────────────────────
const initialState: DesignerState = {
  walls: [],
  floors: [],
  furniture: [],
  drawingFrom: null,
  activeFurnitureType: null,
  mode: "draw",
  is3D: false,
  selectedId: null,
  snap: true,
  gridSize: 1,
  wallThickness: 0.15,
  wallHeight: 2.5,
};

// Actions that should save to undo history (meaningful changes only)
const UNDOABLE_ACTIONS = new Set([
  "ADD_WALL", "REMOVE_WALL", "SET_FLOORS",
  "PLACE_FURNITURE", "MOVE_FURNITURE", "ROTATE_FURNITURE", "REMOVE_FURNITURE",
]);

interface StateWithHistory {
  current: DesignerState;
  past: DesignerState[];
}

const initialStateWithHistory: StateWithHistory = {
  current: initialState,
  past: [],
};

// ── Reducer ────────────────────────────────────────────────────────────────
function applyAction(state: DesignerState, action: DesignerAction): DesignerState {
  switch (action.type) {
    case "ADD_WALL":
      return { ...state, walls: [...state.walls, action.wall] };
    case "REMOVE_WALL":
      return { ...state, walls: state.walls.filter((w) => w.id !== action.id) };
    case "SET_DRAWING_FROM":
      return { ...state, drawingFrom: action.point };
    case "SET_FLOORS":
      return { ...state, floors: action.floors };
    case "PLACE_FURNITURE":
      return { ...state, furniture: [...state.furniture, action.item] };
    case "MOVE_FURNITURE":
      return {
        ...state,
        furniture: state.furniture.map((f) =>
          f.id === action.id ? { ...f, position: action.position } : f
        ),
      };
    case "ROTATE_FURNITURE":
      return {
        ...state,
        furniture: state.furniture.map((f) =>
          f.id === action.id ? { ...f, rotation: f.rotation + Math.PI / 2 } : f
        ),
      };
    case "REMOVE_FURNITURE":
      return {
        ...state,
        furniture: state.furniture.filter((f) => f.id !== action.id),
        selectedId: state.selectedId === action.id ? null : state.selectedId,
      };
    case "SELECT":
      return { ...state, selectedId: action.id };
    case "SET_MODE":
      return { ...state, mode: action.mode, activeFurnitureType: null, selectedId: null };
    case "SET_ACTIVE_FURNITURE":
      return { ...state, activeFurnitureType: action.furnitureType, mode: "furniture" };
    case "TOGGLE_3D":
      return { ...state, is3D: !state.is3D };
    case "SET_SNAP":
      return { ...state, snap: action.snap };
    case "SET_GRID_SIZE":
      return { ...state, gridSize: action.size };
    case "SET_WALL_THICKNESS":
      return { ...state, wallThickness: action.thickness };
    case "SET_WALL_HEIGHT":
      return { ...state, wallHeight: action.height };
    case "CLEAR_ALL":
      return { ...initialState };
    default:
      return state;
  }
}

function designerReducer(state: StateWithHistory, action: DesignerAction): StateWithHistory {
  if (action.type === "UNDO") {
    if (state.past.length === 0) return state;
    const previous = state.past[state.past.length - 1];
    return {
      current: previous,
      past: state.past.slice(0, -1),
    };
  }

  const newCurrent = applyAction(state.current, action);

  if (UNDOABLE_ACTIONS.has(action.type)) {
    return {
      current: newCurrent,
      past: [...state.past.slice(-49), state.current], // keep max 50
    };
  }

  return { ...state, current: newCurrent };
}

// ── Context ────────────────────────────────────────────────────────────────
const DesignerStateCtx = createContext<DesignerState>(initialState);
const DesignerDispatchCtx = createContext<Dispatch<DesignerAction>>(() => {});
const CanUndoCtx = createContext<boolean>(false);

export function DesignerProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(designerReducer, initialStateWithHistory);
  return (
    <DesignerStateCtx.Provider value={state.current}>
      <DesignerDispatchCtx.Provider value={dispatch}>
        <CanUndoCtx.Provider value={state.past.length > 0}>
          {children}
        </CanUndoCtx.Provider>
      </DesignerDispatchCtx.Provider>
    </DesignerStateCtx.Provider>
  );
}

export function useDesignerState() {
  return useContext(DesignerStateCtx);
}

export function useDesignerDispatch() {
  return useContext(DesignerDispatchCtx);
}

export function useCanUndo() {
  return useContext(CanUndoCtx);
}
