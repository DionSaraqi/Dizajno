import type {
  FloorData,
  OpeningData,
  WallData,
} from "@/types/designer";

export interface RoomAreas {
  /** Sum of floor polygon areas in m² (shoelace formula per floor). */
  floorAreaM2: number;
  /** Total paintable wall surface: Σ(wallLength × wallHeight) − Σ(opening area). */
  paintableWallM2: number;
  /** Total opening area cut out of walls, in m². Exposed for diagnostics + UI. */
  openingAreaM2: number;
}

interface SceneSlice {
  walls: ReadonlyArray<WallData>;
  floors: ReadonlyArray<FloorData>;
  openings: ReadonlyArray<OpeningData>;
}

/**
 * Computes the floor + paintable-wall areas of a designer scene. Used by the
 * RequestQuoteDialog "Materials & finishes" section to suggest paint and
 * flooring quantities before the user submits a quote.
 *
 * Floors use the shoelace formula (works for any simple polygon, convex or
 * concave). Walls multiply length × height and subtract the opening areas.
 * The result is purely informational — the user can override the suggestion
 * in the dialog before submitting.
 */
export function computeRoomAreas(scene: SceneSlice): RoomAreas {
  const floorAreaM2 = scene.floors.reduce(
    (acc, f) => acc + polygonArea(f.vertices),
    0
  );

  let wallSurfaceM2 = 0;
  for (const wall of scene.walls) {
    const length = distance(wall.start, wall.end);
    wallSurfaceM2 += length * wall.height;
  }

  const openingAreaM2 = scene.openings.reduce(
    (acc, o) => acc + o.width * o.height,
    0
  );

  const paintableWallM2 = Math.max(0, wallSurfaceM2 - openingAreaM2);

  return { floorAreaM2, paintableWallM2, openingAreaM2 };
}

export function polygonArea(vertices: ReadonlyArray<readonly [number, number]>): number {
  if (vertices.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < vertices.length; i++) {
    const [x1, z1] = vertices[i];
    const [x2, z2] = vertices[(i + 1) % vertices.length];
    sum += x1 * z2 - x2 * z1;
  }
  return Math.abs(sum) / 2;
}

function distance(a: readonly [number, number], b: readonly [number, number]): number {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  return Math.sqrt(dx * dx + dz * dz);
}

/** Standard ray-casting point-in-polygon test in the XZ plane. */
export function pointInPolygon(
  point: readonly [number, number],
  vertices: ReadonlyArray<readonly [number, number]>
): boolean {
  if (vertices.length < 3) return false;
  const [px, pz] = point;
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const [xi, zi] = vertices[i];
    const [xj, zj] = vertices[j];
    if (zi > pz !== zj > pz && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// ── Inner (usable) floor area ──────────────────────────────────────────────────
// Floor polygons are traced along wall *centerlines*, so their area includes the
// footprint under the walls. The inner usable area is the polygon inset inward
// by each bounding wall's half-thickness — the area between the walls' inner
// faces, which is what people mean by "room size".

type Pt = readonly [number, number];

function norm2(x: number, z: number): [number, number] {
  const l = Math.hypot(x, z) || 1;
  return [x / l, z / l];
}

/** Distance from point p to segment a→b. */
function pointSegDistance(p: Pt, a: Pt, b: Pt): number {
  const abx = b[0] - a[0];
  const abz = b[1] - a[1];
  const len2 = abx * abx + abz * abz;
  let t = len2 > 0 ? ((p[0] - a[0]) * abx + (p[1] - a[1]) * abz) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * abx), p[1] - (a[1] + t * abz));
}

/**
 * Half-thickness of the wall lying on the floor edge vi→vj. Matches the wall
 * whose centerline is parallel to the edge and passes through its midpoint
 * (robust to walls that were split at intersections). Returns 0 when no wall
 * bounds the edge, so that edge isn't inset.
 */
function edgeWallHalfThickness(vi: Pt, vj: Pt, walls: ReadonlyArray<WallData>): number {
  const mid: Pt = [(vi[0] + vj[0]) / 2, (vi[1] + vj[1]) / 2];
  const [edx, edz] = norm2(vj[0] - vi[0], vj[1] - vi[1]);
  let best = 0;
  let bestDist = Infinity;
  for (const w of walls) {
    const [wdx, wdz] = norm2(w.end[0] - w.start[0], w.end[1] - w.start[1]);
    if (Math.abs(edx * wdx + edz * wdz) < 0.9) continue; // not parallel
    const d = pointSegDistance(mid, w.start, w.end);
    if (d < bestDist) {
      bestDist = d;
      best = w.thickness / 2;
    }
  }
  return bestDist < 0.2 ? best : 0;
}

