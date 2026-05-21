"use client";

/**
 * Measurements — renders blueprint-style distance lines from a selected or
 * ghost furniture item to the nearest walls and other furniture.
 *
 * Only shown in 2D (top-down) mode.
 * Uses plain Three.js BufferGeometry lines + @react-three/drei Text.
 */

import React, { useMemo } from "react";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import type { FurnitureData, WallData } from "@/types/designer";
import { getFurnitureAABBSnap, type AABB } from "@/utils/snapToGrid";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MeasurementLine {
  start: [number, number]; // [x, z]
  end: [number, number];
  label: string;
}

// ── Geometry helpers ──────────────────────────────────────────────────────────

function lineGeometry(x1: number, z1: number, x2: number, z2: number): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([x1, 0.05, z1, x2, 0.05, z2], 3)
  );
  return geo;
}

function midpoint(
  a: [number, number],
  b: [number, number]
): [number, number, number] {
  return [(a[0] + b[0]) / 2, 0.15, (a[1] + b[1]) / 2];
}

// ── Distance calculations ─────────────────────────────────────────────────────

function getWallAABBLocal(wall: WallData): AABB {
  const ht = wall.thickness / 2;
  return {
    minX: Math.min(wall.start[0], wall.end[0]) - ht,
    maxX: Math.max(wall.start[0], wall.end[0]) + ht,
    minZ: Math.min(wall.start[1], wall.end[1]) - ht,
    maxZ: Math.max(wall.start[1], wall.end[1]) + ht,
  };
}

/**
 * Returns up to 4 measurement lines: to nearest walls (top/bottom/left/right)
 * and to nearest furniture items.
 */
function computeMeasurements(
  item: FurnitureData,
  walls: WallData[],
  allFurniture: FurnitureData[]
): MeasurementLine[] {
  const aabb = getFurnitureAABBSnap(item);
  const cx = item.position[0];
  const cz = item.position[1];

  const lines: MeasurementLine[] = [];

  // ── Wall measurements ─────────────────────────────────────────────────────
  // For each axis direction, find the nearest wall face.

  interface WallCandidate {
    dist: number;
    wallEdge: number; // the wall face coordinate
    axis: "x" | "z";
    dir: "pos" | "neg";
  }

  const candidates: WallCandidate[] = [];

  for (const wall of walls) {
    const waabb = getWallAABBLocal(wall);
    const wdx = Math.abs(wall.end[0] - wall.start[0]);
    const wdz = Math.abs(wall.end[1] - wall.start[1]);
    const isHorizontal = wdx >= wdz;

    if (isHorizontal) {
      // Wall runs along X — contributes Z-axis measurements
      if (waabb.maxZ <= aabb.minZ) {
        // Wall is above (in negative Z)
        candidates.push({
          dist: aabb.minZ - waabb.maxZ,
          wallEdge: waabb.maxZ,
          axis: "z",
          dir: "neg",
        });
      } else if (waabb.minZ >= aabb.maxZ) {
        // Wall is below (in positive Z)
        candidates.push({
          dist: waabb.minZ - aabb.maxZ,
          wallEdge: waabb.minZ,
          axis: "z",
          dir: "pos",
        });
      }
    } else {
      // Wall runs along Z — contributes X-axis measurements
      if (waabb.maxX <= aabb.minX) {
        candidates.push({
          dist: aabb.minX - waabb.maxX,
          wallEdge: waabb.maxX,
          axis: "x",
          dir: "neg",
        });
      } else if (waabb.minX >= aabb.maxX) {
        candidates.push({
          dist: waabb.minX - aabb.maxX,
          wallEdge: waabb.minX,
          axis: "x",
          dir: "pos",
        });
      }
    }
  }

  // Pick the closest wall in each of the 4 directions
  const bestWall: Record<string, WallCandidate> = {};
  for (const c of candidates) {
    const key = `${c.axis}-${c.dir}`;
    if (!bestWall[key] || c.dist < bestWall[key].dist) {
      bestWall[key] = c;
    }
  }

  for (const c of Object.values(bestWall)) {
    if (c.axis === "z") {
      const itemEdge = c.dir === "neg" ? aabb.minZ : aabb.maxZ;
      const dist = c.dist;
      if (dist < 0.05) continue;
      lines.push({
        start: [cx, itemEdge],
        end: [cx, c.wallEdge],
        label: `${dist.toFixed(2)}m`,
      });
    } else {
      const itemEdge = c.dir === "neg" ? aabb.minX : aabb.maxX;
      const dist = c.dist;
      if (dist < 0.05) continue;
      lines.push({
        start: [itemEdge, cz],
        end: [c.wallEdge, cz],
        label: `${dist.toFixed(2)}m`,
      });
    }
  }

  // ── Nearest furniture measurements ───────────────────────────────────────
  interface FurnCandidate {
    dist: number;
    itemEdge: number;
    otherEdge: number;
    axis: "x" | "z";
    fixedCoord: number;
  }

  const furnCandidates: FurnCandidate[] = [];

  for (const other of allFurniture) {
    if (other.id === item.id) continue;
    const ob = getFurnitureAABBSnap(other);

    // Right side of item → left side of other
    if (ob.minX >= aabb.maxX) {
      furnCandidates.push({
        dist: ob.minX - aabb.maxX,
        itemEdge: aabb.maxX,
        otherEdge: ob.minX,
        axis: "x",
        fixedCoord: cz,
      });
    }
    // Left side
    if (ob.maxX <= aabb.minX) {
      furnCandidates.push({
        dist: aabb.minX - ob.maxX,
        itemEdge: aabb.minX,
        otherEdge: ob.maxX,
        axis: "x",
        fixedCoord: cz,
      });
    }
    // Bottom
    if (ob.minZ >= aabb.maxZ) {
      furnCandidates.push({
        dist: ob.minZ - aabb.maxZ,
        itemEdge: aabb.maxZ,
        otherEdge: ob.minZ,
        axis: "z",
        fixedCoord: cx,
      });
    }
    // Top
    if (ob.maxZ <= aabb.minZ) {
      furnCandidates.push({
        dist: aabb.minZ - ob.maxZ,
        itemEdge: aabb.minZ,
        otherEdge: ob.maxZ,
        axis: "z",
        fixedCoord: cx,
      });
    }
  }

  // Keep only the 2 closest furniture measurements (avoid clutter)
  furnCandidates.sort((a, b) => a.dist - b.dist);
  const topFurn = furnCandidates.slice(0, 2);

  for (const fc of topFurn) {
    if (fc.dist < 0.05) continue;
    if (fc.axis === "x") {
      lines.push({
        start: [fc.itemEdge, fc.fixedCoord],
        end: [fc.otherEdge, fc.fixedCoord],
        label: `${fc.dist.toFixed(2)}m`,
      });
    } else {
      lines.push({
        start: [fc.fixedCoord, fc.itemEdge],
        end: [fc.fixedCoord, fc.otherEdge],
        label: `${fc.dist.toFixed(2)}m`,
      });
    }
  }

  // Cap at 6 total lines
  return lines.slice(0, 6);
}

