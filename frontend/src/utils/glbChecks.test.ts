import { describe, it, expect } from "vitest";
import {
  isGlbBuffer,
  assessDimensions,
  collectGlbWarnings,
  measuredDimsForApply,
  GLB_MAX_RECOMMENDED_TRIANGLES,
  GLB_MAX_UPLOAD_BYTES,
} from "./glbChecks";

function glbHeader(magic = 0x46546c67, version = 2): ArrayBuffer {
  const buffer = new ArrayBuffer(12);
  const view = new DataView(buffer);
  view.setUint32(0, magic, true);
  view.setUint32(4, version, true);
  view.setUint32(8, 12, true);
  return buffer;
}

describe("isGlbBuffer", () => {
  it("accepts a valid glTF v2 binary header", () => {
    expect(isGlbBuffer(glbHeader())).toBe(true);
  });

  it("rejects wrong magic bytes", () => {
    expect(isGlbBuffer(glbHeader(0xdeadbeef))).toBe(false);
  });

  it("rejects glTF v1", () => {
    expect(isGlbBuffer(glbHeader(0x46546c67, 1))).toBe(false);
  });

  it("rejects buffers shorter than a header", () => {
    expect(isGlbBuffer(new ArrayBuffer(4))).toBe(false);
  });
});

describe("assessDimensions", () => {
  const typed = { width: 2, height: 1, depth: 0.8 };

  it("reports matching proportions when the model has the same aspect ratio", () => {
    // Model authored at exactly the typed size (meters).
    const a = assessDimensions(typed, [2, 1, 0.8]);
    expect(a).not.toBeNull();
    expect(a!.proportionsMatch).toBe(true);
    expect(a!.unitHint).toBeNull();
  });

  it("still matches proportions for a uniformly scaled model", () => {
    // Same aspect ratio, 2.5x smaller raw units — uniform scaling handles it.
    const a = assessDimensions(typed, [0.8, 0.4, 0.32]);
    expect(a!.proportionsMatch).toBe(true);
  });

  it("flags proportion mismatch beyond tolerance", () => {
    // Height ratio diverges ~25% from the others → dead-space hitbox.
    const a = assessDimensions(typed, [2, 1.25, 0.8]);
    expect(a!.proportionsMatch).toBe(false);
    expect(a!.proportionSpread).toBeGreaterThan(0.2);
  });

  it("tolerates ~1% measurement noise", () => {
    const a = assessDimensions(typed, [2.0, 1.005, 0.798]);
    expect(a!.proportionsMatch).toBe(true);
  });

  it("detects a centimeter-authored model (ratio ≈ 0.01)", () => {
    const a = assessDimensions(typed, [200, 100, 80]);
    expect(a!.unitHint).toMatch(/centimeter/i);
  });

  it("detects a millimeter-authored model (ratio ≈ 0.001)", () => {
    const a = assessDimensions(typed, [2000, 1000, 800]);
    expect(a!.unitHint).toMatch(/millimeter/i);
  });

  it("detects typed dimensions that look like centimeters (ratio ≈ 100)", () => {
    const a = assessDimensions({ width: 200, height: 100, depth: 80 }, [2, 1, 0.8]);
    expect(a!.unitHint).toMatch(/meters/i);
  });

  it("returns null for degenerate measured sizes", () => {
    expect(assessDimensions(typed, [0, 1, 0.8])).toBeNull();
  });

  it("exposes measuredToMeters = 1 for meter-authored files", () => {
    expect(assessDimensions(typed, [2, 1, 0.8])!.measuredToMeters).toBe(1);
  });

  it("exposes measuredToMeters = 0.01 for centimeter-authored files", () => {
    expect(assessDimensions(typed, [200, 100, 80])!.measuredToMeters).toBe(0.01);
  });

  it("exposes measuredToMeters = 1 when the typed values (not the file) look mis-united", () => {
    const a = assessDimensions({ width: 200, height: 100, depth: 80 }, [2, 1, 0.8]);
    expect(a!.measuredToMeters).toBe(1);
  });

  it("exposes measuredToMeters = null for unrecognized scale relationships", () => {
    // Stylized model ~2.5x smaller than real life — no unit factor matches.
    const a = assessDimensions(typed, [0.8, 0.4, 0.32]);
    expect(a!.measuredToMeters).toBeNull();
  });
});

