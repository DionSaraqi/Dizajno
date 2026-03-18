import React from "react";

interface Props { width: number; depth: number; height: number; color: string; opacity?: number; }

export default function SofaModel({ width, depth, height, color, opacity = 1 }: Props) {
  const baseH = height * 0.45;
  const backH = height * 0.55;
  const armW = 0.12;
  const cushionH = height * 0.3;
  const transparent = opacity < 1;

  return (
    <group>
      {/* Base / seat */}
      <mesh position={[0, baseH / 2, 0]}>
        <boxGeometry args={[width, baseH, depth]} />
        <meshStandardMaterial color={color} transparent={transparent} opacity={opacity} />
      </mesh>
      {/* Back cushion */}
      <mesh position={[0, baseH + backH / 2, -depth / 2 + 0.08]}>
        <boxGeometry args={[width - armW * 2, backH, 0.15]} />
        <meshStandardMaterial color={color} transparent={transparent} opacity={opacity} />
      </mesh>
      {/* Left arm */}
      <mesh position={[-width / 2 + armW / 2, baseH / 2 + cushionH / 2, 0]}>
        <boxGeometry args={[armW, baseH + cushionH, depth]} />
        <meshStandardMaterial color={color} transparent={transparent} opacity={opacity} />
      </mesh>
      {/* Right arm */}
      <mesh position={[width / 2 - armW / 2, baseH / 2 + cushionH / 2, 0]}>
        <boxGeometry args={[armW, baseH + cushionH, depth]} />
        <meshStandardMaterial color={color} transparent={transparent} opacity={opacity} />
      </mesh>
      {/* Seat cushion */}
      <mesh position={[0, baseH + 0.04, 0.04]}>
        <boxGeometry args={[width - armW * 2 - 0.04, 0.08, depth - 0.2]} />
        <meshStandardMaterial color="#D4D4D4" transparent={transparent} opacity={opacity} />
      </mesh>
    </group>
  );
}
