"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
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
  useDimensionFace,
} from "@/store/useDesignerStore";
import GridPlane from "./GridPlane";
import CameraController from "./CameraController";
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
  const dimensionFace = useDimensionFace();
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

  const [previewEnd, setPreviewEnd] = useState<[number, number] | null>(null);
  const drawingRef = useRef(false);
  const drawStartRef = useRef<[number, number] | null>(null);

  // Ghost furniture state (furniture mode hover)
  const [ghostPos, setGhostPos] = useState<[number, number] | null>(null);
  const [ghostSnapEdge, setGhostSnapEdge] = useState<SnapEdge | null>(null);

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
  const { raycaster, camera, pointer } = useThree();
  const groundPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));

  // Smoothly update opening position each frame during drag
  useFrame(() => {
    const drag = draggingOpeningRef.current;
    if (!drag) return;

    raycaster.setFromCamera(pointer, camera);
    const intersection = new THREE.Vector3();
    const hit = raycaster.ray.intersectPlane(groundPlaneRef.current, intersection);
    if (!hit) return;

    const wall = walls.find((w) => w.id === drag.wallId);
    if (!wall) return;

    const offset = projectPointOntoWall(intersection.x, intersection.z, wall);
    if (offset === null) return;

    const wallLen = Math.sqrt(
      (wall.end[0] - wall.start[0]) ** 2 + (wall.end[1] - wall.start[1]) ** 2
    );
    const clamped = Math.max(0.05, Math.min(wallLen - drag.width - 0.05, offset - drag.width / 2));
    updateOpening(drag.openingId, { offsetFromStart: clamped });
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
      let p: [number, number] = [point.x, point.z];
      if (snap) {
        p = snapPoint(p[0], p[1], gridSize);
      }
      // Also snap to existing wall corners (for easy connections)
      return snapToCorner(p, walls);
    },
    [snap, gridSize, walls]
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

  const handlePointerDown = useCallback(
    (e: any) => {
      // Left-click-hold to draw walls
      if (e.button === 0 && mode === "draw") {
        e.stopPropagation();
        const point = getSnappedPoint(e);
        if (!point) return;

        drawingRef.current = true;
        drawStartRef.current = point;
        setDrawingFrom(point);
        setPreviewEnd(point);
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
      walls,
      furniture,
      snap,
      gridSize,
    ]
  );

  const handlePointerMove = useCallback(
    (e: any) => {
      if (drawingRef.current && mode === "draw") {
        const point = getSnappedPoint(e);
        if (point) setPreviewEnd(point);
        return;
      }

      // Update ghost preview position for furniture mode
      if (mode === "furniture" && activeFurnitureType) {
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
        setGhostPos(result.position);
        setGhostSnapEdge(result.snapEdge);
      }
    },
    [mode, activeFurnitureType, getSnappedPoint, walls, furniture, snap, gridSize]
  );

  const handlePointerUp = useCallback(
    (e: any) => {
      if (e.button === 0 && drawingRef.current && mode === "draw") {
        const point = getSnappedPoint(e);
        if (point) {
          finishWall(point);
        }
        drawingRef.current = false;
        drawStartRef.current = null;
        setDrawingFrom(null);
        setPreviewEnd(null);
      }
    },
    [mode, getSnappedPoint, finishWall, setDrawingFrom]
  );

  // Hide ghost when not in furniture mode
  useEffect(() => {
    if (mode !== "furniture" || !activeFurnitureType) {
      setGhostPos(null);
      setGhostSnapEdge(null);
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
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
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

      {/* Floors — selectable in select mode so the user can assign flooring. */}
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

      {/* Planner5D-style persistent wall dimension arrows (2D only) */}
      {!is3D && showDimensions && (
        <WallDimensions walls={walls} floors={floors} face={dimensionFace} />
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
