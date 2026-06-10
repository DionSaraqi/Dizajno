"use client";

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { Html, Edges } from "@react-three/drei";
import * as THREE from "three";
import {
  useDesignerStore,
  useWalls,
  useFloors,
  useFurniture,
  useMode,
  useIs3D,
  useSnap,
  useGridSize,
  useDrawingFrom,
  useWallThickness,
  useWallHeight,
  usePendingDrop,
  useDragPreview,
  useSelectedIds,
  useOpenings,
  useHoveredId,
  usePendingOpeningType,
  useReadOnly,
  useShowDimensions,
  useRoomDraft,
} from "@/store/useDesignerStore";
import GridPlane from "./GridPlane";
import CameraController, { DEFAULT_ORTHO_ZOOM, DEFAULT_PERSP_DISTANCE } from "./CameraController";
import WallMesh from "./WallMesh";
import FloorMesh from "./FloorMesh";
import { newId } from "@/utils/ids";
import FurnitureItem3D from "./FurnitureItem3D";
import BedModel from "./furniture/BedModel";
import TableModel from "./furniture/TableModel";
import ChairModel from "./furniture/ChairModel";
import SofaModel from "./furniture/SofaModel";
import WardrobeModel from "./furniture/WardrobeModel";
import DeskModel from "./furniture/DeskModel";
import BookshelfModel from "./furniture/BookshelfModel";
import NightstandModel from "./furniture/NightstandModel";
import GLTFModel from "./furniture/GLTFModel";
import Measurements from "./Measurements";
import RoomLabels from "./RoomLabels";
import WallDimensions from "./WallDimensions";
import RadialMenu from "./RadialMenu";
import OpeningRadialMenu from "./OpeningRadialMenu";
import OpeningMeasurements from "./OpeningMeasurements";
import SnapIndicator from "./SnapIndicator";
import { smartSnap, snapPoint, type SnapEdge } from "@/utils/snapToGrid";
import { snapOpeningOffset, type OpeningSnapTarget } from "@/utils/openingSnap";
import { pointInPolygon } from "@/utils/areaCalc";
import {
  findFloors,
  addWallWithIntersections,
  snapToCorner,
  reassignOpeningsAfterWallChange,
} from "@/utils/wallGraph";
import { getFurnitureDef } from "@/utils/furnitureCatalog";
import { checkFurnitureCollision } from "@/utils/collision";
import type { FurnitureData, WallData, OpeningData } from "@/types/designer";
import WallOpening from "./WallOpening";

// ── Drop Handler Component (runs inside Canvas) ────────────────────────────

function DropHandler() {
  const pendingDrop = usePendingDrop();
  const { camera, raycaster } = useThree();
  const snap = useSnap();
  const gridSize = useGridSize();
  const walls = useWalls();
  const furniture = useFurniture();

  useEffect(() => {
    if (!pendingDrop) return;

    // Raycast from NDC to the ground plane (y=0)
    const ndc = new THREE.Vector2(pendingDrop.ndcX, pendingDrop.ndcY);
    raycaster.setFromCamera(ndc, camera);

    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersection = new THREE.Vector3();
    raycaster.ray.intersectPlane(groundPlane, intersection);

    if (!intersection) {
      useDesignerStore.getState().setPendingDrop(null);
      return;
    }

    const def = getFurnitureDef(pendingDrop.type);
    if (!def) {
      useDesignerStore.getState().setPendingDrop(null);
      return;
    }

    const itemDesc = { rotation: 0, width: def.width, depth: def.depth };
    const result = smartSnap(
      intersection.x,
      intersection.z,
      itemDesc,
      walls,
      furniture,
      snap,
      gridSize
    );
    const [x, z] = result.position;

    const state = useDesignerStore.getState();

    const newItem: FurnitureData = {
      id: newId(),
      type: def.type,
      position: [x, z],
      rotation: 0,
      width: def.width,
      depth: def.depth,
      height: def.height,
      color: def.color,
    };

    if (!checkFurnitureCollision(newItem, state.furniture, state.walls)) {
      // placeFurniture also selects the new item and enters select mode.
      state.placeFurniture(newItem);
    } else {
      // Collision: nothing placed — just leave the sidebar tool.
      state.setMode("select");
    }
    state.setPendingDrop(null);
  }, [pendingDrop, camera, raycaster, snap, gridSize, walls, furniture]);

  return null;
}

// ── HTML Drag Ghost (shows furniture preview while dragging from sidebar) ────

function DragGhost() {
  const dragPreview = useDragPreview();
  const { camera, raycaster } = useThree();
  const activeFurnitureType = useDesignerStore((s) => s.activeFurnitureType);
  const walls = useWalls();
  const furniture = useFurniture();
  const snap = useSnap();
  const gridSize = useGridSize();
  const is3D = useIs3D();

  const [pos, setPos] = useState<[number, number] | null>(null);
  const [snapEdge, setSnapEdge] = useState<SnapEdge | null>(null);

  // Try to figure out which furniture type is being dragged
  // During HTML drag, activeFurnitureType is set from the sidebar click
  const furnitureType = activeFurnitureType;
  const def = furnitureType ? getFurnitureDef(furnitureType) : null;

  useEffect(() => {
    if (!dragPreview || !def) {
      setPos(null);
      return;
    }

    const ndc = new THREE.Vector2(dragPreview.ndcX, dragPreview.ndcY);
    raycaster.setFromCamera(ndc, camera);
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersection = new THREE.Vector3();
    raycaster.ray.intersectPlane(groundPlane, intersection);

    if (!intersection) {
      setPos(null);
      return;
    }

    const itemDesc = { rotation: 0, width: def.width, depth: def.depth };
    const result = smartSnap(
      intersection.x, intersection.z,
      itemDesc, walls, furniture, snap, gridSize
    );
    setPos(result.position);
    setSnapEdge(result.snapEdge);
  }, [dragPreview, def, camera, raycaster, walls, furniture, snap, gridSize]);

  if (!pos || !def) return null;

  const ghostItem: FurnitureData = {
    id: "__drag_ghost__",
    type: def.type,
    position: pos,
    rotation: 0,
    width: def.width,
    depth: def.depth,
    height: def.height,
    color: def.color,
  };
  const hasCollision = checkFurnitureCollision(ghostItem, furniture, walls);

  return (
    <GhostPreview
      furnitureType={def.type}
      position={pos}
      rotation={0}
      width={def.width}
      depth={def.depth}
      height={def.height}
      color={def.color}
      hasCollision={hasCollision}
      snapEdge={snapEdge}
      walls={walls}
      furniture={furniture}
      showMeasurements={!is3D}
    />
  );
}

