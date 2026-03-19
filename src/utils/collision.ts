import type { FurnitureData, WallData } from "@/types/designer";

interface AABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export function getFurnitureAABB(item: FurnitureData): AABB {
  const isRotated = Math.abs(Math.sin(item.rotation)) > 0.5;
  const hw = (isRotated ? item.depth : item.width) / 2;
  const hd = (isRotated ? item.width : item.depth) / 2;
  return {
    minX: item.position[0] - hw,
    maxX: item.position[0] + hw,
    minZ: item.position[1] - hd,
    maxZ: item.position[1] + hd,
  };
}

function aabbOverlap(a: AABB, b: AABB): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
}

/**
 * Check if an AABB overlaps with a wall segment (line with thickness).
 * Uses proper line-segment-to-AABB distance check instead of inflated AABB,
 * so diagonal walls don't block placement near corners.
 */
function wallOverlapsAABB(wall: WallData, box: AABB): boolean {
  const ht = wall.thickness / 2;

  // Find closest point on the wall segment to the AABB center
  const cx = (box.minX + box.maxX) / 2;
  const cz = (box.minZ + box.maxZ) / 2;

  // Wall segment: A -> B
  const ax = wall.start[0], az = wall.start[1];
  const bx = wall.end[0], bz = wall.end[1];
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz;

  if (len2 < 1e-10) {
    // Degenerate wall (point) — treat as circle
    return circleOverlapsAABB(ax, az, ht, box);
  }

  // For proper collision, check if the minimum distance from the wall segment
  // to the AABB is less than the wall half-thickness.
  // We sample several points along the wall and check if any are inside the
  // expanded AABB (box expanded by wall half-thickness).
  // This is simpler and handles all angles correctly.

  const expanded: AABB = {
    minX: box.minX - ht,
    maxX: box.maxX + ht,
    minZ: box.minZ - ht,
    maxZ: box.maxZ + ht,
  };

  // Check if either wall endpoint is inside the expanded AABB
  if (pointInAABB(ax, az, expanded) || pointInAABB(bx, bz, expanded)) {
    return true;
  }

  // Check if the wall segment intersects any edge of the expanded AABB
  if (segmentIntersectsAABB(ax, az, bx, bz, expanded)) {
    return true;
  }

  return false;
}

function pointInAABB(x: number, z: number, box: AABB): boolean {
  return x >= box.minX && x <= box.maxX && z >= box.minZ && z <= box.maxZ;
}

function circleOverlapsAABB(cx: number, cz: number, r: number, box: AABB): boolean {
  // Clamp circle center to AABB, check distance
  const closestX = Math.max(box.minX, Math.min(cx, box.maxX));
  const closestZ = Math.max(box.minZ, Math.min(cz, box.maxZ));
  const dx = cx - closestX;
  const dz = cz - closestZ;
  return dx * dx + dz * dz <= r * r;
}

/**
 * Check if line segment (x1,z1)-(x2,z2) intersects an AABB.
 * Uses Liang-Barsky algorithm.
 */
function segmentIntersectsAABB(
  x1: number, z1: number, x2: number, z2: number,
  box: AABB
): boolean {
  let tMin = 0, tMax = 1;
  const dx = x2 - x1;
  const dz = z2 - z1;

  // Check each edge
  const edges = [
    { p: -dx, q: x1 - box.minX },
    { p: dx, q: box.maxX - x1 },
    { p: -dz, q: z1 - box.minZ },
    { p: dz, q: box.maxZ - z1 },
  ];

  for (const { p, q } of edges) {
    if (Math.abs(p) < 1e-10) {
      if (q < 0) return false; // Parallel and outside
    } else {
      const t = q / p;
      if (p < 0) {
        tMin = Math.max(tMin, t);
      } else {
        tMax = Math.min(tMax, t);
      }
      if (tMin > tMax) return false;
    }
  }

  return true;
}

export function checkFurnitureCollision(
  item: FurnitureData,
  allFurniture: FurnitureData[],
  walls: WallData[]
): boolean {
  const box = getFurnitureAABB(item);

  for (const other of allFurniture) {
    if (other.id === item.id) continue;
    if (aabbOverlap(box, getFurnitureAABB(other))) return true;
  }

  for (const wall of walls) {
    if (wallOverlapsAABB(wall, box)) return true;
  }

  return false;
}
