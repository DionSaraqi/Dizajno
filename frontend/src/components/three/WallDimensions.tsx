"use client";

/**
 * WallDimensions — Planner5D-style persistent dimension annotations for walls,
 * drawn in 2D (top-down) mode. For each wall segment it renders an offset
 * dimension line with arrowheads, perpendicular extension lines, and a length
 * label. It also draws an overall bounding-span tier (total width + total
 * depth) outside everything.
 *
 * The displayed length honors the inner/outer face choice: walls are stored as
 * centerlines, so at a shared corner the outer face is longer by thickness/2
 * and the inner face shorter by thickness/2 (best-effort, shared-endpoint
 * detection — pragmatic for clean layouts, approximate at messy junctions).
 *
 * World-space geometry (lines + drei <Text>), consistent with Measurements.tsx.
 */

import React, { useMemo } from "react";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import type { WallData, FloorData } from "@/types/designer";

// ── Tunables ────────────────────────────────────────────────────────────────
const DIM_GAP = 0.35; // gap beyond the wall face to the per-wall dimension line
const SPAN_GAP = 1.15; // gap beyond the bounding box to the overall-span tier
const ARROW = 0.16; // arrowhead wing length
const ARROW_ANGLE = (28 * Math.PI) / 180;
const EXT_OVERSHOOT = 0.08; // how far the extension line passes the dim line
const CORNER_TOL = 0.06; // shared-endpoint tolerance for corner detection
const Y = 0.05; // render height above the ground plane

const LINE_COLOR = "#64748b"; // slate-500
const LABEL_COLOR = "#334155"; // slate-700
const LABEL_OUTLINE = "#ffffff";

// ── Vector helpers (operating on [x, z] tuples) ───────────────────────────────
type V = [number, number];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1]];
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]];
const mul = (a: V, s: number): V => [a[0] * s, a[1] * s];
const len = (a: V) => Math.hypot(a[0], a[1]);
const norm = (a: V): V => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l];
};
/** Perpendicular (rotate +90° in the XZ plane). */
const perp = (a: V): V => [-a[1], a[0]];
const rot = (a: V, ang: number): V => {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return [a[0] * c - a[1] * s, a[0] * s + a[1] * c];
};
const dist = (a: V, b: V) => len(sub(a, b));

function fmt(v: number): string {
  const r = Math.round(v * 100) / 100;
  if (Number.isInteger(r)) return `${r} m`;
  return `${r.toFixed(2).replace(/0$/, "")} m`;
}

// ── Building a connected polyline geometry from [x,z] points ──────────────────
function polylineGeometry(points: V[]): THREE.BufferGeometry {
  const arr: number[] = [];
  for (const [x, z] of points) arr.push(x, Y, z);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
  return geo;
}

function Seg({ points, color = LINE_COLOR }: { points: V[]; color?: string }) {
  // Render a THREE.Line via <primitive> — the lowercase <line> JSX intrinsic
  // collides with SVG's line element in TS, so we build the object directly.
  const object = useMemo(() => {
    const geo = polylineGeometry(points);
    const mat = new THREE.LineBasicMaterial({ color });
    return new THREE.Line(geo, mat);
  }, [points, color]);
  return <primitive object={object} />;
}

function FlatLabel({ pos, text }: { pos: V; text: string }) {
  return (
    <Text
      position={[pos[0], Y + 0.01, pos[1]]}
      rotation={[-Math.PI / 2, 0, 0]}
      fontSize={0.22}
      color={LABEL_COLOR}
      anchorX="center"
      anchorY="middle"
      outlineWidth={0.025}
      outlineColor={LABEL_OUTLINE}
    >
      {text}
    </Text>
  );
}

