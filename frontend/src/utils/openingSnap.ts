import { snapToGrid } from "./snapToGrid";
import type { OpeningData } from "@/types/designer";

// ── Opening snap (1D along a wall) ───────────────────────────────────────────
//
// Doors/windows move along a single axis (their host wall), so snapping is a
// scalar problem on the opening's CENTER offset. Targets, nearest-wins:
//   1. abutment with sibling openings on the same wall (edge-to-edge)
//   2. the wall midpoint
//   3. the end margins (flush-to-corner placement)
//   4. grid ticks along the wall axis (fallback)
// The capture radius is deliberately more forgiving than furniture's 0.3 —
// targets are sparse on a wall, so a bigger magnet doesn't cause ambiguity.
// Everything (including the grid fallback) is gated on the global snap toggle
// so precise placement is always possible.

export const OPENING_SNAP_THRESHOLD = 0.45;

/**
 * Minimum clear distance between an opening edge and the wall end. Must stay
 * larger than the wall endpoint joint cylinder radius (thickness/2, default
 * 0.075) plus the frame jamb width (0.05) so frames never intersect joints.
 */
export const OPENING_END_MARGIN = 0.15;

/** Two opening spans closer than this count as overlapping. */
const OVERLAP_EPS = 0.01;
/** Two snap targets closer than this are considered the same position. */
const TIE_EPS = 0.05;

export type OpeningSnapTarget = "sibling" | "midpoint" | "margin" | "grid";

export interface OpeningSnapResult {
  /** Near-edge offset from wall start (meters), clamped into the wall. */
  offsetFromStart: number;
  /** Which target captured the opening, or null for free placement. */
  snapTarget: OpeningSnapTarget | null;
  /** False when the opening cannot legally sit at/near this position. */
  valid: boolean;
}

interface Span {
  start: number;
  end: number;
}

function overlapsAny(center: number, width: number, spans: Span[]): boolean {
  const lo = center - width / 2 + OVERLAP_EPS;
  const hi = center + width / 2 - OVERLAP_EPS;
  return spans.some((s) => lo < s.end && hi > s.start);
}

/**
 * Snap + validate an opening's center offset along its host wall.
 *
 * @param rawCenter  desired center offset (meters from wall start)
 * @param width      opening width
 * @param wallLen    host wall length
 * @param siblings   other openings on the same wall (exclude the moving one)
 * @param snapEnabled the global snap toggle — gates ALL snapping
 * @param gridSize   grid spacing for the tick fallback
 */
export function snapOpeningOffset(
  rawCenter: number,
  width: number,
  wallLen: number,
  siblings: Pick<OpeningData, "offsetFromStart" | "width">[],
  snapEnabled: boolean,
  gridSize: number
): OpeningSnapResult {
  const minC = OPENING_END_MARGIN + width / 2;
  const maxC = wallLen - OPENING_END_MARGIN - width / 2;
  if (minC > maxC) {
    return { offsetFromStart: rawCenter - width / 2, snapTarget: null, valid: false };
  }

  const spans: Span[] = siblings.map((s) => ({
    start: s.offsetFromStart,
    end: s.offsetFromStart + s.width,
  }));

  let center = rawCenter;
  let snapTarget: OpeningSnapResult["snapTarget"] = null;

  if (snapEnabled) {
    const targets: { center: number; kind: OpeningSnapTarget }[] = [
      { center: wallLen / 2, kind: "midpoint" },
      { center: minC, kind: "margin" },
      { center: maxC, kind: "margin" },
    ];
    for (const s of spans) {
      targets.push({ center: s.start - width / 2, kind: "sibling" });
      targets.push({ center: s.end + width / 2, kind: "sibling" });
    }

    let best: { center: number; kind: OpeningSnapTarget } | null = null;
    let bestDist = OPENING_SNAP_THRESHOLD;
    for (const t of targets) {
      if (t.center < minC - 1e-9 || t.center > maxC + 1e-9) continue;
      const d = Math.abs(t.center - rawCenter);
      if (d < bestDist - 1e-9) {
        best = t;
        bestDist = d;
      } else if (best && d < bestDist + TIE_EPS && t.kind === "sibling" && best.kind !== "sibling") {
        // Near-tie: prefer the abutment target — it encodes the overlap rule.
        best = t;
        bestDist = d;
      }
    }

    if (best) {
      center = best.center;
      snapTarget = best.kind;
    } else {
      const gridded = snapToGrid(rawCenter, gridSize);
      if (gridded >= minC && gridded <= maxC) {
        center = gridded;
        snapTarget = "grid";
      }
    }
  }

  const clamped = Math.max(minC, Math.min(maxC, center));
  if (clamped !== center) {
    center = clamped;
    snapTarget = null;
  }

  // Overlap prevention: if the (possibly snapped) span intersects a sibling,
  // shove the opening to that sibling's nearest abutment; if it still
  // overlaps another sibling or falls off the wall, the position is invalid.
  if (overlapsAny(center, width, spans)) {
    const hit = spans.find(
      (s) => center - width / 2 + OVERLAP_EPS < s.end && center + width / 2 - OVERLAP_EPS > s.start
    )!;
    const leftAbut = hit.start - width / 2;
    const rightAbut = hit.end + width / 2;
    const resolved = Math.abs(center - leftAbut) <= Math.abs(center - rightAbut) ? leftAbut : rightAbut;
    if (resolved < minC || resolved > maxC || overlapsAny(resolved, width, spans)) {
      return { offsetFromStart: center - width / 2, snapTarget: null, valid: false };
    }
    center = resolved;
    snapTarget = "sibling";
  }

  return { offsetFromStart: center - width / 2, snapTarget, valid: true };
}
