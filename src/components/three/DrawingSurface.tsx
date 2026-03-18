"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
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
} from "@/store/useDesignerStore";
import GridPlane from "./GridPlane";
import CameraController from "./CameraController";
import WallMesh from "./WallMesh";
import FloorMesh from "./FloorMesh";
import FurnitureItem3D from "./FurnitureItem3D";
import Measurements from "./Measurements";
import SnapIndicator from "./SnapIndicator";
import { smartSnap, snapPoint, type SnapEdge } from "@/utils/snapToGrid";
import { findFloors } from "@/utils/wallGraph";
import { getFurnitureDef } from "@/utils/furnitureCatalog";
import { checkFurnitureCollision } from "@/utils/collision";
import type { FurnitureData } from "@/types/designer";

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
      id: `furn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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
      state.select(newItem.id);
    }

    state.setPendingDrop(null);
  }, [pendingDrop, camera, raycaster, snap, gridSize, walls, furniture]);

  return null;
}

// ── Ghost Furniture Preview ──────────────────────────────────────────────────

interface GhostPreviewProps {
  position: [number, number];
  rotation: number;
  width: number;
  depth: number;
  height: number;
  hasCollision: boolean;
  snapEdge: SnapEdge | null;
  walls: ReturnType<typeof useWalls>;
  furniture: FurnitureData[];
  showMeasurements: boolean;
}

function GhostPreview({
  position,
  rotation,
  width,
  depth,
  height,
  hasCollision,
  snapEdge,
  walls,
  furniture,
  showMeasurements,
}: GhostPreviewProps) {
  const ghostItem: FurnitureData = {
    id: "__ghost__",
    type: "__ghost__",
    position,
    rotation,
    width,
    depth,
    height,
    color: "#6366f1",
  };

  return (
    <>
      <group position={[position[0], 0, position[1]]} rotation={[0, rotation, 0]}>
        {/* Ghost box */}
        <mesh position={[0, height / 2, 0]}>
          <boxGeometry args={[width, height, depth]} />
          <meshBasicMaterial
            color={hasCollision ? "#EF4444" : "#6366f1"}
            transparent
            opacity={0.25}
          />
          <Edges threshold={15} color={hasCollision ? "#EF4444" : "#818cf8"} />
        </mesh>
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

  const addWall = useDesignerStore((s) => s.addWall);
  const setDrawingFrom = useDesignerStore((s) => s.setDrawingFrom);
  const setFloors = useDesignerStore((s) => s.setFloors);
  const placeFurniture = useDesignerStore((s) => s.placeFurniture);
  const select = useDesignerStore((s) => s.select);
  const activeFurnitureType = useDesignerStore((s) => s.activeFurnitureType);
  const clearSelection = useDesignerStore((s) => s.clearSelection);

  const [previewEnd, setPreviewEnd] = useState<[number, number] | null>(null);
  const drawingRef = useRef(false);
  const drawStartRef = useRef<[number, number] | null>(null);

  // Ghost furniture state (furniture mode hover)
  const [ghostPos, setGhostPos] = useState<[number, number] | null>(null);
  const [ghostSnapEdge, setGhostSnapEdge] = useState<SnapEdge | null>(null);

  const getSnappedPoint = useCallback(
    (e: any): [number, number] | null => {
      const point = e.point;
      if (!point) return null;
      if (snap) {
        return snapPoint(point.x, point.z, gridSize);
      }
      return [point.x, point.z];
    },
    [snap, gridSize]
  );

  const finishWall = useCallback(
    (endPoint: [number, number]) => {
      const start = drawStartRef.current;
      if (!start || !endPoint) return;
      const dist = Math.sqrt(
        (endPoint[0] - start[0]) ** 2 + (endPoint[1] - start[1]) ** 2
      );
      if (dist > 0.05) {
        const wall = {
          id: `wall-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          start,
          end: endPoint,
          thickness: wallThickness,
          height: wallHeight,
        };
        addWall(wall);

        const newWalls = [...walls, wall];
        const detectedFloors = findFloors(newWalls);
        if (detectedFloors.length > 0) {
          setFloors(detectedFloors);
        }
      }
    },
    [walls, wallThickness, wallHeight, addWall, setFloors]
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
          id: `furn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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
          select(newItem.id);
        }
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
      <color attach="background" args={["#0f0f13"]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 15, 10]} intensity={0.8} castShadow />
      <directionalLight position={[-5, 10, -5]} intensity={0.3} />

      <CameraController is3D={is3D} mode={mode} />
      <DropHandler />

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

      {/* Floors */}
      {floors.map((floor) => (
        <FloorMesh key={floor.id} vertices={floor.vertices} />
      ))}

      {/* Furniture */}
      {furniture.map((item) => (
        <FurnitureItem3D key={item.id} item={item} />
      ))}

      {/* Ghost preview when placing from sidebar */}
      {ghostItem && ghostPos && ghostDef && (
        <GhostPreview
          position={ghostPos}
          rotation={0}
          width={ghostDef.width}
          depth={ghostDef.depth}
          height={ghostDef.height}
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
      <Canvas shadows>
        <SceneContent />
      </Canvas>
    </div>
  );
}
