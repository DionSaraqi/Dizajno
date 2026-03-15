"use client";

import React from "react";
import * as THREE from "three";

interface WallMeshProps {
  start: [number, number];
  end: [number, number];
  thickness: number;
  height: number;
  selected?: boolean;
}

export default function WallMesh({ start, end, thickness, height, selected }: WallMeshProps) {
  const startVec = new THREE.Vector3(start[0], 0, start[1]);
  const endVec = new THREE.Vector3(end[0], 0, end[1]);
  const direction = new THREE.Vector3().subVectors(endVec, startVec);
  const length = direction.length();

  if (length < 0.01) return null;

  const center = new THREE.Vector3().addVectors(startVec, endVec).multiplyScalar(0.5);
  const angle = Math.atan2(direction.z, direction.x);

  return (
    <group>
      {/* Wall body */}
      <mesh
        position={[center.x, height / 2, center.z]}
        rotation={[0, -angle, 0]}
      >
        <boxGeometry args={[length, height, thickness]} />
        <meshStandardMaterial
          color={selected ? "#60A5FA" : "#6B7280"}
          transparent={selected}
          opacity={selected ? 0.8 : 1}
        />
      </mesh>
      {/* Joint at start */}
      <mesh position={[startVec.x, height / 2, startVec.z]}>
        <cylinderGeometry args={[thickness / 2, thickness / 2, height, 12]} />
        <meshStandardMaterial color={selected ? "#60A5FA" : "#6B7280"} />
      </mesh>
      {/* Joint at end */}
      <mesh position={[endVec.x, height / 2, endVec.z]}>
        <cylinderGeometry args={[thickness / 2, thickness / 2, height, 12]} />
        <meshStandardMaterial color={selected ? "#60A5FA" : "#6B7280"} />
      </mesh>
    </group>
  );
}
