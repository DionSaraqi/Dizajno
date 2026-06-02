"use client";

/**
 * WallDimensions — Planner5D-style wall dimension annotations, drawn in 2D
 * (top-down) mode. For every wall it always shows ONE clean number: the inner
 * clear distance between the two facing walls (the usable room dimension along
 * that wall). When a wall is hovered it additionally shows the full wall length
 * — the inner span plus the thickness of the perpendicular walls at each end —
 * as a second, highlighted dimension stacked further out.
 *
 * Inner vs outer is computed from the *adjacent perpendicular* walls' thickness
 * at each shared corner (shared-endpoint detection, ignoring collinear splits).
 * World-space geometry (lines + drei <Text>), consistent with Measurements.tsx.
 */

import React, { useMemo } from "react";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import type { WallData, FloorData } from "@/types/designer";

// ── Tunables ────────────────────────────────────────────────────────────────
const DIM_GAP = 0.35; // gap beyond the wall face to the inner dimension line
const TIER_GAP = 0.5; // extra offset for the outer (hover) dimension line
const ARROW = 0.16; // arrowhead wing length
const ARROW_ANGLE = (28 * Math.PI) / 180;
const EXT_OVERSHOOT = 0.08; // how far the extension line passes the dim line
const CORNER_TOL = 0.06; // shared-endpoint tolerance for corner detection
const PERP_DOT = 0.5; // |dot(dir, otherDir)| below this ⇒ treat as perpendicular
const Y = 0.05; // render height above the ground plane

const LINE_COLOR = "#64748b"; // slate-500
const LABEL_COLOR = "#334155"; // slate-700
const LABEL_OUTLINE = "#ffffff";
const ACCENT = "#6366f1"; // hovered-wall highlight (indigo)

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

function FlatLabel({ pos, text, color = LABEL_COLOR }: { pos: V; text: string; color?: string }) {
  return (
    <Text
      position={[pos[0], Y + 0.01, pos[1]]}
      rotation={[-Math.PI / 2, 0, 0]}
      fontSize={0.22}
      color={color}
      anchorX="center"
      anchorY="middle"
      outlineWidth={0.025}
      outlineColor={LABEL_OUTLINE}
    >
      {text}
    </Text>
  );
}

/** One dimension annotation: line a→b with outward arrowheads + centered label. */
function DimLine({
  a,
  b,
  outward,
  label,
  color = LINE_COLOR,
  labelColor = LABEL_COLOR,
}: {
  a: V;
  b: V;
  outward: V; // unit normal pointing away from the line, for label nudge
  label: string;
  color?: string;
  labelColor?: string;
}) {
  const u = norm(sub(b, a)); // a → b
  const aw1 = add(a, mul(rot(u, ARROW_ANGLE), ARROW));
  const aw2 = add(a, mul(rot(u, -ARROW_ANGLE), ARROW));
  const bu: V = [-u[0], -u[1]]; // b → a
  const bw1 = add(b, mul(rot(bu, ARROW_ANGLE), ARROW));
  const bw2 = add(b, mul(rot(bu, -ARROW_ANGLE), ARROW));
  const mid = mul(add(a, b), 0.5);
  const labelPos = add(mid, mul(outward, 0.16));

  return (
    <group>
      <Seg points={[a, b]} color={color} />
      <Seg points={[aw1, a, aw2]} color={color} />
      <Seg points={[bw1, b, bw2]} color={color} />
      <FlatLabel pos={labelPos} text={label} color={labelColor} />
    </group>
  );
}

/**
 * A measured dimension between two projected wall-line points p1→p2, offset
 * outward by `off`, with extension ticks from the wall face.
 */
