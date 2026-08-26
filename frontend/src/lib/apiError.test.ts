import { describe, expect, it } from "vitest";

import {
  ApiError,
  errorMessages,
  errorTitle,
  isLeakyDetail,
  normalizeErrorResponse,
  normalizeNetworkError,
  toFieldName,
  toNormalizedError,
} from "./apiError";

const json = "application/json; charset=utf-8";

describe("normalizeErrorResponse — the seven backend envelope shapes", () => {
  it("shape 1: unwraps ProblemDetails `detail`", () => {
    const result = normalizeErrorResponse({
      status: 409,
      body: JSON.stringify({ status: 409, detail: "Slug already in use." }),
      contentType: json,
    });

    expect(result.messages).toEqual(["Slug already in use."]);
    expect(result.kind).toBe("conflict");
    // The envelope itself must never survive into user-facing text.
    expect(result.messages.join(" ")).not.toContain("409");
    expect(result.messages.join(" ")).not.toContain("{");
  });

  it("shape 1: prefers a meaningful ProblemDetails title over the per-status one", () => {
    const result = normalizeErrorResponse({
      status: 400,
      body: JSON.stringify({ status: 400, title: "Scene is invalid", detail: "Wall not found." }),
      contentType: json,
    });

    expect(result.title).toBe("Scene is invalid");
    expect(result.messages).toEqual(["Wall not found."]);
  });

  it("shape 1: ignores a title that only restates the status code", () => {
    const result = normalizeErrorResponse({
      status: 403,
      body: JSON.stringify({ status: 403, title: "Forbidden", detail: "This share is view-only." }),
      contentType: json,
    });

    // "Forbidden" adds nothing over the status, so the written copy wins.
    expect(result.title).toBe("You don't have access");
    expect(result.messages).toEqual(["This share is view-only."]);
  });

  it("shape 2: splits ValidationProblemDetails into a per-field map", () => {
    const result = normalizeErrorResponse({
      status: 400,
      body: JSON.stringify({
        type: "https://tools.ietf.org/html/rfc9110#section-15.5.1",
        title: "One or more validation errors occurred.",
        status: 400,
        errors: {
          Email: ["The Email field is not a valid e-mail address."],
          Password: ["The field Password must be a minimum length of '8'."],
        },
        traceId: "00-abc-def-00",
      }),
      contentType: json,
    });

    expect(result.kind).toBe("validation");
    expect(result.fieldErrors).toEqual({
      email: ["The Email field is not a valid e-mail address."],
      password: ["The field Password must be a minimum length of '8'."],
    });
    expect(result.traceId).toBe("00-abc-def-00");
    // The generic ASP.NET title is suppressed in favour of written copy.
    expect(result.title).not.toContain("One or more");
    // Field messages are mirrored into `messages` so an unwired screen still
    // shows something, and so summary and inline text read identically.
    expect(result.messages).toHaveLength(2);
  });

  it("shape 3: reads Identity's `errors` ARRAY without confusing it for the map", () => {
    const result = normalizeErrorResponse({
      status: 400,
      body: JSON.stringify({
        errors: ["Username 'x@y.com' is already taken.", "Email 'x@y.com' is already taken."],
      }),
      contentType: json,
    });

    expect(result.messages).toEqual([
      "Username 'x@y.com' is already taken.",
      "Email 'x@y.com' is already taken.",
    ]);
    expect(result.fieldErrors).toBeUndefined();
  });

  it("shapes 2 and 3 share the `errors` key — disambiguated by value type", () => {
    const asArray = normalizeErrorResponse({
      status: 400,
      body: JSON.stringify({ errors: ["Boom."] }),
      contentType: json,
    });
    const asMap = normalizeErrorResponse({
      status: 400,
      body: JSON.stringify({ errors: { Name: ["Boom."] } }),
      contentType: json,
    });

    expect(asArray.fieldErrors).toBeUndefined();
    expect(asMap.fieldErrors).toEqual({ name: ["Boom."] });
    expect(asArray.messages).toEqual(asMap.messages);
  });

  it("shape 4: unwraps the auth `{ error }` string", () => {
    const result = normalizeErrorResponse({
      status: 401,
      body: JSON.stringify({ error: "Invalid credentials." }),
      contentType: json,
    });

    expect(result.messages).toEqual(["Invalid credentials."]);
    expect(result.kind).toBe("unauthorized");
  });

  it("shape 5: falls back to written copy for a bodiless 404", () => {
    const result = normalizeErrorResponse({ status: 404, body: "" });

    expect(result.kind).toBe("not-found");
    expect(result.messages).toEqual([]);
    expect(result.title).toBe("Not found");
    expect(result.detail.length).toBeGreaterThan(0);
    expect(errorMessages(new ApiError(404, "/x", result))).toEqual([result.detail]);
  });

  it("shape 5: bodiless 401 and 403 get distinct, correct affordance copy", () => {
    const unauthorized = normalizeErrorResponse({ status: 401, body: "" });
    const forbidden = normalizeErrorResponse({ status: 403, body: "" });

    // 401 → re-authenticating helps. 403 → it does not; ask for access instead.
    expect(unauthorized.detail).toMatch(/sign in/i);
    expect(forbidden.detail).not.toMatch(/sign in/i);
    expect(forbidden.detail).toMatch(/access/i);
  });

  it("shape 6: withholds the unconfigured-R2 message that names server env vars", () => {
    const leak =
      "R2 is not configured. Set R2:AccessKeyId and R2:SecretAccessKey, " +
      "or the DIZAJNO_R2__ACCESSKEYID and DIZAJNO_R2__SECRETACCESSKEY environment variables.";
    const result = normalizeErrorResponse({
      status: 503,
      body: JSON.stringify({ status: 503, detail: leak }),
      contentType: json,
    });

    expect(result.messages).toEqual([]);
    expect(result.technical).toBe(leak);
    expect(result.kind).toBe("unavailable");
    // Nothing user-facing may mention credentials or env vars.
    const shown = [result.title, result.detail, ...result.messages].join(" ");
    expect(shown).not.toMatch(/AccessKeyId|SecretAccessKey|DIZAJNO_/);
  });

  it("shape 7: discards the ASP.NET developer exception HTML page", () => {
    const html =
      "<!DOCTYPE html>\n<html lang=\"en\"><head><title>Internal Server Error</title>" +
      "</head><body><pre>System.NullReferenceException: Object reference not set</pre></body></html>";
    const result = normalizeErrorResponse({
      status: 500,
      body: html,
      contentType: "text/html; charset=utf-8",
    });

    expect(result.messages).toEqual([]);
    expect(result.kind).toBe("server");
    expect(result.retryable).toBe(true);
    expect(result.technical).toContain("NullReferenceException");
  });

  it("shape 7: an HTML body with no content-type header is still detected", () => {
    const result = normalizeErrorResponse({
      status: 500,
      body: "<html><body>boom</body></html>",
      contentType: null,
    });

    expect(result.messages).toEqual([]);
  });
});

