// ── Wall drag (perpendicular room resize) ────────────────────────────────────
// Pure geometry for dragging a closed-room wall along its normal. A drag moves
// a COLLINEAR CHAIN (the grabbed wall plus every collinear segment welded to it
// — a side split by a neighbor's T-junction always moves as one straight line)
// and drags along the touching endpoint of every attached wall, which stretches
// or shrinks to stay connected (AutoCAD-style connected edit). A wall shared by
// two rooms is a single segment bounding two faces, so translating it resizes
// both rooms — one grows, the neighbor shrinks — with no special-casing.
//
// Everything here is pure and store-free: `planWallDrag` is computed once when
// a drag arms, `snapWallDragDelta`/`applyWallDrag` run per preview step, and the
// store action re-plans against live state at commit.

import type {
  WallData,
  FloorData,
  FurnitureData,
  OpeningData,
} from "@/types/designer";
import { wallsAlongEdge, roundTo2 } from "./roomBuilder";
import { snapToGrid, type SnapEdge } from "./snapToGrid";
import {
  COLLINEAR_LINE_EPS,
  MIN_WALL_SEG,
  ENDPOINT_WELD_EPS,
} from "./wallGraph";
import { getFurnitureCollisionBoxes } from "./collision";
import { OPENING_END_MARGIN } from "./openingSnap";

type V = [number, number];

/** Minimum usable room span left after a drag — matches roomAlign's
 *  MIN_USABLE_SPAN and the 0.5 m floor on the room W×L inputs. */
const MIN_USABLE_SPAN = 0.5;
/** Snap engagement distance — matches snapToGrid's furniture SNAP_THRESHOLD. */
const SNAP_THRESHOLD = 0.3;
/** Clearance kept between the moving line and any parallel foreign wall, on
 *  top of both half-thicknesses — landing ON another line would stack
 *  collinear segments the graph only dedupes at exact-key equality. */
const PARALLEL_CLEARANCE = 0.05;

export interface WallDragPlan {
  /** The grabbed wall. */
  wallId: string;
  /** Canonical DRAG axis: "z" for walls running along x, "x" for walls along z. */
  axis: "x" | "z";
  /** Wall-line coordinate along the drag axis before the drag. */
  lineCoord: number;
  /** Collinear chain translating wholesale (includes wallId). */
  movingIds: string[];
  /** Attached-wall endpoints that follow the moved line (wall stretches). */
  riding: { wallId: string; end: "start" | "end" }[];
  /** Chain extent along the wall's RUN axis (for indicators + sweep tests). */
  spanLo: number;
  spanHi: number;
  /** Signed clamp bounds for the drag delta. Always bracket 0. */
  minDelta: number;
  maxDelta: number;
}

/** Component index helpers: run axis = along the wall, drag axis = its normal. */
function axes(plan: Pick<WallDragPlan, "axis">): { run: 0 | 1; drag: 0 | 1 } {
  return plan.axis === "z" ? { run: 0, drag: 1 } : { run: 1, drag: 0 };
}

function wallLen(w: WallData): number {
  return Math.hypot(w.end[0] - w.start[0], w.end[1] - w.start[1]);
}

/** "z"-draggable = wall runs along x; "x"-draggable = runs along z; else null.
 *  ABSOLUTE tolerance matched to COLLINEAR_LINE_EPS: any accepted wall lies
 *  within the collinear eps of its own axis line, so same-line siblings always
 *  chain — a normalized tolerance would accept a long slightly-tilted wall
 *  whose siblings then fail the on-line test and kink instead of translating. */
function dragAxisOf(w: WallData): "x" | "z" | null {
  if (wallLen(w) < MIN_WALL_SEG) return null;
  if (Math.abs(w.end[1] - w.start[1]) <= COLLINEAR_LINE_EPS) return "z";
  if (Math.abs(w.end[0] - w.start[0]) <= COLLINEAR_LINE_EPS) return "x";
  return null;
}

/**
 * Axis-aligned walls that bound at least one closed room — the set that gets
 * the resize cursor / arms a drag. Memoize on [walls, floors] at the call site.
 */
