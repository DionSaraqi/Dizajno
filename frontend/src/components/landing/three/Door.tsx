"use client";

import React, { forwardRef, useState, useCallback } from "react";
import { Group } from "three";
import { Edges } from "@react-three/drei";
import SketchMaterial from "@/components/landing/three/SketchMaterial";

const OPACITY = 0.95;
const EDGE_COLOR = "#d0d0d0";

type DoorProps = {
  onClick?: () => void;
};

// The front wall opening is at world position:
//   x: -0.5 to 0.5 (1m wide)
//   y: -1 to 0.75  (1.75m tall, room floor at y=-1 in room space, room at z=5 offset)
//   z: 8  (front wall z=3 in room space + room position z=5)
//
// The door group pivots at its left edge (hinge).
// Group position x=0.5 puts the hinge at x=0.5 (right side of opening).
// Door mesh offset [-1, 0, 0] fills from x=-0.5 to x=0.5.
// Group y=-0.125 centers a 1.75-tall door so it spans y=-1 to y=0.75.

const Door = forwardRef<Group, DoorProps>(({ onClick }, ref) => {
  const [hovered, setHovered] = useState(false);

  const handlePointerOver = useCallback(() => {
    setHovered(true);
    document.body.style.cursor = "pointer";
  }, []);

  const handlePointerOut = useCallback(() => {
    setHovered(false);
    document.body.style.cursor = "auto";
  }, []);

  return (
    <group
      ref={ref as any}
      position={[0.5, -0.125, 8]}
      onClick={onClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      {/* Door panel — offset so hinge is at the group origin (right side of opening) */}
      <mesh position={[-0.5, 0, 0]}>
        <boxGeometry args={[1, 1.75, 0.05]} />
        <SketchMaterial
          baseColor={hovered ? "#5B9DFF" : "#3B7DDD"}
          opacity={OPACITY}
          transparent
          rim={false}
          grain={false}
          jitter={false}
        />
        <Edges threshold={15} color={EDGE_COLOR} />
      </mesh>

      {/* Door handle */}
      <mesh position={[-0.15, -0.05, 0.06]}>
        <boxGeometry args={[0.06, 0.1, 0.04]} />
        <SketchMaterial baseColor="#888888" opacity={OPACITY} transparent rim={false} jitter={false} />
      </mesh>
    </group>
  );
});

Door.displayName = "Door";

export default Door;
