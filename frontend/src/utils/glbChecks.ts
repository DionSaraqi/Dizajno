/**
 * Pure GLB upload checks — no three.js, no DOM, unit-testable.
 *
 * The designer scales a GLB uniformly by `min(width/rawX, height/rawY,
 * depth/rawZ)` (GLTFModel.tsx), so what matters for a clean hitbox is that the
 * typed catalog dimensions have the *same proportions* as the model's raw
 * bounding box — the absolute unit the file was authored in is forgiven by the
 * uniform scale. These helpers grade a measured bounding box against the
 * supplier's typed dimensions and produce the warnings the portal shows.
 */

export interface TypedDims {
  width: number;
  height: number;
  depth: number;
}

export interface GlbMeasurement {
  /** Raw bounding-box size in the file's own units: [x, y, z]. */
  size: [number, number, number];
  triangleCount: number;
  materialNames: string[];
  fileSizeBytes: number;
}

export interface DimensionAssessment {
  /** typed/measured per axis: [width/x, height/y, depth/z]. */
  ratios: [number, number, number];
  /** max(ratios)/min(ratios) − 1; 0 means the proportions match exactly. */
  proportionSpread: number;
  proportionsMatch: boolean;
  /** Human hint when the mean ratio matches a known unit-conversion factor. */
  unitHint: string | null;
  /**
   * Multiply the measured size by this to get meters: 1 when the file is
   * meter-authored (or the mismatch points at the typed values), 0.01 for a
   * centimeter-authored file, etc. Null when the scale relationship doesn't
   * match any known unit — callers should fall back to proportion-preserving
   * application instead of trusting raw bounds.
   */
  measuredToMeters: number | null;
}

/** Mirror of the backend AssetUploadRules cap for AssetKind.Glb. */
export const GLB_MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
/** Web budget for a scene that renders many items at once. */
export const GLB_MAX_RECOMMENDED_TRIANGLES = 150_000;
/** Proportion spread beyond this produces dead-space hitboxes worth warning about. */
export const PROPORTION_TOLERANCE = 0.02;
/** Typed dims outside this range are almost certainly a unit mistake. */
const PLAUSIBLE_DIM_MIN_M = 0.05;
const PLAUSIBLE_DIM_MAX_M = 10;

/**
 * Binary glTF container check: magic "glTF" + version ≥ 2 — the same
 * acceptance rule as three.js's GLTFBinaryExtension.
 */
export function isGlbBuffer(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 12) return false;
  const view = new DataView(buffer);
  const magic = view.getUint32(0, true);
  const version = view.getUint32(4, true);
  return magic === 0x46546c67 && version >= 2;
}

const UNIT_FACTORS: { ratio: number; hint: string | null; measuredToMeters: number }[] = [
  // Ratio ≈ 1: file is meter-authored and typed values are in the same
  // ballpark — nothing to hint at.
  { ratio: 1, hint: null, measuredToMeters: 1 },
  {
    ratio: 0.01,
    hint: "Model appears to be authored in centimeters — the designer auto-scales it, so this is fine as long as the proportions match.",
    measuredToMeters: 0.01,
  },
  {
    ratio: 0.001,
    hint: "Model appears to be authored in millimeters — the designer auto-scales it, so this is fine as long as the proportions match.",
    measuredToMeters: 0.001,
  },
  {
    ratio: 1 / 39.37,
    hint: "Model appears to be authored in inches — the designer auto-scales it, so this is fine as long as the proportions match.",
    measuredToMeters: 1 / 39.37,
  },
  {
    ratio: 100,
    hint: "Typed dimensions look 100× larger than the model — did you enter centimeters? Dimensions must be in meters.",
    measuredToMeters: 1,
  },
  {
    ratio: 1000,
    hint: "Typed dimensions look 1000× larger than the model — did you enter millimeters? Dimensions must be in meters.",
    measuredToMeters: 1,
  },
];

/** Relative log-space tolerance when matching a unit-conversion factor. */
const UNIT_MATCH_TOLERANCE = 0.12;

/**
 * Grade typed dimensions against a measured bounding box. Returns null when
 * the measurement is degenerate (a zero-size axis — a flat or empty model).
 */
