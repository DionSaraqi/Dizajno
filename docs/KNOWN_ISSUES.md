# Known Issues

Active, intentionally-deferred bugs. **When an issue here is fixed, delete its
entry (and the matching `KNOWN-ISSUE(...)` code comment) so this file never lists
anything that is no longer true.**

---

## Floors & Room Drawing

### Resizing a room with shared walls is disabled
Rooms that share a wall with a neighbor (created by the room-merge behavior)
refuse the W×L resize with a toast — dragging a shared wall would silently
reshape the neighbor. Needs a detach-or-resize-both interaction to lift the
restriction.

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
