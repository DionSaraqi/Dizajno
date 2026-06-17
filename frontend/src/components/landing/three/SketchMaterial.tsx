"use client";

import { useMemo } from "react";
import { shaderMaterial } from "@react-three/drei/core/shaderMaterial";
import { extend } from "@react-three/fiber";
import { Color } from "three";

/**
 * Stylized toon material for the landing-page house ("Blueprint coming to life").
 *
 * Design intent:
 *  - World-space normal + world-space view dir → shading and rim stay STABLE while
 *    the house rotates on the homepage (no flicker, no light-relative shifts).
 *  - Soft `smoothstep` banding (not hard if-bands) → a smooth, premium cartoon ramp.
 *  - Warm-lit / cool-shadow 2-temperature: shadows fade toward the brand indigo
 *    (`shadowTint`) while lit faces warm up — so the "sketch" side stays cool/blueprint
 *    and the lit side reads as finished, warm cottage colour.
 *  - Cheap vertical fake-AO grounds geometry without any shadow maps.
 *  - Gated fresnel `rim` (only hero meshes pay for it) draws a soft indigo silhouette halo.
 *  - `emissive` + `emissiveStrength` drive glowing windows and the door's breathing pulse.
 *
 * The material is self-lit — it intentionally ignores scene lights, which keeps it
 * rotation-stable and free of per-light cost.
 */
const SketchMaterialImpl = shaderMaterial(
  {
    baseColor: new Color("#3a3a3a"),
    opacity: 1.0,
    shadowTint: new Color("#5e63d4"), // exact brand indigo — shadows lean blueprint
    rimColor: new Color("#6E74E0"),
    emissive: new Color("#000000"),
    emissiveStrength: 0.0,
    rim: 0.0, // 0/1 gate — only hero meshes pay for the fresnel
    aoFloorY: -1.0, // world Y of the ground (room floor sits at y = -1)
    aoRange: 3.2, // world-Y span from floor to roof peak for the AO gradient
  },
  // Vertex — world-space normal + world position + view direction.
  // cameraPosition is a three.js built-in uniform available in the VERTEX stage.
  /* glsl */ `
    varying vec3 vWorldNormal;
    varying vec3 vWorldPos;
    varying vec3 vViewDir;

    void main() {
      vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorldPos = wp.xyz;
      vViewDir = cameraPosition - wp.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  // Fragment — soft toon ramp, warm/cool 2-temperature, fake-AO, gated rim, emissive.
  /* glsl */ `
    uniform vec3 baseColor;
    uniform float opacity;
    uniform vec3 shadowTint;
    uniform vec3 rimColor;
    uniform vec3 emissive;
    uniform float emissiveStrength;
    uniform float rim;
    uniform float aoFloorY;
    uniform float aoRange;

    varying vec3 vWorldNormal;
    varying vec3 vWorldPos;
    varying vec3 vViewDir;

    void main() {
      vec3 N = normalize(vWorldNormal);

      // Fixed world-space key light (top-right, slightly forward)
      vec3 lightDir = normalize(vec3(0.5, 0.8, 0.3));
      float NdotL = dot(N, lightDir);

      // Soft 2-tone toon ramp: plateaus ~0.55 / 0.85 / 1.15 with anti-aliased seams.
      float t1 = smoothstep(-0.12, 0.02, NdotL);
      float t2 = smoothstep(0.42, 0.58, NdotL);
      float band = 0.55 + t1 * 0.30 + t2 * 0.30;

      // Warm-lit pole vs cool (brand-indigo) shadow pole, lerped by lit amount.
      vec3 warm = baseColor * 1.06 + vec3(0.05, 0.03, 0.0);
      vec3 cool = mix(baseColor, shadowTint, 0.45) * 0.80;
      float litFactor = clamp((band - 0.55) / 0.60, 0.0, 1.0);
      vec3 col = mix(cool, warm, litFactor) * (band / 1.15);

      // Vertical fake-AO — darker toward the ground, no shadow maps.
      float h = clamp((vWorldPos.y - aoFloorY) / aoRange, 0.0, 1.0);
      col *= mix(0.82, 1.02, h);

      // Gated fresnel rim — soft indigo silhouette halo (rotation-stable).
      vec3 V = normalize(vViewDir);
      float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
      col += rim * fres * 0.35 * rimColor;

      // Emissive glow (windows / door breathing).
      col += emissive * emissiveStrength;

      gl_FragColor = vec4(col, opacity);
    }
  `
);

extend({ SketchMaterial: SketchMaterialImpl });

// Type declaration for JSX usage
declare global {
  namespace JSX {
    interface IntrinsicElements {
      sketchMaterial: {
        ref?: React.Ref<unknown>;
        baseColor?: Color | string;
        opacity?: number;
        transparent?: boolean;
        depthWrite?: boolean;
        side?: number;
        attach?: string;
        shadowTint?: Color | string;
        rimColor?: Color | string;
        emissive?: Color | string;
        emissiveStrength?: number;
        rim?: number;
        aoFloorY?: number;
        aoRange?: number;
      };
    }
  }
}

export { SketchMaterialImpl };

export interface SketchMaterialProps {
  baseColor?: string;
  opacity?: number;
  transparent?: boolean;
  /** Set false for stacked translucent meshes (e.g. chimney smoke) to avoid transparent-sort artifacts. */
  depthWrite?: boolean;
  side?: number;
  /** Cool shadow pole — defaults to the brand indigo. */
  shadowTint?: string;
  rimColor?: string;
  /** Emissive glow colour (windows, door). */
  emissive?: string;
  emissiveStrength?: number;
  /** 0 or 1 — enable the fresnel rim halo on hero meshes only. */
  rim?: number;
  aoFloorY?: number;
  aoRange?: number;
}

export default function SketchMaterial({
  baseColor = "#3a3a3a",
  opacity = 1.0,
  transparent = false,
  depthWrite,
  side,
  shadowTint = "#5e63d4",
  rimColor = "#6E74E0",
  emissive = "#000000",
  emissiveStrength = 0,
  rim = 0,
  aoFloorY = -1.0,
  aoRange = 3.2,
}: SketchMaterialProps) {
  // Memoize the Color objects so per-frame re-renders (e.g. the door click-through
  // animation) don't churn fresh allocations across the scene's ~150 instances.
  const baseColorC = useMemo(() => new Color(baseColor), [baseColor]);
  const shadowTintC = useMemo(() => new Color(shadowTint), [shadowTint]);
  const rimColorC = useMemo(() => new Color(rimColor), [rimColor]);
  const emissiveC = useMemo(() => new Color(emissive), [emissive]);

  return (
    <sketchMaterial
      baseColor={baseColorC}
      opacity={opacity}
      transparent={transparent}
      depthWrite={depthWrite}
      side={side}
      shadowTint={shadowTintC}
      rimColor={rimColorC}
      emissive={emissiveC}
      emissiveStrength={emissiveStrength}
      rim={rim}
      aoFloorY={aoFloorY}
      aoRange={aoRange}
      attach="material"
    />
  );
}
