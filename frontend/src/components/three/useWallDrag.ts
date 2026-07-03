"use client";

// ── useWallDrag — perpendicular wall-drag gesture (2D select mode) ───────────
// Mirrors the opening-drag state machine: arm on wall pointerdown, hold-to-drag
// past a 0.05 m threshold, per-frame ground-plane raycast for movement, LOCAL
// preview only (the store is written exactly once, on pointer-up ⇒ one undo
// entry per gesture), window-level pointerup/pointercancel to always terminate,
// and a capture-phase Escape listener that cancels before useKeyboardShortcuts'
// Escape-clears-selection can see the key.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  useDesignerStore,
  useWalls,
  useFloors,
  useFurniture,
  useOpenings,
  useMode,
  useIs3D,
  useSnap,
  useGridSize,
  useHoveredId,
  useReadOnly,
} from "@/store/useDesignerStore";
import {
  planWallDrag,
  applyWallDrag,
  snapWallDragDelta,
  computeDraggableWallIds,
  openingsAtRiskForDrag,
  normalizeRidingOpenings,
  type WallDragPlan,
} from "@/utils/wallDrag";
import { reconcileLoadedFloors } from "@/utils/wallGraph";
import type { WallData, FloorData, OpeningData } from "@/types/designer";
import type { SnapEdge } from "@/utils/snapToGrid";

/** Hold-to-drag threshold — same constant as furniture and opening drags. */
const WALL_DRAG_THRESHOLD = 0.05;

interface DragRef {
  wallId: string;
  plan: WallDragPlan;
  /** Pointer world coordinate along the drag axis at grab time. */
  startCoord: number;
  /** Threshold crossed — the wall is actually being moved. */
  dragging: boolean;
  pointerId: number | null;
}

interface DragPreview {
  delta: number;
  axis: "x" | "z";
  snapEdge: SnapEdge | null;
  clamped: boolean;
}

export interface WallDragInfo {
  plan: WallDragPlan;
  delta: number;
  clamped: boolean;
}

interface UseWallDragArgs {
  /** Shared trailing-click suppressor (also used by the opening drag). */
  suppressClickUntilRef: React.MutableRefObject<number>;
}

