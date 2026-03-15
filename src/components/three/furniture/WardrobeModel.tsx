import React from "react";

interface Props { width: number; depth: number; height: number; color: string; }

export default function WardrobeModel({ width, depth, height, color }: Props) {
  return (
    <group>
      {/* Main body */}
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Door split line */}
      <mesh position={[0, height / 2, depth / 2 + 0.001]}>
        <planeGeometry args={[0.01, height - 0.1]} />
        <meshBasicMaterial color="#000" />
      </mesh>
      {/* Left handle */}
      <mesh position={[-0.06, height / 2, depth / 2 + 0.02]}>
        <boxGeometry args={[0.02, 0.12, 0.02]} />
        <meshStandardMaterial color="#C0C0C0" />
      </mesh>
      {/* Right handle */}
      <mesh position={[0.06, height / 2, depth / 2 + 0.02]}>
        <boxGeometry args={[0.02, 0.12, 0.02]} />
        <meshStandardMaterial color="#C0C0C0" />
      </mesh>
    </group>
  );
}
