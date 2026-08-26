import { describe, expect, it } from "vitest";

import { safeRedirect } from "./safeRedirect";

describe("safeRedirect", () => {
  it("keeps ordinary internal paths", () => {
    expect(safeRedirect("/projects", "/fallback")).toBe("/projects");
    expect(safeRedirect("/projects/abc-123", "/fallback")).toBe("/projects/abc-123");
    expect(safeRedirect("/supplier/1/products?tab=info", "/fallback")).toBe(
      "/supplier/1/products?tab=info",
    );
  });

  it("rejects absolute and protocol-relative URLs", () => {
    expect(safeRedirect("https://evil.test", "/fallback")).toBe("/fallback");
    expect(safeRedirect("http://evil.test", "/fallback")).toBe("/fallback");
    expect(safeRedirect("//evil.test", "/fallback")).toBe("/fallback");
    expect(safeRedirect("/\\evil.test", "/fallback")).toBe("/fallback");
    expect(safeRedirect("javascript:alert(1)", "/fallback")).toBe("/fallback");
  });

  it("rejects control characters smuggled into the value", () => {
    const tab = String.fromCharCode(9);
    const newline = String.fromCharCode(10);
    const nul = String.fromCharCode(0);
    expect(safeRedirect(`/pro${tab}jects`, "/fallback")).toBe("/fallback");
    expect(safeRedirect(`/${newline}//evil.test`, "/fallback")).toBe("/fallback");
    expect(safeRedirect(`/x${nul}`, "/fallback")).toBe("/fallback");
  });

  it("falls back for empty, missing, and relative values", () => {
    expect(safeRedirect(null, "/fallback")).toBe("/fallback");
    expect(safeRedirect(undefined, "/fallback")).toBe("/fallback");
    expect(safeRedirect("", "/fallback")).toBe("/fallback");
    expect(safeRedirect("   ", "/fallback")).toBe("/fallback");
    expect(safeRedirect("projects", "/fallback")).toBe("/fallback");
  });
});
