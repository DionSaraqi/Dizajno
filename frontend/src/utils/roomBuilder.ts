// ── Room builder ──────────────────────────────────────────────────────────────
// Generates wall geometry from a USABLE (inner) room footprint. The user draws/
// types the usable polygon; we offset it OUTWARD by half the wall thickness to
// get the wall centerlines, then build one wall per edge. After the walls are
// committed, the existing floor detection re-derives the floor at the centerlines
// and innerFloorArea() insets it back to exactly the usable footprint — so a 5×5
// the user asks for is 25 m² usable.

import type { WallData } from "@/types/designer";
import { newId } from "./ids";

type V = [number, number];

const round2 = (n: number): number => Math.round(n * 100) / 100;

function norm(x: number, z: number): [number, number] {
  const l = Math.hypot(x, z) || 1;
  return [x / l, z / l];
}

function pointSegDistance(p: V, a: V, b: V): number {
  const abx = b[0] - a[0];
  const abz = b[1] - a[1];
  const len2 = abx * abx + abz * abz;
  let t = len2 > 0 ? ((p[0] - a[0]) * abx + (p[1] - a[1]) * abz) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * abx), p[1] - (a[1] + t * abz));
}

/** Axis-aligned rectangle usable-footprint corners (CCW) centered at (cx,cz). */
export function rectUsableVerts(w: number, l: number, cx = 0, cz = 0): V[] {
  const hw = w / 2;
  const hl = l / 2;
  return [
    [cx - hw, cz - hl],
    [cx + hw, cz - hl],
    [cx + hw, cz + hl],
    [cx - hw, cz + hl],
  ];
}

/**
 * Offset each polygon edge OUTWARD (away from the centroid) by `distance`, then
 * intersect consecutive offset lines to form the outer polygon. Used to turn a
 * usable footprint into wall centerlines.
 */
export function outsetPolygon(verts: V[], distance: number): V[] {
  const n = verts.length;
  if (n < 3) return verts.map((v) => [v[0], v[1]] as V);
  const cx = verts.reduce((s, v) => s + v[0], 0) / n;
  const cz = verts.reduce((s, v) => s + v[1], 0) / n;

  const lines = verts.map((vi, i) => {
    const vj = verts[(i + 1) % n];
    const [dx, dz] = norm(vj[0] - vi[0], vj[1] - vi[1]);
    let nx = -dz;
    let nz = dx;
    const mx = (vi[0] + vj[0]) / 2;
    const mz = (vi[1] + vj[1]) / 2;
    // Outward = pointing away from the centroid.
    if (nx * (cx - mx) + nz * (cz - mz) > 0) {
      nx = -nx;
      nz = -nz;
    }
    return { px: vi[0] + nx * distance, pz: vi[1] + nz * distance, dx, dz };
  });

  const out: V[] = [];
  for (let i = 0; i < n; i++) {
    const a = lines[(i - 1 + n) % n];
    const b = lines[i];
    const denom = a.dx * b.dz - a.dz * b.dx;
    if (Math.abs(denom) < 1e-9) {
      out.push([verts[i][0], verts[i][1]]);
      continue;
    }
    const t = ((b.px - a.px) * b.dz - (b.pz - a.pz) * b.dx) / denom;
    out.push([a.px + t * a.dx, a.pz + t * a.dz]);
  }
  return out;
}

/** One wall per polygon edge (centerline verts already at final positions). */
export function centerlineToWalls(
  centerline: V[],
  thickness: number,
  height: number
): WallData[] {
  const walls: WallData[] = [];
  const n = centerline.length;
  for (let i = 0; i < n; i++) {
    const a = centerline[i];
    const b = centerline[(i + 1) % n];
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.05) continue;
    walls.push({ id: newId(), start: a, end: b, thickness, height });
  }
  return walls;
}

/**
 * Build wall segments around a usable footprint: offset to centerlines and emit
 * one wall per edge. Used for custom (arbitrary) room shapes. The centerlines
 * keep full precision (no rounding) so that when findFloors insets the detected
 * floor back by the same half-thickness it recovers the drawn footprint exactly
 * — a room drawn 5×5 stays exactly 25 m².
 */
export function usablePolygonToWalls(
  usable: V[],
  thickness: number,
  height: number
): WallData[] {
  const centerline = outsetPolygon(usable, thickness / 2);
  return centerlineToWalls(centerline, thickness, height);
}

/**
 * Centerline corners for an axis-aligned rectangle of a given USABLE size. The
 * far corner is derived as `anchor + (usable + thickness)` (both cm-clean) rather
 * than rounded independently, so the span — and therefore the inner usable area —
 * is exact at the floor-detector's cm precision (e.g. 5×5 ⇒ exactly 25 m²).
 */
export function rectCenterlineVerts(
  usableW: number,
  usableL: number,
  thickness: number,
  cx = 0,
  cz = 0
): V[] {
  const W = round2(usableW + thickness);
  const L = round2(usableL + thickness);
  const x0 = round2(cx - W / 2);
  const z0 = round2(cz - L / 2);
  const x1 = round2(x0 + W);
  const z1 = round2(z0 + L);
  return [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ];
}

/** The wall lying on the floor edge vi→vj (parallel + nearest its midpoint). */
function matchWall(vi: V, vj: V, walls: WallData[]): WallData | null {
  const mx = (vi[0] + vj[0]) / 2;
  const mz = (vi[1] + vj[1]) / 2;
  const [edx, edz] = norm(vj[0] - vi[0], vj[1] - vi[1]);
  let best: WallData | null = null;
  let bestDist = 0.2;
  for (const w of walls) {
    const [wdx, wdz] = norm(w.end[0] - w.start[0], w.end[1] - w.start[1]);
    if (Math.abs(edx * wdx + edz * wdz) < 0.9) continue;
    const d = pointSegDistance([mx, mz], w.start, w.end);
    if (d < bestDist) {
      bestDist = d;
      best = w;
    }
  }
  return best;
}

/** The distinct walls bounding a floor polygon (one per edge, deduped). */
export function boundingWalls(floorVerts: V[], walls: WallData[]): WallData[] {
  const found = new Map<string, WallData>();
  const n = floorVerts.length;
  for (let i = 0; i < n; i++) {
    const w = matchWall(floorVerts[i], floorVerts[(i + 1) % n], walls);
    if (w) found.set(w.id, w);
  }
  return [...found.values()];
}

/** Polygon centroid (vertex average — fine for label/selection proximity). */
export function vertsCentroid(verts: ReadonlyArray<V>): V {
  const n = verts.length || 1;
  return [
    verts.reduce((s, v) => s + v[0], 0) / n,
    verts.reduce((s, v) => s + v[1], 0) / n,
  ];
}

/** True for an axis-aligned rectangle (4 corners on the bounding box). */
export function isAxisAlignedRect(verts: ReadonlyArray<V>): boolean {
  if (verts.length !== 4) return false;
  const xs = verts.map((v) => v[0]);
  const zs = verts.map((v) => v[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  if (maxX - minX < 0.05 || maxZ - minZ < 0.05) return false;
  return verts.every(
    (v) =>
      (Math.abs(v[0] - minX) < 0.01 || Math.abs(v[0] - maxX) < 0.01) &&
      (Math.abs(v[1] - minZ) < 0.01 || Math.abs(v[1] - maxZ) < 0.01)
  );
}

export const roundTo2 = round2;
