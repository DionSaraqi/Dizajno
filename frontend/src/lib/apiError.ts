/**
 * Normalises every error the Dizajno backend can produce into a single shape.
 *
 * The API emits seven distinct failure envelopes (see docs/KNOWN_ISSUES.md and
 * backend/BACKEND.md). Rather than teach 38 display sites to unwrap them, the
 * body is parsed exactly once — here — and everything downstream consumes
 * `ApiError`, which is already human-readable.
 *
 * The seven shapes:
 *  1. RFC 7807/9457 `ProblemDetails`      → `{ status, detail }`, occasionally `title`
 *  2. `ValidationProblemDetails`          → the same, plus `errors: { Field: [...] }`
 *  3. Identity failures                   → `{ errors: ["...", "..."] }` (an *array*, same key)
 *  4. Auth 401s                           → `{ error: "Invalid credentials." }`
 *  5. Bodiless 404 / 401 / 403            → nothing to unwrap; client supplies the copy
 *  6. Unconfigured-R2 503                 → a raw `ex.Message` naming server env vars
 *  7. Unhandled exception                 → the ASP.NET developer HTML page, or an empty 500
 *
 * Shapes 3 and 2 collide on the `errors` key with different value types, which is
 * the single nastiest parsing hazard in the set — disambiguated by `Array.isArray`.
 */

/** Coarse classification, used to pick copy, an icon, and whether to offer Retry. */
export type ApiErrorKind =
  | "network"
  | "validation"
  | "unauthorized"
  | "session-expired"
  | "forbidden"
  | "not-found"
  | "conflict"
  | "gone"
  | "too-large"
  | "unsupported-media"
  | "rate-limit"
  | "unavailable"
  | "server"
  | "unknown";

/** The parsed, already-human result. Never contains a raw payload. */
export interface NormalizedApiError {
  kind: ApiErrorKind;
  /** Short noun phrase naming the failure. Never a sentence, never punctuated. */
  title: string;
  /** One sentence: what it means and what to do next. Always present. */
  detail: string;
  /**
   * Human messages the *server* supplied, already fit to show. Empty when the
   * response had no body or the body was unusable (HTML, a stack trace, a
   * config dump). Prefer these over `detail` when non-empty.
   */
  messages: string[];
  /** Per-field validation messages, keys camelCased to match form field names. */
  fieldErrors?: Record<string, string[]>;
  /** Whether offering the user a "Try again" affordance makes sense. */
  retryable: boolean;
  /** ASP.NET correlation id, when the response carried one. */
  traceId?: string;
  /**
   * Diagnostic text for the console and the collapsed `Details` disclosure.
   * Withheld from the primary message on purpose — it can carry stack traces,
   * server paths, and (on the unconfigured-R2 path) credential env-var names.
   */
  technical?: string;
  /** Seconds to wait, parsed from a `Retry-After` header. */
  retryAfterSeconds?: number;
}

/** A failed API call. `message` is always a sentence safe to render as-is. */
export class ApiError extends Error implements NormalizedApiError {
  readonly name = "ApiError";
  readonly status: number;
  readonly path: string;
  readonly kind: ApiErrorKind;
  readonly title: string;
  readonly detail: string;
  readonly messages: string[];
  readonly fieldErrors?: Record<string, string[]>;
  readonly retryable: boolean;
  readonly traceId?: string;
  readonly technical?: string;
  readonly retryAfterSeconds?: number;

  constructor(status: number, path: string, normalized: NormalizedApiError) {
    // `message` is what the ~38 legacy `err.message` call sites render. Making
    // it the primary human sentence means every one of them improves the moment
    // this lands, before any of them are migrated to the shared primitive.
    super(normalized.messages[0] ?? normalized.detail);
    this.status = status;
    this.path = path;
    this.kind = normalized.kind;
    this.title = normalized.title;
    this.detail = normalized.detail;
    this.messages = normalized.messages;
    this.fieldErrors = normalized.fieldErrors;
    this.retryable = normalized.retryable;
    this.traceId = normalized.traceId;
    this.technical = normalized.technical;
    this.retryAfterSeconds = normalized.retryAfterSeconds;
  }