export function useWallDrag({ suppressClickUntilRef }: UseWallDragArgs) {
  const walls = useWalls();
  const floors = useFloors();
  const furniture = useFurniture();
  const openings = useOpenings();
  const mode = useMode();
  const is3D = useIs3D();
  const snap = useSnap();
  const gridSize = useGridSize();
  const hoveredId = useHoveredId();
  const readOnly = useReadOnly();
  const select = useDesignerStore((s) => s.select);
  const setStoreDragging = useDesignerStore((s) => s.setDragging);

  const { gl, raycaster, camera, pointer } = useThree();
  const groundPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));

  const dragRef = useRef<DragRef | null>(null);
  const previewRef = useRef<DragPreview | null>(null);
  const [preview, setPreview] = useState<DragPreview | null>(null);

  // Shared exit path for commit / cancel / mid-drag wall deletion, reachable
  // from useFrame via ref (effects re-register listeners, frames don't).
  const finishRef = useRef<(commit: boolean) => void>(() => {});
  finishRef.current = (commit: boolean) => {
    const drag = dragRef.current;
    if (!drag) return;
    const p = previewRef.current;
    if (drag.dragging) {
      // The DOM click trailing the release lands on whatever is under the
      // cursor now (often a floor after the wall moved away) — swallow it.
      suppressClickUntilRef.current = performance.now() + 200;
    }
    if (commit && drag.dragging && p && p.delta !== 0) {
      // dragWall re-plans against live state and re-clamps — safe even if the
      // scene changed under the gesture.
      useDesignerStore.getState().dragWall(drag.wallId, p.delta);
    }
    if (drag.pointerId != null) {
      try {
        gl.domElement.releasePointerCapture(drag.pointerId);
      } catch {
        /* already released */
      }
    }
    dragRef.current = null;
    previewRef.current = null;
    setPreview(null);
    setStoreDragging(false);
  };

  // Draggable set for the hover affordance (resize cursor) + arming guard.
  const draggableWallIds = useMemo(
    () => computeDraggableWallIds(walls, floors),
    [walls, floors]
  );

  const handleWallPointerDown = useCallback(
    (wall: WallData, e: any) => {
      if (e.button !== 0) return;
      // Bail BEFORE stopPropagation in non-select modes: a draw-mode
      // pointerdown over a wall must still reach GridPlane to start a wall.
      if (mode !== "select" || is3D) return;
      e.stopPropagation();
      if (performance.now() >= suppressClickUntilRef.current) {
        select(wall.id);
      }
      // Read-only viewer: select but never arm a drag.
      if (readOnly || dragRef.current) return;
      const plan = planWallDrag(wall.id, walls, floors, furniture);
      if (!plan) return; // dangling/diagonal wall — plain select
      if (!e.ray) return;
      // 2D top-down ortho: the ground plane is exact for the grab point.
      const pt = new THREE.Vector3();
      if (!e.ray.intersectPlane(groundPlaneRef.current, pt)) return;
      const startCoord = plan.axis === "z" ? pt.z : pt.x;
      const pointerId = e.pointerId ?? e.nativeEvent?.pointerId ?? null;
      dragRef.current = { wallId: wall.id, plan, startCoord, dragging: false, pointerId };
      // Lock the camera for the WHOLE hold (2D LEFT = pan) and freeze hover.
      setStoreDragging(true);
      // Capture on the canvas so the gesture survives DOM overlays/off-canvas.
      if (pointerId != null) {
        try {
          gl.domElement.setPointerCapture(pointerId);
        } catch {
          /* capture unsupported — window pointerup still ends the gesture */
        }
      }
    },
    [mode, is3D, readOnly, walls, floors, furniture, select, setStoreDragging, gl, suppressClickUntilRef]
  );

  // Per-frame movement — global-pointer raycast (mesh events stopPropagation
  // and would freeze the preview), delta-based from the grab point, deduped on
  // the cm-quantized delta so the scene re-renders per centimeter, not per frame.
  useFrame(() => {
    const drag = dragRef.current;
    if (!drag) return;
    // Delete-mid-drag (or undo) removed the wall: cancel cleanly.
    if (!walls.some((w) => w.id === drag.wallId)) {
      finishRef.current(false);
      return;
    }
    raycaster.setFromCamera(pointer, camera);
    const pt = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(groundPlaneRef.current, pt)) return;
    const coord = drag.plan.axis === "z" ? pt.z : pt.x;
    const raw = coord - drag.startCoord;
    if (!drag.dragging) {
      if (Math.abs(raw) < WALL_DRAG_THRESHOLD) return;
      drag.dragging = true;
    }
    const res = snapWallDragDelta(drag.plan, raw, snap, gridSize);
    const prev = previewRef.current;
    if (
      !prev ||
      prev.delta !== res.delta ||
      prev.clamped !== res.clamped ||
      (prev.snapEdge === null) !== (res.snapEdge === null)
    ) {
      const next: DragPreview = {
        delta: res.delta,
        axis: drag.plan.axis,
        snapEdge: res.snapEdge,
        clamped: res.clamped,
      };
      previewRef.current = next;
      setPreview(next);
    }
  });

  // Gesture termination: window-level pointerup/pointercancel (release outside
  // the canvas still ends it) + capture-phase Escape cancel.
  useEffect(() => {
    const onUp = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      if (drag.pointerId != null && e.pointerId !== drag.pointerId) return;
      if (drag.pointerId == null && e.button !== 0) return;
      finishRef.current(true);
    };
    const onCancel = () => finishRef.current(false);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dragRef.current) {
        // Capture phase: consume before useKeyboardShortcuts clears selection.
        e.stopPropagation();
        e.preventDefault();
        finishRef.current(false);
      }
    };
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, []);

  // Resize-cursor affordance — the first canvas cursor in the designer. Shown
  // while hovering a draggable wall in 2D select mode, kept during the drag.
  useEffect(() => {
    let cursor = "";
    if (preview) {
      cursor = preview.axis === "z" ? "ns-resize" : "ew-resize";
    } else if (mode === "select" && !is3D && !readOnly && hoveredId && draggableWallIds.has(hoveredId)) {
      const w = walls.find((x) => x.id === hoveredId);
      if (w) {
        const horizontal =
          Math.abs(w.end[0] - w.start[0]) >= Math.abs(w.end[1] - w.start[1]);
        cursor = horizontal ? "ns-resize" : "ew-resize";
      }
    }
    gl.domElement.style.cursor = cursor;
    return () => {
      gl.domElement.style.cursor = "";
    };
  }, [preview, mode, is3D, readOnly, hoveredId, draggableWallIds, walls, gl]);

  // Live preview arrays — pure-props substitution for WallMesh / FloorMesh /
  // WallDimensions / RoomLabels / WallOpening while the drag is active.
  const activePlan = preview && dragRef.current ? dragRef.current.plan : null;

  const displayWalls = useMemo<WallData[] | null>(() => {
    if (!activePlan || !preview || preview.delta === 0) return null;
    return applyWallDrag(activePlan, walls, preview.delta);
  }, [activePlan, preview, walls]);

  const displayFloors = useMemo<FloorData[] | null>(() => {
    if (!displayWalls) return null;
    return reconcileLoadedFloors(displayWalls, floors, walls);
  }, [displayWalls, floors, walls]);

  const doomedOpeningIds = useMemo<Set<string>>(() => {
    if (!activePlan || !preview || preview.delta === 0) return new Set();
    return openingsAtRiskForDrag(activePlan, walls, openings, preview.delta);
  }, [activePlan, preview, walls, openings]);

  // World-anchored preview offsets for openings on riding walls — without
  // this, a neighbor's doors slide along with the stretching wall during the
  // preview and visibly jump back at commit (commit runs the same normalize).
  const displayOpenings = useMemo<OpeningData[] | null>(() => {
    if (!activePlan || !preview || preview.delta === 0) return null;
    const normalized = normalizeRidingOpenings(activePlan, walls, openings, preview.delta);
    return normalized === openings ? null : normalized;
  }, [activePlan, preview, walls, openings]);

  const dragInfo: WallDragInfo | null =
    activePlan && preview
      ? { plan: activePlan, delta: preview.delta, clamped: preview.clamped }
      : null;

  return {
    handleWallPointerDown,
    /** Non-null while a drag is past the threshold — substitute into renders. */
    displayWalls,
    displayFloors,
    /** World-anchored opening offsets on riding walls during the drag. */
    displayOpenings,
    doomedOpeningIds,
    wallDragSnapEdge: preview?.snapEdge ?? null,
    /** Plan + live delta for tints and the delta readout; null when idle. */
    wallDragInfo: dragInfo,
  };
}