export function assessDimensions(
  typed: TypedDims,
  measured: [number, number, number]
): DimensionAssessment | null {
  const [x, y, z] = measured;
  if (x <= 0 || y <= 0 || z <= 0) return null;
  if (typed.width <= 0 || typed.height <= 0 || typed.depth <= 0) return null;

  const ratios: [number, number, number] = [
    typed.width / x,
    typed.height / y,
    typed.depth / z,
  ];
  const max = Math.max(...ratios);
  const min = Math.min(...ratios);
  const proportionSpread = max / min - 1;

  const meanRatio = Math.cbrt(ratios[0] * ratios[1] * ratios[2]);
  let unitHint: string | null = null;
  let measuredToMeters: number | null = null;
  for (const candidate of UNIT_FACTORS) {
    if (Math.abs(Math.log(meanRatio / candidate.ratio)) <= UNIT_MATCH_TOLERANCE) {
      unitHint = candidate.hint;
      measuredToMeters = candidate.measuredToMeters;
      break;
    }
  }

  return {
    ratios,
    proportionSpread,
    proportionsMatch: proportionSpread <= PROPORTION_TOLERANCE,
    unitHint,
    measuredToMeters,
  };
}

/**
 * The dimensions to write into the W/H/D fields when the supplier clicks
 * "Apply measured dimensions". In meters. Strategy:
 *  - A recognized unit relationship (meters/cm/mm/inches) converts the
 *    measured bounds to meters directly.
 *  - Unknown relationship (e.g. a stylized model): keep the typed height as
 *    the anchor and match the model's proportions around it.
 *  - No usable typed dims: trust the measured bounds as meters only when
 *    every axis is a plausible furniture size.
 * Returns null when nothing sensible can be applied.
 */
export function measuredDimsForApply(
  typed: TypedDims | null,
  measured: [number, number, number]
): TypedDims | null {
  const [x, y, z] = measured;
  if (x <= 0 || y <= 0 || z <= 0) return null;

  if (typed) {
    const factor = assessDimensions(typed, measured)?.measuredToMeters ?? null;
    if (factor !== null) {
      return { width: x * factor, height: y * factor, depth: z * factor };
    }
    return {
      width: typed.height * (x / y),
      height: typed.height,
      depth: typed.height * (z / y),
    };
  }

  const plausible = [x, y, z].every(
    (v) => v >= PLAUSIBLE_DIM_MIN_M && v <= PLAUSIBLE_DIM_MAX_M
  );
  return plausible ? { width: x, height: y, depth: z } : null;
}

/** All portal warnings for a measured GLB against the currently typed dims. */
export function collectGlbWarnings(
  measurement: GlbMeasurement,
  typed: TypedDims
): string[] {
  const warnings: string[] = [];

  const assessment = assessDimensions(typed, measurement.size);
  if (assessment === null) {
    warnings.push(
      "The model's bounding box has a zero-size axis — it may be flat, empty, or corrupt."
    );
  } else {
    if (!assessment.proportionsMatch) {
      warnings.push(
        `Typed dimensions don't share the model's proportions (off by ${Math.round(
          assessment.proportionSpread * 100
        )}%). The designer scales uniformly, so the selection/collision box will have dead space. Use "Apply measured dimensions" or adjust the fields.`
      );
    }
    if (assessment.unitHint) {
      warnings.push(assessment.unitHint);
    }
  }

  for (const [axis, value] of Object.entries(typed) as [string, number][]) {
    if (value > PLAUSIBLE_DIM_MAX_M || value < PLAUSIBLE_DIM_MIN_M) {
      warnings.push(
        `${axis[0].toUpperCase()}${axis.slice(1)} of ${value} m is outside the usual furniture range (${PLAUSIBLE_DIM_MIN_M}–${PLAUSIBLE_DIM_MAX_M} m) — double-check the unit.`
      );
    }
  }

  if (measurement.triangleCount > GLB_MAX_RECOMMENDED_TRIANGLES) {
    warnings.push(
      `${measurement.triangleCount.toLocaleString()} triangles exceeds the recommended budget of ${GLB_MAX_RECOMMENDED_TRIANGLES.toLocaleString()} — the model will slow down rooms with many items. Consider simplifying it.`
    );
  }

  if (measurement.fileSizeBytes > GLB_MAX_UPLOAD_BYTES) {
    warnings.push(
      `File is ${(measurement.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB — uploads over 50 MB are rejected by the server.`
    );
  }

  return warnings;
}
