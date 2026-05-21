"use client";

import React, { useMemo } from "react";
import * as THREE from "three";

interface FloorMeshProps {
  vertices: [number, number][];
}

export default function FloorMesh({ vertices }: FloorMeshProps) {
  const geometry = useMemo(() => {
    if (vertices.length < 3) return null;

    const shape = new THREE.Shape();
    // Negate Z when mapping to Shape's Y axis, because rotateX(-PI/2)
    // maps (x, y, 0) → (x, 0, -y). Negating here cancels it out.
    shape.moveTo(vertices[0][0], -vertices[0][1]);
    for (let i = 1; i < vertices.length; i++) {
      shape.lineTo(vertices[i][0], -vertices[i][1]);
    }
    shape.closePath();

    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, [vertices]);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry} position={[0, 0.02, 0]} renderOrder={1}>
      <meshStandardMaterial
        color="#e8dcc8"
        side={THREE.DoubleSide}
        polygonOffset
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-1}
      />
    </mesh>
  );
}