  /** All human messages, falling back to the client-side copy when the body was empty. */
  get allMessages(): string[] {
    return this.messages.length > 0 ? this.messages : [this.detail];
  }
}

// ── Per-status copy for bodiless (and unusable-body) responses ──────────────
//
// Voice rules, per the design research: active voice, own the failure, name a
// next step, no "please", no "sorry", no error codes in the sentence itself.
// `title` is a noun phrase; `detail` is the actionable sentence.

interface StatusCopy {
  kind: ApiErrorKind;
  title: string;
  detail: string;
  retryable: boolean;
}

const STATUS_COPY: Record<number, StatusCopy> = {
  400: {
    kind: "validation",
    title: "That didn't go through",
    detail: "Some of the details weren't accepted. Check them and try again.",
    retryable: false,
  },
  401: {
    kind: "unauthorized",
    title: "Your session has ended",
    detail: "Sign in again to pick up where you left off.",
    retryable: false,
  },
  403: {
    kind: "forbidden",
    title: "You don't have access",
    detail:
      "This account isn't allowed to do that. Ask an owner or an admin to grant access.",
    retryable: false,
  },
  404: {
    kind: "not-found",
    title: "Not found",
    detail: "This item no longer exists, or it isn't shared with your account.",
    retryable: false,
  },
  409: {
    kind: "conflict",
    title: "That conflicts with existing data",
    detail: "Something with those details already exists. Change them and try again.",
    retryable: false,
  },
  410: {
    kind: "gone",
    title: "This link is no longer valid",
    detail: "It has expired or been revoked. Ask for a new one.",
    retryable: false,
  },
  413: {
    kind: "too-large",
    title: "That file is too large",
    detail: "Upload a smaller file and try again.",
    retryable: false,
  },
  415: {
    kind: "unsupported-media",
    title: "That file type isn't supported",
    detail: "Convert it to a supported format and try again.",
    retryable: false,
  },
  429: {
    kind: "rate-limit",
    title: "Too many requests",
    detail: "Wait a moment before trying again.",
    retryable: true,
  },
  503: {
    kind: "unavailable",
    title: "Dizajno is temporarily unavailable",
    detail: "The service is briefly offline. Try again in a minute.",
    retryable: true,
  },
};

const SERVER_COPY: StatusCopy = {
  kind: "server",
  title: "Something went wrong on our end",
  detail: "This one is on us. Try again in a moment.",
  retryable: true,
};

const UNKNOWN_COPY: StatusCopy = {
  kind: "unknown",
  title: "That request didn't complete",
  detail: "Try again in a moment.",
  retryable: true,
};

export const NETWORK_COPY: StatusCopy = {
  kind: "network",
  title: "Can't reach Dizajno",
  detail:
    "The server didn't respond. Check your internet connection, then try again.",
  retryable: true,
};

function copyForStatus(status: number): StatusCopy {
  const exact = STATUS_COPY[status];
  if (exact) return exact;
  if (status >= 500) return SERVER_COPY;
  return UNKNOWN_COPY;
}

// ── Body sanitising ─────────────────────────────────────────────────────────

/**
 * Server text that must never reach a user, even though it arrived in a field
 * nominally meant for humans.
 *
 * The live example is the unconfigured-R2 503: the backend forwards
 * `ex.Message` verbatim, and that message names `R2:AccessKeyId`,
 * `R2:SecretAccessKey`, and the `DIZAJNO_R2__*` env vars — a config-disclosure
 * leak straight into the error banner. Stack traces and SQL are the same class
 * of problem. Anything matching goes to `technical` instead of `messages`.
 */
