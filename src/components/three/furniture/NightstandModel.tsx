import React from "react";

interface Props { width: number; depth: number; height: number; color: string; }

export default function NightstandModel({ width, depth, height, color }: Props) {
  const topH = 0.04;
  const legH = height * 0.2;
  const legR = 0.025;
  const bodyH = height - topH - legH;
  const lx = width / 2 - 0.05;
  const lz = depth / 2 - 0.05;

  return (
    <group>
      {/* Body */}
      <mesh position={[0, legH + bodyH / 2, 0]}>
        <boxGeometry args={[width, bodyH, depth]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Top */}
      <mesh position={[0, height - topH / 2, 0]}>
        <boxGeometry args={[width + 0.04, topH, depth + 0.04]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Drawer handle */}
      <mesh position={[0, legH + bodyH / 2, depth / 2 + 0.015]}>
        <boxGeometry args={[width * 0.3, 0.02, 0.02]} />
        <meshStandardMaterial color="#C0C0C0" />
      </mesh>
      {/* Legs */}
      {[[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]].map(([x, z], i) => (
        <mesh key={i} position={[x, legH / 2, z]}>
          <cylinderGeometry args={[legR, legR, legH, 8]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
    </group>
  );
}
