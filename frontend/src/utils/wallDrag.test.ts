import { describe, it, expect } from "vitest";
import type { WallData, FloorData, FurnitureData, OpeningData } from "@/types/designer";
import {
  findFloors,
  reconcileLoadedFloors,
  reassignOpeningsAfterWallChange,
} from "./wallGraph";
import {
  planWallDrag,
  applyWallDrag,
  snapWallDragDelta,
  computeDraggableWallIds,
  normalizeRidingOpenings,
  openingsAtRiskForDrag,
} from "./wallDrag";

// ── Scene builders ───────────────────────────────────────────────────────────

const T = 0.15; // default wall thickness
let idSeq = 0;

function wall(start: [number, number], end: [number, number], thickness = T): WallData {
  return { id: `w${idSeq++}`, start, end, thickness, height: 2.5 };
}

/** Rect room from CENTERLINE corners (x0,z0)-(x1,z1), CW edge order. */
function rectWalls(x0: number, z0: number, x1: number, z1: number): {
  top: WallData;
  right: WallData;
  bottom: WallData;
  left: WallData;
  all: WallData[];
} {
  const top = wall([x0, z0], [x1, z0]);
  const right = wall([x1, z0], [x1, z1]);
  const bottom = wall([x1, z1], [x0, z1]);
  const left = wall([x0, z1], [x0, z0]);
  return { top, right, bottom, left, all: [top, right, bottom, left] };
}

function polyArea(verts: [number, number][]): number {
  let sum = 0;
  for (let i = 0; i < verts.length; i++) {
    const j = (i + 1) % verts.length;
    sum += verts[i][0] * verts[j][1] - verts[j][0] * verts[i][1];
  }
  return Math.abs(sum) / 2;
}

function furnitureBox(x: number, z: number, w = 1, d = 1): FurnitureData {
  return {
    id: `f${idSeq++}`,
    type: "__test_box__", // not in the catalog → plain AABB from width/depth
    position: [x, z],
    rotation: 0,
    width: w,
    depth: d,
    height: 1,
    color: "#888",
  };
}

// Single 4×3 room, centerlines (0,0)-(4,3). Usable ≈ 3.85 × 2.85.
function singleRoom() {
  const r = rectWalls(0, 0, 4, 3);
  const floors = findFloors(r.all);
  return { ...r, floors };
}

// Two rooms side by side sharing the vertical wall at x=4:
// A (0,0)-(4,3), B (4,0)-(7,3). The shared wall is ONE segment.
function sharedWallRooms() {
  const shared = wall([4, 0], [4, 3]);
  const aTop = wall([0, 0], [4, 0]);
  const aBottom = wall([4, 3], [0, 3]);
  const aLeft = wall([0, 3], [0, 0]);
  const bTop = wall([4, 0], [7, 0]);
  const bRight = wall([7, 0], [7, 3]);
  const bBottom = wall([7, 3], [4, 3]);
  const all = [shared, aTop, aBottom, aLeft, bTop, bRight, bBottom];
  const floors = findFloors(all);
  return { shared, aTop, aBottom, aLeft, bTop, bRight, bBottom, all, floors };
}

// Room whose bottom side is split into two collinear segments by a T-joining
// wall running south from (2,3) to (2,5).
function tJunctionRoom() {
  const top = wall([0, 0], [4, 0]);
  const right = wall([4, 0], [4, 3]);
  const bottom1 = wall([4, 3], [2, 3]);
  const bottom2 = wall([2, 3], [0, 3]);
  const left = wall([0, 3], [0, 0]);
  const tee = wall([2, 3], [2, 5]);
  const all = [top, right, bottom1, bottom2, left, tee];
  const floors = findFloors(all);
  return { top, right, bottom1, bottom2, left, tee, all, floors };
}

// ── planWallDrag ─────────────────────────────────────────────────────────────

