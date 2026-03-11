"use client";

import React, { useState, useCallback, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useDesignerState, useDesignerDispatch } from "@/components/designer/DesignerProvider";
import GridPlane from "./GridPlane";
import CameraController from "./CameraController";
import WallMesh from "./WallMesh";
import FloorMesh from "./FloorMesh";
import FurnitureItem3D from "./FurnitureItem3D";
import { snapPoint } from "@/utils/snapToGrid";
import { findFloors } from "@/utils/wallGraph";
import { getFurnitureDef } from "@/utils/furnitureCatalog";
import { checkFurnitureCollision } from "@/utils/collision";

function SceneContent() {
  const state = useDesignerState();
  const dispatch = useDesignerDispatch();

  const [previewEnd, setPreviewEnd] = useState(null);
  const drawingRef = useRef(false);
  const drawStartRef = useRef(null);

  const getSnappedPoint = useCallback(
    (e) => {
      const point = e.point;
      if (!point) return null;
      if (state.snap) {
        return snapPoint(point.x, point.z, state.gridSize);
      }
      return [point.x, point.z];
    },
    [state.snap, state.gridSize]
  );

  const finishWall = useCallback(
    (endPoint) => {
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
          thickness: state.wallThickness,
          height: state.wallHeight,
        };
        dispatch({ type: "ADD_WALL", wall });

        const newWalls = [...state.walls, wall];
        const floors = findFloors(newWalls);
        if (floors.length > 0) {
          dispatch({ type: "SET_FLOORS", floors });
        }
      }
    },
    [state.walls, state.wallThickness, state.wallHeight, dispatch]
  );

  const handlePointerDown = useCallback(
    (e) => {
      // Left-click-hold to draw walls
      if (e.button === 0 && state.mode === "draw") {
        e.stopPropagation();
        const point = getSnappedPoint(e);
        if (!point) return;

        drawingRef.current = true;
        drawStartRef.current = point;
        dispatch({ type: "SET_DRAWING_FROM", point });
        setPreviewEnd(point);
        return;
      }

      // Left-click for furniture placement
      if (e.button === 0 && state.mode === "furniture" && state.activeFurnitureType) {
        e.stopPropagation();
        const point = getSnappedPoint(e);
        if (!point) return;

        const def = getFurnitureDef(state.activeFurnitureType);
        if (!def) return;

        const newItem = {
          id: `furn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: def.type,
          position: point,
          rotation: 0,
          width: def.width,
          depth: def.depth,
          height: def.height,
          color: def.color,
        };

        if (!checkFurnitureCollision(newItem, state.furniture, state.walls)) {
          dispatch({ type: "PLACE_FURNITURE", item: newItem });
        }
        return;
      }

      // Left-click deselect in select mode
      if (e.button === 0 && state.mode === "select") {
        dispatch({ type: "SELECT", id: null });
      }
    },
    [state, dispatch, getSnappedPoint]
  );

  const handlePointerMove = useCallback(
    (e) => {
      if (drawingRef.current && state.mode === "draw") {
        const point = getSnappedPoint(e);
        if (point) setPreviewEnd(point);
      }
    },
    [state.mode, getSnappedPoint]
  );

  const handlePointerUp = useCallback(
    (e) => {
      if (e.button === 0 && drawingRef.current && state.mode === "draw") {
        const point = getSnappedPoint(e);
        if (point) {
          finishWall(point);
        }
        drawingRef.current = false;
        drawStartRef.current = null;
        dispatch({ type: "SET_DRAWING_FROM", point: null });
        setPreviewEnd(null);
      }
    },
    [state.mode, getSnappedPoint, finishWall, dispatch]
  );

  // Calculate preview wall measurement
  let previewLength = 0;
  let previewCenter = null;
  if (drawingRef.current && state.drawingFrom && previewEnd) {
    const dx = previewEnd[0] - state.drawingFrom[0];
    const dz = previewEnd[1] - state.drawingFrom[1];
    previewLength = Math.sqrt(dx * dx + dz * dz);
    previewCenter = [
      (state.drawingFrom[0] + previewEnd[0]) / 2,
      (state.drawingFrom[1] + previewEnd[1]) / 2,
    ];
  }

  return (
    <>
      <color attach="background" args={["#1a1a2e"]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 15, 10]} intensity={0.8} castShadow />
      <directionalLight position={[-5, 10, -5]} intensity={0.3} />

      <CameraController is3D={state.is3D} drawingMode={state.mode === "draw"} />

      <GridPlane
        gridSize={state.gridSize}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />

      {/* Rendered walls */}
      {state.walls.map((wall) => (
        <WallMesh
          key={wall.id}
          start={wall.start}
          end={wall.end}
          thickness={wall.thickness}
          height={state.is3D ? wall.height : 0.15}
        />
      ))}

      {/* Preview wall being drawn */}
      {drawingRef.current && state.drawingFrom && previewEnd && (
        <>
          <WallMesh
            start={state.drawingFrom}
            end={previewEnd}
            thickness={state.wallThickness}
            height={state.is3D ? state.wallHeight : 0.15}
            selected
          />
          {previewLength > 0.05 && previewCenter && (
            <Html position={[previewCenter[0], 1.5, previewCenter[1]]} center>
              <div className="bg-blue-600 text-white px-2 py-0.5 rounded text-xs whitespace-nowrap font-mono shadow-lg">
                {previewLength.toFixed(2)}m
              </div>
            </Html>
          )}
        </>
      )}

      {/* Floors */}
      {state.floors.map((floor) => (
        <FloorMesh key={floor.id} vertices={floor.vertices} />
      ))}

      {/* Furniture */}
      {state.furniture.map((item) => (
        <FurnitureItem3D key={item.id} item={item} />
      ))}

      {/* Start point indicator */}
      {drawingRef.current && state.drawingFrom && (
        <mesh position={[state.drawingFrom[0], 0.05, state.drawingFrom[1]]}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshBasicMaterial color="#3B82F6" />
        </mesh>
      )}
    </>
  );
}

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
