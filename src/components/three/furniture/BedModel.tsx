import React from "react";

interface Props { width: number; depth: number; height: number; color: string; opacity?: number; }

export default function BedModel({ width, depth, height, color, opacity = 1 }: Props) {
  const frameH = height * 0.4;
  const mattressH = height * 0.5;
  const pillowH = height * 0.2;
  const transparent = opacity < 1;

  return (
    <group>
      {/* Frame */}
      <mesh position={[0, frameH / 2, 0]}>
        <boxGeometry args={[width, frameH, depth]} />
        <meshStandardMaterial color={color} transparent={transparent} opacity={opacity} />
      </mesh>
      {/* Mattress */}
      <mesh position={[0, frameH + mattressH / 2, 0]}>
        <boxGeometry args={[width - 0.05, mattressH, depth - 0.05]} />
        <meshStandardMaterial color="#F5F5DC" transparent={transparent} opacity={opacity} />
      </mesh>
      {/* Pillow */}
      <mesh position={[0, frameH + mattressH + pillowH / 2, -depth * 0.35]}>
        <boxGeometry args={[width * 0.7, pillowH, depth * 0.2]} />
        <meshStandardMaterial color="#FFFFFF" transparent={transparent} opacity={opacity} />
      </mesh>
    </group>
  );
}