describe("planWallDrag", () => {
  it("plans a single-room wall: chain of one, two riding corners, span clamp", () => {
    const { top, all, floors } = singleRoom();
    const plan = planWallDrag(top.id, all, floors, []);
    expect(plan).not.toBeNull();
    expect(plan!.axis).toBe("z"); // top wall runs along x → drags in z
    expect(plan!.movingIds).toEqual([top.id]);
    // Left + right walls each contribute their z=0 endpoint.
    expect(plan!.riding).toHaveLength(2);
    // Interior is below (z>0) → dragging +z shrinks the room: usable span
    // ≈ 2.85, so the clamp leaves 0.5 → maxDelta ≈ 2.35. Nothing bounds -z.
    expect(plan!.maxDelta).toBeCloseTo(2.35, 2);
    expect(plan!.minDelta).toBe(-Infinity);
  });

  it("returns null for dangling and missing walls", () => {
    const { all, floors } = singleRoom();
    const dangling = wall([10, 10], [12, 10]);
    const walls = [...all, dangling];
    expect(planWallDrag(dangling.id, walls, floors, [])).toBeNull();
    expect(planWallDrag("nope", walls, floors, [])).toBeNull();
  });

  it("returns null for diagonal walls", () => {
    const { all, floors } = singleRoom();
    const diag = wall([0, 0], [2, 2]);
    expect(planWallDrag(diag.id, [...all, diag], floors, [])).toBeNull();
  });

  it("shared wall: bounds from BOTH rooms, riding endpoints from both sides", () => {
    const { shared, all, floors } = sharedWallRooms();
    expect(floors).toHaveLength(2);
    const plan = planWallDrag(shared.id, all, floors, []);
    expect(plan).not.toBeNull();
    expect(plan!.axis).toBe("x");
    expect(plan!.movingIds).toEqual([shared.id]);
    // aTop end, aBottom start, bTop start, bBottom end all sit on x=4.
    expect(plan!.riding).toHaveLength(4);
    // Room A usable ≈ 3.85 (shrinks when delta < 0), room B ≈ 2.85 (delta > 0).
    expect(plan!.minDelta).toBeCloseTo(-(3.85 - 0.5), 2);
    expect(plan!.maxDelta).toBeCloseTo(2.85 - 0.5, 2);
  });

  it("T-split side: whole collinear chain moves, tee endpoint rides", () => {
    const { bottom1, bottom2, tee, all, floors } = tJunctionRoom();
    const plan = planWallDrag(bottom2.id, all, floors, []);
    expect(plan).not.toBeNull();
    expect(new Set(plan!.movingIds)).toEqual(new Set([bottom1.id, bottom2.id]));
    const rideIds = plan!.riding.map((r) => r.wallId);
    expect(rideIds).toContain(tee.id);
    const teeRide = plan!.riding.find((r) => r.wallId === tee.id)!;
    expect(teeRide.end).toBe("start"); // (2,3) is the tee's start
  });

  it("distant collinear wall is NOT chained and not moved", () => {
    const { bottom2, all, floors } = tJunctionRoom();
    const distant = wall([10, 3], [12, 3]); // same line z=3, far away
    const walls = [...all, distant];
    const plan = planWallDrag(bottom2.id, walls, floors, [])!;
    expect(plan.movingIds).not.toContain(distant.id);
    const moved = applyWallDrag(plan, walls, 0.5);
    const after = moved.find((w) => w.id === distant.id)!;
    expect(after.start).toEqual([10, 3]);
    expect(after.end).toEqual([12, 3]);
  });

  it("clamps flush against furniture in the sweep path", () => {
    const { bottom1, all, floors } = tJunctionRoom();
    // 1×1 box centered at (2, 4.5) → near face z=4; bottom line z=3.
    const plan = planWallDrag(bottom1.id, all, floors, [furnitureBox(2, 4.5)])!;
    expect(plan.maxDelta).toBeCloseTo(4 - T / 2 - 3, 3); // 0.925 exact flush
  });

  it("ignores furniture with no overlap along the wall's run", () => {
    const { bottom1, all, floors } = tJunctionRoom();
    const plan = planWallDrag(bottom1.id, all, floors, [furnitureBox(20, 4.5)])!;
    // Unbounded by the far-away furniture — the remaining bound is the tee
    // wall's own min-length clamp: it is 2 m long and must keep 0.05.
    expect(plan.maxDelta).toBeCloseTo(1.95, 3);
  });

  it("keeps a dead zone before a parallel foreign wall", () => {
    const { bottom1, all, floors } = tJunctionRoom();
    const parallel = wall([0, 5], [4, 5]);
    const plan = planWallDrag(bottom1.id, [...all, parallel], floors, [])!;
    // gap 2, minGap = (0.15+0.15)/2 + 0.05 = 0.2 → maxDelta 1.8
    expect(plan.maxDelta).toBeCloseTo(1.8, 3);
  });
});