describe("collectGlbWarnings", () => {
  const okAnalysis = {
    size: [2, 1, 0.8] as [number, number, number],
    triangleCount: 20_000,
    materialNames: ["Body"],
    fileSizeBytes: 8 * 1024 * 1024,
  };
  const typed = { width: 2, height: 1, depth: 0.8 };

  it("returns no warnings for a healthy model", () => {
    expect(collectGlbWarnings(okAnalysis, typed)).toEqual([]);
  });

  it("warns on proportion mismatch", () => {
    const warnings = collectGlbWarnings(okAnalysis, { width: 2, height: 2, depth: 0.8 });
    expect(warnings.some((w) => /proportion/i.test(w))).toBe(true);
  });

  it("warns on excessive triangle count", () => {
    const warnings = collectGlbWarnings(
      { ...okAnalysis, triangleCount: GLB_MAX_RECOMMENDED_TRIANGLES + 1 },
      typed
    );
    expect(warnings.some((w) => /triangle/i.test(w))).toBe(true);
  });

  it("warns when the file exceeds the backend upload cap", () => {
    const warnings = collectGlbWarnings(
      { ...okAnalysis, fileSizeBytes: GLB_MAX_UPLOAD_BYTES + 1 },
      typed
    );
    expect(warnings.some((w) => /50 ?MB/i.test(w))).toBe(true);
  });

  it("warns on implausible typed dimensions", () => {
    const warnings = collectGlbWarnings(okAnalysis, { width: 22, height: 1, depth: 0.8 });
    expect(warnings.some((w) => /22(\.0+)? ?m/i.test(w))).toBe(true);
  });

  it("surfaces the unit hint for a cm-authored model", () => {
    const warnings = collectGlbWarnings(
      { ...okAnalysis, size: [200, 100, 80] },
      typed
    );
    expect(warnings.some((w) => /centimeter/i.test(w))).toBe(true);
  });

  it("warns on a degenerate zero-size axis", () => {
    const warnings = collectGlbWarnings({ ...okAnalysis, size: [2, 0, 0.8] }, typed);
    expect(warnings.some((w) => /zero-size/i.test(w))).toBe(true);
  });

  it("boundary values are inclusive-clean: exactly at the caps produces no warnings", () => {
    const warnings = collectGlbWarnings(
      {
        ...okAnalysis,
        triangleCount: GLB_MAX_RECOMMENDED_TRIANGLES,
        fileSizeBytes: GLB_MAX_UPLOAD_BYTES,
      },
      { width: 10, height: 0.05, depth: 0.8 }
    );
    // Note: 10/0.05 dims break proportions vs okAnalysis.size, so only assert
    // the cap-related warnings are absent.
    expect(warnings.some((w) => /triangle/i.test(w))).toBe(false);
    expect(warnings.some((w) => /50 ?MB/i.test(w))).toBe(false);
    expect(warnings.some((w) => /usual furniture range/i.test(w))).toBe(false);
  });
});

describe("measuredDimsForApply", () => {
  it("converts a cm-authored model to meters", () => {
    const dims = measuredDimsForApply({ width: 2, height: 1, depth: 0.8 }, [200, 100, 80]);
    expect(dims!.width).toBeCloseTo(2);
    expect(dims!.height).toBeCloseTo(1);
    expect(dims!.depth).toBeCloseTo(0.8);
  });

  it("uses measured bounds directly for meter-authored models", () => {
    const dims = measuredDimsForApply({ width: 2.1, height: 1, depth: 0.8 }, [2, 0.95, 0.82]);
    expect(dims).toEqual({ width: 2, height: 0.95, depth: 0.82 });
  });

  it("preserves the typed height for unknown unit relationships", () => {
    // Stylized model 2.5x smaller than life: anchor on typed height.
    const dims = measuredDimsForApply({ width: 2, height: 1, depth: 0.8 }, [0.6, 0.4, 0.2]);
    expect(dims!.height).toBe(1);
    expect(dims!.width).toBeCloseTo(1.5);
    expect(dims!.depth).toBeCloseTo(0.5);
  });

  it("trusts plausible measured bounds when no typed dims exist", () => {
    expect(measuredDimsForApply(null, [2, 1, 0.8])).toEqual({ width: 2, height: 1, depth: 0.8 });
  });

  it("returns null for implausible bounds when no typed dims exist", () => {
    expect(measuredDimsForApply(null, [200, 100, 80])).toBeNull();
  });

  it("returns null for degenerate measurements", () => {
    expect(measuredDimsForApply({ width: 2, height: 1, depth: 0.8 }, [2, 0, 0.8])).toBeNull();
  });
});
