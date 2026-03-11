import type { FurnitureData, WallData } from "@/components/designer/DesignerProvider";

interface AABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export function getFurnitureAABB(item: FurnitureData): AABB {
  // For 0/90/180/270 rotations, swap width/depth when rotated 90 or 270
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

function getWallAABB(wall: WallData): AABB {
  const ht = wall.thickness / 2;
  const minX = Math.min(wall.start[0], wall.end[0]) - ht;
  const maxX = Math.max(wall.start[0], wall.end[0]) + ht;
  const minZ = Math.min(wall.start[1], wall.end[1]) - ht;
  const maxZ = Math.max(wall.start[1], wall.end[1]) + ht;
  return { minX, maxX, minZ, maxZ };
}

function aabbOverlap(a: AABB, b: AABB): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
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
    if (aabbOverlap(box, getWallAABB(wall))) return true;
  }

  return false;
}