export function computeDraggableWallIds(
  walls: WallData[],
  floors: FloorData[]
): Set<string> {
  const out = new Set<string>();
  for (const floor of floors) {
    const n = floor.vertices.length;
    for (let i = 0; i < n; i++) {
      for (const w of wallsAlongEdge(
        floor.vertices[i],
        floor.vertices[(i + 1) % n],
        walls
      )) {
        if (dragAxisOf(w)) out.add(w.id);
      }
    }
  }
  return out;
}

/**
 * Build the full drag plan for one wall, or null when the wall is missing,
 * diagonal, or doesn't bound any closed room. Computed once at pointerdown
 * (and again inside the store action against live state at commit).
 */
export function planWallDrag(
  wallId: string,
  walls: WallData[],
  floors: FloorData[],
  furniture: FurnitureData[]
): WallDragPlan | null {
  const grabbed = walls.find((w) => w.id === wallId);
  if (!grabbed) return null;
  const axis = dragAxisOf(grabbed);
  if (!axis) return null;
  const run = axis === "z" ? 0 : 1;
  const drag = axis === "z" ? 1 : 0;
  const lineCoord = grabbed.start[drag];

  // ── Collinear chain: same line, connected through welded endpoints ────────
  const onLine = (w: WallData): boolean =>
    dragAxisOf(w) === axis &&
    Math.abs(w.start[drag] - lineCoord) <= COLLINEAR_LINE_EPS &&
    Math.abs(w.end[drag] - lineCoord) <= COLLINEAR_LINE_EPS;

  interface Seg {
    w: WallData;
    lo: number;
    hi: number;
  }
  const segsOnLine: Seg[] = walls
    .filter((w) => w.id !== grabbed.id && onLine(w))
    .map((w) => ({
      w,
      lo: Math.min(w.start[run], w.end[run]),
      hi: Math.max(w.start[run], w.end[run]),
    }));

  const chain = new Map<string, Seg>();
  chain.set(grabbed.id, {
    w: grabbed,
    lo: Math.min(grabbed.start[run], grabbed.end[run]),
    hi: Math.max(grabbed.start[run], grabbed.end[run]),
  });
  // BFS over 1D interval adjacency: segments join when their spans touch
  // within the endpoint-weld tolerance. Distant same-line walls stay out.
  let grew = true;
  while (grew) {
    grew = false;
    for (const seg of segsOnLine) {
      if (chain.has(seg.w.id)) continue;
      for (const c of chain.values()) {
        if (seg.lo <= c.hi + ENDPOINT_WELD_EPS && seg.hi >= c.lo - ENDPOINT_WELD_EPS) {
          chain.set(seg.w.id, seg);
          grew = true;
          break;
        }
      }
    }
  }

  let spanLo = Infinity;
  let spanHi = -Infinity;
  for (const c of chain.values()) {
    spanLo = Math.min(spanLo, c.lo);
    spanHi = Math.max(spanHi, c.hi);
  }

  // ── Eligibility: the chain must bound at least one closed room ────────────
  // Also collect every wall bounding an AFFECTED floor — walls on the far side
  // of the same room get a stricter dead zone below (min usable span, not just
  // clearance), which is what protects non-convex rooms whose bbox span is
  // larger than the local span at the dragged wall.
  const affectedFloors: FloorData[] = [];
  const affectedBoundIds = new Set<string>();
  for (const floor of floors) {
    const n = floor.vertices.length;
    const edgeIds: string[] = [];
    let bounds = false;
    for (let i = 0; i < n; i++) {
      for (const w of wallsAlongEdge(
        floor.vertices[i],
        floor.vertices[(i + 1) % n],
        walls
      )) {
        edgeIds.push(w.id);
        if (chain.has(w.id)) bounds = true;
      }
    }
    if (bounds) {
      affectedFloors.push(floor);
      for (const id of edgeIds) affectedBoundIds.add(id);
    }
  }
  if (affectedFloors.length === 0) return null;

  // ── Riding endpoints: attached walls stretch to follow the line ───────────
  const riding: { wallId: string; end: "start" | "end" }[] = [];
  for (const w of walls) {
    if (chain.has(w.id) || wallLen(w) < MIN_WALL_SEG) continue;
    for (const end of ["start", "end"] as const) {
      const p = w[end];
      if (
        Math.abs(p[drag] - lineCoord) <= ENDPOINT_WELD_EPS &&
        p[run] >= spanLo - ENDPOINT_WELD_EPS &&
        p[run] <= spanHi + ENDPOINT_WELD_EPS
      ) {
        riding.push({ wallId: w.id, end });
      }
    }
  }

  // ── Clamps — every bound brackets 0 so the wall can always stay put ───────
  let minDelta = -Infinity;
  let maxDelta = Infinity;

  // (a) each adjacent room keeps at least MIN_USABLE_SPAN usable along the
  // drag axis: shrinking a room is bounded by its own current span.
  for (const floor of affectedFloors) {
    let fLo = Infinity;
    let fHi = -Infinity;
    let cSum = 0;
    for (const v of floor.vertices) {
      fLo = Math.min(fLo, v[drag]);
      fHi = Math.max(fHi, v[drag]);
      cSum += v[drag];
    }
    const span = fHi - fLo;
    const interiorAbove = cSum / floor.vertices.length > lineCoord;
    const room = Math.max(0, span - MIN_USABLE_SPAN);
    if (interiorAbove) maxDelta = Math.min(maxDelta, room);
    else minDelta = Math.max(minDelta, -room);
  }

  // (b) attached walls that run along the drag axis must never collapse
  // through zero — keep MIN_WALL_SEG and the original direction.
  const wallById = new Map(walls.map((w) => [w.id, w]));
  for (const r of riding) {
    const w = wallById.get(r.wallId)!;
    const moved = w[r.end];
    const fixed = w[r.end === "start" ? "end" : "start"];
    const q = moved[run] - fixed[run];
    if (Math.abs(q) >= MIN_WALL_SEG) continue; // can't collapse along its run
    const p = moved[drag] - fixed[drag];
    if (p > 0) minDelta = Math.max(minDelta, Math.min(0, MIN_WALL_SEG - p));
    else if (p < 0) maxDelta = Math.min(maxDelta, Math.max(0, -MIN_WALL_SEG - p));
  }

  // (c) dead zone against parallel walls overlapping the chain's span. Walls
  // bounding an AFFECTED room keep the full min usable span (this is the
  // LOCAL span protection — the bbox check in (a) over-estimates the span of
  // non-convex rooms); foreign walls only need collision clearance.
  for (const w of walls) {
    if (chain.has(w.id) || dragAxisOf(w) !== axis) continue;
    const g = w.start[drag] - lineCoord;
    if (Math.abs(g) <= COLLINEAR_LINE_EPS) continue; // same line, not chained
    const lo = Math.min(w.start[run], w.end[run]);
    const hi = Math.max(w.start[run], w.end[run]);
    if (Math.min(hi, spanHi) - Math.max(lo, spanLo) <= 0.01) continue;
    const clearance = affectedBoundIds.has(w.id)
      ? MIN_USABLE_SPAN
      : PARALLEL_CLEARANCE;
    const minGap = (grabbed.thickness + w.thickness) / 2 + clearance;
    if (g > 0) maxDelta = Math.min(maxDelta, Math.max(0, g - minGap));
    else minDelta = Math.max(minDelta, Math.min(0, g + minGap));
  }

  // (d) never sweep through a detached perpendicular wall: a non-riding wall
  // crossing the moving line would commit an unsplit X-crossing the wall
  // graph cannot represent. Stop a segment-length short of its near endpoint.
  const ridingIds = new Set(riding.map((r) => r.wallId));
  for (const w of walls) {
    if (chain.has(w.id) || ridingIds.has(w.id) || wallLen(w) < MIN_WALL_SEG) continue;
    const other = axis === "z" ? "x" : "z";
    if (dragAxisOf(w) !== other) continue; // parallel/diagonal: handled above
    const runCoord = w.start[run];
    if (runCoord < spanLo - 0.01 || runCoord > spanHi + 0.01) continue;
    const dLo = Math.min(w.start[drag], w.end[drag]);
    const dHi = Math.max(w.start[drag], w.end[drag]);
    if (dLo > lineCoord) {
      maxDelta = Math.min(maxDelta, Math.max(0, dLo - lineCoord - MIN_WALL_SEG));
    } else if (dHi < lineCoord) {
      minDelta = Math.max(minDelta, Math.min(0, dHi - lineCoord + MIN_WALL_SEG));
    }
  }

  // (e) furniture in the sweep path: the wall face stops flush against the
  // nearest collision-box face (exact flush — no penetration tolerance).
  const half = grabbed.thickness / 2;
  for (const item of furniture) {
    for (const box of getFurnitureCollisionBoxes(item)) {
      const bLo = axis === "z" ? box.minX : box.minZ;
      const bHi = axis === "z" ? box.maxX : box.maxZ;
      if (Math.min(bHi, spanHi) - Math.max(bLo, spanLo) <= 0) continue;
      const nLo = axis === "z" ? box.minZ : box.minX;
      const nHi = axis === "z" ? box.maxZ : box.maxX;
      if ((nLo + nHi) / 2 >= lineCoord) {
        maxDelta = Math.min(maxDelta, Math.max(0, nLo - half - lineCoord));
      } else {
        minDelta = Math.max(minDelta, Math.min(0, nHi + half - lineCoord));
      }
    }
  }

  return {
    wallId,
    axis,
    lineCoord,
    movingIds: [...chain.keys()],
    riding,
    spanLo,
    spanHi,
    minDelta,
    maxDelta,
  };
}

