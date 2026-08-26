/**
 * True when the string contains a C0 control character or DEL. Written as a
 * codepoint scan rather than a regex literal so the bytes stay visible in
 * source — an invisible control character inside a character class is exactly
 * the kind of thing that silently rots.
 */
function hasControlChars(value: string): boolean {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

/**
 * Constrains a `?redirect=` value to a path inside this app.
 *
 * The login and register screens push whatever the query string contains
 * straight into `router.replace`, which makes them the highest-value phishing
 * target in the app: a user who has just been told to sign in is primed to
 * trust wherever they land next. Anything not clearly an internal path falls
 * back to the caller's default.
 *
 * Rejected: absolute URLs (`https://evil.test`), protocol-relative URLs
 * (`//evil.test`), and the backslash variants some parsers normalise to `//`.
 */
export function safeRedirect(raw: string | null | undefined, fallback: string): string {
  if (!raw) return fallback;

  const value = raw.trim();
  if (value.length === 0) return fallback;
  if (hasControlChars(value)) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;

  return value;
}
