import React from "react";

interface Props { width: number; depth: number; height: number; color: string; opacity?: number; }

export default function TableModel({ width, depth, height, color, opacity = 1 }: Props) {
  const topH = 0.05;
  const legR = 0.03;
  const legH = height - topH;
  const lx = width / 2 - 0.08;
  const lz = depth / 2 - 0.08;
  const transparent = opacity < 1;

  return (
    <group>
      {/* Tabletop */}
      <mesh position={[0, height - topH / 2, 0]}>
        <boxGeometry args={[width, topH, depth]} />
        <meshStandardMaterial color={color} transparent={transparent} opacity={opacity} />
      </mesh>
      {/* 4 legs */}
      {[[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]].map(([x, z], i) => (
        <mesh key={i} position={[x, legH / 2, z]}>
          <cylinderGeometry args={[legR, legR, legH, 8]} />
          <meshStandardMaterial color={color} transparent={transparent} opacity={opacity} />
        </mesh>
      ))}
    </group>
  );
}
