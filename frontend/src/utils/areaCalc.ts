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
