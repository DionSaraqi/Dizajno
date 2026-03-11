import React from "react";

interface Props { width: number; depth: number; height: number; color: string; }

export default function DeskModel({ width, depth, height, color }: Props) {
  const topH = 0.05;
  const legH = height - topH;
  const legW = 0.06;

  return (
    <group>
      {/* Desktop */}
      <mesh position={[0, height - topH / 2, 0]}>
        <boxGeometry args={[width, topH, depth]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Left panel leg */}
      <mesh position={[-width / 2 + legW / 2 + 0.02, legH / 2, 0]}>
        <boxGeometry args={[legW, legH, depth - 0.1]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Right panel leg */}
      <mesh position={[width / 2 - legW / 2 - 0.02, legH / 2, 0]}>
        <boxGeometry args={[legW, legH, depth - 0.1]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}