describe("normalizeErrorResponse — hostile and malformed bodies", () => {
  it("never leaks a stack trace into a user-facing message", () => {
    const result = normalizeErrorResponse({
      status: 500,
      body: JSON.stringify({
        status: 500,
        detail:
          "System.InvalidOperationException: boom\n   at Dizajno.Api.Controllers.Foo.Bar(Guid id)",
      }),
      contentType: json,
    });

    expect(result.messages).toEqual([]);
    expect(result.technical).toContain("at Dizajno.Api");
  });

  it("drops an over-long detail rather than dumping it into a banner", () => {
    const result = normalizeErrorResponse({
      status: 400,
      body: JSON.stringify({ detail: "x".repeat(400) }),
      contentType: json,
    });

    expect(result.messages).toEqual([]);
  });

  it("keeps a short plain-text body but discards a long one", () => {
    const short = normalizeErrorResponse({ status: 400, body: "Quote is already Closed." });
    const long = normalizeErrorResponse({ status: 400, body: "x".repeat(500) });

    expect(short.messages).toEqual(["Quote is already Closed."]);
    expect(long.messages).toEqual([]);
    expect(long.technical).toBeTruthy();
  });

  it("survives malformed JSON, a JSON string, null, and an empty object", () => {
    expect(() => normalizeErrorResponse({ status: 400, body: "{not json" })).not.toThrow();
    expect(normalizeErrorResponse({ status: 400, body: '"just a string"' }).messages).toEqual([
      "just a string",
    ]);
    expect(normalizeErrorResponse({ status: 400, body: "null" }).messages).toEqual([]);
    expect(normalizeErrorResponse({ status: 400, body: "{}" }).messages).toEqual([]);
  });

  it("de-duplicates a message that arrives in two fields at once", () => {
    const result = normalizeErrorResponse({
      status: 400,
      body: JSON.stringify({ error: "Name is required.", detail: "Name is required." }),
      contentType: json,
    });

    expect(result.messages).toEqual(["Name is required."]);
  });

  it("ignores empty and non-string entries in an errors array", () => {
    const result = normalizeErrorResponse({
      status: 400,
      body: JSON.stringify({ errors: ["", "  ", null, 42, "Real message."] }),
      contentType: json,
    });

    expect(result.messages).toEqual(["Real message."]);
  });
});

