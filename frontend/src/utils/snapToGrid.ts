import type { FurnitureData, WallData } from "@/types/designer";

// ── Grid Snap ────────────────────────────────────────────────────────────────

export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

export function snapPoint(
  x: number,
  z: number,
  gridSize: number
): [number, number] {
  return [snapToGrid(x, gridSize), snapToGrid(z, gridSize)];
}

// ── AABB helper (mirrors collision.ts to avoid circular deps) ────────────────

export interface AABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export function getFurnitureAABBSnap(item: {
  position: [number, number];
  rotation: number;
  width: number;
  depth: number;
}): AABB {
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

function getWallAABBSnap(wall: WallData): AABB {
  const ht = wall.thickness / 2;
  return {
    minX: Math.min(wall.start[0], wall.end[0]) - ht,
    maxX: Math.max(wall.start[0], wall.end[0]) + ht,
    minZ: Math.min(wall.start[1], wall.end[1]) - ht,
    maxZ: Math.max(wall.start[1], wall.end[1]) + ht,
  };
}

// ── Snap Result ───────────────────────────────────────────────────────────────

export type SnapAxis = "x" | "z" | "xz" | null;

export interface SnapResult {
  position: [number, number];
  /** Which world-space edge the item snapped to (for drawing the indicator) */
  snapEdge: SnapEdge | null;
}

export interface SnapEdge {
  /** Two world-space [x,z] points defining the indicator line */
  p1: [number, number];
  p2: [number, number];
}

// ── Wall Snap ─────────────────────────────────────────────────────────────────

const SNAP_THRESHOLD = 0.3;

/**
 * Tries to snap an item (by its desired center) to any wall face.
 * Returns adjusted [x, z] plus the wall edge that triggered the snap.
 */
export function snapToWalls(
  x: number,
  z: number,
  item: { rotation: number; width: number; depth: number },
  walls: WallData[]
): SnapResult {
  const isRotated = Math.abs(Math.sin(item.rotation)) > 0.5;
  const hw = (isRotated ? item.depth : item.width) / 2;
  const hd = (isRotated ? item.width : item.depth) / 2;

  let bestX = x;
  let bestZ = z;
  let bestDist = SNAP_THRESHOLD + 1;
  let snapEdge: SnapEdge | null = null;

  for (const wall of walls) {
    const waabb = getWallAABBSnap(wall);

    // Determine if the wall is predominantly horizontal or vertical
    const dx = Math.abs(wall.end[0] - wall.start[0]);
    const dz = Math.abs(wall.end[1] - wall.start[1]);
    const isHorizontal = dx >= dz; // wall runs along X

    if (isHorizontal) {
      // The wall's top face (minZ side) and bottom face (maxZ side)

      // Snap item's bottom edge to wall's top face
      const distTop = Math.abs(z + hd - waabb.minZ);
      if (distTop < SNAP_THRESHOLD && distTop < bestDist) {
        bestDist = distTop;
        bestZ = waabb.minZ - hd;
        bestX = x;
        snapEdge = { p1: [waabb.minX, waabb.minZ], p2: [waabb.maxX, waabb.minZ] };
      }

      // Snap item's top edge to wall's bottom face
      const distBottom = Math.abs(z - hd - waabb.maxZ);
      if (distBottom < SNAP_THRESHOLD && distBottom < bestDist) {
        bestDist = distBottom;
        bestZ = waabb.maxZ + hd;
        bestX = x;
        snapEdge = { p1: [waabb.minX, waabb.maxZ], p2: [waabb.maxX, waabb.maxZ] };
      }
    } else {
      // Wall runs along Z — left face (minX) and right face (maxX)

      // Snap item's right edge to wall's left face
      const distLeft = Math.abs(x + hw - waabb.minX);
      if (distLeft < SNAP_THRESHOLD && distLeft < bestDist) {
        bestDist = distLeft;
        bestX = waabb.minX - hw;
        bestZ = z;
        snapEdge = { p1: [waabb.minX, waabb.minZ], p2: [waabb.minX, waabb.maxZ] };
      }

      // Snap item's left edge to wall's right face
      const distRight = Math.abs(x - hw - waabb.maxX);
      if (distRight < SNAP_THRESHOLD && distRight < bestDist) {
        bestDist = distRight;
        bestX = waabb.maxX + hw;
        bestZ = z;
        snapEdge = { p1: [waabb.maxX, waabb.minZ], p2: [waabb.maxX, waabb.maxZ] };
      }
    }
  }

  if (bestDist <= SNAP_THRESHOLD) {
    return { position: [bestX, bestZ], snapEdge };
  }
  return { position: [x, z], snapEdge: null };
}

// ── Furniture-to-Furniture Snap ───────────────────────────────────────────────

/**
 * Tries to snap an item to the edges of any existing furniture item.
 * Returns adjusted [x, z] plus the shared edge that triggered the snap.
 */
export function snapToFurniture(
  x: number,
  z: number,
  item: { id?: string; rotation: number; width: number; depth: number },
  allFurniture: FurnitureData[]
): SnapResult {
  const isRotated = Math.abs(Math.sin(item.rotation)) > 0.5;
  const hw = (isRotated ? item.depth : item.width) / 2;
  const hd = (isRotated ? item.width : item.depth) / 2;

  let bestX = x;
  let bestZ = z;
  let bestDist = SNAP_THRESHOLD + 1;
  let snapEdge: SnapEdge | null = null;

  for (const other of allFurniture) {
    if (item.id && other.id === item.id) continue;

    const ob = getFurnitureAABBSnap(other);

    // Right edge of item → left edge of other
    const distRight = Math.abs(x + hw - ob.minX);
    if (distRight < SNAP_THRESHOLD && distRight < bestDist) {
      // Also check z-range overlap
      const minZ = Math.max(z - hd, ob.minZ);
      const maxZ = Math.min(z + hd, ob.maxZ);
      if (maxZ > minZ) {
        bestDist = distRight;
        bestX = ob.minX - hw;
        bestZ = z;
        snapEdge = { p1: [ob.minX, minZ], p2: [ob.minX, maxZ] };
      }
    }

    // Left edge of item → right edge of other
    const distLeft = Math.abs(x - hw - ob.maxX);
    if (distLeft < SNAP_THRESHOLD && distLeft < bestDist) {
      const minZ = Math.max(z - hd, ob.minZ);
      const maxZ = Math.min(z + hd, ob.maxZ);
      if (maxZ > minZ) {
        bestDist = distLeft;
        bestX = ob.maxX + hw;
        bestZ = z;
        snapEdge = { p1: [ob.maxX, minZ], p2: [ob.maxX, maxZ] };
      }
    }

    // Bottom edge of item → top edge of other
    const distBottom = Math.abs(z + hd - ob.minZ);
    if (distBottom < SNAP_THRESHOLD && distBottom < bestDist) {
      const minX = Math.max(x - hw, ob.minX);
      const maxX = Math.min(x + hw, ob.maxX);
      if (maxX > minX) {
        bestDist = distBottom;
        bestZ = ob.minZ - hd;
        bestX = x;
        snapEdge = { p1: [minX, ob.minZ], p2: [maxX, ob.minZ] };
      }
    }

    // Top edge of item → bottom edge of other
    const distTop = Math.abs(z - hd - ob.maxZ);
    if (distTop < SNAP_THRESHOLD && distTop < bestDist) {
      const minX = Math.max(x - hw, ob.minX);
      const maxX = Math.min(x + hw, ob.maxX);
      if (maxX > minX) {
        bestDist = distTop;
        bestZ = ob.maxZ + hd;
        bestX = x;
        snapEdge = { p1: [minX, ob.maxZ], p2: [maxX, ob.maxZ] };
      }
    }
  }

  if (bestDist <= SNAP_THRESHOLD) {
    return { position: [bestX, bestZ], snapEdge };
  }
  return { position: [x, z], snapEdge: null };
}

// ── Combined Smart Snap ───────────────────────────────────────────────────────

/**
 * Full snap pipeline with corner support:
 *  1. Try wall snap on X axis (vertical walls)
 *  2. Try wall snap on Z axis (horizontal walls)
 *  3. Combine both for corner snapping (flush to two walls at once)
 *  4. Try furniture-to-furniture snap on remaining free axis
 *  5. Grid snap as fallback for any unsnapped axis
 *
 * Returns final position and optional snap-edge for the visual indicator.
 */
export function smartSnap(
  x: number,
  z: number,
  item: { id?: string; rotation: number; width: number; depth: number },
  walls: WallData[],
  allFurniture: FurnitureData[],
  snapEnabled: boolean,
  gridSize: number
): SnapResult {
  const isRotated = Math.abs(Math.sin(item.rotation)) > 0.5;
  const hw = (isRotated ? item.depth : item.width) / 2;
  const hd = (isRotated ? item.width : item.depth) / 2;

  let snappedX = x;
  let snappedZ = z;
  let xSnapped = false;
  let zSnapped = false;
  let bestEdge: SnapEdge | null = null;

  // Check all walls for potential snaps on each axis independently
  for (const wall of walls) {
    const waabb = getWallAABBSnap(wall);
    const dx = Math.abs(wall.end[0] - wall.start[0]);
    const dz = Math.abs(wall.end[1] - wall.start[1]);
    const isHorizontal = dx >= dz;

    if (isHorizontal) {
      // Horizontal wall → snap on Z axis
      if (!zSnapped) {
        const distTop = Math.abs(z + hd - waabb.minZ);
        if (distTop < SNAP_THRESHOLD) {
          snappedZ = waabb.minZ - hd;
          zSnapped = true;
          bestEdge = { p1: [waabb.minX, waabb.minZ], p2: [waabb.maxX, waabb.minZ] };
        }
        const distBottom = Math.abs(z - hd - waabb.maxZ);
        if (distBottom < SNAP_THRESHOLD && (!zSnapped || distBottom < Math.abs(z + hd - waabb.minZ))) {
          snappedZ = waabb.maxZ + hd;
          zSnapped = true;
          bestEdge = { p1: [waabb.minX, waabb.maxZ], p2: [waabb.maxX, waabb.maxZ] };
        }
      }
    } else {
      // Vertical wall → snap on X axis
      if (!xSnapped) {
        const distLeft = Math.abs(x + hw - waabb.minX);
        if (distLeft < SNAP_THRESHOLD) {
          snappedX = waabb.minX - hw;
          xSnapped = true;
          bestEdge = { p1: [waabb.minX, waabb.minZ], p2: [waabb.minX, waabb.maxZ] };
        }
        const distRight = Math.abs(x - hw - waabb.maxX);
        if (distRight < SNAP_THRESHOLD && (!xSnapped || distRight < Math.abs(x + hw - waabb.minX))) {
          snappedX = waabb.maxX + hw;
          xSnapped = true;
          bestEdge = { p1: [waabb.maxX, waabb.minZ], p2: [waabb.maxX, waabb.maxZ] };
        }
      }
    }
  }

  // Try furniture snap on unsnapped axes
  if (!xSnapped || !zSnapped) {
    const furnResult = snapToFurniture(
      xSnapped ? snappedX : x,
      zSnapped ? snappedZ : z,
      item,
      allFurniture
    );
    if (furnResult.snapEdge) {
      const [fx, fz] = furnResult.position;
      if (!xSnapped && Math.abs(fx - x) > 0.001) {
        snappedX = fx;
        xSnapped = true;
        if (!bestEdge) bestEdge = furnResult.snapEdge;
      }
      if (!zSnapped && Math.abs(fz - z) > 0.001) {
        snappedZ = fz;
        zSnapped = true;
        if (!bestEdge) bestEdge = furnResult.snapEdge;
      }
    }
  }

  // Grid snap for any axis that wasn't snapped
  if (snapEnabled) {
    if (!xSnapped) snappedX = snapToGrid(x, gridSize);
    if (!zSnapped) snappedZ = snapToGrid(z, gridSize);
  }

  return {
    position: [xSnapped ? snappedX : (snapEnabled ? snapToGrid(x, gridSize) : x),
               zSnapped ? snappedZ : (snapEnabled ? snapToGrid(z, gridSize) : z)],
    snapEdge: (xSnapped || zSnapped) ? bestEdge : null,
  };
}
