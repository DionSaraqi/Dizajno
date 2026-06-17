import type { WallData, FloorData, OpeningData } from "@/types/designer";
import { newId } from "@/utils/ids";
import { insetFloorPolygon } from "@/utils/areaCalc";
import { OPENING_END_MARGIN } from "@/utils/openingSnap";

type Key = string;
type Point = [number, number];

/** Endpoint corner-merge radius. Exported so roomAlign's polygon-level corner
 *  weld agrees with the per-wall pull on what counts as "at a corner". */
export const CORNER_MERGE_THRESHOLD = 0.2;
/** Two walls within ~5° of each other count as (near-)parallel — T-junction
 *  splits make no geometric sense between them and used to kink walls. */
const PARALLEL_COS = Math.cos((5 * Math.PI) / 180);
/** Max perpendicular distance for treating a wall as lying ON another's line. */
const COLLINEAR_LINE_EPS = 0.02;
/** Minimum wall segment worth keeping — matches the historical 0.05 checks. */
const MIN_WALL_SEG = 0.05;
/** Residual endpoints within this of a chain endpoint weld onto it exactly,
 *  so the 2-decimal graph keys connect and findFloors closes the loop. */
const ENDPOINT_WELD_EPS = 0.05;
/** Floors whose inner (post-inset) area is below this are slivers between
 *  near-parallel walls, not rooms — drop them. */
const MIN_FLOOR_AREA = 0.05;

/** Round to the millimetre — kills float noise from the inset intersection
 *  while preserving sub-cm accuracy (so a grid-clean room stays exact). */
const round3 = (n: number): number => Math.round(n * 1000) / 1000;

function key(p: Point): Key {
  return `${p[0].toFixed(2)},${p[1].toFixed(2)}`;
}

function parseKey(k: Key): Point {
  const [x, z] = k.split(",").map(Number);
  return [x, z];
}

function dist(a: Point, b: Point): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2);
}

function makeWallId(): string {
  return newId();
}

// ── Line Segment Intersection ────────────────────────────────────────────────

/**
 * Returns the intersection point of segments (p1->p2) and (p3->p4), or null.
 * Uses parametric form: P = p1 + t*(p2-p1), Q = p3 + u*(p4-p3).
 * Only returns a point if 0 < t < 1 and 0 < u < 1 (proper interior crossing).
 */
function segmentIntersection(
  p1: Point, p2: Point, p3: Point, p4: Point
): Point | null {
  const d1x = p2[0] - p1[0];
  const d1z = p2[1] - p1[1];
  const d2x = p4[0] - p3[0];
  const d2z = p4[1] - p3[1];

  const denom = d1x * d2z - d1z * d2x;
  if (Math.abs(denom) < 1e-10) return null; // parallel or collinear

  const t = ((p3[0] - p1[0]) * d2z - (p3[1] - p1[1]) * d2x) / denom;
  const u = ((p3[0] - p1[0]) * d1z - (p3[1] - p1[1]) * d1x) / denom;

  // Strict interior (exclude endpoints — those are handled by corner merging)
  const EPS = 0.01;
  if (t <= EPS || t >= 1 - EPS || u <= EPS || u >= 1 - EPS) return null;

  return [p1[0] + t * d1x, p1[1] + t * d1z];
}

/**
 * Returns the closest point on segment (a->b) to point p, or null if
 * the projection falls outside the segment interior.
 */
function pointOnSegment(
  p: Point, a: Point, b: Point, threshold: number
): Point | null {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len2 = dx * dx + dz * dz;
  if (len2 < 1e-10) return null;

  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / len2;
  const EPS = 0.01;
  if (t <= EPS || t >= 1 - EPS) return null; // too close to endpoints

  const proj: Point = [a[0] + t * dx, a[1] + t * dz];
  if (dist(p, proj) > threshold) return null;

  return proj;
}

/** True when the (a->b) direction is within ~5° of the wall's direction. */
function isNearParallel(a: Point, b: Point, w: WallData): boolean {
  const l1 = dist(a, b);
  const l2 = dist(w.start, w.end);
  if (l1 < 1e-9 || l2 < 1e-9) return false;
  const d1x = (b[0] - a[0]) / l1;
  const d1z = (b[1] - a[1]) / l1;
  const d2x = (w.end[0] - w.start[0]) / l2;
  const d2z = (w.end[1] - w.start[1]) / l2;
  return Math.abs(d1x * d2x + d1z * d2z) > PARALLEL_COS;
}