// ── Ghost Furniture Preview ──────────────────────────────────────────────────

function getGhostModel(type: string) {
  switch (type) {
    case "bed": return BedModel;
    case "table": return TableModel;
    case "chair": return ChairModel;
    case "sofa": return SofaModel;
    case "wardrobe": return WardrobeModel;
    case "desk": return DeskModel;
    case "bookshelf": return BookshelfModel;
    case "nightstand": return NightstandModel;
    default: return null;
  }
}

interface GhostPreviewProps {
  furnitureType: string;
  position: [number, number];
  rotation: number;
  width: number;
  depth: number;
  height: number;
  color: string;
  hasCollision: boolean;
  snapEdge: SnapEdge | null;
  walls: ReturnType<typeof useWalls>;
  furniture: FurnitureData[];
  showMeasurements: boolean;
}

function GhostPreview({
  furnitureType,
  position,
  rotation,
  width,
  depth,
  height,
  color,
  hasCollision,
  snapEdge,
  walls,
  furniture,
  showMeasurements,
}: GhostPreviewProps) {
  const ghostItem: FurnitureData = {
    id: "__ghost__",
    type: furnitureType,
    position,
    rotation,
    width,
    depth,
    height,
    color,
  };

  const ModelComponent = getGhostModel(furnitureType);
  const catalogDef = getFurnitureDef(furnitureType);
  const hasGLTF = !!catalogDef?.modelUrl;

  return (
    <>
      <group position={[position[0], 0, position[1]]} rotation={[0, rotation, 0]}>
        {/* Render actual furniture model with transparency */}
        {hasGLTF ? (
          <group>
            <GLTFModel
              url={catalogDef!.modelUrl!}
              width={width}
              depth={depth}
              height={height}
              color={hasCollision ? "#EF4444" : color}
              opacity={0.45}
            />
            <mesh position={[0, height / 2, 0]}>
              <boxGeometry args={[width + 0.01, height + 0.01, depth + 0.01]} />
              <meshBasicMaterial visible={false} />
              <Edges threshold={15} color={hasCollision ? "#EF4444" : "#818cf8"} />
            </mesh>
          </group>
        ) : ModelComponent ? (
          <group>
            <ModelComponent
              width={width}
              depth={depth}
              height={height}
              color={hasCollision ? "#EF4444" : color}
              opacity={0.45}
            />
            <mesh position={[0, height / 2, 0]}>
              <boxGeometry args={[width + 0.01, height + 0.01, depth + 0.01]} />
              <meshBasicMaterial visible={false} />
              <Edges threshold={15} color={hasCollision ? "#EF4444" : "#818cf8"} />
            </mesh>
          </group>
        ) : (
          <mesh position={[0, height / 2, 0]}>
            <boxGeometry args={[width, height, depth]} />
            <meshBasicMaterial
              color={hasCollision ? "#EF4444" : "#6366f1"}
              transparent
              opacity={0.25}
            />
            <Edges threshold={15} color={hasCollision ? "#EF4444" : "#818cf8"} />
          </mesh>
        )}
      </group>

      {/* Snap edge indicator (world space) */}
      <SnapIndicator snapEdge={snapEdge} />

      {/* Measurements (world space) */}
      {showMeasurements && (
        <Measurements item={ghostItem} walls={walls} allFurniture={furniture} />
      )}
    </>
  );
}

// ── Opening Placement Helpers ────────────────────────────────────────────────

/** Project a world XZ point onto a specific wall, returning the offset (meters) from wall start. */
function projectPointOntoWall(cx: number, cz: number, wall: WallData): number | null {
  const ax = wall.start[0], az = wall.start[1];
  const bx = wall.end[0], bz = wall.end[1];
  const dx = bx - ax, dz = bz - az;
  const lenSq = dx * dx + dz * dz;
  if (lenSq < 0.0001) return null;

  const t = Math.max(0, Math.min(1, ((cx - ax) * dx + (cz - az) * dz) / lenSq));
  return t * Math.sqrt(lenSq);
}

/** Exact equality for snapped XZ points — used to skip no-op state updates in the per-frame loop. */
function pointsEqual(a: [number, number] | null, b: [number, number] | null): boolean {
  return a !== null && b !== null && a[0] === b[0] && a[1] === b[1];
}

// ── Room draft preview ────────────────────────────────────────────────────────
// Renders the in-progress custom-room polygon: a rubber-band polyline through the
// placed corners to the cursor, with the first corner highlighted as the close
// target.
function RoomDraftPreview({
  points,
  cursor,
}: {
  points: [number, number][];
  cursor: [number, number] | null;
}) {
  const all = cursor ? [...points, cursor] : points;

  const lineObj = useMemo(() => {
    const arr: number[] = [];
    for (const [x, z] of all) arr.push(x, 0.06, z);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
    const mat = new THREE.LineBasicMaterial({ color: "#6366f1" });
    return new THREE.Line(geo, mat);
  }, [all]);

  // Live length label per drawn segment (placed edges + rubber-band to cursor).
  const segLabels: { mid: [number, number]; len: number }[] = [];
  for (let i = 0; i < all.length - 1; i++) {
    const a = all[i];
    const b = all[i + 1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 0.05) continue;
    segLabels.push({ mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], len });
  }

  return (
    <group>
      <primitive object={lineObj} />
      {points.map((p, i) => (
        <mesh key={i} position={[p[0], 0.06, p[1]]}>
          <sphereGeometry args={[i === 0 ? 0.12 : 0.07, 14, 14]} />
          <meshBasicMaterial color={i === 0 ? "#22c55e" : "#6366f1"} />
        </mesh>
      ))}
      {segLabels.map((s, i) => (
        <Html key={`len-${i}`} position={[s.mid[0], 0.3, s.mid[1]]} center>
          <div className="bg-dizajno-accent text-white px-1.5 py-0.5 rounded text-[11px] font-mono whitespace-nowrap shadow-lg pointer-events-none">
            {s.len.toFixed(2)}m
          </div>
        </Html>
      ))}
    </group>
  );
}

