"use client";

import { shaderMaterial } from "@react-three/drei/core/shaderMaterial";
import { extend } from "@react-three/fiber";
import { Color } from "three";

const SketchMaterialImpl = shaderMaterial(
  {
    baseColor: new Color("#3a3a3a"),
    opacity: 1.0,
  },
  // Vertex shader
  /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vPosition;

    void main() {
      vNormal = normalize(normalMatrix * normal);
      vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  // Fragment shader — 3-band toon shading
  /* glsl */ `
    uniform vec3 baseColor;
    uniform float opacity;

    varying vec3 vNormal;
    varying vec3 vPosition;

    void main() {
      // Light direction (top-right, slightly forward)
      vec3 lightDir = normalize(vec3(0.5, 0.8, 0.3));
      float NdotL = dot(vNormal, lightDir);

      // 3-band toon shading
      float shade;
      if (NdotL > 0.5) {
        shade = 1.2;       // bright band
      } else if (NdotL > -0.1) {
        shade = 0.85;      // mid band
      } else {
        shade = 0.5;       // dark band
      }

      vec3 color = baseColor * shade;
      gl_FragColor = vec4(color, opacity);
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
}: {
  baseColor?: string;
  opacity?: number;
  transparent?: boolean;
  side?: number;
}) {
  return (
    <sketchMaterial
      baseColor={new Color(baseColor)}
      opacity={opacity}
      transparent={transparent}
      side={side}
      attach="material"
    />
  );
}
