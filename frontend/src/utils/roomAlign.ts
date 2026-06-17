// ── Room-to-wall alignment ────────────────────────────────────────────────────
// Before a new room's walls are generated, two passes square it up to the
// existing structure:
//
//  1. Edge capture — snap each centerline edge that runs parallel and close to
//     an existing wall ONTO that wall's centerline. The collinear merge in
//     wallGraph then absorbs the overlap, so adjacent rooms SHARE a wall
//     instead of stacking a doubled slab (or worse, kinking the neighbor's
//     wall through the old T-junction math).
//
//  2. Corner weld — pull polygon vertices that land near an existing wall
//     corner EXACTLY onto it, shifting WHOLE edges (directions preserved) so
//     the room squares up to the structure and every wall stays straight.
//     Without this, the per-endpoint corner pull in addWallWithIntersections
//     would drag ONE end of a generated wall diagonally onto the corner and
//     tilt it — a room hugging the junction corner of two existing rooms came
//     out a trapezoid. Once every room vertex is settled (exactly on the
//     corners/lines it touches), room walls are inserted with that endpoint
//     pull suppressed (skipEndpointCornerSnap, gated by roomCornersSettled).
//
// Both passes are best-effort and conservative: any rebuild that would distort
// the polygon (flipped winding, collapsed edges, vertices flying away) bails
// back to its input. Concave polygons use winding-derived outward normals, so
// deeply concave drafts may simply not align — they are never corrupted.

import type { WallData } from "@/types/designer";
import { CORNER_MERGE_THRESHOLD } from "@/utils/wallGraph";

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
/** Sanity bound: no capture-rebuilt corner may move further than this. */
const ALIGN_MAX_VERTEX_SHIFT = 2 * ALIGN_CAPTURE;
/** Sanity bound for the weld pass: re-anchoring both incident edges can move
 *  a corner by at most √2 × the weld radius — 2× leaves comfortable slack. */
const WELD_MAX_VERTEX_SHIFT = 2 * CORNER_MERGE_THRESHOLD;
/** Rooms below this centerline area skip alignment (degenerate input). */
const MIN_ALIGN_AREA = 0.25;
const MIN_EDGE = 0.05;
/** A weld corner within this of an edge's line counts as lying ON it. */
const WELD_LINE_EPS = 0.02;

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
 * Intersect consecutive edge lines to rebuild the polygon corners (same
 * pattern as roomBuilder.outsetPolygon). Collinear neighbors project the
 * reference vertex onto the second line so it lands ON the target line
 * instead of keeping a kinked off-line position the merge can't absorb.
 */
function rebuildCorners(lines: Line[], ref: V[]): V[] {
  const n = lines.length;
  const out: V[] = [];
  for (let i = 0; i < n; i++) {
    const a = lines[(i - 1 + n) % n];
    const b = lines[i];
    const denom = a.dx * b.dz - a.dz * b.dx;
    if (Math.abs(denom) < 1e-9) {
      const along = (ref[i][0] - b.px) * b.dx + (ref[i][1] - b.pz) * b.dz;
      out.push([b.px + along * b.dx, b.pz + along * b.dz]);
      continue;
    }
    const t = ((b.px - a.px) * b.dz - (b.pz - a.pz) * b.dx) / denom;
    out.push([a.px + t * a.dx, a.pz + t * a.dz]);
  }
  return out;
}

/** Safety net shared by both passes: a rebuild must never corrupt the room. */
function rebuildIsSafe(out: V[], ref: V[], maxShift: number): boolean {
  const n = ref.length;
  for (let i = 0; i < n; i++) {
    const shift = Math.hypot(out[i][0] - ref[i][0], out[i][1] - ref[i][1]);
    if (shift > maxShift) return false;
  }
  for (let i = 0; i < n; i++) {
    const a = out[i];
    const b = out[(i + 1) % n];
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < MIN_EDGE) return false;
  }
  const areaBefore = signedArea(ref);
  const areaAfter = signedArea(out);
  if (Math.sign(areaAfter) !== Math.sign(areaBefore)) return false;
  if (Math.abs(areaAfter) < MIN_ALIGN_AREA) return false;
  // A drastic shrink means the rebuild collapsed the room (e.g. a narrow drawn
  // corridor straddling a wall snapped both sides onto it) — bail out.
  if (Math.abs(areaAfter) < 0.5 * Math.abs(areaBefore)) return false;
  return true;
}

