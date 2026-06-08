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
import SnapIndicator from "./SnapIndicator";
import { smartSnap, snapPoint, type SnapEdge } from "@/utils/snapToGrid";
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
      state.placeFurniture(newItem);
    }

    // Deselect sidebar item after placing
    state.setMode("select");
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
    wallStart: [number, number];
    wallEnd: [number, number];
    wallThicknessLocal: number;
  } | null>(null);

  // Opening drag state
  const draggingOpeningRef = useRef<{
    openingId: string;
    wallId: string;
    width: number;
  } | null>(null);
  const { raycaster, camera, pointer, gl, controls } = useThree();
  const groundPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  // Pointer id captured during a wall-draw gesture (see handlePointerDown).
  const capturedPointerRef = useRef<number | null>(null);

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
    // 1. Opening drag — reposition the dragged opening along its host wall.
    const drag = draggingOpeningRef.current;
    if (drag) {
      if (!hasGround) return;
      const wall = walls.find((w) => w.id === drag.wallId);
      if (!wall) return;

      const offset = projectPointOntoWall(ground.x, ground.z, wall);
      if (offset === null) return;

      const wallLen = Math.sqrt(
        (wall.end[0] - wall.start[0]) ** 2 + (wall.end[1] - wall.start[1]) ** 2
      );
      const clamped = Math.max(0.05, Math.min(wallLen - drag.width - 0.05, offset - drag.width / 2));
      updateOpening(drag.openingId, { offsetFromStart: clamped });
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

  // Release opening drag on pointer up (window-level listener)
  useEffect(() => {
    const handlePointerUp = () => {
      if (draggingOpeningRef.current) {
        draggingOpeningRef.current = null;
        setStoreDragging(false);
      }
    };
    window.addEventListener("pointerup", handlePointerUp);
    return () => window.removeEventListener("pointerup", handlePointerUp);
  }, [setStoreDragging]);

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
          placeFurniture(newItem);
        }
        // Deselect sidebar item after placing
        setMode("select");
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
          openings={openings.filter((o) => o.wallId === wall.id)}
          paintVariantId={wall.paintVariantId ?? null}
          onClick={(e: any) => {
            if (mode === "select" || mode === "draw") {
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

              if (wallLen < opWidth + 0.1) return;
              const clampedOffset = Math.max(0.05, Math.min(wallLen - opWidth - 0.05, hit - opWidth / 2));

              addOpening({
                id: newId(),
                wallId: wall.id,
                type: pendingOpeningType,
                offsetFromStart: clampedOffset,
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
              const clampedOffset = Math.max(0.05, Math.min(wallLen - opWidth - 0.05, hit - opWidth / 2));
              setGhostOpening({
                wallId: wall.id,
                offsetFromStart: clampedOffset,
                wallStart: wall.start,
                wallEnd: wall.end,
                wallThicknessLocal: wall.thickness,
              });
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
            if (mode === "select") select(floor.id);
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
      {openings.map((opening) => {
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
            onClick={() => {
              if (mode === "select" && !draggingOpeningRef.current) select(opening.id);
            }}
            onPointerDown={(e: any) => {
              if (mode === "select" && e.button === 0) {
                e.stopPropagation();
                select(opening.id);
                // Read-only viewer: select but never start a drag.
                if (readOnly) return;
                draggingOpeningRef.current = {
                  openingId: opening.id,
                  wallId: opening.wallId,
                  width: opening.width,
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

      {/* Ghost opening preview */}
      {ghostOpening && pendingOpeningType && (() => {
        const opWidth = pendingOpeningType === "door" ? 0.9 : 1.2;
        const opHeight = pendingOpeningType === "door" ? 2.1 : 1.0;
        const opSill = pendingOpeningType === "door" ? 0 : 0.9;
        const wallH = is3D ? (walls.find((w) => w.id === ghostOpening.wallId)?.height ?? wallHeight) : 0.15;
        return (
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
          />
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
          return sel ? <RadialMenu item={sel} /> : null;
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
