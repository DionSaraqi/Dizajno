"use client";

/**
 * RoomLabels — Planner5D-style centered room labels: prints the floor area
 * (`Room (24.980 m²)`) at the centroid of each detected floor polygon.
 *
 * Only shown in 2D (top-down) mode. Pure read-only overlay — reuses the
 * existing `polygonArea` shoelace helper from utils/areaCalc.
 */

import React from "react";
import { Html } from "@react-three/drei";
import type { FloorData } from "@/types/designer";
import { polygonArea } from "@/utils/areaCalc";

/**
 * Area-weighted polygon centroid. Falls back to the vertex average for
 * degenerate (near-zero-area) polygons.
 */
function polygonCentroid(
  vertices: ReadonlyArray<readonly [number, number]>
): [number, number] {
  const n = vertices.length;
  if (n === 0) return [0, 0];
  if (n < 3) {
    const avg = vertices.reduce(
      (acc, [x, z]) => [acc[0] + x, acc[1] + z] as [number, number],
      [0, 0] as [number, number]
    );
    return [avg[0] / n, avg[1] / n];
  }

  let signedArea = 0;
  let cx = 0;
  let cz = 0;
  for (let i = 0; i < n; i++) {
    const [x1, z1] = vertices[i];
    const [x2, z2] = vertices[(i + 1) % n];
    const cross = x1 * z2 - x2 * z1;
    signedArea += cross;
    cx += (x1 + x2) * cross;
    cz += (z1 + z2) * cross;
  }
  signedArea *= 0.5;

  if (Math.abs(signedArea) < 1e-6) {
    const avg = vertices.reduce(
      (acc, [x, z]) => [acc[0] + x, acc[1] + z] as [number, number],
      [0, 0] as [number, number]
    );
    return [avg[0] / n, avg[1] / n];
  }

  return [cx / (6 * signedArea), cz / (6 * signedArea)];
}

interface RoomLabelsProps {
  floors: FloorData[];
}

export default function RoomLabels({ floors }: RoomLabelsProps) {
  if (floors.length === 0) return null;

  return (
    <group>
      {floors.map((floor) => {
        const area = polygonArea(floor.vertices);
        if (area < 0.01) return null;
        const [cx, cz] = polygonCentroid(floor.vertices);
        return (
          <Html
            key={floor.id}
            position={[cx, 0.05, cz]}
            center
            zIndexRange={[10, 0]}
            style={{ pointerEvents: "none", userSelect: "none" }}
          >
            <div className="px-2 py-0.5 rounded bg-white/80 text-[11px] font-medium text-slate-600 whitespace-nowrap shadow-sm">
              Room ({area.toFixed(2)} m²)
            </div>
          </Html>
        );
      })}
    </group>
  );
}
