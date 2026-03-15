import React from "react";

interface Props { width: number; depth: number; height: number; color: string; }

export default function ChairModel({ width, depth, height, color }: Props) {
  const seatH = height * 0.5;
  const seatThick = 0.05;
  const legR = 0.025;
  const backH = height - seatH;
  const lx = width / 2 - 0.06;
  const lz = depth / 2 - 0.06;

  return (
    <group>
      {/* Seat */}
      <mesh position={[0, seatH, 0]}>
        <boxGeometry args={[width, seatThick, depth]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Back */}
      <mesh position={[0, seatH + backH / 2, -depth / 2 + 0.03]}>
        <boxGeometry args={[width, backH, 0.04]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* 4 legs */}
      {[[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]].map(([x, z], i) => (
        <mesh key={i} position={[x, seatH / 2, z]}>
          <cylinderGeometry args={[legR, legR, seatH, 8]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
    </group>
  );
}
