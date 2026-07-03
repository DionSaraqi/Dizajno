# Known Issues

Active, intentionally-deferred bugs. **When an issue here is fixed, delete its
entry (and the matching `KNOWN-ISSUE(...)` code comment) so this file never lists
anything that is no longer true.**

---

## Floors & Room Drawing

### Wall drag-to-resize is 2D-only
Dragging a room wall perpendicular to its axis (including shared walls, which
resize both rooms) only arms in 2D select mode. In 3D walls stay click-to-select.
A 3D version needs a camera-facing drag-plane projection (the ground-plane
raycast used in 2D is parallax-distorted under the perspective camera) and is
wanted as a follow-up.

### No dimension labels in 3D mode
`WallDimensions`, `RoomLabels`, and `Measurements` are all gated behind `!is3D`,
so 3D mode has no dimension feedback at all — which also blocks the 3D wall-drag
follow-up above from having usable live feedback. Wanted: 3D-friendly dimension
labels (billboarded, likely on hover/selection only).

---

## Auth & Home Page

### No logged-in indication on the home page
After logging in, the home page (where the menu is) gives no sign that you're logged
in. When logged in:
- Hide the **Sign in** button.
- Make **Create new project** behave like the "new project" button on the projects
  page.

The designer should be reserved for people who don't want to create an account.
