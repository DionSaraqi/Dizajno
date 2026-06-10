// ── Room-to-wall alignment ────────────────────────────────────────────────────
// Before a new room's walls are generated, snap each centerline edge that runs
// parallel and close to an existing wall ONTO that wall's centerline. The
// collinear merge in wallGraph then absorbs the overlap, so adjacent rooms
// SHARE a wall instead of stacking a doubled slab (or worse, kinking the
// neighbor's wall through the old T-junction math).
//
// Alignment is best-effort and conservative: any rebuild that would distort
// the polygon (flipped winding, collapsed edges, vertices flying away) bails
// back to the unaligned input. Concave polygons use the same centroid-based
// outward-normal trick as roomBuilder.outsetPolygon, so deeply concave drafts
// may simply not align — they are never corrupted.

import type { WallData } from "@/types/designer";

type V = [number, number];

/** Edges within ~5° of a wall count as parallel for capture. */
const ALIGN_ANGLE_COS = Math.cos((5 * Math.PI) / 180);
/**
 * Lateral capture distance between the room edge and the wall centerline.
 * Covers the common cases: edge drawn on the neighbor's inner face (centerline
 * gap = thickness, 0.15 by default), on its centerline (gap = thickness/2),
 * and a generous "nearby" miss — while staying well under half the 1 m grid so
 * a room deliberately placed one cell away is never captured.
 */
const ALIGN_CAPTURE = 0.35;
/** Minimum usable span a room must keep after alignment squeezes it. */
const MIN_USABLE_SPAN = 0.5;
/** Sanity bound: no rebuilt corner may move further than this. */
const ALIGN_MAX_VERTEX_SHIFT = 2 * ALIGN_CAPTURE;
/** Rooms below this centerline area skip alignment (degenerate input). */
const MIN_ALIGN_AREA = 0.25;
const MIN_EDGE = 0.05;

interface Line {
  px: number;
  pz: number;
  dx: number;
  dz: number;
}

interface Capture {
  lat: number;
  overlap: number;
  line: Line;
}

function signedArea(verts: V[]): number {
  let sum = 0;
  for (let i = 0; i < verts.length; i++) {
    const j = (i + 1) % verts.length;
    sum += verts[i][0] * verts[j][1] - verts[j][0] * verts[i][1];
  }
  return sum / 2;
}

function unit(ax: number, az: number): [number, number] {
  const l = Math.hypot(ax, az) || 1;
  return [ax / l, az / l];
}

/** Required longitudinal overlap before an edge captures a wall. */
function minOverlap(edgeLen: number, wallLen: number): number {
  return Math.max(0.3, 0.25 * Math.min(edgeLen, wallLen));
}

/**
 * Snap the room's centerline polygon edges onto nearby parallel existing wall
 * centerlines, rebuilding the corners by intersecting consecutive edge lines.
 * Returns the input unchanged when nothing captures or validation fails.
 */
