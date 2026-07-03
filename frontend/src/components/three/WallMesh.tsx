"use client";

import React, { useEffect } from "react";
import * as THREE from "three";
import { Edges } from "@react-three/drei";
import { useMaterialTexture } from "@/hooks/useMaterialTexture";
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
  /** Live wall-drag preview state — indigo edges while dragging. */
  dragging?: boolean;
  /** Drag hit a clamp limit (min room span / furniture) — red edges. */
  clamped?: boolean;
  openings?: OpeningData[];
  /** Phase 6.5: optional Paint variant id. When set, walls tint with the variant's color. */
  paintVariantId?: string | null;
  /**
   * Render the invisible widened hit proxy (2D only). In 3D the proxy would
   * sit in front of door/window hit areas across the full wall — including
   * the opening gaps — and steal their hover/click.
   */
  hitProxy?: boolean;
  onClick?: (e: any) => void;
  onPointerOver?: (e: any) => void;
  onPointerOut?: (e: any) => void;
  onPointerMove?: (e: any) => void;
  /**
   * Forwarded RAW (no automatic stopPropagation): the wall-drag handler must
   * decide mode-dependently whether to swallow the event — in draw mode a
   * pointerdown over a wall still has to reach GridPlane to start a new wall.
   */
  onPointerDown?: (e: any) => void;
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
    // Sill below opening (windows only). Clamped to the rendered wall height —
    // in 2D walls are squashed to 0.15 and an unclamped 0.9 sill would tower.
    if (op.sillHeight > 0.001) {
      segments.push({
        startOffset: opStart,
        endOffset: opEnd,
        yBottom: 0,
        yTop: Math.min(op.sillHeight, wallHeight),
      });
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
/** Paint tiles ~0.5× per meter (subtle finish, not as visible as flooring planks). */
const PAINT_TEXTURE_REPEAT_PER_METER = 0.5;

export default function WallMesh({
  start,
  end,
  thickness,
  height,
  selected = false,
  hovered = false,
  dragging = false,
  clamped = false,
  openings = [],
  paintVariantId,
  hitProxy = false,
  onClick,
  onPointerOver,
  onPointerOut,
  onPointerMove,
  onPointerDown,
}: WallMeshProps) {
  const startVec = new THREE.Vector3(start[0], 0, start[1]);
  const endVec = new THREE.Vector3(end[0], 0, end[1]);
  const direction = new THREE.Vector3().subVectors(endVec, startVec);
  const wallLength = direction.length();

  const paint = useMaterialTexture(paintVariantId ?? null);
  // Set sensible texture tiling once per wall (varies by length × height).
  useEffect(() => {
    if (!paint.map) return;
    paint.map.repeat.set(
      Math.max(1, wallLength * PAINT_TEXTURE_REPEAT_PER_METER),
      Math.max(1, height * PAINT_TEXTURE_REPEAT_PER_METER)
    );
  }, [paint.map, wallLength, height]);

  if (wallLength < 0.01) return null;

  const angle = Math.atan2(direction.z, direction.x);
  const unitDir = direction.clone().normalize();

  const stopAndCall = (handler?: (e: any) => void) => (e: any) => {
    e.stopPropagation();
    handler?.(e);
  };

  const segments = computeSegments(wallLength, height, openings);
  const edgeColor = clamped
    ? "#EF4444"
    : dragging
      ? "#6366f1"
      : selected
        ? "#ffffff"
        : hovered
          ? "#00aaff"
          : null;
  const wallSurfaceColor = paint.map ? "#ffffff" : paint.color ?? WALL_COLOR;

  // Effective grab width for the drag/select hit proxy below. A default wall
  // is 0.15 m ≈ 5 px at the default 2D zoom — far below comfortable pointer
  // target size — so an invisible proxy widens the hit area around the wall.
  const hitWidth = Math.max(thickness, 0.35);
  const wallCenter = startVec.clone().addScaledVector(unitDir, wallLength / 2);

  return (
    <group>
      {/* Invisible raycast-only hit proxy (GridPlane pattern): widens the
          pointer target for the whole wall without changing its visual. */}
      {hitProxy && (
        <mesh
          position={[wallCenter.x, height / 2, wallCenter.z]}
          rotation={[0, -angle, 0]}
          visible={false}
          onClick={stopAndCall(onClick)}
          onPointerOver={stopAndCall(onPointerOver)}
          onPointerOut={stopAndCall(onPointerOut)}
          onPointerMove={onPointerMove ? stopAndCall(onPointerMove) : undefined}
          onPointerDown={onPointerDown}
        >
          <boxGeometry args={[wallLength, height, hitWidth]} />
        </mesh>
      )}

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
            onPointerDown={onPointerDown}
          >
            <boxGeometry args={[segLen, segH, thickness]} />
            {/* key remounts the material when the paint map appears/disappears —
                same shader-staleness fix as FloorMesh. */}
            <meshStandardMaterial
              key={paint.map ? "textured" : "flat"}
              color={wallSurfaceColor}
              map={paint.map ?? null}
            />
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
          <meshStandardMaterial color={paint.color ?? WALL_COLOR} />
          {edgeColor && <Edges threshold={1} color={edgeColor} />}
        </mesh>
      ))}
    </group>
  );
}
