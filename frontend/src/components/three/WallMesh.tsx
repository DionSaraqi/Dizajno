"use client";

import React from "react";
import * as THREE from "three";
import { Edges } from "@react-three/drei";
import type { OpeningData } from "@/types/designer";

interface WallSegment {
  startOffset: number;
  endOffset: number;
  yBottom: number;
  yTop: number;
}

interface WallMeshProps {
  start: [number, number];
  end: [number, number];
  thickness: number;
  height: number;
  selected?: boolean;
  hovered?: boolean;
  openings?: OpeningData[];
  onClick?: (e: any) => void;
  onPointerOver?: (e: any) => void;
  onPointerOut?: (e: any) => void;
  onPointerMove?: (e: any) => void;
}

function computeSegments(
  wallLength: number,
  wallHeight: number,
  openings: OpeningData[]
): WallSegment[] {
  if (openings.length === 0) {
    return [{ startOffset: 0, endOffset: wallLength, yBottom: 0, yTop: wallHeight }];
  }

  const segments: WallSegment[] = [];
  const sorted = [...openings].sort((a, b) => a.offsetFromStart - b.offsetFromStart);
  let cursor = 0;

  for (const op of sorted) {
    const opStart = Math.max(0, op.offsetFromStart);
    const opEnd = Math.min(wallLength, op.offsetFromStart + op.width);
    const lintelBottom = op.sillHeight + op.height;

    // Solid wall to the left of the opening
    if (cursor < opStart) {
      segments.push({ startOffset: cursor, endOffset: opStart, yBottom: 0, yTop: wallHeight });
    }
    // Sill below opening (windows only)
    if (op.sillHeight > 0.001) {
      segments.push({ startOffset: opStart, endOffset: opEnd, yBottom: 0, yTop: op.sillHeight });
    }
    // Lintel above opening
    if (lintelBottom < wallHeight - 0.001) {
      segments.push({ startOffset: opStart, endOffset: opEnd, yBottom: lintelBottom, yTop: wallHeight });
    }

    cursor = opEnd;
  }

  // Remaining solid wall after last opening
  if (cursor < wallLength) {
    segments.push({ startOffset: cursor, endOffset: wallLength, yBottom: 0, yTop: wallHeight });
  }

  return segments;
}

const WALL_COLOR = "#6B7280";

export default function WallMesh({
  start,
  end,
  thickness,
  height,
  selected = false,
  hovered = false,
  openings = [],
  onClick,
  onPointerOver,
  onPointerOut,
  onPointerMove,
}: WallMeshProps) {
  const startVec = new THREE.Vector3(start[0], 0, start[1]);
  const endVec = new THREE.Vector3(end[0], 0, end[1]);
  const direction = new THREE.Vector3().subVectors(endVec, startVec);
  const wallLength = direction.length();

  if (wallLength < 0.01) return null;

  const angle = Math.atan2(direction.z, direction.x);
  const unitDir = direction.clone().normalize();

  const stopAndCall = (handler?: (e: any) => void) => (e: any) => {
    e.stopPropagation();
    handler?.(e);
  };

  const segments = computeSegments(wallLength, height, openings);
  const edgeColor = selected ? "#ffffff" : hovered ? "#00aaff" : null;

  return (
    <group>
      {segments.map((seg, i) => {
        const segLen = seg.endOffset - seg.startOffset;
        const segH = seg.yTop - seg.yBottom;
        if (segLen < 0.001 || segH < 0.001) return null;

        const midOffset = seg.startOffset + segLen / 2;
        const worldCenter = startVec.clone().addScaledVector(unitDir, midOffset);
        const yCenter = seg.yBottom + segH / 2;

        return (
          <mesh
            key={i}
            position={[worldCenter.x, yCenter, worldCenter.z]}
            rotation={[0, -angle, 0]}
            onClick={stopAndCall(onClick)}
            onPointerOver={stopAndCall(onPointerOver)}
            onPointerOut={stopAndCall(onPointerOut)}
            onPointerMove={onPointerMove ? stopAndCall(onPointerMove) : undefined}
          >
            <boxGeometry args={[segLen, segH, thickness]} />
            <meshStandardMaterial color={WALL_COLOR} />
            {edgeColor && <Edges threshold={1} color={edgeColor} />}
          </mesh>
        );
      })}

      {/* Joints at wall endpoints */}
      {[startVec, endVec].map((pt, i) => (
        <mesh
          key={`joint-${i}`}
          position={[pt.x, height / 2, pt.z]}
          onClick={stopAndCall(onClick)}
          onPointerOver={stopAndCall(onPointerOver)}
          onPointerOut={stopAndCall(onPointerOut)}
        >
          <cylinderGeometry args={[thickness / 2, thickness / 2, height, 12]} />
          <meshStandardMaterial color={WALL_COLOR} />
          {edgeColor && <Edges threshold={1} color={edgeColor} />}
        </mesh>
      ))}
    </group>
  );
}
