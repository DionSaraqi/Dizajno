"use client";

/**
 * Scene lighting for the landing-page cottage. The house body uses the self-lit
 * SketchMaterial (which computes its own warm/cool toon ramp), so these lights are
 * intentionally soft — they set mood and light any standard/unlit accents. Warm key
 * + cool indigo fill mirror the in-shader 2-temperature split for a unified look.
 */
export default function Lights() {
  return (
    <>
      <ambientLight intensity={0.55} color="#FFF6E8" />
      {/* Warm key sun (upper-right-front) */}
      <directionalLight position={[6, 8, 4]} intensity={0.6} color="#FFF1DD" />
      {/* Cool brand-indigo fill (left) */}
      <directionalLight position={[-4, 5, 2]} intensity={0.25} color="#8E92E0" />
    </>
  );
}
