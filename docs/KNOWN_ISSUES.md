# Known Issues

Active, intentionally-deferred bugs. **When an issue here is fixed, delete its
entry (and the matching `KNOWN-ISSUE(...)` code comment) so this file never lists
anything that is no longer true.**

---

## Floors & Room Drawing

### Custom room hugging an existing corner gets a slanted wall
When a custom room is drawn hugging the existing structure and a corner is
clicked **right on the corner where existing rooms meet**, one of the new
room's walls comes out at a slight angle instead of staying axis-aligned.
Observed: a 5×5 room drawn against two existing rooms came out a trapezoid —
left side 4.85 m, right side 5.00 m, with the bottom wall slanted by exactly
one wall thickness (0.15 m) from the shared corner outward.

**Repro:** build two adjacent rooms → Rooms → *Draw custom room* → click the
first corner exactly on the junction corner of the existing rooms, draw the
rest of the polygon hugging a side, close. One wall of the new room is tilted.

**Suspected cause:** the per-wall corner merge (`snapToCorner`, 0.2 m radius)
inside `addWallWithIntersections` (`frontend/src/utils/wallGraph.ts`) runs
*after* the room-to-wall alignment and pulls ONE endpoint of a generated room
wall diagonally onto the nearby existing corner (the aligned corner sits about
half a wall thickness away from the existing centerline corner). The far
endpoint, metres away, stays put — tilting the whole wall. The alignment layer
(`frontend/src/utils/roomAlign.ts`) cannot compensate because it runs before
the walls are inserted one by one.

**Decided behavior (June 2026):** the room should *square up to the
structure* — the corner welds to the existing corner AND the connected walls
stay straight, i.e. the whole edge shifts so the room stays rectangular (its
drawn size may adjust slightly). Fix sketch: snap the room's centerline
polygon vertices to existing corners during alignment (then re-rectify the
edges as a polygon), and suppress the per-wall endpoint corner pull for
room-generated walls whenever the weld would knock a wall off its line.

### Resizing a room with shared walls is disabled
Rooms that share a wall with a neighbor (created by the room-merge behavior)
refuse the W×L resize with a toast — dragging a shared wall would silently
reshape the neighbor. Needs a detach-or-resize-both interaction to lift the
restriction.

---

## Furniture

### Add increase/decrease size buttons for proportional furniture
All furniture currently scales proportionally. Editing the raw dimensions should
not be the only way to resize — add dedicated increase/decrease (grow/shrink) size
buttons as well.

### Bookshelves & wardrobes should hug the wall with their longest side
Tall, against-the-wall items (bookshelves, wardrobes, etc.) should orient so their
**longest side** sits flush against the wall.

---

## Build & Tooling

### `pnpm build` fails type-checking (pre-existing, unrelated to designer)
`next build` compiles successfully but fails at the "Linting and checking
validity of types" step. Six errors, all in supplier/admin portal + UI
primitives (not the designer canvas):

- `src/app/admin/suppliers/page.tsx:37` — `api.AdminSupplierListItem` is not
  exported from `lib/api`.
- `src/app/supplier/[supplierId]/members/page.tsx:41` — `api.SupplierPortalMember`
  is not exported (the value `listSupplierPortalMembers` exists, but no matching
  type).
- `src/app/supplier/[supplierId]/products/page.tsx:38` — `api.SupplierProductListItem`
  is not exported.
- `src/app/supplier/[supplierId]/textures/page.tsx:28` — `api.SupplierTexture`
  is not exported (the type is named `SupplierTextureRow`).
- `src/components/ui/Input.tsx:5` and `src/components/ui/Select.tsx:6` —
  `InputProps`/`SelectProps` declare a `size: "sm" | "md"` prop that clashes
  with the DOM `size: number` they extend. Omit the native `size` (e.g.
  `extends Omit<InputHTMLAttributes<HTMLInputElement>, "size">`) or rename the
  prop.

The first four are stale type names in `lib/api` imports; the last two are a
prop-name collision. Each is a small, self-contained fix.

---

## Auth & Home Page

### No logged-in indication on the home page
After logging in, the home page (where the menu is) gives no sign that you're logged
in. When logged in:
- Hide the **Sign in** button.
- Make **Create new project** behave like the "new project" button on the projects
  page.

The designer should be reserved for people who don't want to create an account.
