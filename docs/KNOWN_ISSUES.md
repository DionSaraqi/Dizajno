# Known Issues

Active, intentionally-deferred bugs. **When an issue here is fixed, delete its
entry (and the matching `KNOWN-ISSUE(...)` code comment) so this file never lists
anything that is no longer true.**

---

## KNOWN-ISSUE(furniture-floor-interaction): furniture ghost preview won't follow the cursor over a floor; selection falls through to the floor underneath

**Status:** open · flagged 2026-06-05 · root cause likely identified (R3F event
propagation through the interactive floor mesh), not yet fixed

**Symptoms (reported):**

A. **Ghost preview doesn't follow the cursor over a floor.** In Furniture mode,
   while the cursor is over a room floor the ghost preview freezes — it stays
   stuck to the side instead of tracking the cursor (see screenshot: cursor
   centred in the room, ghost off at the edge). Placement itself still works: a
   single click *does* drop the item at the cursor position over the floor — only
   the live preview is wrong.

B. **Holding left-click is the only way to get a live preview.** Holding the left
   button down while moving makes the ghost follow the cursor again, but you
   should not have to hold the button just to preview where a fresh item will
   land — a normal hover should drive the preview.

C. **Selecting furniture on a floor falls through to the floor.** Click a piece of
   furniture that sits on a floor: it selects, then (the reporter perceived
   "after ~1 second") the selection switches to the floor underneath, making it
   impossible to edit furniture while it rests on a floor.

D. **Furniture only selects on a stationary click.** You cannot select furniture
   while the cursor is moving over it — you have to stop on top of it for the
   click to register. Otherwise the click is dropped or goes to whatever is
   under/behind the item (more pronounced in 3D, where the model is shallow).

**Repro:** Build a closed room so a floor polygon is generated → open the
furniture sidebar → move the cursor into the room interior and try to (1) place
an item and (2) select an item already placed there.

**Investigation so far (code read, not yet reproduced under instrumentation):**
- `components/three/FloorMesh.tsx` — the floor is an *interactive* mesh rendered
  above the grid (`position={[0, 0.02, 0]}`, `renderOrder={1}`) whose
  `onClick`/`onPointerOver`/`onPointerOut` all call `e.stopPropagation()` (via
  `stopAndCall`).
- `components/three/GridPlane.tsx` + `DrawingSurface.SceneContent` — furniture
  ghost-follow is driven by the GridPlane `onPointerMove`, click-to-place by its
  `onPointerDown`. The floor has no `onPointerDown`, so the down still propagates
  to the GridPlane — **placement works over a floor** (a single click drops the
  item correctly). The floor *does* handle hover (`onPointerOver`/`onPointerOut`
  with `stopPropagation`), and R3F walks ray intersections nearest-first, halting
  the walk as soon as a handler stops propagation — so over a floor the move never
  reaches the GridPlane `onPointerMove` and the ghost freezes. Holding the button
  keeps the gesture active (the floor isn't re-entered on each move), so the move
  reaches the GridPlane again and the ghost follows. **Prime suspect for A/B.**
- `DrawingSurface` floor render (`onClick={() => mode === "select" && select(floor.id)}`)
  vs `FurnitureItem3D.handlePointerDown` (`select(item.id)` on pointer-*down*,
  with `stopPropagation`): furniture selects on pointer-down, but the synthesized
  *click* on pointer-up still propagates — the furniture group has no `onClick`
  to stop it, so the click falls through to the floor's `onClick`, which
  overwrites the selection with the floor id. **Prime suspect for C.** The "~1 s"
  is just how long the button was held before release; there is no timer in the
  3D path (grep confirms no `setTimeout` in the designer 3D code).
- `FurnitureItem3D` selecting on `onPointerDown` (not click) plus the thin
  hitboxes and the global `pointerup` drag-end listener make a *moving* cursor
  easy to miss: the down can land on the floor or grid behind the item, so the
  selection lands on the wrong object. **Suspect for D.**

**Next steps when picking this up:**
- Make the furniture ghost preview follow the cursor over a floor (placement
  already works) — drive the ghost-follow at the Canvas / `onPointerMissed` level,
  mirror the GridPlane `onPointerMove` handler onto `FloorMesh`, or render a
  transparent full-scene interaction plane on top while in furniture mode (A/B).
- Give furniture a click handler that `stopPropagation()`s (or guard the floor's
  `onClick` so it only selects when nothing sits on top) so selecting furniture
  on a floor sticks (C).
- Decide whether furniture should select on pointer-down or on click
  consistently, and make hit detection forgiving while the cursor moves (D).

**Code markers:** `KNOWN-ISSUE(furniture-floor-interaction)` comments in
`frontend/src/components/three/DrawingSurface.tsx` (floor render + GridPlane
placement handlers) and `frontend/src/components/three/FurnitureItem3D.tsx`
(selection on pointer-down). Remove them together with this entry once fixed.