/** Signed perpendicular distance of p from the infinite line through o with unit dir (dx,dz). */
function perpDistance(p: Point, o: Point, dx: number, dz: number): number {
  return (p[0] - o[0]) * -dz + (p[1] - o[1]) * dx;
}

// ── Corner Merging ───────────────────────────────────────────────────────────

/**
 * Snap a point to an existing wall corner if within CORNER_MERGE_THRESHOLD.
 * Returns the snapped point (or the original if no nearby corner).
 */
export function snapToCorner(
  point: Point,
  walls: WallData[]
): Point {
  let closest: Point | null = null;
  let closestDist = CORNER_MERGE_THRESHOLD;

  for (const w of walls) {
    for (const corner of [w.start, w.end]) {
      const d = dist(point, corner);
      if (d < closestDist) {
        closestDist = d;
        closest = corner;
      }
    }
  }

  return closest ?? point;
}

// ── Wall Splitting & Merging ─────────────────────────────────────────────────

/** Replace every wall endpoint that coincides with `from` by `to` (id kept). */
function applyWeld(walls: WallData[], from: Point, to: Point): WallData[] {
  if (dist(from, to) < 1e-9) return walls;
  return walls.map((w) => {
    const moveStart = dist(w.start, from) < 1e-6;
    const moveEnd = dist(w.end, from) < 1e-6;
    if (!moveStart && !moveEnd) return w;
    return { ...w, start: moveStart ? to : w.start, end: moveEnd ? to : w.end };
  });
}

/**
 * When a free-drawn wall runs along an existing wall's BODY (parallel, both
 * endpoints within half its thickness of its centerline), snap the new wall
 * onto that centerline so the collinear merge below can absorb the overlap
 * instead of stacking a near-duplicate wall.
 */
function lateralSnapToWallLine(
  start: Point,
  end: Point,
  walls: WallData[]
): { start: Point; end: Point } {
  let best: { lat: number; w: WallData; dx: number; dz: number } | null = null;
  for (const w of walls) {
    const wLen = dist(w.start, w.end);
    if (wLen < MIN_WALL_SEG) continue;
    if (!isNearParallel(start, end, w)) continue;
    const dx = (w.end[0] - w.start[0]) / wLen;
    const dz = (w.end[1] - w.start[1]) / wLen;
    const latS = Math.abs(perpDistance(start, w.start, dx, dz));
    const latE = Math.abs(perpDistance(end, w.start, dx, dz));
    const lat = Math.max(latS, latE);
    // Capture anything inside the wall's body, with a small margin so tracing
    // along a wall FACE (lateral distance exactly thickness/2 on a grid-snapped
    // draw) doesn't sit on a float boundary.
    if (lat > w.thickness / 2 + COLLINEAR_LINE_EPS) continue;
    // Require actual longitudinal overlap so a far-away parallel wall on the
    // same line extension doesn't capture.
    const t1 = (start[0] - w.start[0]) * dx + (start[1] - w.start[1]) * dz;
    const t2 = (end[0] - w.start[0]) * dx + (end[1] - w.start[1]) * dz;
    const ov = Math.min(Math.max(t1, t2), wLen) - Math.max(Math.min(t1, t2), 0);
    if (ov <= MIN_WALL_SEG) continue;
    if (!best || lat < best.lat) best = { lat, w, dx, dz };
  }
  if (!best) return { start, end };
  const { w, dx, dz } = best;
  const project = (p: Point): Point => {
    const t = (p[0] - w.start[0]) * dx + (p[1] - w.start[1]) * dz;
    return [w.start[0] + dx * t, w.start[1] + dz * t];
  };
  return { start: project(start), end: project(end) };
}

interface CollinearMerge {
  /** Spans of the new wall NOT covered by existing collinear walls. */
  residuals: { start: Point; end: Point }[];
  /** Sub-5cm gaps between collinear chains, closed by moving an endpoint. */
  welds: [Point, Point][];
}

/**
 * Absorb the spans of a new wall that are already covered by existing
 * collinear walls. The existing walls are NEVER split or replaced here — their
 * ids, paint and openings survive untouched — only the uncovered "residual"
 * spans of the new wall are returned for insertion. An exact duplicate is
 * fully absorbed (no-op). Residual endpoints weld onto the exact coordinates
 * of the adjoining existing endpoints so the wall graph stays connected.
 */
