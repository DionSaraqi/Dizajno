"use client";

import React from "react";
import { Grid } from "@react-three/drei";

interface GridPlaneProps {
  gridSize: number;
  onPointerDown?: (e: any) => void;
  onPointerMove?: (e: any) => void;
  onPointerUp?: (e: any) => void;
}

export default function GridPlane({ gridSize, onPointerDown, onPointerMove, onPointerUp }: GridPlaneProps) {
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
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <planeGeometry args={[200, 200]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </>
  );
}
