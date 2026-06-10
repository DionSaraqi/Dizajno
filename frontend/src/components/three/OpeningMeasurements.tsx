"use client";

/**
 * OpeningMeasurements — live dimension lines for a door/window along its host
 * wall, shown in 2D mode during placement, drag, and selection. Mirrors the
 * furniture `Measurements` visual style (dashed blue lines, endpoint ticks,
 * flat meter labels), but the math is 1D: distances run along the wall axis
 * from the opening's edges to the wall ends or the nearest sibling opening.
 */

import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";
import type { OpeningData, WallData } from "@/types/designer";

const LINE_COLOR = "#60a5fa"; // blue-400 (same as Measurements)
const LABEL_COLOR = "#93c5fd"; // blue-300
const LINE_Y = 0.05;
const LABEL_Y = 0.15;
/** Lateral clearance between the wall face and the distance lines. */
const SIDE_GAP = 0.35;
const MIN_SEGMENT = 0.05;

interface Seg {
  /** Scalar interval along the wall (meters from wall start). */
  from: number;
  to: number;
  /** Lateral offset from the wall centerline (signed, meters). */
  lateral: number;
}

function DashedSeg({ p1, p2 }: { p1: [number, number]; p2: [number, number] }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([p1[0], LINE_Y, p1[1], p2[0], LINE_Y, p2[1]], 3)
    );
    return g;
  }, [p1, p2]);

  const mat = useMemo(
    () => new THREE.LineDashedMaterial({ color: LINE_COLOR, dashSize: 0.08, gapSize: 0.06 }),
    []
  );

  // R3F doesn't dispose swapped geometry props — these change every drag frame.
  useEffect(() => () => geo.dispose(), [geo]);
  useEffect(() => () => mat.dispose(), [mat]);

  return (
    <lineSegments geometry={geo} material={mat} onUpdate={(self) => self.computeLineDistances()} />
  );
}

interface OpeningMeasurementsProps {
  opening: Pick<OpeningData, "offsetFromStart" | "width">;
  wall: WallData;
  /** Other openings on the same wall (the measured one excluded). */
  siblings: Pick<OpeningData, "offsetFromStart" | "width">[];
}

export default function OpeningMeasurements({ opening, wall, siblings }: OpeningMeasurementsProps) {
  const dx = wall.end[0] - wall.start[0];
  const dz = wall.end[1] - wall.start[1];
  const wallLen = Math.hypot(dx, dz);
  if (wallLen < 0.01) return null;

  const ux = dx / wallLen;
  const uz = dz / wallLen;
  // Local +Z of the opening group (the door-swing side) is (-uz, ux).
  const px = -uz;
  const pz = ux;

  const a = opening.offsetFromStart;
  const b = opening.offsetFromStart + opening.width;

  // Nearest boundary on each side: a sibling edge, else the wall end.
  let leftBound = 0;
  let rightBound = wallLen;
  for (const s of siblings) {
    const sEnd = s.offsetFromStart + s.width;
    if (sEnd <= a + 1e-6) leftBound = Math.max(leftBound, sEnd);
    if (s.offsetFromStart >= b - 1e-6) rightBound = Math.min(rightBound, s.offsetFromStart);
  }

  const sideLateral = -(wall.thickness / 2 + SIDE_GAP);
  const widthLateral = wall.thickness / 2 + SIDE_GAP;

  const segs: Seg[] = [];
  if (a - leftBound >= MIN_SEGMENT) segs.push({ from: leftBound, to: a, lateral: sideLateral });
  if (rightBound - b >= MIN_SEGMENT) segs.push({ from: b, to: rightBound, lateral: sideLateral });
  segs.push({ from: a, to: b, lateral: widthLateral });

  const toWorld = (s: number, lateral: number): [number, number] => [
    wall.start[0] + ux * s + px * lateral,
    wall.start[1] + uz * s + pz * lateral,
  ];

  return (
    <group>
      {segs.map((seg, i) => {
        const p1 = toWorld(seg.from, seg.lateral);
        const p2 = toWorld(seg.to, seg.lateral);
        const mid: [number, number, number] = [
          (p1[0] + p2[0]) / 2,
          LABEL_Y,
          (p1[1] + p2[1]) / 2,
        ];
        return (
          <group key={i}>
            <DashedSeg p1={p1} p2={p2} />
            <mesh position={[p1[0], LINE_Y, p1[1]]}>
              <sphereGeometry args={[0.025, 6, 6]} />
              <meshBasicMaterial color={LINE_COLOR} />
            </mesh>
            <mesh position={[p2[0], LINE_Y, p2[1]]}>
              <sphereGeometry args={[0.025, 6, 6]} />
              <meshBasicMaterial color={LINE_COLOR} />
            </mesh>
            <Text
              position={mid}
              fontSize={0.18}
              color={LABEL_COLOR}
              anchorX="center"
              anchorY="middle"
              rotation={[-Math.PI / 2, 0, 0]}
              outlineWidth={0.02}
              outlineColor="#1e1b4b"
            >
              {`${(seg.to - seg.from).toFixed(2)}m`}
            </Text>
          </group>
        );
      })}
    </group>
  );
}
