import type { WallData, FloorData, OpeningData } from "@/types/designer";
import { newId } from "@/utils/ids";

type Key = string;
type Point = [number, number];

const CORNER_MERGE_THRESHOLD = 0.2; // merge corners within 0.2 units

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

// ── Wall Splitting ───────────────────────────────────────────────────────────

/**
 * Process a new wall against all existing walls:
 * 1. Merge endpoints to nearby corners
 * 2. Split at any crossing intersections
 * 3. Split existing walls where the new wall's endpoints land on them (T-junctions)
 * 4. Split the new wall where existing endpoints land on it (reverse T-junctions)
 *
 * Returns the updated full wall list (existing walls may be split).
 */
export function addWallWithIntersections(
  newWall: WallData,
  existingWalls: WallData[]
): WallData[] {
  const thickness = newWall.thickness;
  const height = newWall.height;

  // Step 1: Snap new wall endpoints to existing corners
  let start: Point = snapToCorner(newWall.start, existingWalls);
  let end: Point = snapToCorner(newWall.end, existingWalls);

  // Bail if wall collapsed to a point after snapping
  if (dist(start, end) < 0.05) return existingWalls;

  // Step 2: Collect all split points on the new wall
  const splitPoints: Point[] = [];
  const wallsToRemove = new Set<string>();
  const wallsToAdd: WallData[] = [];

  for (const existing of existingWalls) {
    // 2a: Check for crossing intersections
    const cross = segmentIntersection(start, end, existing.start, existing.end);
    if (cross) {
      splitPoints.push(cross);
      // Also split the existing wall at the intersection
      wallsToRemove.add(existing.id);
      wallsToAdd.push(
        { ...existing, id: makeWallId(), end: cross },
        { ...existing, id: makeWallId(), start: cross }
      );
    }

    // 2b: T-junction — new wall endpoint lands on existing wall's interior
    for (const ep of [start, end]) {
      const proj = pointOnSegment(ep, existing.start, existing.end, CORNER_MERGE_THRESHOLD);
      if (proj && !wallsToRemove.has(existing.id)) {
        wallsToRemove.add(existing.id);
        wallsToAdd.push(
          { ...existing, id: makeWallId(), end: ep },
          { ...existing, id: makeWallId(), start: ep }
        );
      }
    }

    // 2c: Reverse T-junction — existing wall endpoint lands on the new wall's interior
    for (const ep of [existing.start, existing.end]) {
      const proj = pointOnSegment(ep, start, end, CORNER_MERGE_THRESHOLD);
      if (proj) {
        splitPoints.push(ep);
      }
    }
  }

  // Step 3: Build the surviving existing walls
  const survivingWalls = existingWalls.filter((w) => !wallsToRemove.has(w.id));
  const result = [...survivingWalls, ...wallsToAdd];

  // Step 4: Split the new wall at all collected split points
  // Sort split points by distance from start
  const uniquePoints = deduplicatePoints(splitPoints, 0.05);
  uniquePoints.sort((a, b) => dist(start, a) - dist(start, b));

  let prev = start;
  for (const pt of uniquePoints) {
    if (dist(prev, pt) > 0.05) {
      result.push({
        id: makeWallId(),
        start: prev,
        end: pt,
        thickness,
        height,
      });
    }
    prev = pt;
  }
  // Final segment
  if (dist(prev, end) > 0.05) {
    result.push({
      id: makeWallId(),
      start: prev,
      end: end,
      thickness,
      height,
    });
  }

  return result;
}

function deduplicatePoints(points: Point[], threshold: number): Point[] {
  const result: Point[] = [];
  for (const p of points) {
    if (!result.some((r) => dist(r, p) < threshold)) {
      result.push(p);
    }
  }
  return result;
}

// ── Opening Reconciliation ───────────────────────────────────────────────────

const ON_LINE_EPS = 0.05;

/**
 * After a wall split (or any wall-list mutation that changes ids), find each
 * opening a new home: the child segment that lies on the original wall's line
 * AND contains the opening's full footprint. Openings whose host wall vanished
 * outright, or whose footprint straddles a split point, are dropped — the
 * backend validates `opening.wallId ∈ walls` and would otherwise 400 the save.
 */
export function reassignOpeningsAfterWallChange(
  openings: OpeningData[],
  oldWalls: WallData[],
  newWalls: WallData[]
): OpeningData[] {
  const newWallById = new Map(newWalls.map((w) => [w.id, w]));
  const oldWallById = new Map(oldWalls.map((w) => [w.id, w]));
  const result: OpeningData[] = [];

  for (const opening of openings) {
    // Fast path: host wall still exists with the same id and the opening still
    // fits — keep it as-is.
    const stillHere = newWallById.get(opening.wallId);
    if (stillHere) {
      const len = dist(stillHere.start, stillHere.end);
      if (opening.offsetFromStart + opening.width <= len + 0.01) {
        result.push(opening);
        continue;
      }
    }

    const oldWall = oldWallById.get(opening.wallId);
    if (!oldWall) continue; // truly orphaned — drop

    // World position of the opening's start and end along the old wall.
    const oldLen = dist(oldWall.start, oldWall.end);
    if (oldLen < 1e-6) continue;
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

    // Find a new wall colinear with the old one that fully contains both ends.
    let assigned = false;
    for (const candidate of newWalls) {
      // Quick colinearity check: both endpoints lie close to the candidate's
      // infinite line.
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
      if (lo < -0.01 || hi > candidateLen + 0.01) continue;

      // Opening direction may be opposite to the candidate wall's direction.
      // Re-derive offsetFromStart relative to the candidate's `start`.
      result.push({
        ...opening,
        wallId: candidate.id,
        offsetFromStart: Math.max(0, lo),
      });
      assigned = true;
      break;
    }
    if (!assigned) {
      // Could not find a child that fully contains the opening — drop it.
    }
  }

  return result;
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

  for (const w of walls) {
    const sk = key(w.start);
    const ek = key(w.end);

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

      // Compute signed area (shoelace formula)
      const verts = faceKeys.map(parseKey);
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
        floors.push({
          id: newId(),
          vertices: verts,
        });
      }
    }
  }

  return floors;
}
