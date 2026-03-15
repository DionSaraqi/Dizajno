import React from "react";

interface Props { width: number; depth: number; height: number; color: string; }

export default function BookshelfModel({ width, depth, height, color }: Props) {
  const shelfCount = 4;
  const thickness = 0.03;
  const sideW = 0.04;

  return (
    <group>
      {/* Left side */}
      <mesh position={[-width / 2 + sideW / 2, height / 2, 0]}>
        <boxGeometry args={[sideW, height, depth]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Right side */}
      <mesh position={[width / 2 - sideW / 2, height / 2, 0]}>
        <boxGeometry args={[sideW, height, depth]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Back */}
      <mesh position={[0, height / 2, -depth / 2 + 0.01]}>
        <boxGeometry args={[width - sideW * 2, height, 0.02]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Shelves */}
      {Array.from({ length: shelfCount + 1 }).map((_, i) => (
        <mesh key={i} position={[0, (i * height) / shelfCount, 0]}>
          <boxGeometry args={[width - sideW * 2, thickness, depth]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
    </group>
  );
}