// ── applyWallDrag ────────────────────────────────────────────────────────────

describe("applyWallDrag", () => {
  it("moves the chain wholesale and stretches riding walls; both rooms re-derive", () => {
    const { shared, aLeft, bRight, all, floors } = sharedWallRooms();
    const plan = planWallDrag(shared.id, all, floors, [])!;
    const moved = applyWallDrag(plan, all, 1);

    const sharedAfter = moved.find((w) => w.id === shared.id)!;
    expect(sharedAfter.start).toEqual([5, 0]);
    expect(sharedAfter.end).toEqual([5, 3]);
    // Outer walls untouched.
    expect(moved.find((w) => w.id === aLeft.id)!.start).toEqual([0, 3]);
    expect(moved.find((w) => w.id === bRight.id)!.start).toEqual([7, 0]);

    // Both faces still close; A grew, B shrank.
    const newFloors = findFloors(moved);
    expect(newFloors).toHaveLength(2);
    const areas = newFloors.map((f) => polyArea(f.vertices)).sort((a, b) => a - b);
    expect(areas[0]).toBeCloseTo(1.85 * 2.85, 2); // B: (3−1−0.15) × 2.85
    expect(areas[1]).toBeCloseTo(4.85 * 2.85, 2); // A: (4+1−0.15) × 2.85
  });

  it("returns the SAME array for zero and sub-cm deltas (no-op contract)", () => {
    const { top, all, floors } = singleRoom();
    const plan = planWallDrag(top.id, all, floors, [])!;
    expect(applyWallDrag(plan, all, 0)).toBe(all);
    expect(applyWallDrag(plan, all, 0.004)).toBe(all);
  });

  it("preserves ids, thickness, height and paint across the move", () => {
    const { top, all, floors } = singleRoom();
    const painted = all.map((w) =>
      w.id === top.id ? { ...w, paintVariantId: "paint-1" } : w
    );
    const plan = planWallDrag(top.id, painted, floors, [])!;
    const moved = applyWallDrag(plan, painted, -0.5);
    const after = moved.find((w) => w.id === top.id)!;
    expect(after.paintVariantId).toBe("paint-1");
    expect(after.thickness).toBe(T);
    expect(after.height).toBe(2.5);
    expect(after.start).toEqual([0, -0.5]);
  });

  it("keeps every moved corner key-identical (T-split side stays welded)", () => {
    const { bottom2, tee, all, floors } = tJunctionRoom();
    const plan = planWallDrag(bottom2.id, all, floors, [])!;
    const moved = applyWallDrag(plan, all, 0.37);
    // The tee junction vertex must equal both bottom segments' shared vertex.
    const teeAfter = moved.find((w) => w.id === tee.id)!;
    expect(teeAfter.start).toEqual([2, 3.37]);
    expect(teeAfter.end).toEqual([2, 5]); // far endpoint fixed
    const floorsAfter = findFloors(moved);
    expect(floorsAfter).toHaveLength(1); // room still closed
    expect(polyArea(floorsAfter[0].vertices)).toBeCloseTo(3.85 * (2.85 + 0.37), 2);
  });

  it("clamps deltas beyond the plan bounds instead of applying them", () => {
    const { shared, all, floors } = sharedWallRooms();
    const plan = planWallDrag(shared.id, all, floors, [])!;
    const moved = applyWallDrag(plan, all, 99);
    const after = moved.find((w) => w.id === shared.id)!;
    expect(after.start[0]).toBeCloseTo(4 + plan.maxDelta, 2);
  });
});

// ── snapWallDragDelta ────────────────────────────────────────────────────────

