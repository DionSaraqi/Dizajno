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

### Doorway thresholds have no floor — you see through the gap between rooms
Floor polygons are the **inner usable polygon**: `findFloors` (`utils/wallGraph.ts`)
traces the centerline face and then insets every edge by its wall's half-thickness
(`insetFloorPolygon` in `utils/areaCalc.ts`). So the band of ground under a wall's
own footprint is never covered by floor geometry. Solid wall segments hide that
band, but a door cuts the wall away down to `y = 0` — doors default to
`sillHeight = 0`, so `computeSegments` in `WallMesh.tsx` emits no sill segment and
`WallOpening.tsx` draws jambs + lintel but no threshold piece. What's left in the
doorway is a `wall.thickness` deep × opening-width hole: in 3D you look straight
through it to the canvas clear color (`#e8ecf0`), which reads as a bright slit
between the two rooms' floors. Windows are unaffected — their sill segment fills
the band.

Wanted: fill the threshold band with floor geometry so the two floors read as one
continuous surface. **Visual only** — it must not join any room's polygon or any
area math. `polygonArea(floor.vertices)` feeds `RoomLabels`, the SelectionBar area
field, `computeRoomAreas` (quote dialog) and the backend `QuoteService` flooring
line, and the inner-usable convention (a 5×5 room = exactly 25 m²) has to survive
untouched, as does the flooring quantity billed per room.

Open decisions before implementing:
- What the strip looks like: neutral filler color, or inherit an adjacent room's
  flooring variant/texture — and if so, which of the two sides wins?
- Scope: only under openings, or the whole wall-footprint band everywhere (that
  would also cover exterior-door thresholds and any future cutaway/top-down view).

---

## Auth & Home Page

### Account menu links to a `/profile` page that doesn't exist
`AccountMenu` (`components/ui/AccountMenu.tsx`) has a **Profile** item pointing at
`/profile`, but `app/profile/page.tsx` renders an empty `<div />` and the backend
has no user-update endpoint (`AuthController` is register/login/refresh/logout/me
only). Because the menu is the shared session indicator, the dead link shows up
on every signed-in surface: the landing meta row (`LandingHeader`), all three
designer surfaces via `DesignerHeader` (`/designer`, `/projects/[id]`,
`/share/[token]`), and every `TopBar` page (`/projects`, `/quotes`, `/admin/*`,
`/supplier/*`).

Wanted: either build the page (read-only from `/me` needs no backend work;
editing needs a new `PATCH /api/auth/me`) or drop the menu item until it exists.

---

## Designer Chrome

### The designer's top chrome is two stacked bars and reads badly
`/designer` and `/projects/[id]` (and `/share/[token]`) stack two full-width
bars: `DesignerHeader` (`h-12`, `bg-dizajno-bg/85`, back + logo + title + save
badge + Quote/Share/Save + account chip) sitting directly on `Toolbar` (`h-11`,
`bg-dizajno-surface`, undo/redo + Snap + Walls + the centered 2D/3D pill +
settings + Clear). That's **92px of chrome across two hairline-bordered rows** on
a surface where canvas height is the whole point, and it reads as one doubled
toolbar rather than two things with different jobs:

- **No hierarchy between the rows.** 48px vs 44px is too close to signal that one
  is document-level and the other is tools; they just look like a toolbar that
  wrapped.
- **A tonal stripe.** The two rows use different backgrounds (`dizajno-bg/85` vs
  `dizajno-surface`), so on a light theme the seam reads as a faint band rather
  than deliberate layering.
- **Actions split across rows.** The right edge has two separate clusters —
  Quote/Share/account on top, settings/Clear below — so related controls are on
  different lines and the eye scans twice to find anything.
- **Dead space in row 2.** The 2D/3D pill is absolutely centered
  (`absolute left-1/2` in `Toolbar.tsx`), so on wide viewports it floats alone
  between two large empty gaps while row 1 is comfortably filled.

Wanted: collapse the top chrome to a single bar (or make the two rows clearly
distinct in height/weight/role) so the designer surfaces feel like one piece of
chrome and give the canvas back its vertical space.

Open decisions before implementing:
- One bar or two? Merging everything into one `h-12` row means finding space for
  ~10 controls plus the title and account chip — likely needs the tool controls
  to become icon-only, or to move into the existing left `IconRail`/`LeftDock`.
- If it stays two rows, which one loses its border and background so they read as
  a single unit — and does the 2D/3D pill stay centered or move into a cluster?