function mergeCollinearOverlaps(
  start: Point,
  end: Point,
  existingWalls: WallData[]
): CollinearMerge {
  const len = dist(start, end);
  if (len < 1e-9) return { residuals: [], welds: [] };
  const dx = (end[0] - start[0]) / len;
  const dz = (end[1] - start[1]) / len;

  const covered: [number, number][] = [];
  const chainEndpoints: { t: number; p: Point }[] = [];

  for (const w of existingWalls) {
    const wLen = dist(w.start, w.end);
    if (wLen < MIN_WALL_SEG) continue;
    if (!isNearParallel(start, end, w)) continue;
    if (Math.abs(perpDistance(w.start, start, dx, dz)) > COLLINEAR_LINE_EPS) continue;
    if (Math.abs(perpDistance(w.end, start, dx, dz)) > COLLINEAR_LINE_EPS) continue;

    const tA = (w.start[0] - start[0]) * dx + (w.start[1] - start[1]) * dz;
    const tB = (w.end[0] - start[0]) * dx + (w.end[1] - start[1]) * dz;
    const lo = Math.min(tA, tB);
    const hi = Math.max(tA, tB);
    // Touching at a single point is a corner join, not an overlap.
    if (Math.min(hi, len) - Math.max(lo, 0) <= 0.01) continue;

    covered.push([Math.max(lo, 0), Math.min(hi, len)]);
    const pLo = tA < tB ? w.start : w.end;
    const pHi = tA < tB ? w.end : w.start;
    if (lo >= -ENDPOINT_WELD_EPS && lo <= len + ENDPOINT_WELD_EPS) {
      chainEndpoints.push({ t: Math.max(lo, 0), p: pLo });
    }
    if (hi >= -ENDPOINT_WELD_EPS && hi <= len + ENDPOINT_WELD_EPS) {
      chainEndpoints.push({ t: Math.min(hi, len), p: pHi });
    }
  }

  if (covered.length === 0) return { residuals: [{ start, end }], welds: [] };

  // Interval union of the covered spans.
  covered.sort((a, b) => a[0] - b[0]);
  const union: [number, number][] = [];
  for (const iv of covered) {
    const last = union[union.length - 1];
    if (last && iv[0] <= last[1] + 1e-9) last[1] = Math.max(last[1], iv[1]);
    else union.push([iv[0], iv[1]]);
  }

  // Complement within [0, len] = residual spans of the new wall.
  const residualIvs: [number, number][] = [];
  let cursor = 0;
  for (const [lo, hi] of union) {
    if (lo - cursor > 1e-9) residualIvs.push([cursor, lo]);
    cursor = Math.max(cursor, hi);
  }
  if (len - cursor > 1e-9) residualIvs.push([cursor, len]);

  const at = (t: number): Point => [start[0] + dx * t, start[1] + dz * t];
  const weldTarget = (t: number): Point | null => {
    let bestP: Point | null = null;
    let bestD = ENDPOINT_WELD_EPS;
    for (const ce of chainEndpoints) {
      const d = Math.abs(ce.t - t);
      if (d < bestD) {
        bestD = d;
        bestP = ce.p;
      }
    }
    return bestP;
  };

  const residuals: { start: Point; end: Point }[] = [];
  const welds: [Point, Point][] = [];
  for (const [a, b] of residualIvs) {
    if (b - a < MIN_WALL_SEG) {
      // Micro-gap between two collinear chains: too short to render as a wall,
      // so close it by welding the facing endpoints together — otherwise the
      // user's "repair" draw would be silently absorbed with the gap intact.
      const from = weldTarget(a);
      const to = weldTarget(b);
      if (from && to && dist(from, to) > 1e-9) welds.push([from, to]);
      continue;
    }
    const p1 = weldTarget(a) ?? at(a);
    const p2 = weldTarget(b) ?? at(b);
    if (dist(p1, p2) >= MIN_WALL_SEG) residuals.push({ start: p1, end: p2 });
  }
  return { residuals, welds };
}

/**
 * Core insertion of one (non-collinear-overlapping) wall segment:
 * 1. T-junctions: a new endpoint near an existing wall's interior snaps ONTO
 *    that wall's line and splits it at the projection. (Splitting at the raw
 *    endpoint — up to 0.2 off the line — used to kink straight walls.)
 * 2. Crossings: both walls split at the intersection.
 * 3. Reverse-T: an existing endpoint near the new wall's interior splits the
 *    new wall at the PROJECTION and welds the existing endpoint onto it, so
 *    the graph connects without zigzagging the new wall.
 */
