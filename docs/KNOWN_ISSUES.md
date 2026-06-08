# Known Issues

Active, intentionally-deferred bugs. **When an issue here is fixed, delete its
entry (and the matching `KNOWN-ISSUE(...)` code comment) so this file never lists
anything that is no longer true.**

---

## Floors & Room Drawing

### Room walls overlap nearby existing walls
When a room is drawn close to an existing wall, the new room's walls and the
already-placed walls overlap instead of merging/aligning. **Important** — needs a
proper fix; we'll go into much greater detail on this in the future.

---

## Selection & Keyboard Shortcuts

### Delete key doesn't work on floors
The Delete keyboard shortcut does not remove a selected floor. While fixing this,
make sure **all keyboard shortcuts apply to everything on the drawing board**
(walls, floors, furniture, doors/windows) — not just furniture.

### Select All (Ctrl+A) skips floors
Select All does not include floors in the selection. It should select everything
on the board, floors included.

### Newly placed furniture isn't auto-selected
After dropping a piece of furniture onto a floor, the furniture is placed but the
**floor** ends up selected. The newly placed item should be the thing that is
automatically selected after placement.

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

## Doors & Windows

### 2D ghost preview + placement measurements
Add a ghost preview for doors and windows in **2D mode** (open to recommendations
on the best approach). While here, show door/window dimensions and the distance to
adjacent walls during placement — the same live measurement preview we already have
for furniture (which shows the spacing between the placed item and everything around
it).

### Snap mode for doors/windows
Add snapping for doors/windows (open for discussion). The idea: snap at critical
positions, but make it **more forgiving** than the furniture and wall snapping.

### Doors/windows are too thin — walls glitch through them
Doors and windows are very skinny, so at certain angles the walls glitch through
them. The likely easiest fix is to increase their **thickness**. This is **not** a
new configurable dimension — it's purely a fix for the wall glitching through them.

### Editing a door/window jumps it + needs the radial menu other items have
When you click a door or window to edit it, it jumps/moves from its place — it
should stay put. Both doors and windows should also get the same round (radial)
menu that everything else has, with:
- **2 buttons that look identical to the levitate buttons** on normal furniture,
  but for windows they adjust the **sill** instead of levitating.
- The **same color-palette button** other furniture have. Clicking it shows the
  different **fixtures** that can be applied, in the same way the color palette
  shows color/texture options for normal furniture.

The small menu that opens at the bottom of the screen should then be reduced to
only **width**, **height**, and **delete**.

---

## Camera & 3D View

### Increase max zoom in 3D view
In 3D view the maximum zoom is currently capped (the footer shows ~693% as the max).
Raise the zoom ceiling.

### Faster right-click camera movement
Increase the camera movement speed when **right-clicking** (panning/orbit). Leave
the **left-click** speed unchanged.

### Camera randomly rotates when selecting some custom models
Sometimes when picking one of the custom 3D models (e.g. the designer sofa) the
camera rotates unexpectedly. Cause unknown and not yet reproducible — flagged for
future investigation.

---

## Auth & Home Page

### No logged-in indication on the home page
After logging in, the home page (where the menu is) gives no sign that you're logged
in. When logged in:
- Hide the **Sign in** button.
- Make **Create new project** behave like the "new project" button on the projects
  page.

The designer should be reserved for people who don't want to create an account.