const LEAKY_PATTERNS: RegExp[] = [
  /\bR2:[A-Za-z]/,
  /\bDIZAJNO_[A-Z0-9_]+/,
  /\b(?:AccessKeyId|SecretAccessKey|ConnectionString|Password=)\b/i,
  /\bat\s+[A-Za-z_][\w.]*\.[A-Za-z_]\w*\s*\(/, // " at Dizajno.Api.Foo("  — stack frame
  /\b[A-Za-z.]*Exception\b/,
  /--->/, // .NET inner-exception separator
  /\b[A-Za-z]:\\[\\\w]/, // Windows path
  /\bappsettings(?:\.\w+)?\.json\b/,
  /\bSELECT\b[\s\S]*\bFROM\b/i,
];

/** True when a server-supplied string is unsafe or unhelpful to show a user. */
export function isLeakyDetail(text: string): boolean {
  if (text.length > 300) return true;
  return LEAKY_PATTERNS.some((pattern) => pattern.test(text));
}

function looksLikeHtml(body: string, contentType: string | null): boolean {
  if (contentType?.includes("text/html")) return true;
  const head = body.trimStart().slice(0, 200).toLowerCase();
  return head.startsWith("<!doctype") || head.startsWith("<html") || head.startsWith("<");
}

/** Keeps only strings that are non-empty, safe, and actually human-readable. */
function usableMessages(candidates: unknown[]): string[] {
  const out: string[] = [];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const trimmed = candidate.trim();
    if (trimmed.length === 0) continue;
    if (isLeakyDetail(trimmed)) continue;
    if (out.includes(trimmed)) continue; // the same message can arrive twice
    out.push(trimmed);
  }
  return out;
}

// ── Field-name mapping ──────────────────────────────────────────────────────

/**
 * ASP.NET keys its validation map by C# property name (`Email`, `Sku`,
 * `BasePrice`), while the forms use camelCase. Malformed JSON additionally
 * produces `$` or `$.propertyName` keys.
 *
 * Returns `""` for the `$` root key — the caller routes those to the form-level
 * summary rather than dropping them, since no field owns them.
 */
export function toFieldName(key: string): string {
  let name = key.trim();
  if (name === "$" || name === "") return "";
  if (name.startsWith("$.")) name = name.slice(2);
  // Nested DTO paths ("Variant.Sku") belong to their leaf input.
  const leaf = name.split(".").pop() ?? name;
  // Strip array indexers: "Lines[0]" → "Lines".
  const bare = leaf.replace(/\[\d+\]$/, "");
  if (bare.length === 0) return "";
  // Preserve already-camelCase and all-caps acronyms; only lower a leading
  // capital run that is followed by a lowercase letter (`SKU` stays `SKU`,
  // `BasePrice` becomes `basePrice`).
  if (/^[A-Z][a-z]/.test(bare)) {
    return bare.charAt(0).toLowerCase() + bare.slice(1);
  }
  return bare;
}

/**
 * `title` values that carry no information beyond the status code. ASP.NET
 * fills these in automatically, so echoing them just says "Bad Request" twice.
 */
const GENERIC_TITLES = new Set(
  [
    "bad request",
    "unauthorized",
    "forbidden",
    "not found",
    "conflict",
    "gone",
    "internal server error",
    "service unavailable",
    "one or more validation errors occurred.",
    "one or more validation errors occurred",
  ].map((t) => t.toLowerCase()),
);

function isGenericTitle(title: string): boolean {
  return GENERIC_TITLES.has(title.trim().toLowerCase());
}

// ── The parser ──────────────────────────────────────────────────────────────

export interface ParseInput {
  status: number;
  statusText?: string;
  body: string;
  contentType?: string | null;
  retryAfter?: string | null;
  /** Set when a 401 arrives on an authenticated request that already retried a refresh. */
  sessionExpired?: boolean;
}

function parseRetryAfter(header: string | null | undefined): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds;
  const asDate = Date.parse(header);
  if (Number.isNaN(asDate)) return undefined;
  return Math.max(0, Math.round((asDate - Date.now()) / 1000));
}

/**
 * Turns a raw failure response into `NormalizedApiError`. Pure — no fetch, no
 * DOM — so the seven envelope shapes are directly unit-testable.
 */