describe("snapWallDragDelta", () => {
  it("snaps the moved line to grid multiples when snap is on", () => {
    const { top, all, floors } = singleRoom();
    const plan = planWallDrag(top.id, all, floors, [])!; // lineCoord 0
    const res = snapWallDragDelta(plan, -0.85, true, 1);
    expect(res.delta).toBe(-1);
    expect(res.snapEdge).not.toBeNull();
    expect(res.clamped).toBe(false);
  });

  it("keeps the raw (cm-rounded) delta when snap is off", () => {
    const { top, all, floors } = singleRoom();
    const plan = planWallDrag(top.id, all, floors, [])!;
    const res = snapWallDragDelta(plan, -0.853, false, 1);
    expect(res.delta).toBeCloseTo(-0.85, 5);
    expect(res.snapEdge).toBeNull();
  });

  it("flags and clamps deltas beyond the bounds", () => {
    const { top, all, floors } = singleRoom();
    const plan = planWallDrag(top.id, all, floors, [])!; // maxDelta ≈ 2.35
    const res = snapWallDragDelta(plan, 10, false, 1);
    expect(res.clamped).toBe(true);
    // cm-rounded within the bounds' 1e-9 float-noise tolerance
    expect(res.delta).toBeLessThanOrEqual(plan.maxDelta + 1e-9);
  });
});

// ── computeDraggableWallIds ──────────────────────────────────────────────────

describe("computeDraggableWallIds", () => {
  it("includes room walls, excludes dangling walls", () => {
    const { all, floors } = singleRoom();
    const dangling = wall([10, 10], [12, 10]);
    const ids = computeDraggableWallIds([...all, dangling], floors);
    for (const w of all) expect(ids.has(w.id)).toBe(true);
    expect(ids.has(dangling.id)).toBe(false);
  });
});

// ── opening helpers ──────────────────────────────────────────────────────────

function openingOn(w: WallData, offset: number, width = 0.8): OpeningData {
  return {
    id: `o${idSeq++}`,
    wallId: w.id,
    type: "door",
    offsetFromStart: offset,
    width,
    height: 2.1,
    sillHeight: 0,
  };
}

describe("normalizeRidingOpenings", () => {
  it("re-anchors openings on start-moved riding walls so they hold world position", () => {
    const { bottom2, tee, all, floors } = tJunctionRoom();
    const plan = planWallDrag(bottom2.id, all, floors, [])!;
    const door = openingOn(tee, 1.0);
    // Drag +0.5 (>0.25 → reassign would keep the raw offset and slide the
    // door). The tee's start rides: world position of the door edge is
    // start + 1.0 along +z; after the move start sits 0.5 closer, so the
    // offset must shrink to 0.5.
    const out = normalizeRidingOpenings(plan, all, [door], 0.5);
    expect(out.find((o) => o.id === door.id)!.offsetFromStart).toBeCloseTo(0.5, 5);
  });

  it("leaves openings alone for weld-scale (≤0.25) drags", () => {
    const { bottom2, tee, all, floors } = tJunctionRoom();
    const plan = planWallDrag(bottom2.id, all, floors, [])!;
    const openings = [openingOn(tee, 1.0)];
    const out = normalizeRidingOpenings(plan, all, openings, 0.2);
    expect(out).toBe(openings); // same reference — reassign world-preserves ≤0.25
  });
});

describe("openingsAtRiskForDrag", () => {
  it("marks openings that can no longer fit on a shrinking wall", () => {
    const { bottom2, tee, all, floors } = tJunctionRoom();
    const plan = planWallDrag(bottom2.id, all, floors, [])!;
    // tee is 2 m long; a 0.8 door needs 0.8 + 2×0.15 = 1.1 m.
    const door = openingOn(tee, 1.0);
    expect(openingsAtRiskForDrag(plan, all, [door], 0.7).has(door.id)).toBe(false); // 1.3 left
    expect(openingsAtRiskForDrag(plan, all, [door], 1.0).has(door.id)).toBe(true); // 1.0 left
  });

  it("never marks openings when the wall grows", () => {
    const { bottom2, tee, all, floors } = tJunctionRoom();
    const plan = planWallDrag(bottom2.id, all, floors, [])!;
    const door = openingOn(tee, 1.0);
    expect(openingsAtRiskForDrag(plan, all, [door], -1.5).size).toBe(0);
  });
});

// ── review-fix regressions ───────────────────────────────────────────────────