interface CapturePhaseResult {
  verts: V[];
  /** Per edge: the existing-wall line the edge was captured onto, or null. */
  capturedLines: (Line | null)[];
}

/**
 * Pass 1 — snap the room's centerline polygon edges onto nearby parallel
 * existing wall centerlines, rebuilding the corners by intersecting
 * consecutive edge lines. Returns the input unchanged when nothing captures
 * or validation fails.
 */
function captureOntoWallLines(
  centerline: V[],
  existingWalls: WallData[],
  thickness: number
): CapturePhaseResult {
  const n = centerline.length;
  const unchanged: CapturePhaseResult = {
    verts: centerline,
    capturedLines: new Array<Line | null>(n).fill(null),
  };
  // Winding sign drives the outward normals — exact for concave polygons too
  // (a vertex-average centroid can fall outside a concave room and flip them).
  const winding = Math.sign(signedArea(centerline));

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

  if (captures.every((c) => c === null)) return unchanged;

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

  // STEP 4 — rebuild corners, STEP 5 — validate.
  const out = rebuildCorners(lines, centerline);
  if (!rebuildIsSafe(out, centerline, ALIGN_MAX_VERTEX_SHIFT)) return unchanged;

  return { verts: out, capturedLines: captures.map((c) => c?.line ?? null) };
}

/**
 * Pass 2 — weld polygon vertices onto existing wall corners within the
 * corner-merge radius, shifting WHOLE edges (directions preserved) so the
 * polygon stays straight: the corner welds AND the connected walls keep their
 * lines, at the cost of the drawn size adjusting slightly. Edges captured by
 * pass 1 keep their wall line exactly — a weld may join them along the line
 * but never pulls them off it. Returns the input unchanged when nothing welds
 * or validation fails.
 */
function weldCornersToStructure(
  poly: V[],
  capturedLines: (Line | null)[],
  existingWalls: WallData[]
): V[] {
  const n = poly.length;

  // Nearest existing wall corner within the weld radius, per vertex.
  const targets: (V | null)[] = poly.map((v) => {
    let best: V | null = null;
    let bestD = CORNER_MERGE_THRESHOLD;
    for (const w of existingWalls) {
      for (const corner of [w.start, w.end]) {
        const d = Math.hypot(v[0] - corner[0], v[1] - corner[1]);
        if (d < bestD) {
          bestD = d;
          best = corner;
        }
      }
    }
    return best;
  });
  if (targets.every((t) => t === null)) return poly;

  // Per-edge lines: an edge with welded endpoint(s) re-anchors through the
  // weld target so the WHOLE edge shifts laterally instead of one end.
  const lines: Line[] = [];
  for (let i = 0; i < n; i++) {
    if (capturedLines[i]) {
      lines.push(capturedLines[i]!);
      continue;
    }
    const vi = poly[i];
    const vj = poly[(i + 1) % n];
    const [dx, dz] = unit(vj[0] - vi[0], vj[1] - vi[1]);
    const ti = targets[i];
    const tj = targets[(i + 1) % n];
    if (ti && tj) {
      // Both corners weld: go corner-to-corner when that agrees with the
      // edge's own line (the structure may sit a hair off-axis); otherwise
      // the nearer weld wins and the edge keeps its direction — never tilt
      // a wall to reach a second corner.
      const lat = Math.abs((tj[0] - ti[0]) * -dz + (tj[1] - ti[1]) * dx);
      const span = Math.hypot(tj[0] - ti[0], tj[1] - ti[1]);
      const [adx, adz] = unit(tj[0] - ti[0], tj[1] - ti[1]);
      if (span >= MIN_EDGE && adx * dx + adz * dz > 0 && lat <= WELD_LINE_EPS) {
        lines.push({ px: ti[0], pz: ti[1], dx: adx, dz: adz });
      } else {
        const di = Math.hypot(vi[0] - ti[0], vi[1] - ti[1]);
        const dj = Math.hypot(vj[0] - tj[0], vj[1] - tj[1]);
        const anchor = di <= dj ? ti : tj;
        lines.push({ px: anchor[0], pz: anchor[1], dx, dz });
      }
    } else if (ti ?? tj) {
      const anchor = (ti ?? tj)!;
      lines.push({ px: anchor[0], pz: anchor[1], dx, dz });
    } else {
      lines.push({ px: vi[0], pz: vi[1], dx, dz });
    }
  }

  const out = rebuildCorners(lines, poly);
  // Pin landed welds to the corner's exact coordinates so the wall graph's
  // 2-decimal keys and exact-coordinate welds connect without float residue.
  for (let i = 0; i < n; i++) {
    const t = targets[i];
    if (t && Math.hypot(out[i][0] - t[0], out[i][1] - t[1]) < 0.02) {
      out[i] = [t[0], t[1]];
    }
  }
  if (!rebuildIsSafe(out, poly, WELD_MAX_VERTEX_SHIFT)) return poly;
  return out;
}

