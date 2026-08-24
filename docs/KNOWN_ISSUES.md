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

---

## Errors & Feedback

### Raw API error payloads are rendered straight into the UI
`apiFetch` (`lib/api.ts`, the `!response.ok` branch) builds every failure message
as `` `Request failed: ${status} ${statusText} — ${await response.text()}` `` —
the response body pasted in unparsed — and all 38 display sites just render
`err.message`. So a duplicate signup shows the user:

> Request failed: 400 Bad Request — {"errors":["Username 'x@y.com' is already
> taken.","Email 'x@y.com' is already taken."]}

The backend messages themselves are fine; what leaks is the envelope. There are
five distinct response shapes to unwrap, and `apiFetch` handles none of them:
- `{ "errors": ["…", "…"] }` — Identity failures from `AuthService.RegisterAsync`
  (array of human-readable strings).
- `{ "errors": { "Email": ["The Email field is required."] } }` — the automatic
  `[ApiController]` model-validation 400 (same key, but a per-field **map**).
- `{ "error": "Invalid credentials." }` — the 5 auth 401s in `AuthService`.
- RFC 7807 `ProblemDetails` with the text in `detail` — ~100 sites across the
  Application services (`{"status":409,"detail":"Slug already in use."}`).
- **No body at all** — bare `NotFoundResult` (60), `UnauthorizedResult` (55) and
  `ForbidResult` (39). Nothing to unwrap, so these can only ever be
  "Request failed: 404 Not Found" unless the client supplies its own copy.

There is no `UseExceptionHandler`, so an unhandled server exception in
Development returns the ASP.NET developer exception **HTML page**, and the whole
page ends up inside the red banner string.

Presentation is inconsistent too: five hand-rolled red boxes (login/register use
`role="alert"` + `AlertCircle` + `dizajno-danger`), `alert(e.message)` on
`/admin/moderation`, a few Sonner toasts elsewhere, and no shared error
primitive in `components/ui/` to reach for.

Wanted (everywhere, not just the auth screens): parse the body once in
`lib/api.ts` so `ApiError` carries structured, already-human-readable data
(a title + a list of messages + optional per-field map) with a per-status
fallback for the bodiless responses, and render it through one shared UI
primitive so every screen looks the same.

Open decisions before implementing:
- Where each error goes: inline banner vs toast vs field-level. Forms already
  have `FormField error` wiring (`aria-invalid` + described-by), so the
  validation map and "Email is already taken" could attach to the offending
  field instead of a banner — worth doing on login/register at least?
- 401 after the refresh retry fails: show a banner, or route to `/login` with a
  "session expired" notice and the current path as `redirect`?
- Bodiless 404/401/403: generic client-side copy per status, or add
  `ProblemDetails` bodies to those 154 backend return sites?
- Network failure (`ApiError` with `status: 0`, currently the raw
  "Failed to fetch"): dedicated offline/backend-unreachable copy?
- Unexpected 500s / non-JSON bodies: collapse to a generic
  "Something went wrong" and log the detail to the console instead of showing it?
