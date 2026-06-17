"use client";

import React, {
  forwardRef,
  useState,
  useRef,
  useEffect,
  useCallback,
  useImperativeHandle,
  useMemo,
} from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Mesh, Color, AdditiveBlending, ShaderMaterial } from "three";
import { Edges } from "@react-three/drei";
import SketchMaterial from "@/components/landing/three/SketchMaterial";

const DOOR_COLOR = "#3B7DDD";
const DOOR_PANEL_INSET = "#5B9DFF"; // lighter blue for the recessed panels
const DOOR_GLOW = "#7FB4FF"; // warm-cool halo / emissive accent
const HANDLE_BRASS = "#E8B84B";
const EDGE_COLOR = "#6B4A30"; // warm storybook ink
const OPACITY = 1.0;

type DoorProps = {
  onClick?: () => void;
};

// Uniforms drei's shaderMaterial exposes as direct mutable props on the instance.
type DoorMaterial = {
  baseColor: Color;
  emissive: Color;
  emissiveStrength: number;
  rim: number;
};

// Soft radial additive halo behind/around the door — a child of the door group so it
// swings with the panel. Falls off to nothing at the edges so it reads as a glow, not a quad.
const HALO_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const HALO_FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform float uOpacity;
  void main() {
    float d = distance(vUv, vec2(0.5));
    float a = smoothstep(0.5, 0.0, d) * uOpacity;
    gl_FragColor = vec4(uColor, a);
  }
`;

// The front-wall opening sits at world x∈[-0.5,0.5], y∈[-1,0.75], z=8.
// The door group pivots at its right edge (hinge); the panel is offset so it fills the gap.
// Scene.tsx drives this group's rotation.y to swing it open.
const Door = forwardRef<Group, DoorProps>(({ onClick }, ref) => {
  const groupRef = useRef<Group>(null!);
  const panelRef = useRef<Mesh>(null!);
  const matRef = useRef<DoorMaterial | null>(null);
  const haloRef = useRef<ShaderMaterial | null>(null);

  const [hovered, setHovered] = useState(false);
  const time = useRef(0);
  const hoverAmt = useRef(0); // eased 0→1 hover blend
  const scaleAmt = useRef(1); // eased panel scale
  const reduceMotion = useRef(false);

  // Forward the real group to Scene while keeping an internal ref for our own useFrame.
  useImperativeHandle(ref, () => groupRef.current, []);

  useEffect(() => {
    reduceMotion.current =
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const haloUniforms = useMemo(
    () => ({
      uColor: { value: new Color(DOOR_GLOW) },
      uOpacity: { value: 0 },
    }),
    []
  );

  useFrame((_, delta) => {
    time.current += delta;
    const mat = matRef.current;
    if (!mat) return;

    // Door is mid-swing once Scene rotates the group away from rest.
    const opening = Math.abs(groupRef.current?.rotation.y ?? 0) > 0.05;

    // Ease the hover blend so glow/lift transitions feel soft.
    const hoverTarget = hovered && !opening ? 1 : 0;
    hoverAmt.current += (hoverTarget - hoverAmt.current) * Math.min(delta * 8, 1);

    let emissive: number;
    if (opening) {
      // Fade the glow out so the open-door reveal isn't washed out.
      emissive = mat.emissiveStrength * (1 - Math.min(delta * 6, 1));
    } else {
      // Honor prefers-reduced-motion: drop the oscillation, keep a steady glow.
      const wob = reduceMotion.current ? 0 : 1;
      const idle = 0.2 + Math.sin(time.current * 1.5) * 0.1 * wob; // calm ~4s breath
      const hot = 0.5 + Math.sin(time.current * 5) * 0.15 * wob; // brighter, faster
      emissive = idle + (hot - idle) * hoverAmt.current;
    }
    mat.emissiveStrength = emissive;

    // Halo opacity tracks the breath; door panel lifts slightly on hover.
    if (haloRef.current) {
      haloRef.current.uniforms.uOpacity.value = Math.max(emissive * 0.6, 0);
    }
    const targetScale = opening ? 1 : 1 + hoverAmt.current * 0.03;
    scaleAmt.current += (targetScale - scaleAmt.current) * Math.min(delta * 8, 1);
    panelRef.current?.scale.setScalar(scaleAmt.current);
  });

  const handlePointerOver = useCallback(() => {
    setHovered(true);
    document.body.style.cursor = "pointer";
  }, []);

  const handlePointerOut = useCallback(() => {
    setHovered(false);
    document.body.style.cursor = "auto";
  }, []);

  return (
    <group
      ref={groupRef}
      position={[0.5, -0.125, 8]}
      onClick={onClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      {/* Soft additive glow halo — spills around the door onto the wall */}
      <mesh position={[-0.5, 0, 0.07]} renderOrder={2}>
        <planeGeometry args={[1.5, 2.45]} />
        <shaderMaterial
          ref={haloRef}
          args={[
            {
              uniforms: haloUniforms,
              vertexShader: HALO_VERT,
              fragmentShader: HALO_FRAG,
              transparent: true,
              depthWrite: false,
              blending: AdditiveBlending,
            },
          ]}
        />
      </mesh>

      {/* Door panel — offset so the hinge sits at the group origin */}
      <mesh
        ref={panelRef}
        position={[-0.5, 0, 0]}
      >
        <boxGeometry args={[1, 1.75, 0.05]} />
        <sketchMaterial
          ref={matRef}
          baseColor={new Color(DOOR_COLOR)}
          emissive={new Color(DOOR_GLOW)}
          emissiveStrength={0.18}
          rim={1}
          opacity={OPACITY}
          attach="material"
        />
        <Edges threshold={15} color={EDGE_COLOR} />

        {/* Two recessed panels for a friendly paneled-door look (children → scale with panel) */}
        <mesh position={[0, 0.38, 0.027]}>
          <boxGeometry args={[0.56, 0.62, 0.02]} />
          <SketchMaterial baseColor={DOOR_PANEL_INSET} />
        </mesh>
        <mesh position={[0, -0.42, 0.027]}>
          <boxGeometry args={[0.56, 0.6, 0.02]} />
          <SketchMaterial baseColor={DOOR_PANEL_INSET} />
        </mesh>
      </mesh>

      {/* Brass handle — a single warm dot marking where to click */}
      <mesh position={[-0.15, -0.05, 0.06]}>
        <boxGeometry args={[0.07, 0.12, 0.05]} />
        <SketchMaterial
          baseColor={HANDLE_BRASS}
          emissive={HANDLE_BRASS}
          emissiveStrength={0.25}
        />
      </mesh>
    </group>
  );
});

Door.displayName = "Door";

export default Door;