export interface WallDragSnapResult {
  /** Clamped, snapped, cm-rounded delta — feed this to applyWallDrag. */
  delta: number;
  /** Grid line engaged by the snap, for the SnapIndicator. */
  snapEdge: SnapEdge | null;
  /** True when the raw pointer delta was cut off by a clamp bound. */
  clamped: boolean;
}

/** Round toward zero to the cm so rounding never escapes the clamp bounds.
 *  The epsilon keeps float noise in a bound (e.g. 2.3499999999999996 for a
 *  span-derived 2.35) from eating a centimetre of legal travel. */
function roundIntoBounds(delta: number, min: number, max: number): number {
  const EPS = 1e-9;
  let d = roundTo2(delta);
  if (d > max + EPS) d = Math.floor((max + EPS) * 100) / 100;
  if (d < min - EPS) d = Math.ceil((min - EPS) * 100) / 100;
  return Object.is(d, -0) ? 0 : d;
}

/**
 * Clamp + grid-snap + cm-round a raw pointer delta. Grid snapping follows the
 * global snap toggle (like the wall-draw pipeline); clamping always applies.
 */
export function snapWallDragDelta(
  plan: WallDragPlan,
  rawDelta: number,
  snapEnabled: boolean,
  gridSize: number
): WallDragSnapResult {
  const clamped = Math.max(plan.minDelta, Math.min(plan.maxDelta, rawDelta));
  const wasClamped = Math.abs(clamped - rawDelta) > 1e-9;

  let delta = clamped;
  let snapped = false;
  if (snapEnabled && gridSize > 0) {
    const target = snapToGrid(plan.lineCoord + clamped, gridSize);
    const cand = target - plan.lineCoord;
    if (
      Math.abs(cand - clamped) <= SNAP_THRESHOLD &&
      cand >= plan.minDelta - 1e-9 &&
      cand <= plan.maxDelta + 1e-9
    ) {
      delta = cand;
      snapped = true;
    }
  }

  delta = roundIntoBounds(delta, plan.minDelta, plan.maxDelta);

  let snapEdge: SnapEdge | null = null;
  if (snapped && delta !== 0) {
    const c = roundTo2(plan.lineCoord + delta);
    snapEdge =
      plan.axis === "z"
        ? { p1: [plan.spanLo, c], p2: [plan.spanHi, c] }
        : { p1: [c, plan.spanLo], p2: [c, plan.spanHi] };
  }

  return { delta, snapEdge, clamped: wasClamped };
}

