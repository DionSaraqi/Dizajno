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

## Furniture

### Add increase/decrease size buttons for proportional furniture
All furniture currently scales proportionally. Editing the raw dimensions should
not be the only way to resize — add dedicated increase/decrease (grow/shrink) size
buttons as well.

### Bookshelves & wardrobes should hug the wall with their longest side
Tall, against-the-wall items (bookshelves, wardrobes, etc.) should orient so their
**longest side** sits flush against the wall.

---

## Auth & Home Page

### No logged-in indication on the home page
After logging in, the home page (where the menu is) gives no sign that you're logged
in. When logged in:
- Hide the **Sign in** button.
- Make **Create new project** behave like the "new project" button on the projects
  page.

The designer should be reserved for people who don't want to create an account.