/** One full dimension annotation: line a→b with outward arrowheads + label. */
function DimLine({
  a,
  b,
  outward,
  label,
}: {
  a: V;
  b: V;
  outward: V; // unit normal pointing away from the line, for label nudge
  label: string;
}) {
  const u = norm(sub(b, a)); // a → b
  // Arrowheads: tip at each end, wings splayed toward the line interior.
  const aw1 = add(a, mul(rot(u, ARROW_ANGLE), ARROW));
  const aw2 = add(a, mul(rot(u, -ARROW_ANGLE), ARROW));
  const bu: V = [-u[0], -u[1]]; // b → a
  const bw1 = add(b, mul(rot(bu, ARROW_ANGLE), ARROW));
  const bw2 = add(b, mul(rot(bu, -ARROW_ANGLE), ARROW));
  const mid = mul(add(a, b), 0.5);
  const labelPos = add(mid, mul(outward, 0.16));

  return (
    <group>
      <Seg points={[a, b]} />
      <Seg points={[aw1, a, aw2]} />
      <Seg points={[bw1, b, bw2]} />
      <FlatLabel pos={labelPos} text={label} />
    </group>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface WallDimensionsProps {
  walls: WallData[];
  floors: FloorData[];
  face: "inner" | "outer";
}

function interiorRef(walls: WallData[], floors: FloorData[]): V {
  if (floors.length > 0) {
    let sx = 0;
    let sz = 0;
    let n = 0;
    for (const f of floors) {
      for (const [x, z] of f.vertices) {
        sx += x;
        sz += z;
        n++;
      }
    }
    if (n > 0) return [sx / n, sz / n];
  }
  // Fallback: bounding-box center of all wall endpoints.
  const pts = walls.flatMap((w) => [w.start, w.end]);
  if (pts.length === 0) return [0, 0];
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2];
}

export default function WallDimensions({ walls, floors, face }: WallDimensionsProps) {
  const sign = face === "outer" ? 1 : -1;

  const annotations = useMemo(() => {
    if (walls.length === 0) return null;

    const ref = interiorRef(walls, floors);
    const sharesCorner = (pt: V, selfId: string) =>
      walls.some(
        (w) =>
          w.id !== selfId &&
          (dist(pt, w.start) < CORNER_TOL || dist(pt, w.end) < CORNER_TOL)
      );

    const perWall = walls.map((w) => {
      const a = w.start;
      const b = w.end;
      const dir = norm(sub(b, a));
      // Outward normal: pick the perpendicular pointing away from the interior.
      let n = perp(dir);
      const mid = mul(add(a, b), 0.5);
      if (n[0] * (mid[0] - ref[0]) + n[1] * (mid[1] - ref[1]) < 0) n = mul(n, -1);

      const off = w.thickness / 2 + DIM_GAP;
      const da = add(a, mul(n, off));
      const db = add(b, mul(n, off));

      // Extension lines from the wall face to just past the dimension line.
      const faceStart = add(a, mul(n, w.thickness / 2));
      const faceEnd = add(b, mul(n, w.thickness / 2));
      const extA = add(da, mul(n, EXT_OVERSHOOT));
      const extB = add(db, mul(n, EXT_OVERSHOOT));

      // Inner/outer length adjustment at shared corners.
      const c1 = sharesCorner(a, w.id) ? sign * (w.thickness / 2) : 0;
      const c2 = sharesCorner(b, w.id) ? sign * (w.thickness / 2) : 0;
      const displayLen = Math.max(0, len(sub(b, a)) + c1 + c2);

      return { id: w.id, da, db, n, faceStart, faceEnd, extA, extB, label: fmt(displayLen) };
    });

    // Overall bounding-span tier.
    const pts = walls.flatMap((w) => [w.start, w.end]);
    const xs = pts.map((p) => p[0]);
    const zs = pts.map((p) => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minZ = Math.min(...zs);
    const maxZ = Math.max(...zs);

    const widthA: V = [minX, maxZ + SPAN_GAP];
    const widthB: V = [maxX, maxZ + SPAN_GAP];
    const depthA: V = [maxX + SPAN_GAP, minZ];
    const depthB: V = [maxX + SPAN_GAP, maxZ];

    return {
      perWall,
      span: {
        width: { a: widthA, b: widthB, label: fmt(maxX - minX), outward: [0, 1] as V },
        depth: { a: depthA, b: depthB, label: fmt(maxZ - minZ), outward: [1, 0] as V },
        ticks: { minX, maxX, minZ, maxZ },
      },
    };
  }, [walls, floors, sign]);

  if (!annotations) return null;
  const { perWall, span } = annotations;

  return (
    <group>
      {perWall.map((d) => (
        <group key={d.id}>
          {/* extension lines */}
          <Seg points={[d.faceStart, d.extA]} />
          <Seg points={[d.faceEnd, d.extB]} />
          <DimLine a={d.da} b={d.db} outward={d.n} label={d.label} />
        </group>
      ))}

      {/* Overall span tier (total width + total depth) */}
      <Seg points={[[span.ticks.minX, span.ticks.maxZ], span.width.a]} />
      <Seg points={[[span.ticks.maxX, span.ticks.maxZ], span.width.b]} />
      <DimLine a={span.width.a} b={span.width.b} outward={span.width.outward} label={span.width.label} />

      <Seg points={[[span.ticks.maxX, span.ticks.minZ], span.depth.a]} />
      <Seg points={[[span.ticks.maxX, span.ticks.maxZ], span.depth.b]} />
      <DimLine a={span.depth.a} b={span.depth.b} outward={span.depth.outward} label={span.depth.label} />
    </group>
  );
}