function insertWallSegment(
  startIn: Point,
  endIn: Point,
  thickness: number,
  height: number,
  existingWalls: WallData[]
): WallData[] {
  let start = startIn;
  let end = endIn;

  // Pass A — T-junctions (snap new endpoints onto host walls, split hosts).
  // A projection landing within MIN_WALL_SEG of a host CORNER joins that
  // corner instead of splitting — sub-5cm host children would be invisible
  // but break later collinear merges.
  const removed = new Set<string>();
  const added: WallData[] = [];
  for (const existing of existingWalls) {
    if (removed.has(existing.id)) continue;
    if (isNearParallel(start, end, existing)) continue;
    for (const which of [0, 1] as const) {
      const ep = which === 0 ? start : end;
      const proj = pointOnSegment(ep, existing.start, existing.end, CORNER_MERGE_THRESHOLD);
      if (!proj) continue;
      let target: Point;
      if (dist(proj, existing.start) <= MIN_WALL_SEG) {
        target = existing.start; // corner join, no split
      } else if (dist(proj, existing.end) <= MIN_WALL_SEG) {
        target = existing.end; // corner join, no split
      } else {
        target = proj;
        removed.add(existing.id);
        added.push(
          { ...existing, id: makeWallId(), end: proj },
          { ...existing, id: makeWallId(), start: proj }
        );
      }
      if (which === 0) start = target;
      else end = target;
      if (removed.has(existing.id)) break; // one split per host wall
    }
  }
  if (dist(start, end) < MIN_WALL_SEG) return existingWalls;

  // Pass B — crossings + reverse-T against the surviving walls.
  const splitPoints: Point[] = [];
  const welds: [Point, Point][] = [];
  for (const existing of existingWalls) {
    if (removed.has(existing.id)) continue;

    const cross = segmentIntersection(start, end, existing.start, existing.end);
    if (cross) {
      // Crossing right next to the host's corner: treat as a corner join.
      if (dist(cross, existing.start) <= MIN_WALL_SEG) {
        splitPoints.push(existing.start);
      } else if (dist(cross, existing.end) <= MIN_WALL_SEG) {
        splitPoints.push(existing.end);
      } else {
        splitPoints.push(cross);
        removed.add(existing.id);
        added.push(
          { ...existing, id: makeWallId(), end: cross },
          { ...existing, id: makeWallId(), start: cross }
        );
      }
      continue;
    }

    if (isNearParallel(start, end, existing)) continue;
    // Reverse-T: an existing endpoint near the new wall's interior splits the
    // new wall at the projection and welds the endpoint onto it. If BOTH
    // endpoints of the existing wall project (a short oblique wall hovering
    // over the new one), welding would flatten it collinear and duplicate the
    // span — leave such walls alone.
    const projS = pointOnSegment(existing.start, start, end, CORNER_MERGE_THRESHOLD);
    const projE = pointOnSegment(existing.end, start, end, CORNER_MERGE_THRESHOLD);
    if (projS && projE) continue;
    const proj = projS ?? projE;
    if (proj) {
      splitPoints.push(proj);
      welds.push([projS ? existing.start : existing.end, proj]);
    }
  }

  let result = [
    ...existingWalls.filter((w) => !removed.has(w.id)),
    ...added,
  ];
  for (const [from, to] of welds) result = applyWeld(result, from, to);

  // Split the new wall at the collected points, sorted from its start. Points
  // within MIN_WALL_SEG of an already-accepted point (or of the wall's own
  // endpoints) are the SAME junction: their host vertices are welded onto the
  // survivor rather than silently dropped — dropping them used to disconnect
  // the just-split host children from the new wall.
  splitPoints.sort((a, b) => dist(start, a) - dist(start, b));
  const accepted: Point[] = [];
  for (const pt of splitPoints) {
    const survivor =
      accepted.find((r) => dist(r, pt) < MIN_WALL_SEG) ??
      (dist(start, pt) <= MIN_WALL_SEG ? start : null) ??
      (dist(end, pt) <= MIN_WALL_SEG ? end : null);
    if (survivor) {
      result = applyWeld(result, pt, survivor);
      continue;
    }
    accepted.push(pt);
  }

  let prev = start;
  for (const pt of accepted) {
    result.push({ id: makeWallId(), start: prev, end: pt, thickness, height });
    prev = pt;
  }
  result.push({ id: makeWallId(), start: prev, end, thickness, height });

  return result;
}

