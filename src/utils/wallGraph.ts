import type { WallData, FloorData } from "@/components/designer/DesignerProvider";

type Key = string;

function key(p: [number, number]): Key {
  return `${p[0].toFixed(2)},${p[1].toFixed(2)}`;
}

function parseKey(k: Key): [number, number] {
  const [x, z] = k.split(",").map(Number);
  return [x, z];
}

/**
 * Find all enclosed rooms (faces) in the wall graph using planar face traversal.
 *
 * Algorithm:
 * 1. Build adjacency list with neighbors sorted by angle around each vertex.
 * 2. For every directed half-edge (u→v), trace the face to its left by always
 *    picking the "next clockwise" edge at each vertex.
 * 3. Compute signed area to distinguish inner faces (rooms) from the outer face.
 */
export function findFloors(walls: WallData[]): FloorData[] {
  if (walls.length < 3) return [];

  // Build adjacency: vertex → sorted list of neighbor keys
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

  // For directed edge (from → to), find the next vertex in the face traversal.
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
      // Negative area = CW winding = outer (unbounded) face → skip
      if (area > 0.01) {
        floors.push({
          id: `floor-${floors.length}-${Date.now()}`,
          vertices: verts,
        });
      }
    }
  }

  return floors;
}