function Dimension({
  p1,
  p2,
  n,
  off,
  thickness,
  label,
  color,
  labelColor,
}: {
  p1: V;
  p2: V;
  n: V;
  off: number;
  thickness: number;
  label: string;
  color: string;
  labelColor: string;
}) {
  const A = add(p1, mul(n, off));
  const B = add(p2, mul(n, off));
  const faceA = add(p1, mul(n, thickness / 2));
  const faceB = add(p2, mul(n, thickness / 2));
  const extA = add(A, mul(n, EXT_OVERSHOOT));
  const extB = add(B, mul(n, EXT_OVERSHOOT));
  return (
    <group>
      <Seg points={[faceA, extA]} color={color} />
      <Seg points={[faceB, extB]} color={color} />
      <DimLine a={A} b={B} outward={n} label={label} color={color} labelColor={labelColor} />
    </group>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface WallDimensionsProps {
  walls: WallData[];
  floors: FloorData[];
  hoveredId: string | null;
}

/** Interior reference point used to orient dimensions outward (away from rooms). */
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
  const pts = walls.flatMap((w) => [w.start, w.end]);
  if (pts.length === 0) return [0, 0];
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2];
}

/**
 * Half-thickness of the perpendicular wall sharing `pt` (the corner). Collinear
 * walls (e.g. a split segment) are ignored so only true corners contribute.
 */
function adjacentPerpHalf(pt: V, dir: V, walls: WallData[], selfId: string): number {
  let t = 0;
  for (const w of walls) {
    if (w.id === selfId) continue;
    if (dist(pt, w.start) < CORNER_TOL || dist(pt, w.end) < CORNER_TOL) {
      const wd = norm(sub(w.end, w.start));
      if (Math.abs(dir[0] * wd[0] + dir[1] * wd[1]) < PERP_DOT) {
        t = Math.max(t, w.thickness);
      }
    }
  }
  return t / 2;
}

export default function WallDimensions({ walls, floors, hoveredId }: WallDimensionsProps) {
  const perWall = useMemo(() => {
    if (walls.length === 0) return [];
    const ref = interiorRef(walls, floors);

    const out: {
      id: string;
      thickness: number;
      n: V;
      innerLen: number;
      outerLen: number;
      ip1: V;
      ip2: V;
      op1: V;
      op2: V;
      offInner: number;
      offOuter: number;
    }[] = [];

    for (const w of walls) {
      const a = w.start;
      const b = w.end;
      const L = dist(a, b);
      if (L < 0.05) continue;

      const dir = norm(sub(b, a));
      // Outward normal: the perpendicular pointing away from the interior.
      let n = perp(dir);
      const mid = mul(add(a, b), 0.5);
      if (n[0] * (mid[0] - ref[0]) + n[1] * (mid[1] - ref[1]) < 0) n = mul(n, -1);

      const adjA = adjacentPerpHalf(a, dir, walls, w.id);
      const adjB = adjacentPerpHalf(b, dir, walls, w.id);

      out.push({
        id: w.id,
        thickness: w.thickness,
        n,
        innerLen: Math.max(0, L - adjA - adjB),
        outerLen: L + adjA + adjB,
        // Inner span runs between the inner faces of the perpendicular walls;
        // outer span runs between their outer faces.
        ip1: add(a, mul(dir, adjA)),
        ip2: add(b, mul(dir, -adjB)),
        op1: add(a, mul(dir, -adjA)),
        op2: add(b, mul(dir, adjB)),
        offInner: w.thickness / 2 + DIM_GAP,
        offOuter: w.thickness / 2 + DIM_GAP + TIER_GAP,
      });
    }
    return out;
  }, [walls, floors]);

  if (perWall.length === 0) return null;

  return (
    <group>
      {perWall.map((d) => {
        const hovered = d.id === hoveredId;
        return (
          <group key={d.id}>
            {/* Always-on inner clear distance */}
            {d.innerLen > 0.05 && (
              <Dimension
                p1={d.ip1}
                p2={d.ip2}
                n={d.n}
                off={d.offInner}
                thickness={d.thickness}
                label={fmt(d.innerLen)}
                color={hovered ? ACCENT : LINE_COLOR}
                labelColor={hovered ? ACCENT : LABEL_COLOR}
              />
            )}
            {/* On hover: full wall length (incl. adjacent wall thickness) */}
            {hovered && (
              <Dimension
                p1={d.op1}
                p2={d.op2}
                n={d.n}
                off={d.offOuter}
                thickness={d.thickness}
                label={fmt(d.outerLen)}
                color={ACCENT}
                labelColor={ACCENT}
              />
            )}
          </group>
        );
      })}
    </group>
  );
}