/**
 * Apply a drag delta immutably: chain walls translate wholesale, riding
 * endpoints follow. The delta is cm-rounded once and every moved coordinate is
 * cm-rounded to the SAME value, so vertices that met before the drag stay
 * key-identical afterwards and findFloors keeps every face closed. Returns the
 * SAME array reference for a zero effective delta (no-op ⇒ no undo entry).
 */
export function applyWallDrag(
  plan: WallDragPlan,
  walls: WallData[],
  delta: number
): WallData[] {
  const d = roundIntoBounds(delta, plan.minDelta, plan.maxDelta);
  if (d === 0) return walls;

  const { drag } = axes(plan);
  const moving = new Set(plan.movingIds);
  const ridingByWall = new Map<string, Set<"start" | "end">>();
  for (const r of plan.riding) {
    const set = ridingByWall.get(r.wallId) ?? new Set();
    set.add(r.end);
    ridingByWall.set(r.wallId, set);
  }

  const move = (p: V): V => {
    const out: V = [p[0], p[1]];
    out[drag] = roundTo2(p[drag] + d);
    return out;
  };

  return walls.map((w) => {
    if (moving.has(w.id)) {
      return { ...w, start: move(w.start), end: move(w.end) };
    }
    const ends = ridingByWall.get(w.id);
    if (!ends) return w;
    return {
      ...w,
      start: ends.has("start") ? move(w.start) : w.start,
      end: ends.has("end") ? move(w.end) : w.end,
    };
  });
}