describe("normalizeErrorResponse — status classification", () => {
  it.each([
    [400, "validation"],
    [401, "unauthorized"],
    [403, "forbidden"],
    [404, "not-found"],
    [409, "conflict"],
    [410, "gone"],
    [413, "too-large"],
    [415, "unsupported-media"],
    [429, "rate-limit"],
    [500, "server"],
    [502, "server"],
    [503, "unavailable"],
  ])("classifies %i as %s", (status, kind) => {
    expect(normalizeErrorResponse({ status, body: "" }).kind).toBe(kind);
  });

  it("marks a 401 that outlived the refresh retry as session-expired", () => {
    const plain = normalizeErrorResponse({ status: 401, body: "" });
    const expired = normalizeErrorResponse({ status: 401, body: "", sessionExpired: true });

    expect(plain.kind).toBe("unauthorized");
    expect(expired.kind).toBe("session-expired");
  });

  it("offers retry only where retrying could plausibly work", () => {
    expect(normalizeErrorResponse({ status: 500, body: "" }).retryable).toBe(true);
    expect(normalizeErrorResponse({ status: 503, body: "" }).retryable).toBe(true);
    expect(normalizeErrorResponse({ status: 403, body: "" }).retryable).toBe(false);
    expect(normalizeErrorResponse({ status: 404, body: "" }).retryable).toBe(false);
    expect(normalizeErrorResponse({ status: 409, body: "" }).retryable).toBe(false);
  });

  it("reads Retry-After as both seconds and an HTTP date", () => {
    const seconds = normalizeErrorResponse({ status: 429, body: "", retryAfter: "30" });
    expect(seconds.retryAfterSeconds).toBe(30);
    expect(seconds.detail).toContain("30 seconds");

    const future = new Date(Date.now() + 120_000).toUTCString();
    const date = normalizeErrorResponse({ status: 429, body: "", retryAfter: future });
    expect(date.retryAfterSeconds).toBeGreaterThan(100);

    expect(
      normalizeErrorResponse({ status: 429, body: "", retryAfter: "garbage" }).retryAfterSeconds,
    ).toBeUndefined();
  });
});

describe("toFieldName", () => {
  it.each([
    ["Email", "email"],
    ["BasePrice", "basePrice"],
    ["displayName", "displayName"],
    ["SKU", "SKU"],
    ["$.slug", "slug"],
    ["Variant.Sku", "sku"],
    ["Lines[0]", "lines"],
    ["  Name  ", "name"],
  ])("maps %s to %s", (input, expected) => {
    expect(toFieldName(input)).toBe(expected);
  });

  it("returns an empty name for the JSON root key so it routes to the summary", () => {
    expect(toFieldName("$")).toBe("");
    expect(toFieldName("")).toBe("");
  });

  it("keeps root-keyed messages instead of dropping them", () => {
    const result = normalizeErrorResponse({
      status: 400,
      body: JSON.stringify({ errors: { $: ["The JSON value could not be converted."] } }),
      contentType: json,
    });

    expect(result.fieldErrors).toBeUndefined();
    expect(result.messages).toEqual(["The JSON value could not be converted."]);
  });
});