- Does the mode/view control (2D/3D) belong in top chrome at all, or on the
  canvas as a floating overlay like `LeftDock` and `SelectionBar` already are?
- `StatusBar` adds another `h-6` bar at the bottom; worth folding into the same
  pass, or leave it alone?

### The account menu doesn't open on the designer surfaces
Clicking the account chip at the top-right of `/projects/[id]` (and `/designer`
and `/share/[token]`) appears to do nothing. The menu *is* opening — React state
flips and the panel renders — but it is painted underneath the canvas, so
nothing is visible.

`DesignerHeader` (`components/designer/DesignerHeader.tsx`) is
`bg-dizajno-bg/85 backdrop-blur-md` with **no `z-index`**. A non-`none`
`backdrop-filter` makes an element a stacking context, so the header becomes one
at level 0 of the page container. `AccountMenu`'s dropdown is
`absolute … z-50`, but that `z-50` now only orders it *within the header* — it
can never lift the panel above the header's own layer. Every later sibling in
`/projects/[id]` (`Toolbar`, the `flex flex-1 … relative` canvas wrapper,
`StatusBar`) is also at level 0 and comes after the header in DOM order, so all
of them paint over it. The dropdown opens below the 48px header, which is
entirely canvas, so it is completely covered.

The same menu works everywhere else because those headers set an explicit
z-index: `TopBar` is `sticky top-0 z-30 … backdrop-blur-md` (`/projects`,
`/quotes`, `/admin/*`, `/supplier/*`) and `LandingHeader`'s meta row is `z-20`
(`/`). `DesignerHeader` is the only one that omits it. Corroborating detail:
`Toolbar`'s own dropdowns (`z-40`) *do* work, because `Toolbar` has no
`backdrop-filter` and therefore no stacking context of its own — its `z-40`
competes page-wide and wins.

Wanted: give `DesignerHeader` its own layer (`relative z-30`, matching `TopBar`)
so the panel escapes the canvas. Worth auditing the other `backdrop-blur`
element in the designer (`SelectionBar`, which wraps a `z-50` popover in a
`backdrop-blur` container at `z-20`) for the same latent bug at the same time.

Open decisions before implementing:
- Fix locally on `DesignerHeader`, or give `AccountMenu` a portal so no call site
  can reintroduce this? A portal also fixes it inside `overflow-hidden`
  ancestors, which the designer container is.
- If the top chrome gets collapsed (see the entry above), the z-index layering
  for header / Toolbar / floating overlays should be decided once, as a scale,
  rather than per component.

---

## Catalog & Seed Data

### Two catalog tests assert stale seed counts and fail on a clean tree
`CatalogEndpointsTests.GetProducts_ReturnsAllSeededItems` asserts
`HaveCount(20)` and
`GetProducts_FiltersByFamily_BuildingMaterialExposesUnitAndCoverage` asserts
`HaveCount(6)`. The seed (`backend/src/Dizajno.Data/Seed/CatalogSeedData.cs`)
actually contains **22** products — 12 furniture, 2 fixtures, and **8**
building materials.

The drift is exactly two extra flooring rows, `natural-oak-plank` (€38/m²) and
`herringbone-parquet` (€68/m²), added in `e4071a3` without updating either
assertion. Both tests still describe "3 paints + 3 flooring tiers" in their
comments, which is no longer what the seed ships. Every other assertion in both
tests passes — the specific types, prices, `UnitOfSale`, and `CoverageRate` are
all still correct — so this is a counting problem, not a data problem.

There is a second-order drift behind it: those two rows exist **only** in the
backend seed. `frontend/src/utils/furnitureCatalog.ts` has neither, so the
fallback catalog and `CatalogSeedData.cs` are out of sync, which CLAUDE.md
requires them not to be until the supplier portal fully replaces the seed.

Wanted: decide whether the two floorings are intended, then make the seed, the
frontend fallback, and the two assertions agree.

Open decisions before implementing:
- Are `natural-oak-plank` and `herringbone-parquet` meant to ship? If yes, bump
  the counts to 22/8 and add both to the frontend fallback; if they were
  scratch data for the quote calculator, drop them from the seed instead.
- Should these tests assert exact counts at all? A count is the assertion most
  likely to break for a reason nobody cares about. Asserting only that the
  expected types are present (which both tests already do) would make the seed
  growable without touching tests — at the cost of not catching an accidental
  duplicate row.
