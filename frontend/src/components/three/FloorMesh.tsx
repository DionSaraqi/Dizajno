"use client";

import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { Edges } from "@react-three/drei";
import { useMaterialTexture } from "@/hooks/useMaterialTexture";

interface FloorMeshProps {
  vertices: [number, number][];
  /** Phase 6.5: optional variant id. When set, skin the floor with the variant's texture/color. */
  flooringVariantId?: string | null;
  selected?: boolean;
  hovered?: boolean;
  onClick?: (e: any) => void;
  onPointerOver?: (e: any) => void;
  onPointerOut?: (e: any) => void;
}

const DEFAULT_FLOOR_COLOR = "#e8dcc8";
/** Each plank/tile texture tile covers ~1 m². Adjust if textures look too small/large. */
const TEXTURE_REPEAT_PER_METER = 1;

export default function FloorMesh({
  vertices,
  flooringVariantId,
  selected = false,
  hovered = false,
  onClick,
  onPointerOver,
  onPointerOut,
}: FloorMeshProps) {
  const { geometry, sizeX, sizeZ } = useMemo(() => {
    if (vertices.length < 3) return { geometry: null, sizeX: 0, sizeZ: 0 };

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

    // ShapeGeometry's default UVs come from the X/Y of the 2D shape, which
    // post-rotation are X/Z. Compute the polygon's bounding box so we can
    // normalise UVs to (0..1) and then scale by TEXTURE_REPEAT_PER_METER × size.
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [x, z] of vertices) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    const w = Math.max(maxX - minX, 0.001);
    const h = Math.max(maxZ - minZ, 0.001);

    const uvAttr = geo.attributes.uv;
    const posAttr = geo.attributes.position;
    if (uvAttr && posAttr) {
      for (let i = 0; i < uvAttr.count; i++) {
        const x = posAttr.getX(i);
        const z = posAttr.getZ(i);
        uvAttr.setXY(i, (x - minX) / w, (z - minZ) / h);
      }
      uvAttr.needsUpdate = true;
    }

    return { geometry: geo, sizeX: w, sizeZ: h };
  }, [vertices]);

  const { map, color, fallbackOnly } = useMaterialTexture(flooringVariantId ?? null);

  // Configure tile repeats so a 4×5 m floor shows ~4×5 tiles, not stretched.
  useEffect(() => {
    if (!map) return;
    const repeatU = Math.max(1, sizeX * TEXTURE_REPEAT_PER_METER);
    const repeatV = Math.max(1, sizeZ * TEXTURE_REPEAT_PER_METER);
    map.repeat.set(repeatU, repeatV);
  }, [map, sizeX, sizeZ]);

  if (!geometry) return null;

  const stopAndCall = (handler?: (e: any) => void) => (e: any) => {
    e.stopPropagation();
    handler?.(e);
  };

  // When a variant is assigned but the texture is missing/loading, tint with
  // the variant's color so the floor visibly differs from a bare floor.
  const surfaceColor = map ? "#ffffff" : color ?? DEFAULT_FLOOR_COLOR;
  // Subtle visual hint that a variant is assigned without a usable texture file.
  void fallbackOnly;

  const edgeColor = selected ? "#ffffff" : hovered ? "#00aaff" : null;

  return (
    <mesh
      geometry={geometry}
      position={[0, 0.02, 0]}
      renderOrder={1}
      onClick={stopAndCall(onClick)}
      onPointerOver={stopAndCall(onPointerOver)}
      onPointerOut={stopAndCall(onPointerOut)}
    >
      <meshStandardMaterial
        color={surfaceColor}
        map={map ?? null}
        side={THREE.DoubleSide}
        polygonOffset
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-1}
      />
      {edgeColor && <Edges threshold={1} color={edgeColor} />}
    </mesh>
  );
}