export function normalizeErrorResponse(input: ParseInput): NormalizedApiError {
  const { status, body, contentType } = input;
  const retryAfterSeconds = parseRetryAfter(input.retryAfter);

  const base = copyForStatus(status);
  let kind = base.kind;
  let title = base.title;
  let detail = base.detail;
  let retryable = base.retryable;

  // A 401 that survived the refresh-and-retry means the session is genuinely
  // dead, not that a single token expired. Distinguishing them matters: only
  // this one should push the user toward signing in again.
  if (status === 401 && input.sessionExpired) {
    kind = "session-expired";
  }

  if (retryAfterSeconds !== undefined && status === 429) {
    detail =
      retryAfterSeconds > 0
        ? `Wait ${formatSeconds(retryAfterSeconds)} before trying again.`
        : detail;
  }

  const trimmed = body?.trim() ?? "";

  // Shape 5: no body at all. The per-status copy above is the whole answer.
  if (trimmed.length === 0) {
    return { kind, title, detail, messages: [], retryable, retryAfterSeconds };
  }

  // Shape 7: the ASP.NET developer exception page. Rendering this dumps an
  // entire HTML document into the banner, so it is discarded wholesale.
  if (looksLikeHtml(trimmed, contentType ?? null)) {
    return {
      kind,
      title,
      detail,
      messages: [],
      retryable,
      retryAfterSeconds,
      technical: trimmed.slice(0, 2000),
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    // Non-JSON text. Short, safe, sentence-like bodies are worth showing;
    // anything else is diagnostic only.
    const safe = usableMessages([trimmed]);
    return {
      kind,
      title,
      detail,
      messages: safe.length > 0 && trimmed.length <= 200 ? safe : [],
      retryable,
      retryAfterSeconds,
      technical: trimmed.slice(0, 2000),
    };
  }

  if (typeof parsed === "string") {
    return {
      kind,
      title,
      detail,
      messages: usableMessages([parsed]),
      retryable,
      retryAfterSeconds,
    };
  }

  if (parsed === null || typeof parsed !== "object") {
    return { kind, title, detail, messages: [], retryable, retryAfterSeconds };
  }

  const payload = parsed as Record<string, unknown>;
  const messages: string[] = [];
  let fieldErrors: Record<string, string[]> | undefined;
  let technical: string | undefined;

  // `traceId` sits at the root on ValidationProblemDetails and inside
  // `extensions` when a handler adds it explicitly.
  const extensions =
    typeof payload.extensions === "object" && payload.extensions !== null
      ? (payload.extensions as Record<string, unknown>)
      : undefined;
  const traceCandidate = payload.traceId ?? extensions?.traceId;
  const traceId = typeof traceCandidate === "string" ? traceCandidate : undefined;

  // Shapes 2 + 3 — same key, different types.
  const errors = payload.errors;
  if (Array.isArray(errors)) {
    // Shape 3: Identity's array of already-human strings.
    messages.push(...usableMessages(errors));
  } else if (errors !== null && typeof errors === "object") {
    // Shape 2: the per-field validation map.
    const map: Record<string, string[]> = {};
    const unfielded: string[] = [];
    for (const [rawKey, value] of Object.entries(errors as Record<string, unknown>)) {
      const list = usableMessages(Array.isArray(value) ? value : [value]);
      if (list.length === 0) continue;
      const field = toFieldName(rawKey);
      if (field === "") {
        unfielded.push(...list);
        continue;
      }
      map[field] = [...(map[field] ?? []), ...list];
    }
    if (Object.keys(map).length > 0) fieldErrors = map;
    // Every field message also goes into `messages` so a screen with no
    // field-level wiring still shows something actionable, and so the form
    // summary and the inline messages read identically.
    for (const list of Object.values(map)) messages.push(...list);
    messages.push(...unfielded);
    if (fieldErrors) kind = "validation";
  }

  // Shape 4: `{ error: "..." }`.
  if (typeof payload.error === "string") {
    messages.push(...usableMessages([payload.error]));
  }

  // Shape 1 + 6: ProblemDetails. `detail` is where all ~100 service-level
  // messages live; shape 6 is the same field carrying a leaked `ex.Message`,
  // which `usableMessages` filters out and we keep as diagnostics instead.
  if (typeof payload.detail === "string") {
    const problemDetail = payload.detail.trim();
    const safe = usableMessages([problemDetail]);
    if (safe.length > 0) {
      messages.push(...safe);
    } else if (problemDetail.length > 0) {
      technical = problemDetail;
    }
  }

  if (typeof payload.title === "string" && !isGenericTitle(payload.title)) {
    const problemTitle = payload.title.trim();
    if (problemTitle.length > 0 && !isLeakyDetail(problemTitle)) {
      // A meaningful server title outranks the generic per-status one.
      title = problemTitle;
    }
  }

  // A 409 whose message names a duplicate is worth classifying precisely, since
  // the surface usually wants to point at the offending field.
  if (status === 409) kind = "conflict";

  const deduped = usableMessages(messages);

  return {
    kind,
    title,
    detail,
    messages: deduped,
    fieldErrors,
    retryable,
    traceId,
    technical,
    retryAfterSeconds,
  };
}

/** Builds the normalised shape for a `fetch` that never reached the server. */
export function normalizeNetworkError(cause: unknown): NormalizedApiError {
  return {
    kind: NETWORK_COPY.kind,
    title: NETWORK_COPY.title,
    detail: NETWORK_COPY.detail,
    messages: [],
    retryable: true,
    technical: cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause),
  };
}