export interface AddWallOptions {
  /**
   * Skip the per-endpoint pull onto nearby corners (step 1). Room-generated
   * walls set this: their polygon corners are already welded onto the
   * structure as a whole (roomAlign), so the endpoint pull could only drag
   * ONE end of a wall diagonally onto a nearby corner while the far end —
   * metres away — stays put, tilting the wall.
   */
  skipEndpointCornerSnap?: boolean;
}

/**
 * Process a new wall against all existing walls:
 * 1. Merge endpoints to nearby corners (skippable for room-generated walls)
 * 2. Snap laterally onto an existing wall's centerline when drawn inside its body
 * 3. Absorb spans already covered by collinear walls (shared walls — never
 *    duplicated, existing walls never split by the merge)
 * 4. Insert the remaining spans with crossing / T-junction handling
 *
 * Returns the updated full wall list (existing walls may be split by
 * crossings/T-junctions; collinear overlaps never split them).
 */
export function addWallWithIntersections(
  newWall: WallData,
  existingWalls: WallData[],
  opts?: AddWallOptions
): WallData[] {
  const pull = !opts?.skipEndpointCornerSnap;
  let start: Point = pull ? snapToCorner(newWall.start, existingWalls) : newWall.start;
  let end: Point = pull ? snapToCorner(newWall.end, existingWalls) : newWall.end;
  if (dist(start, end) < MIN_WALL_SEG) return existingWalls;

  ({ start, end } = lateralSnapToWallLine(start, end, existingWalls));

  const { residuals, welds } = mergeCollinearOverlaps(start, end, existingWalls);
  let walls = existingWalls;
  for (const [from, to] of welds) walls = applyWeld(walls, from, to);
  for (const r of residuals) {
    walls = insertWallSegment(r.start, r.end, newWall.thickness, newWall.height, walls);
  }
  return walls;
}

// ── Opening Reconciliation ───────────────────────────────────────────────────

const ON_LINE_EPS = 0.05;

export interface OpeningReassignResult {
  openings: OpeningData[];
  /** Openings that no longer fit anywhere on their wall line and were removed. */
  dropped: number;
}

/**
 * After a wall split (or any wall-list mutation that changes ids), find each
 * opening a new home: the child segment that lies on the original wall's line
 * AND contains the opening's full footprint. An opening that straddles a split
 * point is SHIFTED minimally along the wall into the child with the largest
 * overlap (so doors/windows survive an attaching room). Only openings whose
 * wall line vanished, or that cannot fit on any child, are dropped — the
 * backend validates `opening.wallId ∈ walls` and would otherwise 400 the save.
 */