/**
 * Square a new room's centerline polygon up to the existing structure:
 * capture edges onto nearby parallel wall centerlines (pass 1), then weld
 * corners onto nearby existing corners keeping every edge straight (pass 2).
 * Returns the input unchanged when nothing captures/welds or validation fails.
 */
export function alignRoomToWalls(
  centerline: V[],
  existingWalls: WallData[],
  thickness: number
): V[] {
  if (centerline.length < 3 || existingWalls.length === 0) return centerline;
  if (Math.abs(signedArea(centerline)) < MIN_ALIGN_AREA) return centerline;

  const captured = captureOntoWallLines(centerline, existingWalls, thickness);
  return weldCornersToStructure(captured.verts, captured.capturedLines, existingWalls);
}

/** A vertex this close to a wall's line counts as ON it: a residual gap this
 *  small still closes through the wall graph's 2-decimal key quantization. */
const ON_LINE_SETTLE_EPS = 0.005;

/**
 * True when the room polygon is fully settled against the structure, i.e. the
 * per-endpoint corner pull has nothing legitimate left to do and commitRoom
 * may suppress it (the pull could only drag one end of a wall sideways and
 * tilt it). Settled means every vertex either
 *  - sits EXACTLY on the existing corner it is near,
 *  - lies ON the line of any existing wall whose interior it is near (a
 *    vertex hovering OFF the line would be T-projected onto it on one sibling
 *    wall, minting a mid-commit corner that only the pull could reconnect the
 *    other sibling to — e.g. a diagonal room's apex touching a wall), or
 *  - is clear of corners and walls entirely.
 * When a vertex remains unsettled (weld bailed, or snap is off so alignment
 * never ran), the pull stays on: it is what connects the room there, at the
 * cost of the old slight tilt.
 */
export function roomCornersSettled(verts: V[], existingWalls: WallData[]): boolean {
  for (const v of verts) {
    let nearest = CORNER_MERGE_THRESHOLD;
    let onCorner = false;
    for (const w of existingWalls) {
      for (const corner of [w.start, w.end]) {
        const d = Math.hypot(v[0] - corner[0], v[1] - corner[1]);
        if (d < nearest) {
          nearest = d;
          onCorner = d < 1e-9;
        }
      }
    }
    if (nearest < CORNER_MERGE_THRESHOLD && !onCorner) return false;

    for (const w of existingWalls) {
      const len = Math.hypot(w.end[0] - w.start[0], w.end[1] - w.start[1]);
      if (len < 1e-9) continue;
      const dx = (w.end[0] - w.start[0]) / len;
      const dz = (w.end[1] - w.start[1]) / len;
      const t = (v[0] - w.start[0]) * dx + (v[1] - w.start[1]) * dz;
      if (t <= 0 || t >= len) continue; // near-endpoint zone is the corner case
      const lat = Math.abs(
        (v[0] - w.start[0]) * -dz + (v[1] - w.start[1]) * dx
      );
      if (lat < CORNER_MERGE_THRESHOLD && lat > ON_LINE_SETTLE_EPS) return false;
    }
  }
  return true;
}