// ── Scene Content ───────────────────────────────────────────────────────────

function SceneContent() {
  const walls = useWalls();
  const floors = useFloors();
  const furniture = useFurniture();
  const mode = useMode();
  const is3D = useIs3D();
  const snap = useSnap();
  const gridSize = useGridSize();
  const drawingFrom = useDrawingFrom();
  const wallThickness = useWallThickness();
  const wallHeight = useWallHeight();

  const openings = useOpenings();
  const hoveredId = useHoveredId();
  const pendingOpeningType = usePendingOpeningType();
  const readOnly = useReadOnly();
  const showDimensions = useShowDimensions();
  const isDraggingItem = useDesignerStore((s) => s.isDragging);

  const addWall = useDesignerStore((s) => s.addWall);
  const setWallsAndFloors = useDesignerStore((s) => s.setWallsAndFloors);
  const setDrawingFrom = useDesignerStore((s) => s.setDrawingFrom);
  const placeFurniture = useDesignerStore((s) => s.placeFurniture);
  const addOpening = useDesignerStore((s) => s.addOpening);
  const updateOpening = useDesignerStore((s) => s.updateOpening);
  const select = useDesignerStore((s) => s.select);
  const setHoveredId = useDesignerStore((s) => s.setHoveredId);
  const setStoreDragging = useDesignerStore((s) => s.setDragging);
  const selectedIds = useSelectedIds();
  const activeFurnitureType = useDesignerStore((s) => s.activeFurnitureType);
  const setMode = useDesignerStore((s) => s.setMode);
  const clearSelection = useDesignerStore((s) => s.clearSelection);
  const roomDraft = useRoomDraft();
  const setRoomDraft = useDesignerStore((s) => s.setRoomDraft);
  const addRoom = useDesignerStore((s) => s.addRoom);
  const setCursor = useDesignerStore((s) => s.setCursor);
  const setZoom = useDesignerStore((s) => s.setZoom);

  const [previewEnd, setPreviewEnd] = useState<[number, number] | null>(null);
  // Live cursor position while drawing a custom room polygon (rubber-band).
  const [roomCursor, setRoomCursor] = useState<[number, number] | null>(null);
  const ROOM_CLOSE_THRESHOLD = 0.3;
  const drawingRef = useRef(false);
  const drawStartRef = useRef<[number, number] | null>(null);
  // Latest snapped preview end / room cursor, mirrored in refs so the per-frame
  // raycast loop and the pointer-up commit share one value without stale closures.
  const previewEndRef = useRef<[number, number] | null>(null);
  const roomCursorRef = useRef<[number, number] | null>(null);
  // Last-pushed status-bar values, to skip redundant store writes each frame.
  const cursorRef = useRef<[number, number] | null>(null);
  const zoomRef = useRef(100);

  // Ghost furniture state (furniture mode hover)
  const [ghostPos, setGhostPos] = useState<[number, number] | null>(null);
  const [ghostSnapEdge, setGhostSnapEdge] = useState<SnapEdge | null>(null);
  // Last-pushed ghost position, to skip redundant state writes each frame.
  const ghostPosRef = useRef<[number, number] | null>(null);

  // Ghost opening state (opening mode hover)
  const [ghostOpening, setGhostOpening] = useState<{
    wallId: string;
    offsetFromStart: number;
    valid: boolean;
    snapTarget: OpeningSnapTarget | null;
    wallStart: [number, number];
    wallEnd: [number, number];
    wallThicknessLocal: number;
  } | null>(null);

  // Opening drag state — armed on pointerdown, but movement only starts once
  // the pointer travels OPENING_DRAG_THRESHOLD along the wall (mirrors the
  // furniture hold-to-drag pattern so a plain click never moves the opening).
  const draggingOpeningRef = useRef<{
    openingId: string;
    wallId: string;
    width: number;
    /** offsetFromStart when the gesture began */
    startOffset: number;
    /** pointer projection along the wall when the gesture began */
    startProj: number;
    /** threshold crossed — the opening is actually being moved */
    dragging: boolean;
  } | null>(null);
  // Local drag preview — the store is only written ONCE on release (also keeps
  // the undo history at one entry per drag instead of one per frame).
  const [openingDragPreview, setOpeningDragPreview] = useState<{
    id: string;
    offsetFromStart: number;
    valid: boolean;
    snapTarget: OpeningSnapTarget | null;
  } | null>(null);
  const openingDragPreviewRef = useRef<typeof openingDragPreview>(null);
  const OPENING_DRAG_THRESHOLD = 0.05; // world meters along the wall
  // Set when an opening drag actually moved: the DOM click that follows the
  // release would otherwise raycast to whatever is now under the cursor
  // (often the bare wall after a snap-back) and steal the selection.
  const suppressClickUntilRef = useRef(0);
  const { raycaster, camera, pointer, gl, controls } = useThree();
  const groundPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  // Pointer id captured during a wall-draw gesture (see handlePointerDown).
  const capturedPointerRef = useRef<number | null>(null);

  // Project a pointer ray to a scalar offset along a wall. In 3D the ray is
  // intersected with the wall's own vertical (centerline) plane — using a
  // surface hit point (offset from the centerline by hitbox/frame depth) or
  // the y=0 ground plane would introduce view-angle parallax bigger than the
  // drag threshold, making a plain click count as a move. In 2D the top-down
  // ortho ray is parallel to that plane, so the ground plane is used (exact).
  const projectRayAlongWall = useCallback(
    (ray: THREE.Ray, wall: WallData): number | null => {
      const wdx = wall.end[0] - wall.start[0];
      const wdz = wall.end[1] - wall.start[1];
      const wlen = Math.hypot(wdx, wdz);
      if (wlen < 0.01) return null;
      const pt = new THREE.Vector3();
      if (is3D) {
        const wallPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
          new THREE.Vector3(-wdz / wlen, 0, wdx / wlen),
          new THREE.Vector3(wall.start[0], 0, wall.start[1])
        );
        if (!ray.intersectPlane(wallPlane, pt)) return null;
      } else {
        if (!ray.intersectPlane(groundPlaneRef.current, pt)) return null;
      }
      return projectPointOntoWall(pt.x, pt.z, wall);
    },
    [is3D]
  );

  // Snap a raw world XZ point: grid snap (when enabled) then snap to a nearby
  // existing wall corner so wall chains connect cleanly.
  const snapWorldPoint = useCallback(
    (x: number, z: number): [number, number] => {
      let p: [number, number] = [x, z];
      if (snap) {
        p = snapPoint(p[0], p[1], gridSize);
      }
      return snapToCorner(p, walls);
    },
    [snap, gridSize, walls]
  );

  // Per-frame ground-plane raycast off the GLOBAL pointer (not mesh pointer
  // events). R3F updates `pointer` before any object's stopPropagation runs, so
  // this stays glued to the cursor even when it passes over existing walls /
  // furniture / floors (which stopPropagation and would otherwise freeze the
  // preview) or over DOM overlays (the captured pointer keeps `pointer` live).
  // One raycast per frame feeds both the status-bar readouts and the live
  // previews (opening drag, wall draw, room rubber-band).
  useFrame(() => {
    raycaster.setFromCamera(pointer, camera);
    const ground = new THREE.Vector3();
    const hasGround = raycaster.ray.intersectPlane(groundPlaneRef.current, ground);

    // ── Status-bar readouts ──────────────────────────────────────────────────
    if (hasGround) {
      const cur = cursorRef.current;
      if (!cur || Math.abs(cur[0] - ground.x) > 1e-3 || Math.abs(cur[1] - ground.z) > 1e-3) {
        cursorRef.current = [ground.x, ground.z];
        setCursor([ground.x, ground.z]);
      }
    }
    const orthoCam = camera as THREE.OrthographicCamera;
    let zoomPct: number;
    if (orthoCam.isOrthographicCamera) {
      // 2D: orthographic zoom relative to the default fit.
      zoomPct = Math.round((orthoCam.zoom / DEFAULT_ORTHO_ZOOM) * 100);
    } else {
      // 3D: a perspective camera doesn't "zoom" — OrbitControls dollies it closer
      // or further, so derive the percentage from its distance to the orbit
      // target (closer = larger %). Falls back to distance-from-origin if the
      // controls target isn't available yet.
      const target = (controls as { target?: THREE.Vector3 } | null)?.target;
      const dist = target ? camera.position.distanceTo(target) : camera.position.length();
      zoomPct = Math.round((DEFAULT_PERSP_DISTANCE / Math.max(dist, 0.001)) * 100);
    }
    if (zoomPct !== zoomRef.current) {
      zoomRef.current = zoomPct;
      setZoom(zoomPct);
    }

    // ── Live previews ────────────────────────────────────────────────────────
    // 1. Opening drag — move the dragged opening along its host wall, locally.
    // The pointer is projected against the wall's own VERTICAL plane in 3D
    // (the y=0 ground plane lands meters behind a wall when you grab a frame
    // at sill height); in 2D top-down the ground plane is exact. Movement is
    // delta-based from the grab point — never re-centered under the cursor —
    // and only starts past a hold-to-drag threshold, so clicks don't move it.
    const drag = draggingOpeningRef.current;
    if (drag) {
      const wall = walls.find((w) => w.id === drag.wallId);
      if (!wall) return;

      const proj = projectRayAlongWall(raycaster.ray, wall);
      if (proj === null) return;

      if (!drag.dragging) {
        if (Math.abs(proj - drag.startProj) < OPENING_DRAG_THRESHOLD) return;
        drag.dragging = true;
      }

      const wallLen = Math.sqrt(
        (wall.end[0] - wall.start[0]) ** 2 + (wall.end[1] - wall.start[1]) ** 2
      );
      const desiredCenter = drag.startOffset + (proj - drag.startProj) + drag.width / 2;
      const siblings = openings.filter(
        (o) => o.wallId === wall.id && o.id !== drag.openingId
      );
      const res = snapOpeningOffset(desiredCenter, drag.width, wallLen, siblings, snap, gridSize);

      const prev = openingDragPreviewRef.current;
      if (
        !prev ||
        prev.offsetFromStart !== res.offsetFromStart ||
        prev.valid !== res.valid ||
        prev.snapTarget !== res.snapTarget
      ) {
        const next = {
          id: drag.openingId,
          offsetFromStart: res.offsetFromStart,
          valid: res.valid,
          snapTarget: res.snapTarget,
        };
        openingDragPreviewRef.current = next;
        setOpeningDragPreview(next);
      }
      return;
    }

    // 2. Wall draw — track the preview end while a wall is being drawn.
    if (drawingRef.current && mode === "draw") {
      if (!hasGround) return;
      const snapped = snapWorldPoint(ground.x, ground.z);
      if (!pointsEqual(snapped, previewEndRef.current)) {
        previewEndRef.current = snapped;
        setPreviewEnd(snapped);
      }
      return;
    }

    // 3. Room tool — rubber-band the in-progress polygon to the cursor.
    if (mode === "room") {
      if (!hasGround) return;
      const snapped = snapWorldPoint(ground.x, ground.z);
      if (!pointsEqual(snapped, roomCursorRef.current)) {
        roomCursorRef.current = snapped;
        setRoomCursor(snapped);
      }
      return;
    }

    // 4. Furniture placement ghost — follow the cursor. Driven here (global
    // pointer) rather than GridPlane.onPointerMove so it keeps tracking over a
    // floor: FloorMesh is an interactive mesh above the GridPlane and its
    // stopPropagation hover handlers otherwise swallow the move event before it
    // reaches the GridPlane, freezing the ghost at the floor's edge.
    if (mode === "furniture" && activeFurnitureType) {
      if (!hasGround) return;
      const def = getFurnitureDef(activeFurnitureType);
      if (!def) return;
      const itemDesc = { rotation: 0, width: def.width, depth: def.depth };
      const result = smartSnap(ground.x, ground.z, itemDesc, walls, furniture, snap, gridSize);
      if (!pointsEqual(result.position, ghostPosRef.current)) {
        ghostPosRef.current = result.position;
        setGhostPos(result.position);
        setGhostSnapEdge(result.snapEdge);
      }
      return;
    }
  });

  // Release opening drag on pointer up / cancel (window-level listeners).
  // Commits the move to the store ONCE — only if the drag threshold was
  // crossed, the final position is legal AND actually different, and the
  // opening still exists (it can be Delete-keyed mid-drag). Anything else
  // would pollute the zundo history with no-op entries.
  useEffect(() => {
    const finishOpeningDrag = (commit: boolean) => {
      const drag = draggingOpeningRef.current;
      if (!drag) return;
      const preview = openingDragPreviewRef.current;
      if (drag.dragging) {
        // The DOM click that follows the release lands on whatever is under
        // the cursor now (often the wall, after a snap-back) — swallow it.
        suppressClickUntilRef.current = performance.now() + 200;
      }
      if (
        commit &&
        drag.dragging &&
        preview &&
        preview.valid &&
        preview.offsetFromStart !== drag.startOffset &&
        useDesignerStore.getState().openings.some((o) => o.id === drag.openingId)
      ) {
        updateOpening(drag.openingId, { offsetFromStart: preview.offsetFromStart });
      }
      draggingOpeningRef.current = null;
      openingDragPreviewRef.current = null;
      setOpeningDragPreview(null);
      setStoreDragging(false);
    };
    const handlePointerUp = (e: PointerEvent) => {
      if (e.button !== 0) return; // only the dragging button ends the gesture
      finishOpeningDrag(true);
    };
    const handlePointerCancel = () => finishOpeningDrag(false);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);
    return () => {
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, [setStoreDragging, updateOpening]);

  const getSnappedPoint = useCallback(
    (e: any): [number, number] | null => {
      const point = e.point;
      if (!point) return null;
      return snapWorldPoint(point.x, point.z);
    },
    [snapWorldPoint]
  );

  const finishWall = useCallback(
    (endPoint: [number, number]) => {
      const start = drawStartRef.current;
      if (!start || !endPoint) return;
      const d = Math.sqrt(
        (endPoint[0] - start[0]) ** 2 + (endPoint[1] - start[1]) ** 2
      );
      if (d > 0.05) {
        const newWall = {
          id: newId(),
          start,
          end: endPoint,
          thickness: wallThickness,
          height: wallHeight,
        };

        // Process intersections: splits walls at crossings and T-junctions
        const updatedWalls = addWallWithIntersections(newWall, walls);
        const detectedFloors = findFloors(updatedWalls);
        // Any opening on a wall that just got split would otherwise reference
        // a vanished id — reassign each to whichever child segment still
        // contains its footprint, drop the rest.
        const updatedOpenings = reassignOpeningsAfterWallChange(openings, walls, updatedWalls);

        // Atomic update — single undo step
        setWallsAndFloors(
          updatedWalls,
          detectedFloors.length > 0 ? detectedFloors : floors,
          updatedOpenings
        );
      }
    },
    [walls, floors, openings, wallThickness, wallHeight, setWallsAndFloors]
  );

  // End the in-progress wall draw: commit at the live preview end, release the
  // captured pointer, and reset all draw state. Driven by a window-level
  // pointerup (below) so it fires no matter where the cursor is on release
  // (over a wall, over the Build panel, or off-canvas).
  const endWallDraw = useCallback(() => {
    if (!drawingRef.current) return;
    const point = previewEndRef.current;
    if (point) finishWall(point);
    if (capturedPointerRef.current != null) {
      try {
        gl.domElement.releasePointerCapture(capturedPointerRef.current);
      } catch {
        /* already released */
      }
      capturedPointerRef.current = null;
    }
    drawingRef.current = false;
    drawStartRef.current = null;
    previewEndRef.current = null;
    setDrawingFrom(null);
    setPreviewEnd(null);
  }, [finishWall, setDrawingFrom, gl]);

  useEffect(() => {
    const onUp = (e: PointerEvent) => {
      if (!drawingRef.current) return;
      // Only end on the pointer that started the draw (ignore right-click pans etc.)
      if (capturedPointerRef.current != null && e.pointerId !== capturedPointerRef.current) return;
      if (capturedPointerRef.current == null && e.button !== 0) return;
      endWallDraw();
    };
    window.addEventListener("pointerup", onUp);
    return () => window.removeEventListener("pointerup", onUp);
  }, [endWallDraw]);

  const handlePointerDown = useCallback(
    (e: any) => {
      // Left-click-hold to draw walls
      if (e.button === 0 && mode === "draw") {
        e.stopPropagation();
        const point = getSnappedPoint(e);
        if (!point) return;

        drawingRef.current = true;
        drawStartRef.current = point;
        previewEndRef.current = point;
        setDrawingFrom(point);
        setPreviewEnd(point);

        // Capture the pointer on the canvas so pointermove keeps flowing — and
        // R3F's global `pointer` keeps updating — even when the cursor crosses
        // over a DOM overlay (e.g. the open Build panel) or leaves the canvas.
        // Without this the pointer freezes at the canvas edge and the preview
        // sticks pointing toward whatever overlay the cursor wandered onto.
        const pid = e.pointerId ?? e.nativeEvent?.pointerId;
        if (pid != null) {
          try {
            gl.domElement.setPointerCapture(pid);
            capturedPointerRef.current = pid;
          } catch {
            /* capture unsupported — preview still works while over the canvas */
          }
        }
        return;
      }

      // Left-click for click-to-place furniture
      if (e.button === 0 && mode === "furniture" && activeFurnitureType) {
        e.stopPropagation();
        const rawPoint = e.point;
        if (!rawPoint) return;

        const def = getFurnitureDef(activeFurnitureType);
        if (!def) return;

        const itemDesc = { rotation: 0, width: def.width, depth: def.depth };
        const result = smartSnap(
          rawPoint.x,
          rawPoint.z,
          itemDesc,
          walls,
          furniture,
          snap,
          gridSize
        );
        const [x, z] = result.position;

        const state = useDesignerStore.getState();

        const newItem: FurnitureData = {
          id: newId(),
          type: def.type,
          position: [x, z],
          rotation: 0,
          width: def.width,
          depth: def.depth,
          height: def.height,
          color: def.color,
        };

        if (!checkFurnitureCollision(newItem, state.furniture, state.walls)) {
          // placeFurniture also selects the new item and enters select mode.
          placeFurniture(newItem);
        } else {
          // Collision: nothing placed — just leave the sidebar tool.
          setMode("select");
        }
        setGhostPos(null);
        setGhostSnapEdge(null);
        return;
      }

      // Custom room: click to drop corners; click near the first corner to close.
      if (e.button === 0 && mode === "room") {
        e.stopPropagation();
        const point = getSnappedPoint(e);
        if (!point) return;
        const draft = useDesignerStore.getState().roomDraft ?? [];
        if (
          draft.length >= 3 &&
          Math.hypot(point[0] - draft[0][0], point[1] - draft[0][1]) < ROOM_CLOSE_THRESHOLD
        ) {
          addRoom(draft); // closes the polygon → builds walls outward
          setRoomCursor(null);
          roomCursorRef.current = null;
          return;
        }
        setRoomDraft([...draft, point]);
        return;
      }

      // Left-click deselect
      if (e.button === 0 && mode === "select") {
        clearSelection();
      }
    },
    [
      mode,
      activeFurnitureType,
      getSnappedPoint,
      setDrawingFrom,
      placeFurniture,
      select,
      clearSelection,
      addRoom,
      setRoomDraft,
      walls,
      furniture,
      snap,
      gridSize,
    ]
  );

  // All live cursor-tracking previews (wall draw, room rubber-band, furniture
  // ghost) are driven by the per-frame ground-plane raycast in useFrame (above)
  // off the GLOBAL pointer, so they keep tracking even over meshes that
  // stopPropagation (existing walls, floors). GridPlane needs no onPointerMove
  // or onPointerUp handler — only onPointerDown (to start/place/select).

  // Hide ghost when not in furniture mode
  useEffect(() => {
    if (mode !== "furniture" || !activeFurnitureType) {
      setGhostPos(null);
      setGhostSnapEdge(null);
      ghostPosRef.current = null;
    }
  }, [mode, activeFurnitureType]);

  // Calculate preview wall measurement
  let previewLength = 0;
  let previewCenter: [number, number] | null = null;
  if (drawingRef.current && drawingFrom && previewEnd) {
    const dx = previewEnd[0] - drawingFrom[0];
    const dz = previewEnd[1] - drawingFrom[1];
    previewLength = Math.sqrt(dx * dx + dz * dz);
    previewCenter = [
      (drawingFrom[0] + previewEnd[0]) / 2,
      (drawingFrom[1] + previewEnd[1]) / 2,
    ];
  }

  // Ghost furniture definition
  const ghostDef = activeFurnitureType ? getFurnitureDef(activeFurnitureType) : null;
  const ghostItem: FurnitureData | null =
    ghostPos && ghostDef
      ? {
          id: "__ghost__",
          type: ghostDef.type,
          position: ghostPos,
          rotation: 0,
          width: ghostDef.width,
          depth: ghostDef.depth,
          height: ghostDef.height,
          color: ghostDef.color,
        }
      : null;
  const ghostHasCollision =
    ghostItem !== null &&
    checkFurnitureCollision(ghostItem, furniture, walls);

  // Openings as rendered this frame: while one is being dragged, substitute
  // its local preview offset so both the frame AND the wall hole track the
  // cursor (the store itself is untouched until release).
  const displayOpenings = openingDragPreview
    ? openings.map((o) =>
        o.id === openingDragPreview.id
          ? { ...o, offsetFromStart: openingDragPreview.offsetFromStart }
          : o
      )
    : openings;

  // Indicator line across the wall at a snapped opening's center.
  const openingSnapEdge = (
    wall: WallData,
    offsetFromStart: number,
    width: number
  ): SnapEdge | null => {
    const dx = wall.end[0] - wall.start[0];
    const dz = wall.end[1] - wall.start[1];
    const len = Math.hypot(dx, dz);
    if (len < 0.01) return null;
    const cx = wall.start[0] + (dx / len) * (offsetFromStart + width / 2);
    const cz = wall.start[1] + (dz / len) * (offsetFromStart + width / 2);
    const px = -dz / len;
    const pz = dx / len;
    const half = wall.thickness / 2 + 0.4;
    return {
      p1: [cx + px * half, cz + pz * half],
      p2: [cx - px * half, cz - pz * half],
    };
  };

  // Which side of its wall a door's 2D swing arc opens toward: prefer the
  // side whose probe point lands inside a floor polygon (i.e. into the room).
  // Walls carry no swing-side datum, so this is a symbolic best-effort that
  // stays stable regardless of the wall's draw direction.
  const doorSwingSide = (
    wall: WallData,
    offsetFromStart: number,
    width: number
  ): 1 | -1 => {
    const dx = wall.end[0] - wall.start[0];
    const dz = wall.end[1] - wall.start[1];
    const len = Math.hypot(dx, dz);
    if (len < 0.01) return 1;
    const cx = wall.start[0] + (dx / len) * (offsetFromStart + width / 2);
    const cz = wall.start[1] + (dz / len) * (offsetFromStart + width / 2);
    const px = -dz / len;
    const pz = dx / len;
    const probe = wall.thickness / 2 + 0.3;
    if (floors.some((f) => pointInPolygon([cx + px * probe, cz + pz * probe], f.vertices))) {
      return 1;
    }
    if (floors.some((f) => pointInPolygon([cx - px * probe, cz - pz * probe], f.vertices))) {
      return -1;
    }
    return 1;
  };

  // Opening whose measurements should show in 2D: the dragged one, else the
  // single selected one (mirrors furniture's selected-measurements behavior).
  const measuredOpening = (() => {
    const targetId =
      openingDragPreview?.id ?? (selectedIds.length === 1 ? selectedIds[0] : null);
    if (!targetId) return null;
    const op = displayOpenings.find((o) => o.id === targetId);
    if (!op) return null;
    const wall = walls.find((w) => w.id === op.wallId);
    return wall ? { op, wall } : null;
  })();

  return (
    <>
      <color attach="background" args={["#e8ecf0"]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 15, 10]} intensity={0.8} castShadow />
      <directionalLight position={[-5, 10, -5]} intensity={0.3} />

      <CameraController is3D={is3D} mode={mode} />
      <DropHandler />
      <DragGhost />

      <GridPlane
        gridSize={gridSize}
        onPointerDown={handlePointerDown}
      />

      {/* Rendered walls */}
      {walls.map((wall) => (
        <WallMesh
          key={wall.id}
          start={wall.start}
          end={wall.end}
          thickness={wall.thickness}
          height={is3D ? wall.height : 0.15}
          selected={selectedIds.includes(wall.id)}
          hovered={hoveredId === wall.id}
          openings={displayOpenings.filter((o) => o.wallId === wall.id)}
          paintVariantId={wall.paintVariantId ?? null}
          onClick={(e: any) => {
            if (mode === "select" || mode === "draw") {
              // Ignore the synthetic click that trails an opening drag.
              if (performance.now() < suppressClickUntilRef.current) return;
              select(wall.id);
            }
            // Place opening directly on the clicked wall (avoids click-through)
            if (mode === "opening" && pendingOpeningType && e.point) {
              const hit = projectPointOntoWall(e.point.x, e.point.z, wall);
              if (hit === null) return;

              const wallLen = Math.sqrt(
                (wall.end[0] - wall.start[0]) ** 2 + (wall.end[1] - wall.start[1]) ** 2
              );
              const opWidth = pendingOpeningType === "door" ? 0.9 : 1.2;
              const opHeight = pendingOpeningType === "door" ? 2.1 : 1.0;
              const opSill = pendingOpeningType === "door" ? 0 : 0.9;

              const res = snapOpeningOffset(
                hit,
                opWidth,
                wallLen,
                openings.filter((o) => o.wallId === wall.id),
                snap,
                gridSize
              );
              if (!res.valid) return;

              addOpening({
                id: newId(),
                wallId: wall.id,
                type: pendingOpeningType,
                offsetFromStart: res.offsetFromStart,
                width: opWidth,
                height: opHeight,
                sillHeight: opSill,
              });
              clearSelection();
              setGhostOpening(null);
            }
          }}
          onPointerOver={() => {
            if (!useDesignerStore.getState().isDragging) setHoveredId(wall.id);
          }}
          onPointerOut={() => {
            setHoveredId(null);
            if (mode === "opening") setGhostOpening(null);
          }}
          onPointerMove={(e: any) => {
            // Show ghost opening preview on the hovered wall
            if (mode === "opening" && pendingOpeningType && e.point) {
              const hit = projectPointOntoWall(e.point.x, e.point.z, wall);
              if (hit === null) { setGhostOpening(null); return; }
              const wallLen = Math.sqrt(
                (wall.end[0] - wall.start[0]) ** 2 + (wall.end[1] - wall.start[1]) ** 2
              );
              const opWidth = pendingOpeningType === "door" ? 0.9 : 1.2;
              const res = snapOpeningOffset(
                hit,
                opWidth,
                wallLen,
                openings.filter((o) => o.wallId === wall.id),
                snap,
                gridSize
              );
              setGhostOpening((prev) =>
                prev &&
                prev.wallId === wall.id &&
                prev.offsetFromStart === res.offsetFromStart &&
                prev.valid === res.valid &&
                prev.snapTarget === res.snapTarget
                  ? prev
                  : {
                      wallId: wall.id,
                      offsetFromStart: res.offsetFromStart,
                      valid: res.valid,
                      snapTarget: res.snapTarget,
                      wallStart: wall.start,
                      wallEnd: wall.end,
                      wallThicknessLocal: wall.thickness,
                    }
              );
            }
          }}
        />
      ))}

      {/* Preview wall being drawn */}
      {drawingRef.current && drawingFrom && previewEnd && (
        <>
          <WallMesh
            start={drawingFrom}
            end={previewEnd}
            thickness={wallThickness}
            height={is3D ? wallHeight : 0.15}
            selected
          />
          {previewLength > 0.05 && previewCenter && (
            <Html position={[previewCenter[0], 1.5, previewCenter[1]]} center>
              <div className="bg-dizajno-accent text-white px-2 py-0.5 rounded text-xs whitespace-nowrap font-mono shadow-lg">
                {previewLength.toFixed(2)}m
              </div>
            </Html>
          )}
        </>
      )}

      {/* Custom-room polygon in progress (Room tool) */}
      {mode === "room" && roomDraft && roomDraft.length > 0 && (
        <RoomDraftPreview points={roomDraft} cursor={roomCursor} />
      )}

      {/* Floors — selectable in select mode so the user can assign flooring.
          Selecting furniture that sits on a floor no longer falls through here:
          FurnitureItem3D stops the click from reaching this onClick. */}
      {floors.map((floor) => (
        <FloorMesh
          key={floor.id}
          vertices={floor.vertices}
          flooringVariantId={floor.flooringVariantId ?? null}
          selected={selectedIds.includes(floor.id)}
          hovered={hoveredId === floor.id}
          onClick={() => {
            if (mode === "select") {
              if (performance.now() < suppressClickUntilRef.current) return;
              select(floor.id);
            }
          }}
          onPointerOver={() => {
            if (mode === "select" && !useDesignerStore.getState().isDragging) {
              setHoveredId(floor.id);
            }
          }}
          onPointerOut={() => setHoveredId(null)}
        />
      ))}

      {/* Planner5D-style centered room area labels (2D only) */}
      {!is3D && <RoomLabels floors={floors} />}

      {/* Planner5D-style wall dimensions (2D only): inner clear distance always,
          full wall length on hover. */}
      {!is3D && showDimensions && (
        <WallDimensions walls={walls} floors={floors} hoveredId={hoveredId} />
      )}

      {/* Openings (door/window frames rendered in world space) */}
      {displayOpenings.map((opening) => {
        const wall = walls.find((w) => w.id === opening.wallId);
        if (!wall) return null;
        return (
          <WallOpening
            key={opening.id}
            opening={opening}
            wallStart={wall.start}
            wallEnd={wall.end}
            wallThickness={wall.thickness}
            wallHeight={is3D ? wall.height : 0.15}
            selected={selectedIds.includes(opening.id)}
            hovered={hoveredId === opening.id}
            flat={!is3D}
            invalid={openingDragPreview?.id === opening.id && !openingDragPreview.valid}
            interactive={mode === "select"}
            swingSide={
              !is3D && opening.type === "door"
                ? doorSwingSide(wall, opening.offsetFromStart, opening.width)
                : 1
            }
            onClick={() => {
              if (mode === "select" && !draggingOpeningRef.current) select(opening.id);
            }}
            onPointerDown={(e: any) => {
              if (mode === "select" && e.button === 0) {
                e.stopPropagation();
                select(opening.id);
                // Read-only viewer: select but never start a drag.
                if (readOnly) return;
                // Capture the grab point along the wall — the drag is
                // delta-based from here, and nothing moves until the pointer
                // travels past the hold-to-drag threshold. Project the EVENT
                // RAY the same way the per-frame loop does: e.point sits on
                // the hitbox/frame surface, off the wall centerline, and that
                // offset reads as instant movement at oblique 3D angles.
                if (!e.ray) return;
                const startProj = projectRayAlongWall(e.ray, wall);
                if (startProj === null) return;
                draggingOpeningRef.current = {
                  openingId: opening.id,
                  wallId: opening.wallId,
                  width: opening.width,
                  startOffset: opening.offsetFromStart,
                  startProj,
                  dragging: false,
                };
                setStoreDragging(true);
              }
            }}
            onPointerOver={() => {
              if (!useDesignerStore.getState().isDragging) setHoveredId(opening.id);
            }}
            onPointerOut={() => setHoveredId(null)}
          />
        );
      })}

      {/* Snap indicator + live measurements for the dragged / selected opening */}
      {openingDragPreview?.snapTarget &&
        (() => {
          const op = displayOpenings.find((o) => o.id === openingDragPreview.id);
          const wall = op && walls.find((w) => w.id === op.wallId);
          if (!op || !wall) return null;
          const edge = openingSnapEdge(wall, op.offsetFromStart, op.width);
          return edge ? <SnapIndicator snapEdge={edge} /> : null;
        })()}
      {!is3D && measuredOpening && (
        <OpeningMeasurements
          opening={measuredOpening.op}
          wall={measuredOpening.wall}
          siblings={displayOpenings.filter(
            (o) => o.wallId === measuredOpening.op.wallId && o.id !== measuredOpening.op.id
          )}
        />
      )}

      {/* Ghost opening preview (+ live measurements and snap indicator) */}
      {ghostOpening && pendingOpeningType && (() => {
        const opWidth = pendingOpeningType === "door" ? 0.9 : 1.2;
        const opHeight = pendingOpeningType === "door" ? 2.1 : 1.0;
        const opSill = pendingOpeningType === "door" ? 0 : 0.9;
        const ghostWall = walls.find((w) => w.id === ghostOpening.wallId);
        const wallH = is3D ? (ghostWall?.height ?? wallHeight) : 0.15;
        const edge =
          ghostWall && ghostOpening.snapTarget
            ? openingSnapEdge(ghostWall, ghostOpening.offsetFromStart, opWidth)
            : null;
        return (
          <>
            <WallOpening
              opening={{
                id: "__ghost_opening__",
                wallId: ghostOpening.wallId,
                type: pendingOpeningType,
                offsetFromStart: ghostOpening.offsetFromStart,
                width: opWidth,
                height: opHeight,
                sillHeight: opSill,
              }}
              wallStart={ghostOpening.wallStart}
              wallEnd={ghostOpening.wallEnd}
              wallThickness={ghostOpening.wallThicknessLocal}
              wallHeight={wallH}
              ghost
              flat={!is3D}
              invalid={!ghostOpening.valid}
              swingSide={
                !is3D && pendingOpeningType === "door" && ghostWall
                  ? doorSwingSide(ghostWall, ghostOpening.offsetFromStart, opWidth)
                  : 1
              }
            />
            {edge && <SnapIndicator snapEdge={edge} />}
            {!is3D && ghostWall && (
              <OpeningMeasurements
                opening={{ offsetFromStart: ghostOpening.offsetFromStart, width: opWidth }}
                wall={ghostWall}
                siblings={openings.filter((o) => o.wallId === ghostOpening.wallId)}
              />
            )}
          </>
        );
      })()}

      {/* Furniture */}
      {furniture.map((item) => (
        <FurnitureItem3D key={item.id} item={item} />
      ))}

      {/* Planner5D-style radial action menu around the single selected item */}
      {!isDraggingItem &&
        selectedIds.length === 1 &&
        (() => {
          const sel = furniture.find((f) => f.id === selectedIds[0]);
          if (sel) return <RadialMenu item={sel} />;
          if (readOnly) return null;
          const op = openings.find((o) => o.id === selectedIds[0]);
          if (!op) return null;
          const opWall = walls.find((w) => w.id === op.wallId);
          return opWall ? <OpeningRadialMenu opening={op} wall={opWall} /> : null;
        })()}

      {/* Ghost preview when placing from sidebar */}
      {ghostItem && ghostPos && ghostDef && (
        <GhostPreview
          furnitureType={ghostDef.type}
          position={ghostPos}
          rotation={0}
          width={ghostDef.width}
          depth={ghostDef.depth}
          height={ghostDef.height}
          color={ghostDef.color}
          hasCollision={ghostHasCollision}
          snapEdge={ghostSnapEdge}
          walls={walls}
          furniture={furniture}
          showMeasurements={!is3D}
        />
      )}

      {/* Start point indicator */}
      {drawingRef.current && drawingFrom && (
        <mesh position={[drawingFrom[0], 0.05, drawingFrom[1]]}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshBasicMaterial color="#6366f1" />
        </mesh>
      )}
    </>
  );
}

// ── Main Export ──────────────────────────────────────────────────────────────

export default function DrawingSurface() {
  return (
    <div
      className="relative w-full h-full"
      onContextMenu={(e) => e.preventDefault()}
      tabIndex={0}
    >
      {/* preserveDrawingBuffer lets us screenshot the canvas for project
          thumbnails (utils/captureCanvas.ts). Without it WebGL clears the
          framebuffer between frames and toBlob/toDataURL come back blank. */}
      <Canvas shadows gl={{ preserveDrawingBuffer: true }}>
        <SceneContent />
      </Canvas>
    </div>
  );
}