export function reassignOpeningsAfterWallChange(
  openings: OpeningData[],
  oldWalls: WallData[],
  newWalls: WallData[]
): OpeningReassignResult {
  const newWallById = new Map(newWalls.map((w) => [w.id, w]));
  const oldWallById = new Map(oldWalls.map((w) => [w.id, w]));
  const result: OpeningData[] = [];
  // Two passes: settle every opening that keeps its place first, THEN shift
  // the straddlers — so a shifted opening can never land under a sibling that
  // a later fast-path iteration would have kept in place.
  const pending: OpeningData[] = [];
  let dropped = 0;

  for (const opening of openings) {
    // Fast path: host wall still exists with the same id and the opening fits.
    const stillHere = newWallById.get(opening.wallId);
    const oldWall = oldWallById.get(opening.wallId);
    if (stillHere) {
      const len = dist(stillHere.start, stillHere.end);
      const fits = opening.offsetFromStart + opening.width <= len + 0.01;
      const startMoved = oldWall ? dist(oldWall.start, stillHere.start) : 0;
      const endMoved = oldWall ? dist(oldWall.end, stillHere.end) : 0;
      if (fits && startMoved < 1e-9 && endMoved < 1e-9) {
        result.push(opening);
        continue;
      }
      // Weld-scale endpoint moves (≤ ~corner-merge distance): keep the
      // opening at its WORLD position by recomputing the offset — keeping the
      // raw offset would silently slide the door with the moved start. Larger
      // moves (room resize) intentionally carry openings along, so the raw
      // offset is kept there.
      if (oldWall && startMoved <= 0.25 && endMoved <= 0.25 && (startMoved > 1e-9 || endMoved > 1e-9)) {
        const oldLen0 = dist(oldWall.start, oldWall.end);
        const newLen = dist(stillHere.start, stillHere.end);
        if (oldLen0 > 1e-6 && newLen > 1e-6) {
          const odx = (oldWall.end[0] - oldWall.start[0]) / oldLen0;
          const odz = (oldWall.end[1] - oldWall.start[1]) / oldLen0;
          const worldStart: Point = [
            oldWall.start[0] + odx * opening.offsetFromStart,
            oldWall.start[1] + odz * opening.offsetFromStart,
          ];
          const ndx = (stillHere.end[0] - stillHere.start[0]) / newLen;
          const ndz = (stillHere.end[1] - stillHere.start[1]) / newLen;
          const t =
            (worldStart[0] - stillHere.start[0]) * ndx +
            (worldStart[1] - stillHere.start[1]) * ndz;
          if (t >= -0.01 && t + opening.width <= newLen + 0.01) {
            result.push({ ...opening, offsetFromStart: Math.max(0, t) });
            continue;
          }
        }
        pending.push(opening);
        continue;
      }
      if (fits) {
        result.push(opening);
        continue;
      }
    }

    if (!oldWall) {
      dropped++;
      continue; // truly orphaned — drop
    }
    pending.push(opening);
  }

  for (const opening of pending) {
    const oldWall = oldWallById.get(opening.wallId)!;

    // World position of the opening's start and end along the old wall.
    const oldLen = dist(oldWall.start, oldWall.end);
    if (oldLen < 1e-6) {
      dropped++;
      continue;
    }
    const dx = (oldWall.end[0] - oldWall.start[0]) / oldLen;
    const dz = (oldWall.end[1] - oldWall.start[1]) / oldLen;
    const openingStart: Point = [
      oldWall.start[0] + dx * opening.offsetFromStart,
      oldWall.start[1] + dz * opening.offsetFromStart,
    ];
    const openingEnd: Point = [
      openingStart[0] + dx * opening.width,
      openingStart[1] + dz * opening.width,
    ];

    // Collect collinear candidate walls with the opening's 1D span on each.
    interface Candidate {
      wall: WallData;
      len: number;
      lo: number;
      hi: number;
      overlap: number;
    }
    const candidates: Candidate[] = [];
    for (const candidate of newWalls) {
      if (
        !isCloseToLine(openingStart, candidate.start, candidate.end, ON_LINE_EPS) ||
        !isCloseToLine(openingEnd, candidate.start, candidate.end, ON_LINE_EPS)
      ) {
        continue;
      }
      const candidateLen = dist(candidate.start, candidate.end);
      if (candidateLen < 1e-6) continue;
      const cdx = (candidate.end[0] - candidate.start[0]) / candidateLen;
      const cdz = (candidate.end[1] - candidate.start[1]) / candidateLen;
      const tStart =
        (openingStart[0] - candidate.start[0]) * cdx +
        (openingStart[1] - candidate.start[1]) * cdz;
      const tEnd =
        (openingEnd[0] - candidate.start[0]) * cdx +
        (openingEnd[1] - candidate.start[1]) * cdz;

      const lo = Math.min(tStart, tEnd);
      const hi = Math.max(tStart, tEnd);
      const overlap = Math.min(hi, candidateLen) - Math.max(lo, 0);
      if (overlap <= 0) continue;
      candidates.push({ wall: candidate, len: candidateLen, lo, hi, overlap });
    }

    // Perfect fit first: a child that fully contains the opening.
    const perfect = candidates.find((c) => c.lo >= -0.01 && c.hi <= c.len + 0.01);
    if (perfect) {
      result.push({
        ...opening,
        wallId: perfect.wall.id,
        offsetFromStart: Math.max(0, perfect.lo),
      });
      continue;
    }

    // Shift-to-fit: slide the opening minimally into the child with the
    // largest overlap, keeping the end margins and avoiding siblings.
    candidates.sort((a, b) => b.overlap - a.overlap);
    let assigned = false;
    for (const c of candidates) {
      const minOff = OPENING_END_MARGIN;
      const maxOff = c.len - opening.width - OPENING_END_MARGIN;
      if (maxOff < minOff) continue; // child too short for this opening
      const shifted = Math.max(minOff, Math.min(maxOff, c.lo));
      const overlapsSibling = result.some(
        (o) =>
          o.wallId === c.wall.id &&
          shifted < o.offsetFromStart + o.width &&
          shifted + opening.width > o.offsetFromStart
      );
      if (overlapsSibling) continue;
      result.push({ ...opening, wallId: c.wall.id, offsetFromStart: shifted });
      assigned = true;
      break;
    }
    if (!assigned) dropped++;
  }

  return { openings: result, dropped };
}