// ── Dashed Line ───────────────────────────────────────────────────────────────

interface DashedLineProps {
  start: [number, number];
  end: [number, number];
}

function DashedLine({ start, end }: DashedLineProps) {
  const geo = useMemo(
    () => lineGeometry(start[0], start[1], end[0], end[1]),
    [start, end]
  );

  const mat = useMemo(() => {
    const m = new THREE.LineDashedMaterial({
      color: "#60a5fa", // blue-400
      dashSize: 0.08,
      gapSize: 0.06,
      linewidth: 1,
    });
    return m;
  }, []);

  return (
    <lineSegments geometry={geo} material={mat} onUpdate={(self) => self.computeLineDistances()} />
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface MeasurementsProps {
  /** The item that is selected or being ghost-previewed */
  item: FurnitureData;
  walls: WallData[];
  allFurniture: FurnitureData[];
}

export default function Measurements({ item, walls, allFurniture }: MeasurementsProps) {
  const lines = useMemo(
    () => computeMeasurements(item, walls, allFurniture),
    [item, walls, allFurniture]
  );

  if (lines.length === 0) return null;

  return (
    <group>
      {lines.map((line, i) => {
        const mid = midpoint(line.start, line.end);
        return (
          <group key={i}>
            <DashedLine start={line.start} end={line.end} />
            {/* Small tick marks at each endpoint */}
            <mesh position={[line.start[0], 0.05, line.start[1]]}>
              <sphereGeometry args={[0.025, 6, 6]} />
              <meshBasicMaterial color="#60a5fa" />
            </mesh>
            <mesh position={[line.end[0], 0.05, line.end[1]]}>
              <sphereGeometry args={[0.025, 6, 6]} />
              <meshBasicMaterial color="#60a5fa" />
            </mesh>
            <Text
              position={mid}
              fontSize={0.18}
              color="#93c5fd"
              anchorX="center"
              anchorY="middle"
              rotation={[-Math.PI / 2, 0, 0]}
              outlineWidth={0.02}
              outlineColor="#1e1b4b"
            >
              {line.label}
            </Text>
          </group>
        );
      })}
    </group>
  );
}
