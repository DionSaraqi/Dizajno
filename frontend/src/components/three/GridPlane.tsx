"use client";

import React from "react";
import { Grid } from "@react-three/drei";

interface GridPlaneProps {
  gridSize: number;
  // Pointer-DOWN only: starts wall draw, places room corners / furniture, or
  // deselects. Live cursor tracking (previews, ghost) is driven by the per-frame
  // global-pointer raycast in DrawingSurface, NOT by grid move events — so it
  // keeps working over meshes (walls, floors) that stopPropagation.
  onPointerDown?: (e: any) => void;
}

export default function GridPlane({ gridSize, onPointerDown }: GridPlaneProps) {
  return (
    <>
      <Grid
        position={[0, 0.005, 0]}
        args={[100, 100]}
        cellSize={gridSize}
        cellThickness={0.8}
        cellColor="#9CA3AF"
        sectionSize={gridSize * 5}
        sectionThickness={1.2}
        sectionColor="#6B7280"
        fadeDistance={40}
        infiniteGrid
      />

      {/* Invisible raycast plane */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        onPointerDown={onPointerDown}
      >
        <planeGeometry args={[200, 200]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </>
  );
}
