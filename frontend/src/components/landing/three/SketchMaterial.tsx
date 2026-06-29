"use client";

import { shaderMaterial } from "@react-three/drei/core/shaderMaterial";
import { extend } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Color } from "three";

/**
 * Monochrome pencil-blueprint material.
 *
 * World-space lit (rotation-stable: the house drag-rotates while the camera is fixed),
 * built from these layers — all pure grey scalars multiplying one baseColor, so nothing
 * introduces colour:
 *   - half-Lambert wrap + fwidth-antialiased soft toon bands  (Valve / Ronja)
 *   - hemisphere ambient keyed on world-up                    (broad sky/ground gradient)
 *   - gated Fresnel silhouette rim                            (Maya Ndljk)
 *   - screen-fixed paper grain, suppressed in highlights      (mattdesl glsl-film-grain)
 *   - snapped "boiling-line" sub-pixel vertex jitter          (Codrops PS1 / Alan Zucconi)
 *
 * Per-instance gates (uRim / uGrain / uJitter) let glass, the Door accent and the flat
 * ground opt out. uTime is driven for the whole scene from one useFrame in LandingScene
 * via the module-level registry below (no per-mesh React state).
 */

// Every live material registers here so a single useFrame can drive uTime across the
// whole scene by mutating uniforms directly — never through React state.
const clocked = new Set<{ uTime: number }>();

/** Advance the boiling-line clock on every live SketchMaterial. Call once per frame. */
export function tickSketchMaterials(time: number) {
  clocked.forEach((m) => {
    m.uTime = time;
  });
}

const SketchMaterialImpl = shaderMaterial(
  {
    baseColor: new Color("#3a3a3a"),
    opacity: 1.0,
    uTime: 0,
    uGrain: 1,
    uJitter: 1,
    // Retained as inert uniforms so existing `rim`/`rimStrength` call-site props stay valid;
    // the shader no longer reads them (the Fresnel edge rim was removed).
    uRim: 0,
    uRimStrength: 0,
  },
  // Vertex — world-space normal (rotation-independent shading) + boiling-line jitter
  /* glsl */ `
    uniform float uTime;
    uniform float uJitter;

    varying vec3 vWorldNormal;
    varying vec3 vWorldPos;

    void main() {
      vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);

      // "Boiling line": snap time to ~9fps so the form visibly RE-DRAWS like a hand
      // redrawing it, then nudge each vertex a sub-pixel amount (seeded by position).
      float t = floor(uTime * 9.0) / 9.0;
      vec3 jit = vec3(
        sin(t * 7.0 + position.x * 12.0 + position.y * 3.0),
        cos(t * 5.0 + position.y * 9.0  + position.z * 4.0),
        sin(t * 6.0 + position.z * 11.0 + position.x * 2.0)
      ) * 0.005 * uJitter;

      vec3 p = position + jit;
      vec4 worldPos = modelMatrix * vec4(p, 1.0);
      vWorldPos = worldPos.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
  `,
  // Fragment — soft toon ramp + hemisphere + rim + grain (all grey)
  /* glsl */ `
    uniform vec3 baseColor;
    uniform float opacity;
    uniform float uGrain;

    varying vec3 vWorldNormal;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    void main() {
      vec3 N = normalize(vWorldNormal);

      // Static directional key light (one fixed world direction). Each panel gets a single
      // even tone from its orientation — no view-dependent edge glow, no shifting gradient.
      vec3 L = normalize(vec3(0.4, 0.85, 0.35));
      float NdotL = dot(N, L);

      // Half-Lambert wrap so faces stay readable and never collapse to flat black.
      float wrap = NdotL * 0.5 + 0.5;
      wrap = wrap * wrap;
      float shade = 0.55 + 0.6 * wrap;

      // Hemisphere sky/ground tint (subtle, per-face — keeps roof vs. walls distinct).
      shade *= mix(0.9, 1.06, N.y * 0.5 + 0.5);

      // Screen-fixed paper grain (pencil tooth), faded out of the highlights.
      float g = hash(gl_FragCoord.xy) - 0.5;
      float lum = clamp(shade, 0.0, 1.0);
      shade += g * 0.04 * uGrain * (1.0 - smoothstep(0.05, 0.5, lum));

      gl_FragColor = vec4(baseColor * shade, opacity);
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
        side?: number;
        attach?: string;
        uTime?: number;
        uRim?: number;
        uRimStrength?: number;
        uGrain?: number;
        uJitter?: number;
      };
    }
  }
}

export { SketchMaterialImpl };

export default function SketchMaterial({
  baseColor = "#3a3a3a",
  opacity = 1.0,
  transparent = false,
  side,
  rim = true,
  grain = true,
  jitter = true,
  rimStrength = 0.22,
}: {
  baseColor?: string;
  opacity?: number;
  transparent?: boolean;
  side?: number;
  /** Fresnel silhouette rim. Off for glass, the Door and flat ground. */
  rim?: boolean;
  /** Screen-fixed paper grain. */
  grain?: boolean;
  /** Boiling-line vertex jitter. Off for glass, the Door and flat ground. */
  jitter?: boolean;
  rimStrength?: number;
}) {
  const matRef = useRef<{ uTime: number } | null>(null);

  useEffect(() => {
    const m = matRef.current;
    if (!m) return;
    clocked.add(m);
    return () => {
      clocked.delete(m);
    };
  }, []);

  return (
    <sketchMaterial
      ref={matRef}
      baseColor={new Color(baseColor)}
      opacity={opacity}
      transparent={transparent}
      side={side}
      uRim={rim ? 1 : 0}
      uRimStrength={rimStrength}
      uGrain={grain ? 1 : 0}
      uJitter={jitter ? 1 : 0}
      attach="material"
    />
  );
}