/**
 * Openings on ATTACHED walls whose start endpoint rides a large (>0.25 m) drag
 * would slide with the wall — reassignOpeningsAfterWallChange keeps raw
 * offsets on large endpoint moves, and which endpoint is `start` is a
 * draw-order accident. Re-anchor those offsets to the world position BEFORE
 * reassign runs so doors/windows hold still regardless of draw order. Small
 * (≤0.25 m) moves already world-preserve through reassign's weld branch.
 */
export function normalizeRidingOpenings(
  plan: WallDragPlan,
  walls: WallData[],
  openings: OpeningData[],
  delta: number
): OpeningData[] {
  const d = roundIntoBounds(delta, plan.minDelta, plan.maxDelta);
  if (Math.abs(d) <= 0.25) return openings;

  const { drag } = axes(plan);
  const wallById = new Map(walls.map((w) => [w.id, w]));
  const shiftByWall = new Map<string, number>();
  for (const r of plan.riding) {
    if (r.end !== "start") continue;
    const w = wallById.get(r.wallId);
    if (!w) continue;
    const len = wallLen(w);
    if (len < MIN_WALL_SEG) continue;
    const u = (w.end[drag] - w.start[drag]) / len;
    if (Math.abs(u) < 0.99) continue; // only walls running along the drag axis
    shiftByWall.set(r.wallId, u * d);
  }
  if (shiftByWall.size === 0) return openings;

  return openings.map((o) => {
    const shift = shiftByWall.get(o.wallId);
    if (shift === undefined) return o;
    return { ...o, offsetFromStart: roundTo2(o.offsetFromStart - shift) };
  });
}

/**
 * Openings that will NOT survive the commit at the given delta — rendered red
 * during the drag so destruction is predictable. Conservative approximation of
 * reassign's shift-to-fit: an opening is doomed when its shrunken host wall
 * can no longer hold it (alone, or together with its siblings).
 */
export function openingsAtRiskForDrag(
  plan: WallDragPlan,
  walls: WallData[],
  openings: OpeningData[],
  delta: number
): Set<string> {
  const doomed = new Set<string>();
  const d = roundIntoBounds(delta, plan.minDelta, plan.maxDelta);
  if (d === 0) return doomed;

  const { run, drag } = axes(plan);
  const wallById = new Map(walls.map((w) => [w.id, w]));

  for (const r of plan.riding) {
    const w = wallById.get(r.wallId);
    if (!w) continue;
    const moved = w[r.end];
    const fixed = w[r.end === "start" ? "end" : "start"];
    if (Math.abs(moved[run] - fixed[run]) >= MIN_WALL_SEG) continue; // not along drag axis
    const p = moved[drag] - fixed[drag];
    const newLen = Math.abs(p + d);
    if (newLen >= wallLen(w)) continue; // wall grows — nothing at risk

    const onWall = openings
      .filter((o) => o.wallId === w.id)
      .sort((a, b) => a.offsetFromStart - b.offsetFromStart);
    if (onWall.length === 0) continue;

    // Individually too big, then greedy total-capacity check: drop from the
    // moved end first — that matches where reassign runs out of room.
    let capacity = newLen - 2 * OPENING_END_MARGIN;
    const order =
      r.end === "end" ? [...onWall].reverse() : onWall; // moved-end first
    const survivors: OpeningData[] = [];
    for (const o of [...order].reverse()) {
      if (o.width <= capacity + 1e-9) {
        survivors.push(o);
        capacity -= o.width;
      }
    }
    for (const o of onWall) {
      if (!survivors.includes(o)) doomed.add(o.id);
    }
  }
  return doomed;
}