export function alignRoomToWalls(
  centerline: V[],
  existingWalls: WallData[],
  thickness: number
): V[] {
  const n = centerline.length;
  if (n < 3 || existingWalls.length === 0) return centerline;
  const areaBefore = signedArea(centerline);
  if (Math.abs(areaBefore) < MIN_ALIGN_AREA) return centerline;
  // Winding sign drives the outward normals — exact for concave polygons too
  // (a vertex-average centroid can fall outside a concave room and flip them).
  const winding = Math.sign(areaBefore);

  // STEP 1 — per-edge capture: nearest parallel wall within ALIGN_CAPTURE
  // with enough longitudinal overlap.
  const captures: (Capture | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    const vi = centerline[i];
    const vj = centerline[(i + 1) % n];
    const edgeLen = Math.hypot(vj[0] - vi[0], vj[1] - vi[1]);
    if (edgeLen < MIN_EDGE) continue;
    const [dx, dz] = unit(vj[0] - vi[0], vj[1] - vi[1]);
    const mid: V = [(vi[0] + vj[0]) / 2, (vi[1] + vj[1]) / 2];

    let best: Capture | null = null;
    for (const w of existingWalls) {
      const wLen = Math.hypot(w.end[0] - w.start[0], w.end[1] - w.start[1]);
      if (wLen < MIN_EDGE) continue;
      const [wdx, wdz] = unit(w.end[0] - w.start[0], w.end[1] - w.start[1]);
      const dot = dx * wdx + dz * wdz;
      if (Math.abs(dot) < ALIGN_ANGLE_COS) continue;

      // Lateral distance from the edge midpoint to the wall's infinite line.
      const lat = Math.abs(
        (mid[0] - w.start[0]) * -wdz + (mid[1] - w.start[1]) * wdx
      );
      if (lat > ALIGN_CAPTURE) continue;

      // Longitudinal overlap measured on the wall's axis.
      const t1 = (vi[0] - w.start[0]) * wdx + (vi[1] - w.start[1]) * wdz;
      const t2 = (vj[0] - w.start[0]) * wdx + (vj[1] - w.start[1]) * wdz;
      const overlap =
        Math.min(Math.max(t1, t2), wLen) - Math.max(Math.min(t1, t2), 0);
      if (overlap < minOverlap(edgeLen, wLen)) continue;

      if (!best || lat < best.lat || (lat === best.lat && overlap > best.overlap)) {
        // Keep the edge's own direction sign so the polygon winding survives.
        const adx = dot >= 0 ? wdx : -wdx;
        const adz = dot >= 0 ? wdz : -wdz;
        // Anchor the line at the midpoint's projection onto the wall line.
        const t = (mid[0] - w.start[0]) * wdx + (mid[1] - w.start[1]) * wdz;
        best = {
          lat,
          overlap,
          line: {
            px: w.start[0] + wdx * t,
            pz: w.start[1] + wdz * t,
            dx: adx,
            dz: adz,
          },
        };
      }
    }
    captures[i] = best;
  }

  if (captures.every((c) => c === null)) return centerline;

  // STEP 2 — opposite-edge squeeze guard: two facing edges may not snap so
  // close together that the room collapses; drop the weaker capture.
  const outwardNormal = (i: number): [number, number] => {
    const vi = centerline[i];
    const vj = centerline[(i + 1) % n];
    const [dx, dz] = unit(vj[0] - vi[0], vj[1] - vi[1]);
    // For a positively-wound polygon the interior is to the left of each
    // directed edge, so outward is the right-hand normal; flipped winding
    // flips it. Exact regardless of convexity.
    return [winding * dz, -winding * dx];
  };
  for (let i = 0; i < n; i++) {
    if (!captures[i]) continue;
    for (let k = i + 1; k < n; k++) {
      if (!captures[i] || !captures[k]) continue;
      const ni = outwardNormal(i);
      const nk = outwardNormal(k);
      if (ni[0] * nk[0] + ni[1] * nk[1] > -ALIGN_ANGLE_COS) continue; // not facing
      const li = captures[i]!.line;
      const lk = captures[k]!.line;
      const span = Math.abs(
        (lk.px - li.px) * -li.dz + (lk.pz - li.pz) * li.dx
      );
      if (span < MIN_USABLE_SPAN + thickness) {
        // Same target line, or squeezing the room shut — keep the closer edge.
        if (captures[i]!.lat <= captures[k]!.lat) captures[k] = null;
        else captures[i] = null;
      }
    }
  }

  // STEP 3 — per-edge lines: captured edges adopt the wall's line exactly
  // (direction forced to the wall's, killing the residual ≤5° rotation).
  const lines: Line[] = [];
  for (let i = 0; i < n; i++) {
    const cap = captures[i];
    if (cap) {
      lines.push(cap.line);
    } else {
      const vi = centerline[i];
      const vj = centerline[(i + 1) % n];
      const [dx, dz] = unit(vj[0] - vi[0], vj[1] - vi[1]);
      lines.push({ px: vi[0], pz: vi[1], dx, dz });
    }
  }

  // STEP 4 — rebuild corners by intersecting consecutive lines (same pattern
  // as roomBuilder.outsetPolygon).
  const out: V[] = [];
  for (let i = 0; i < n; i++) {
    const a = lines[(i - 1 + n) % n];
    const b = lines[i];
    const denom = a.dx * b.dz - a.dz * b.dx;
    if (Math.abs(denom) < 1e-9) {
      // Consecutive collinear edges (both captured by the same wall, or a
      // mid-edge draft click) — project the original vertex onto line b so it
      // lands ON the target line instead of keeping its raw position, which
      // would leave a kinked off-line vertex the merge can't absorb.
      const along =
        (centerline[i][0] - b.px) * b.dx + (centerline[i][1] - b.pz) * b.dz;
      out.push([b.px + along * b.dx, b.pz + along * b.dz]);
      continue;
    }
    const t = ((b.px - a.px) * b.dz - (b.pz - a.pz) * b.dx) / denom;
    out.push([a.px + t * a.dx, a.pz + t * a.dz]);
  }

  // STEP 5 — validate; alignment must never corrupt the room.
  for (let i = 0; i < n; i++) {
    const shift = Math.hypot(out[i][0] - centerline[i][0], out[i][1] - centerline[i][1]);
    if (shift > ALIGN_MAX_VERTEX_SHIFT) return centerline;
  }
  for (let i = 0; i < n; i++) {
    const a = out[i];
    const b = out[(i + 1) % n];
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < MIN_EDGE) return centerline;
  }
  const areaAfter = signedArea(out);
  if (Math.sign(areaAfter) !== Math.sign(areaBefore)) return centerline;
  if (Math.abs(areaAfter) < MIN_ALIGN_AREA) return centerline;
  // A drastic shrink means captures collapsed the room (e.g. a narrow drawn
  // corridor straddling a wall snapped both sides onto it) — bail out.
  if (Math.abs(areaAfter) < 0.5 * Math.abs(areaBefore)) return centerline;

  return out;
}
