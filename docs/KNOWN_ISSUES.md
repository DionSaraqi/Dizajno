# Known Issues

Active, intentionally-deferred bugs. **When an issue here is fixed, delete its
entry (and the matching `KNOWN-ISSUE(...)` code comment) so this file never lists
anything that is no longer true.**

---

## KNOWN-ISSUE(wall-draw-glitch): walls glitch / extend leftward while drawing at certain angles

**Status:** open · flagged 2026-06-04 · not yet root-caused

**Symptom (reported):** While drawing a wall (left-click-hold-drag in Draw mode),
holding the cursor at *a certain angle* makes the wall glitch and extend toward
the left with a wrong "inside" length, instead of following the cursor.

**Repro:** Build → Draw Walls, start a wall and slowly sweep the cursor around;
at some angle the preview jumps/extends leftward. (Not yet reproduced
deterministically — appears angle-dependent.)

**Investigation so far (none conclusive):**
- `components/three/WallMesh.tsx` — box geometry + `rotation={[0, -angle, 0]}`
  (`angle = atan2(dz, dx)`) looks correct across all quadrants; no obvious flip.
- `utils/snapToGrid.ts` — wall drawing snaps via `getSnappedPoint` →
  `snapPoint` (grid) then `snapToCorner` (nearest existing corner within
  `CORNER_MERGE_THRESHOLD = 0.2`). **Prime suspect:** when the drag passes within
  0.2 of an existing corner that lies "behind"/left of the start, `previewEnd`
  snaps to it, so the wall jumps leftward. Check whether snap-to-corner should be
  suppressed when the candidate corner is the *start* corner or is behind the
  drag direction.
- `components/three/CameraController.tsx` — in Draw mode `LEFT` is released to the
  canvas; verify OrbitControls isn't also reacting to the drag at some angles.

**Next steps when picking this up:** reproduce with the dev server + on-screen
coords, log `getSnappedPoint` input vs output during the glitch in
`DrawingSurface.finishWall`/`handlePointerMove`, and confirm whether the jump is
a snap-to-corner artifact (most likely) or a render/camera issue.

**Code marker:** `KNOWN-ISSUE(wall-draw-glitch)` comment in
`frontend/src/components/three/DrawingSurface.tsx` (near the wall-draw handlers).
Remove it together with this entry once fixed.
