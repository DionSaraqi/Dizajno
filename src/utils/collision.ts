import type { FurnitureData, WallData, CollisionBox } from "@/types/designer";
import { getFurnitureDef } from "@/utils/furnitureCatalog";

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

/**
 * Get all collision AABBs for a furniture item.
 * If the catalog defines collisionBoxes (for L-shapes etc), returns multiple
 * sub-AABBs rotated and positioned in world space.
 * Otherwise returns the single full AABB.
 */
function getFurnitureCollisionBoxes(item: FurnitureData): AABB[] {
  const def = getFurnitureDef(item.type);
  if (!def?.collisionBoxes || def.collisionBoxes.length === 0) {
    return [getFurnitureAABB(item)];
  }

  const isRotated = Math.abs(Math.sin(item.rotation)) > 0.5;
  const cx = item.position[0];
  const cz = item.position[1];

  return def.collisionBoxes.map((box) => {
    // Rotate offsets if the item is rotated 90/270
    const ox = isRotated ? box.offsetZ : box.offsetX;
    const oz = isRotated ? box.offsetX : box.offsetZ;
    const bw = isRotated ? box.depth : box.width;
    const bd = isRotated ? box.width : box.depth;

    // Handle 180 degree rotation (flip offsets)
    const rot = Math.round(item.rotation / (Math.PI / 2)) % 4;
    const flipX = (rot === 2 || rot === 3) ? -1 : 1;
    const flipZ = (rot === 1 || rot === 2) ? -1 : 1;

    const wx = cx + ox * flipX;
    const wz = cz + oz * flipZ;

    return {
      minX: wx - bw / 2,
      maxX: wx + bw / 2,
      minZ: wz - bd / 2,
      maxZ: wz + bd / 2,
    };
  });
}

function aabbOverlap(a: AABB, b: AABB): boolean {
  // Use a small inset so touching/flush edges don't count as overlap
  const E = COLLISION_INSET;
  return a.minX < b.maxX - E && a.maxX > b.minX + E && a.minZ < b.maxZ - E && a.maxZ > b.minZ + E;
}

/**
 * Check if an AABB overlaps with a wall segment (line with thickness).
 * Uses proper line-segment-to-AABB distance check instead of inflated AABB,
 * so diagonal walls don't block placement near corners.
 */
// Small inset so "flush/touching" doesn't count as overlapping.
// The snap system places furniture exactly touching walls — without this
// tolerance the collision check would reject snapped positions.
const COLLISION_INSET = 0.04;

function wallOverlapsAABB(wall: WallData, box: AABB): boolean {
  const ht = wall.thickness / 2;

  const ax = wall.start[0], az = wall.start[1];
  const bx = wall.end[0], bz = wall.end[1];
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz;

  if (len2 < 1e-10) {
    return circleOverlapsAABB(ax, az, ht - COLLISION_INSET, box);
  }

  // Expand the furniture box by wall half-thickness minus a small inset
  // so touching/flush placement is allowed but actual overlap is caught
  const margin = ht - COLLISION_INSET;
  const expanded: AABB = {
    minX: box.minX - margin,
    maxX: box.maxX + margin,
    minZ: box.minZ - margin,
    maxZ: box.maxZ + margin,
  };

  if (pointInAABB(ax, az, expanded) || pointInAABB(bx, bz, expanded)) {
    return true;
  }

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
  const itemBoxes = getFurnitureCollisionBoxes(item);

  for (const box of itemBoxes) {
    // Check against other furniture
    for (const other of allFurniture) {
      if (other.id === item.id) continue;
      const otherBoxes = getFurnitureCollisionBoxes(other);
      for (const otherBox of otherBoxes) {
        if (aabbOverlap(box, otherBox)) return true;
      }
    }

    // Check against walls
    for (const wall of walls) {
      if (wallOverlapsAABB(wall, box)) return true;
    }
  }

  return false;
}
