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
  /**
   * Suggested Y-rotation (radians) for wall-hugging items. Set only when
   * `wallHug` was requested AND the item snapped to a wall — the caller should
   * apply it so the item's longest side runs parallel to that wall. Undefined
   * means "leave rotation as-is".
   */
  rotation?: number;
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
 * When `wallHug` is set (tall against-the-wall items), a pre-pass picks the
 * orientation that lays the item's longest side parallel to the nearest wall
 * (shallow `depth` back flush against it) BEFORE the position snap runs, and
 * the chosen rotation is returned in `SnapResult.rotation`.
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
  gridSize: number,
  wallHug = false
): SnapResult {
  // Wall-hug pre-pass: choose the orientation AND the perpendicular (into-wall)
  // position first, then let the normal pipeline handle the along-wall axis.
  //
  // A horizontal wall (runs along X) → width along X; a vertical wall (runs
  // along Z) → width along Z. Both wall-hug models face +Z at rotation 0 (back
  // at −Z), so we pick the facing (0 vs 180 / 90 vs 270) by which side of the
  // wall the item is on, keeping the back against the wall and the face toward
  // the room.
  //
  // Engagement: we trigger whenever the item's CURRENT footprint comes within a
  // threshold of a wall — i.e. when the user pushes its near edge to the wall,
  // exactly like the generic snap. The reach is the item's *current*
  // perpendicular half-extent (`curHw`/`curHd`, which depends on its present
  // rotation) + halfThickness + SNAP_THRESHOLD, one-sided from on-the-wall
  // outward. This matters because an un-rotated wardrobe is wide (~0.75 m) along
  // a vertical wall, so its center is far from that wall when its edge touches —
  // gating on the post-rotation `back` (0.3 m) would never fire.
  //
  // Ranking (which wall wins among engaged candidates): the one whose flush
  // position — where the item WOULD sit after hugging — is nearest the cursor.
  // Ranking by current-rotation overlap instead lets a perpendicular stub at a
  // T-junction win just because a (rotated, narrow) item lines up with it; the
  // flush-distance metric makes the wall the user is approaching win. The flush
  // position uses `back` (the shallow depth), since after rotating it's the back
  // that sits against the wall. It must also be alongside the wall's length
  // (span check) so a far stub sharing a coordinate is excluded outright.
  let hugRotation: number | null = null;
  let hugX = x;
  let hugZ = z;
  let hugXSnapped = false;
  let hugZSnapped = false;
  let hugEdge: SnapEdge | null = null;
  if (wallHug) {
    const back = item.depth / 2;
    // Current footprint half-extents (depend on the item's present rotation).
    const curRotated = Math.abs(Math.sin(item.rotation)) > 0.5;
    const curHw = (curRotated ? item.depth : item.width) / 2;
    const curHd = (curRotated ? item.width : item.depth) / 2;
    let bestPerp = Infinity;
    for (const wall of walls) {
      const waabb = getWallAABBSnap(wall);
      const dx = Math.abs(wall.end[0] - wall.start[0]);
      const dz = Math.abs(wall.end[1] - wall.start[1]);
      const isHorizontal = dx >= dz;

      if (isHorizontal) {
        const center = (waabb.minZ + waabb.maxZ) / 2;
        const half = (waabb.maxZ - waabb.minZ) / 2;
        const edgeGap = Math.abs(z - center) - (curHd + half); // current near edge → wall face
        // Must be alongside the wall's length (its X-span), not merely sharing a
        // perpendicular coordinate with a far wall/stub (the T-junction bug).
        const alongside = x >= waabb.minX - SNAP_THRESHOLD && x <= waabb.maxX + SNAP_THRESHOLD;
        if (alongside && edgeGap < SNAP_THRESHOLD) {
          // Rank by how close the cursor is to where the item WOULD sit (its
          // flush center) — not the current-rotation overlap — so the wall the
          // user is approaching wins over a perpendicular stub the cursor merely
          // lines up with.
          const flushZ = z <= center ? waabb.minZ - back : waabb.maxZ + back;
          const flushDist = Math.abs(z - flushZ);
          if (flushDist < bestPerp) {
            bestPerp = flushDist;
            // Back to the wall, face into the room. Model front = +Z at rot 0;
            // item on the −Z side → wall is +Z → rotate 180°; on the +Z side → 0.
            hugRotation = z <= center ? Math.PI : 0;
            hugXSnapped = false; // along-wall axis stays free
            hugX = x;
            hugZSnapped = true;
            hugZ = flushZ;
            hugEdge = z <= center
              ? { p1: [waabb.minX, waabb.minZ], p2: [waabb.maxX, waabb.minZ] }
              : { p1: [waabb.minX, waabb.maxZ], p2: [waabb.maxX, waabb.maxZ] };
          }
        }
      } else {
        const center = (waabb.minX + waabb.maxX) / 2;
        const half = (waabb.maxX - waabb.minX) / 2;
        const edgeGap = Math.abs(x - center) - (curHw + half); // current near edge → wall face
        const alongside = z >= waabb.minZ - SNAP_THRESHOLD && z <= waabb.maxZ + SNAP_THRESHOLD;
        if (alongside && edgeGap < SNAP_THRESHOLD) {
          const flushX = x <= center ? waabb.minX - back : waabb.maxX + back;
          const flushDist = Math.abs(x - flushX);
          if (flushDist < bestPerp) {
            bestPerp = flushDist;
            // Back to the wall, face into the room. Item on the −X side → wall
            // is +X → rotate 270°; on the +X side → 90°.
            hugRotation = x <= center ? (3 * Math.PI) / 2 : Math.PI / 2;
            hugZSnapped = false; // along-wall axis stays free
            hugZ = z;
            hugXSnapped = true;
            hugX = flushX;
            hugEdge = x <= center
              ? { p1: [waabb.minX, waabb.minZ], p2: [waabb.minX, waabb.maxZ] }
              : { p1: [waabb.maxX, waabb.minZ], p2: [waabb.maxX, waabb.maxZ] };
          }
        }
      }
    }
  }

  const effRotation = hugRotation ?? item.rotation;
  const isRotated = Math.abs(Math.sin(effRotation)) > 0.5;
  const hw = (isRotated ? item.depth : item.width) / 2;
  const hd = (isRotated ? item.width : item.depth) / 2;

  // Seed the snap state from the hug pre-pass: the into-wall axis is already
  // resolved (flush), so the loop below only fills the along-wall axis (which
  // can still snap to a perpendicular wall for corners, or fall back to grid).
  let snappedX = hugX;
  let snappedZ = hugZ;
  let xSnapped = hugXSnapped;
  let zSnapped = hugZSnapped;
  let bestEdge: SnapEdge | null = hugEdge;

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
    // Only suggest a rotation when the item actually hugged a wall.
    rotation: hugRotation !== null && (xSnapped || zSnapped) ? hugRotation : undefined,
  };
}