function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

// ── Consumer helpers ────────────────────────────────────────────────────────

/**
 * Coerces anything thrown into the normalised shape, so display sites can take
 * `unknown` and never branch on `instanceof`.
 *
 * Not every failure in the app is an `ApiError`: the R2 presigned-PUT helpers
 * and the GLB analyser throw plain `Error`s with copy that is already written
 * for humans, so those are passed through as the message.
 */
export function toNormalizedError(error: unknown): NormalizedApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof Error) {
    const message = error.message.trim();
    const safe = !isLeakyDetail(message) && message.length > 0;
    return {
      kind: "unknown",
      title: UNKNOWN_COPY.title,
      detail: UNKNOWN_COPY.detail,
      messages: safe ? [message] : [],
      retryable: true,
      technical: safe ? undefined : message || undefined,
    };
  }
  return {
    kind: "unknown",
    title: UNKNOWN_COPY.title,
    detail: UNKNOWN_COPY.detail,
    messages: [],
    retryable: true,
    technical: error === undefined ? undefined : String(error),
  };
}

/**
 * Produces the heading for an error surface.
 *
 * `action` is a verb phrase naming what the user was doing ("load your
 * projects", "save this variant"). Naming the failed operation is what keeps
 * a surface from degenerating into "Something went wrong" — but a specific
 * server-supplied title still wins, since it is more precise than either.
 */
export function errorTitle(error: unknown, action?: string): string {
  const normalized = toNormalizedError(error);
  const isGeneric =
    normalized.title === UNKNOWN_COPY.title || normalized.title === SERVER_COPY.title;
  if (action && isGeneric) {
    return `Couldn't ${action}`;
  }
  return normalized.title;
}

/** The sentences to render under the title. Never empty. */
export function errorMessages(error: unknown): string[] {
  const normalized = toNormalizedError(error);
  return normalized.messages.length > 0 ? normalized.messages : [normalized.detail];
}

/**
 * The message for one form field, ready to hand to `<FormField error>`.
 * `field` is the camelCased name (`email`, `basePrice`).
 */
export function fieldErrorFor(error: unknown, field: string): string | undefined {
  if (error == null) return undefined;
  return toNormalizedError(error).fieldErrors?.[field]?.[0];
}

/** True when the error means the session is over and signing in again fixes it. */
export function isSessionExpired(error: unknown): boolean {
  return toNormalizedError(error).kind === "session-expired";
}