function isCloseToLine(p: Point, a: Point, b: Point, threshold: number): boolean {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len2 = dx * dx + dz * dz;
  if (len2 < 1e-10) return dist(p, a) <= threshold;
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / len2;
  const proj: Point = [a[0] + t * dx, a[1] + t * dz];
  return dist(p, proj) <= threshold;
}

// ── Floor Detection ──────────────────────────────────────────────────────────

/** Shoelace area (absolute) of a polygon. */
function polyArea(verts: ReadonlyArray<Point>): number {
  let sum = 0;
  for (let i = 0; i < verts.length; i++) {
    const j = (i + 1) % verts.length;
    sum += verts[i][0] * verts[j][1] - verts[j][0] * verts[i][1];
  }
  return Math.abs(sum) / 2;
}

/**
 * Remove vertices that lie on the straight line between their neighbors —
 * T-junction vertices in the middle of a shared wall add nothing to the floor
 * shape and would break the axis-aligned-rectangle check used by room resize.
 */
function dedupeCollinearVerts(verts: Point[]): Point[] {
  if (verts.length <= 3) return verts;
  const out: Point[] = [];
  const n = verts.length;
  for (let i = 0; i < n; i++) {
    const prev = verts[(i - 1 + n) % n];
    const cur = verts[i];
    const next = verts[(i + 1) % n];
    const abx = next[0] - prev[0];
    const abz = next[1] - prev[1];
    const abLen = Math.hypot(abx, abz);
    if (abLen < 1e-9) continue; // prev == next — degenerate spike
    const perp = Math.abs(
      ((cur[0] - prev[0]) * abz - (cur[1] - prev[1]) * abx) / abLen
    );
    if (perp < 0.005 && dist(prev, cur) > 1e-9 && dist(cur, next) > 1e-9) continue;
    out.push(cur);
  }
  return out.length >= 3 ? out : verts;
}

/**
 * Find all enclosed rooms (faces) in the wall graph using planar face traversal.
 *
 * Algorithm:
 * 1. Build adjacency list with neighbors sorted by angle around each vertex.
 * 2. For every directed half-edge (u->v), trace the face to its left by always
 *    picking the "next clockwise" edge at each vertex.
 * 3. Compute signed area to distinguish inner faces (rooms) from the outer face.
 */
export function findFloors(walls: WallData[]): FloorData[] {
  if (walls.length < 3) return [];

  // Build adjacency: vertex -> sorted list of neighbor keys
  const adj = new Map<Key, Key[]>();

  const edgeSet = new Set<string>(); // dedup walls with same endpoints

  // Keys are quantised to 2 decimals for robust corner matching, but the floor
  // polygon must carry the *exact* endpoint coordinates so the inset below
  // recovers the drawn footprint exactly. Map each key to its real point.
  const realPoint = new Map<Key, Point>();

  for (const w of walls) {
    const sk = key(w.start);
    const ek = key(w.end);
    if (!realPoint.has(sk)) realPoint.set(sk, w.start);
    if (!realPoint.has(ek)) realPoint.set(ek, w.end);

    const edgeId = [sk, ek].sort().join("||");
    if (edgeSet.has(edgeId)) continue;
    edgeSet.add(edgeId);

    if (!adj.has(sk)) adj.set(sk, []);
    if (!adj.has(ek)) adj.set(ek, []);
    adj.get(sk)!.push(ek);
    adj.get(ek)!.push(sk);
  }

  // Sort neighbors by angle at each vertex
  for (const [v, neighbors] of adj) {
    const p = parseKey(v);
    neighbors.sort((a, b) => {
      const pa = parseKey(a);
      const pb = parseKey(b);
      const angA = Math.atan2(pa[1] - p[1], pa[0] - p[0]);
      const angB = Math.atan2(pb[1] - p[1], pb[0] - p[0]);
      return angA - angB;
    });
  }

  // For directed edge (from -> to), find the next vertex in the face traversal.
  // At vertex `to`, find `from` in the sorted neighbor list, then pick the
  // PREVIOUS neighbor (one step clockwise). This follows the face to the left.
  function nextVertex(from: Key, to: Key): Key {
    const neighbors = adj.get(to)!;
    const idx = neighbors.indexOf(from);
    // Previous in CCW-sorted list = next in CW direction
    const prevIdx = (idx - 1 + neighbors.length) % neighbors.length;
    return neighbors[prevIdx];
  }

  const usedHalfEdges = new Set<string>();
  const floors: FloorData[] = [];

  for (const [v, neighbors] of adj) {
    for (const nb of neighbors) {
      const halfEdge = `${v}->${nb}`;
      if (usedHalfEdges.has(halfEdge)) continue;

      // Trace the face starting from this half-edge
      const faceKeys: Key[] = [];
      let cur = v;
      let nxt = nb;
      let steps = 0;

      do {
        usedHalfEdges.add(`${cur}->${nxt}`);
        faceKeys.push(cur);
        const after = nextVertex(cur, nxt);
        cur = nxt;
        nxt = after;
        steps++;
      } while ((cur !== v || nxt !== nb) && steps < 50);

      if (steps >= 50) continue; // safety bail
      if (faceKeys.length < 3) continue;

      // Exact centerline vertices (not the cm-quantised keys) so the inset
      // below lands precisely on the inner wall faces.
      const verts = faceKeys.map((k) => realPoint.get(k) ?? parseKey(k));
      let area = 0;
      for (let i = 0; i < verts.length; i++) {
        const j = (i + 1) % verts.length;
        area += verts[i][0] * verts[j][1];
        area -= verts[j][0] * verts[i][1];
      }
      area /= 2;

      // Positive area = CCW winding = inner face (room)
      // Negative area = CW winding = outer (unbounded) face -> skip
      if (area > 0.01) {
        // The traced polygon runs along the wall centerlines; the floor is the
        // inner usable area, so inset each edge inward by its wall's
        // half-thickness. This is the inverse of the room builder's outset, so
        // a room drawn 5×5 yields a floor of exactly 25 m².
        const inner = dedupeCollinearVerts(
          insetFloorPolygon(verts, walls).map(
            (p) => [round3(p[0]), round3(p[1])] as Point
          )
        );
        // Slivers between near-parallel walls survive the centerline area
        // check above but collapse to ~nothing once inset — not rooms.
        if (polyArea(inner) < MIN_FLOOR_AREA) continue;
        floors.push({
          id: newId(),
          vertices: inner,
        });
      }
    }
  }

  return floors;
}