describe("isLeakyDetail", () => {
  it.each([
    "Set R2:AccessKeyId to continue",
    "DIZAJNO_R2__ACCESSKEYID is missing",
    "System.InvalidOperationException: nope",
    "   at Dizajno.Application.Services.Foo.Bar(Guid id)",
    "One error ---> inner error",
    "C:\\app\\src\\Program.cs",
    "check appsettings.Development.json",
    "SELECT * FROM projects",
    "x".repeat(301),
  ])("flags %s", (text) => {
    expect(isLeakyDetail(text)).toBe(true);
  });

  it.each([
    "Slug already in use.",
    "Quote is already Closed.",
    "Email 'x@y.com' is already taken.",
    "This share is view-only.",
  ])("allows the legitimate message %s", (text) => {
    expect(isLeakyDetail(text)).toBe(false);
  });
});

describe("ApiError", () => {
  it("exposes the primary human sentence as `message` for legacy call sites", () => {
    const error = new ApiError(
      409,
      "/api/supplier/products",
      normalizeErrorResponse({
        status: 409,
        body: JSON.stringify({ status: 409, detail: "Slug already in use." }),
        contentType: json,
      }),
    );

    // The whole point: an untouched `{err.message}` site now renders this.
    expect(error.message).toBe("Slug already in use.");
    expect(error.message).not.toContain("Request failed");
    expect(error.status).toBe(409);
    expect(error.path).toBe("/api/supplier/products");
    expect(error instanceof Error).toBe(true);
  });

  it("falls back to written copy when the body was empty", () => {
    const error = new ApiError(404, "/api/projects/1", normalizeErrorResponse({ status: 404, body: "" }));

    expect(error.message).toBe(error.detail);
    expect(error.message).not.toContain("404");
  });

  it("collapses to allMessages regardless of whether the body had content", () => {
    const withBody = new ApiError(
      400,
      "/x",
      normalizeErrorResponse({ status: 400, body: JSON.stringify({ error: "Bad." }), contentType: json }),
    );
    const withoutBody = new ApiError(400, "/x", normalizeErrorResponse({ status: 400, body: "" }));

    expect(withBody.allMessages).toEqual(["Bad."]);
    expect(withoutBody.allMessages).toEqual([withoutBody.detail]);
  });
});

describe("consumer helpers", () => {
  it("passes through a plain Error's already-human message", () => {
    // The R2 presigned-PUT helper and the GLB analyser both throw these.
    const normalized = toNormalizedError(
      new Error("Upload to object storage failed (500). If this is local dev, R2 may not be configured."),
    );

    expect(normalized.messages[0]).toContain("Upload to object storage failed");
  });

  it("withholds a plain Error whose message is a stack trace", () => {
    const normalized = toNormalizedError(new Error("System.Exception: boom"));

    expect(normalized.messages).toEqual([]);
    expect(normalized.technical).toContain("boom");
  });

  it("handles non-Error throws without crashing the display site", () => {
    expect(toNormalizedError("a string").messages).toEqual([]);
    expect(toNormalizedError(undefined).messages).toEqual([]);
    expect(toNormalizedError(null).messages).toEqual([]);
    expect(errorMessages(undefined)).toHaveLength(1);
  });

  it("names the failed operation instead of saying 'something went wrong'", () => {
    const serverError = new ApiError(500, "/api/projects", normalizeErrorResponse({ status: 500, body: "" }));

    expect(errorTitle(serverError, "load your projects")).toBe("Couldn't load your projects");
    // A specific server title is more precise than the action, so it wins.
    const specific = new ApiError(
      400,
      "/x",
      normalizeErrorResponse({
        status: 400,
        body: JSON.stringify({ title: "Scene is invalid", detail: "Wall not found." }),
        contentType: json,
      }),
    );
    expect(errorTitle(specific, "save the scene")).toBe("Scene is invalid");
  });

  it("describes a network failure without echoing 'Failed to fetch'", () => {
    const normalized = normalizeNetworkError(new TypeError("Failed to fetch"));

    expect(normalized.kind).toBe("network");
    expect(normalized.messages).toEqual([]);
    expect(normalized.title).not.toContain("fetch");
    expect(normalized.detail).toMatch(/connection/i);
    expect(normalized.technical).toContain("Failed to fetch");
  });
});