describe("review regressions", () => {
  it("never commits a NEGATIVE offset when a drag sweeps past an opening (shift or drop)", () => {
    const { shared, bTop, all, floors } = sharedWallRooms();
    // Door on B's top wall 0.5 m from its start (which sits ON the shared wall).
    const door = openingOn(bTop, 0.5);
    const plan = planWallDrag(shared.id, all, floors, [])!;
    const delta = 1.0; // sweeps the riding start endpoint past the door
    const normalized = normalizeRidingOpenings(plan, all, [door], delta);
    expect(normalized[0].offsetFromStart).toBeCloseTo(-0.5, 5); // world-anchored
    const moved = applyWallDrag(plan, all, delta);
    const { openings: out } = reassignOpeningsAfterWallChange(normalized, all, moved);
    // The door must either slide back onto the shrunken wall or be dropped —
    // a negative offset would render it floating off its host wall.
    for (const o of out) expect(o.offsetFromStart).toBeGreaterThanOrEqual(0);
  });

  it("rejects near-axis tilted walls instead of kinking their chain", () => {
    const { all, floors } = singleRoom();
    // 4 m wall with 5 cm drift: old normalized tolerance (0.01) accepted it,
    // but its collinear siblings would fail the 0.02 on-line test and kink.
    const tilted = wall([10, 10], [14, 10.05]);
    expect(planWallDrag(tilted.id, [...all, tilted], floors, [])).toBeNull();
  });

  it("protects the LOCAL span of a non-convex room (L-shape leg)", () => {
    // L-shaped room: 4×1.5 base with a 2-wide leg extending to z=3.
    const outline: [number, number][] = [
      [0, 0], [4, 0], [4, 1.5], [2, 1.5], [2, 3], [0, 3],
    ];
    const walls: WallData[] = outline.map((v, i) =>
      wall(v, outline[(i + 1) % outline.length])
    );
    const floors = findFloors(walls);
    expect(floors).toHaveLength(1);
    // Drag the leg's bottom wall (4,1.5)→(2,1.5) UP (−z): the whole-floor bbox
    // span (2.85) would allow −2.35, but the top wall bounds the SAME room, so
    // the dead zone keeps the full usable span: −1.5 + (0.15 + 0.5) = −0.85.
    const legBottom = walls[2];
    const plan = planWallDrag(legBottom.id, walls, floors, [])!;
    expect(plan.minDelta).toBeCloseTo(-0.85, 3);
    // Growing the leg (+z) is bounded by the middle wall's min-length: 1.45.
    expect(plan.maxDelta).toBeCloseTo(1.45, 3);
  });

  it("stops the sweep before a detached perpendicular wall (no unsplit crossings)", () => {
    const { bottom1, all, floors } = tJunctionRoom();
    // Free-standing wall perpendicular to the dragged line, in its path,
    // NOT touching it: (2,4)→(2,6). (The tee at (2,3)→(2,5) rides; replace it.)
    const detached = wall([2.9, 3.6], [2.9, 6]);
    const walls = [...all, detached];
    const plan = planWallDrag(bottom1.id, walls, floors, [])!;
    // near endpoint z=3.6, line at z=3 → clamp at 3.6 − 3 − 0.05 = 0.55
    expect(plan.maxDelta).toBeCloseTo(0.55, 3);
    expect(plan.movingIds).not.toContain(detached.id);
  });
});

// ── reconcileLoadedFloors with prevWalls ─────────────────────────────────────

describe("reconcileLoadedFloors (wall-id matching)", () => {
  it("carries flooring material across a drag larger than the 1 m centroid budget", () => {
    const { shared, all, floors } = sharedWallRooms();
    // Give room A (centroid x ≈ 2) a flooring material.
    const withMaterial = floors.map((f) => {
      const cx = f.vertices.reduce((s, v) => s + v[0], 0) / f.vertices.length;
      return cx < 4 ? { ...f, flooringVariantId: "floor-oak" } : f;
    });
    const plan = planWallDrag(shared.id, all, withMaterial, [])!;
    const moved = applyWallDrag(plan, all, 2.3); // A centroid moves ~1.15 m
    const out = reconcileLoadedFloors(moved, withMaterial, all);
    expect(out).toHaveLength(2);
    const bigger = out.reduce((a, b) =>
      polyArea(a.vertices) > polyArea(b.vertices) ? a : b
    );
    expect(bigger.flooringVariantId).toBe("floor-oak");
  });
});