function vertsCentroid(verts: ReadonlyArray<Point>): Point {
  const n = verts.length || 1;
  let x = 0;
  let z = 0;
  for (const v of verts) {
    x += v[0];
    z += v[1];
  }
  return [x / n, z / n];
}

/**
 * Re-derive floors from the wall graph so their geometry uses the current
 * inner-usable-polygon convention, carrying each loaded floor's flooring
 * material onto the matching re-derived floor by nearest centroid.
 *
 * Used on scene load to self-heal projects saved under the old centerline
 * convention (where floor vertices ran along wall centerlines), and on every
 * room/wall commit so adding a room doesn't wipe the neighbors' flooring.
 * Falls back to the loaded floors when the walls no longer form closed loops,
 * so we never silently drop a floor we can't re-derive.
 */
export function reconcileLoadedFloors(
  walls: WallData[],
  loadedFloors: FloorData[]
): FloorData[] {
  const derived = findFloors(walls);
  if (derived.length === 0) return loadedFloors;

  // Greedy exclusive matching, nearest pair first — each loaded floor's
  // flooring is consumed at most once, so a new small room beside a floored
  // room can't inherit its neighbor's material.
  const loaded = loadedFloors
    .filter((f) => f.flooringVariantId)
    .map((f) => ({ floor: f, centroid: vertsCentroid(f.vertices) }));
  const derivedInfo = derived.map((d) => ({ floor: d, centroid: vertsCentroid(d.vertices) }));

  const pairs: { di: number; li: number; d2: number }[] = [];
  for (let di = 0; di < derivedInfo.length; di++) {
    for (let li = 0; li < loaded.length; li++) {
      const d2 =
        (loaded[li].centroid[0] - derivedInfo[di].centroid[0]) ** 2 +
        (loaded[li].centroid[1] - derivedInfo[di].centroid[1]) ** 2;
      // ≤1 m between centroids = same room (flooring is a coarse per-room pick).
      if (d2 <= 1) pairs.push({ di, li, d2 });
    }
  }
  pairs.sort((a, b) => a.d2 - b.d2);

  const result = [...derived];
  const usedDerived = new Set<number>();
  const usedLoaded = new Set<number>();
  for (const { di, li } of pairs) {
    if (usedDerived.has(di) || usedLoaded.has(li)) continue;
    usedDerived.add(di);
    usedLoaded.add(li);
    result[di] = { ...result[di], flooringVariantId: loaded[li].floor.flooringVariantId };
  }
  return result;
}