/**
 * Inset a centerline floor polygon inward by each bounding wall's half-thickness.
 * Each edge is offset toward the polygon interior, then consecutive offset lines
 * are intersected to form the new corners. Small offsets (wall thickness) keep
 * this stable for convex and L-shaped rooms alike.
 */
export function insetFloorPolygon(
  vertices: ReadonlyArray<readonly [number, number]>,
  walls: ReadonlyArray<WallData>
): [number, number][] {
  const n = vertices.length;
  if (n < 3) return vertices.map((v) => [v[0], v[1]] as [number, number]);

  const cx = vertices.reduce((s, v) => s + v[0], 0) / n;
  const cz = vertices.reduce((s, v) => s + v[1], 0) / n;

  // Offset line per edge: a point on the line + its direction.
  const lines = vertices.map((vi, i) => {
    const vj = vertices[(i + 1) % n];
    const [dx, dz] = norm2(vj[0] - vi[0], vj[1] - vi[1]);
    let nx = -dz;
    let nz = dx; // perpendicular
    const mx = (vi[0] + vj[0]) / 2;
    const mz = (vi[1] + vj[1]) / 2;
    if (nx * (cx - mx) + nz * (cz - mz) < 0) {
      nx = -nx;
      nz = -nz; // point inward (toward centroid)
    }
    const d = edgeWallHalfThickness(vi, vj, walls);
    return { px: vi[0] + nx * d, pz: vi[1] + nz * d, dx, dz };
  });

  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = lines[(i - 1 + n) % n];
    const b = lines[i];
    const denom = a.dx * b.dz - a.dz * b.dx;
    if (Math.abs(denom) < 1e-9) {
      out.push([vertices[i][0], vertices[i][1]]); // parallel — keep original
      continue;
    }
    const t = ((b.px - a.px) * b.dz - (b.pz - a.pz) * b.dx) / denom;
    out.push([a.px + t * a.dx, a.pz + t * a.dz]);
  }
  return out;
}

/**
 * Suggests a quantity for a building-material item based on the calculated
 * room areas + the product's coverage rate (m²/L for paint) and waste factor.
 * Returns null if the unit isn't one we know how to size — the dialog will
 * prompt the user to enter a number manually.
 *
 * - SquareMeter → assumes the product covers floor area (flooring, vinyl).
 *   Quantity = floorAreaM2 × (1 + wasteFactor), rounded to one decimal.
 * - Liter with coverageRate → assumes paint coverage of walls.
 *   Quantity = ceil(paintableWallM2 / coverageRate × (1 + wasteFactor)).
 */
export function suggestMaterialQuantity(
  unitOfSale: string | undefined,
  coverageRate: number | null | undefined,
  wasteFactor: number | undefined,
  areas: RoomAreas
): number | null {
  const waste = wasteFactor ?? 0;
  if (unitOfSale === "SquareMeter") {
    return roundTo(areas.floorAreaM2 * (1 + waste), 1);
  }
  if (unitOfSale === "Liter" && coverageRate && coverageRate > 0) {
    return Math.ceil((areas.paintableWallM2 / coverageRate) * (1 + waste));
  }
  return null;
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Short display unit shown next to the suggested quantity. Maps the
 *  PascalCase enum to a human-friendly abbreviation. */
export function unitLabel(unitOfSale: string | undefined): string {
  switch (unitOfSale) {
    case "Liter":
      return "L";
    case "SquareMeter":
      return "m²";
    case "LinearMeter":
      return "m";
    case "Kilogram":
      return "kg";
    default:
      return "pcs";
  }
}

/** Short token used as the `quantityUnit` field on QuoteLine.
 *  Matches what the backend tests assert against. */
export function quantityUnitToken(unitOfSale: string | undefined): string {
  switch (unitOfSale) {
    case "Liter":
      return "L";
    case "SquareMeter":
      return "m2";
    case "LinearMeter":
      return "m";
    case "Kilogram":
      return "kg";
    default:
      return "piece";
  }
}
