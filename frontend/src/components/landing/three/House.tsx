"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  DoubleSide,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
} from "three";
import { Edges } from "@react-three/drei";
import SketchMaterial from "@/components/landing/three/SketchMaterial";

/* ── "Blueprint coming to life" — warm storybook cottage palette ── */
const EDGE_COLOR = "#6B4A30"; // warm hand-inked outline (replaces cold grey wireframe)
const EDGE_THRESHOLD = 15;
const EDGE_SOFT = 30; // organic foliage — fewer line segments, softer read

const WALL_MAIN = "#F2E2C4"; // warm cream
const WALL_SHADOW = "#D9B98C"; // deeper wall / foundation
const ROOF_MAIN = "#C9603F"; // terracotta
const ROOF_SHADOW = "#9E4329";
const TRIM = "#FBF4E6"; // cream trim — ridge, frames, posts
const FLOOR_COLOR = "#BFA888"; // warm wood-ish interior floor
const CEILING_COLOR = "#8E8270";
const WINDOW_GLOW = "#FFD27A"; // lamp-amber interior light
const CHIMNEY = "#B5543B";
const FOLIAGE = "#5BA047";
const FOLIAGE_TOP = "#6FB863";
const TREE_TRUNK = "#6B4A2E";
const BLOSSOM_CORAL = "#E8836B";
const BLOSSOM_BUTTER = "#FFD27A";
const GRASS = "#8CBF63";
const PATH = "#E8D6B0";
const FENCE = "#F3EDE0";
const FENCE_GATE = "#EFE3CC";
const SMOKE = "#EFE9DD";
const CONTACT = "#2E5A26"; // dark green fake-AO disc (unlit)

export default function House() {
  const wallHeight = 2;
  const roofPeakHeight = 1.5; // steeper, cuter storybook gable

  return (
    <group position={[0, 0, 5]}>
      {/* Foundation plinth so the cottage sits ON the ground, not floating */}
      <mesh position={[0, -0.92, 0]}>
        <boxGeometry args={[6.2, 0.2, 6.2]} />
        <SketchMaterial baseColor={WALL_SHADOW} />
        <Edges threshold={EDGE_THRESHOLD} color={EDGE_COLOR} />
      </mesh>

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
        <planeGeometry args={[6, 6]} />
        <SketchMaterial baseColor={FLOOR_COLOR} />
      </mesh>

      {/* Flat ceiling (blocks the top-down view into the house) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 1, 0]}>
        <planeGeometry args={[6, 6]} />
        <SketchMaterial baseColor={CEILING_COLOR} side={DoubleSide} />
      </mesh>

      {/* ── Walls ── */}

      {/* Left wall */}
      <group>
        <mesh rotation={[0, -Math.PI / 2, 0]} position={[-3, 0, 0]}>
          <planeGeometry args={[6, wallHeight]} />
          <SketchMaterial baseColor={WALL_MAIN} side={DoubleSide} />
          <Edges threshold={EDGE_THRESHOLD} color={EDGE_COLOR} />
        </mesh>
      </group>

      {/* Right wall */}
      <group>
        <mesh rotation={[0, Math.PI / 2, 0]} position={[3, 0, 0]}>
          <planeGeometry args={[6, wallHeight]} />
          <SketchMaterial baseColor={WALL_MAIN} side={DoubleSide} />
          <Edges threshold={EDGE_THRESHOLD} color={EDGE_COLOR} />
        </mesh>
      </group>

      {/* Front wall with door hole — 3 pieces */}
      <group position={[0, 0, 3]}>
        <mesh rotation={[0, -Math.PI, 0]} position={[-1.75, 0, 0]}>
          <planeGeometry args={[2.5, wallHeight]} />
          <SketchMaterial baseColor={WALL_MAIN} side={DoubleSide} />
        </mesh>
        <mesh rotation={[0, -Math.PI, 0]} position={[1.75, 0, 0]}>
          <planeGeometry args={[2.5, wallHeight]} />
          <SketchMaterial baseColor={WALL_MAIN} side={DoubleSide} />
        </mesh>
        <mesh rotation={[0, -Math.PI, 0]} position={[0, 0.875, 0]}>
          <planeGeometry args={[1, 0.25]} />
          <SketchMaterial baseColor={WALL_MAIN} side={DoubleSide} />
        </mesh>
      </group>

      {/* Back wall */}
      <mesh rotation={[0, Math.PI, 0]} position={[0, 0, -3]}>
        <planeGeometry args={[6, wallHeight]} />
        <SketchMaterial baseColor={WALL_SHADOW} side={DoubleSide} />
        <Edges threshold={EDGE_THRESHOLD} color={EDGE_COLOR} />
      </mesh>

      {/* Warm interior glow — revealed through the doorway as the door swings open */}
      <mesh position={[0, -0.1, 2.0]}>
        <planeGeometry args={[1.3, 1.6]} />
        <SketchMaterial
          baseColor={WINDOW_GLOW}
          emissive={WINDOW_GLOW}
          emissiveStrength={0.9}
          side={DoubleSide}
        />
      </mesh>

      {/* ── Windows (warm-lit, arched) ── */}
      <RectWindow position={[-1.4, 0, 3.03]} rotationY={0} width={1.0} height={0.8} />
      <RectWindow position={[1.4, 0, 3.03]} rotationY={0} width={1.0} height={0.8} />
      <RoundWindow position={[0, 1.55, 3.03]} rotationY={0} />
      <RectWindow position={[-3.03, 0, 1]} rotationY={Math.PI / 2} />
      <RectWindow position={[-3.03, 0, -1]} rotationY={Math.PI / 2} />
      <RectWindow position={[3.03, 0, 1]} rotationY={-Math.PI / 2} />
      <RectWindow position={[3.03, 0, -1]} rotationY={-Math.PI / 2} />

      {/* Porch awning framing the blue door as the obvious entrance */}
      <PorchAwning />

      {/* Brick chimney with drifting toon smoke */}
      <Chimney />

      {/* Yard: lawn, picket fence, stepping-stone path, plants, trees, soft shadows */}
      <Yard />

      {/* ── Gable wall fills ── */}
      {/* normalZ chosen so each gable's camera-facing triangle shades WARM/lit, not shadow */}
      <GableWallTriangle
        width={6}
        height={roofPeakHeight}
        position={[0, 1, 3]}
        color={WALL_MAIN}
        normalZ={1}
      />
      <GableWallTriangle
        width={6}
        height={roofPeakHeight}
        position={[0, 1, -3]}
        color={WALL_SHADOW}
        normalZ={-1}
      />

      {/* ── Pitched roof ── */}
      <GabledRoof width={6.6} depth={6.6} peakHeight={roofPeakHeight} baseY={1} />
    </group>
  );
}

/* ── Rectangular warm window with a rounded arch cap ── */
function RectWindow({
  position,
  rotationY = 0,
  width = 0.7,
  height = 0.55,
}: {
  position: [number, number, number];
  rotationY?: number;
  width?: number;
  height?: number;
}) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Glowing pane */}
      <mesh>
        <planeGeometry args={[width, height]} />
        <SketchMaterial
          baseColor={WINDOW_GLOW}
          emissive={WINDOW_GLOW}
          emissiveStrength={0.8}
          side={DoubleSide}
        />
        <Edges threshold={1} color={EDGE_COLOR} />
      </mesh>
      {/* Muntins */}
      <mesh position={[0, 0, 0.01]}>
        <planeGeometry args={[width, 0.04]} />
        <SketchMaterial baseColor={TRIM} side={DoubleSide} />
      </mesh>
      <mesh position={[0, 0, 0.01]}>
        <planeGeometry args={[0.04, height]} />
        <SketchMaterial baseColor={TRIM} side={DoubleSide} />
      </mesh>
      {/* Rounded arch cap (flat half-disc) */}
      <mesh position={[0, height / 2, 0]}>
        <circleGeometry args={[width * 0.52, 14, 0, Math.PI]} />
        <SketchMaterial baseColor={TRIM} side={DoubleSide} />
      </mesh>
    </group>
  );
}

/* ── Round gable window — warm glass with cross beams ── */
function RoundWindow({
  position,
  rotationY = 0,
}: {
  position: [number, number, number];
  rotationY?: number;
}) {
  const radius = 0.28;

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh>
        <circleGeometry args={[radius, 24]} />
        <SketchMaterial
          baseColor={WINDOW_GLOW}
          emissive={WINDOW_GLOW}
          emissiveStrength={0.8}
          side={DoubleSide}
        />
        <Edges threshold={1} color={EDGE_COLOR} />
      </mesh>
      <mesh position={[0, 0, 0.005]}>
        <planeGeometry args={[radius * 2, 0.03]} />
        <SketchMaterial baseColor={TRIM} side={DoubleSide} />
      </mesh>
      <mesh position={[0, 0, 0.005]}>
        <planeGeometry args={[0.03, radius * 2]} />
        <SketchMaterial baseColor={TRIM} side={DoubleSide} />
      </mesh>
    </group>
  );
}

/* ── Mono-pitch porch roof + posts over the front door ── */
function PorchAwning() {
  return (
    <group position={[0, 0, 3]}>
      {/* Slanted awning roof */}
      <mesh position={[0, 0.98, 0.45]} rotation={[-0.38, 0, 0]}>
        <boxGeometry args={[1.7, 0.06, 0.8]} />
        <SketchMaterial baseColor={ROOF_MAIN} />
        <Edges threshold={EDGE_THRESHOLD} color={EDGE_COLOR} />
      </mesh>
      {/* Posts */}
      <mesh position={[-0.68, -0.05, 0.62]}>
        <cylinderGeometry args={[0.05, 0.05, 1.85, 8]} />
        <SketchMaterial baseColor={TRIM} />
      </mesh>
      <mesh position={[0.68, -0.05, 0.62]}>
        <cylinderGeometry args={[0.05, 0.05, 1.85, 8]} />
        <SketchMaterial baseColor={TRIM} />
      </mesh>
    </group>
  );
}

/* ── Brick chimney with low-poly drifting smoke ── */
function Chimney() {
  return (
    <group>
      <mesh position={[1.1, 1.85, -0.7]}>
        <boxGeometry args={[0.42, 0.95, 0.42]} />
        <SketchMaterial baseColor={CHIMNEY} aoRange={4.0} />
        <Edges threshold={EDGE_THRESHOLD} color={EDGE_COLOR} />
      </mesh>
      <mesh position={[1.1, 2.36, -0.7]}>
        <boxGeometry args={[0.54, 0.12, 0.54]} />
        <SketchMaterial baseColor={TRIM} aoRange={4.0} />
        <Edges threshold={EDGE_THRESHOLD} color={EDGE_COLOR} />
      </mesh>
      <SmokePuffs />
    </group>
  );
}

function SmokePuffs() {
  const ref = useRef<Group>(null!);
  const t = useRef(0);
  const reduceMotion = useRef(false);
  // resting heights (group-local); gentle, allocation-free drift
  const baseY = [0, 0.26, 0.48];

  useEffect(() => {
    reduceMotion.current =
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useFrame((_, delta) => {
    if (reduceMotion.current) return; // honor prefers-reduced-motion
    t.current += delta;
    const g = ref.current;
    if (!g) return;
    const n = Math.min(g.children.length, baseY.length);
    for (let i = 0; i < n; i++) {
      g.children[i].position.y = baseY[i] + Math.sin(t.current * 0.8 + i) * 0.03;
    }
  });

  return (
    <group ref={ref} position={[1.1, 2.6, -0.7]}>
      <mesh position={[0, baseY[0], 0]}>
        <sphereGeometry args={[0.18, 8, 6]} />
        <SketchMaterial baseColor={SMOKE} opacity={0.55} transparent depthWrite={false} aoRange={5} />
      </mesh>
      <mesh position={[0.08, baseY[1], 0.04]}>
        <sphereGeometry args={[0.14, 8, 6]} />
        <SketchMaterial baseColor={SMOKE} opacity={0.45} transparent depthWrite={false} aoRange={5} />
      </mesh>
      <mesh position={[-0.04, baseY[2], -0.04]}>
        <sphereGeometry args={[0.1, 7, 5]} />
        <SketchMaterial baseColor={SMOKE} opacity={0.35} transparent depthWrite={false} aoRange={5} />
      </mesh>
    </group>
  );
}

/* ── Gable wall triangle ── */
function GableWallTriangle({
  width,
  height,
  position,
  color,
  normalZ,
}: {
  width: number;
  height: number;
  position: [number, number, number];
  color: string;
  normalZ: number;
}) {
  const hw = width / 2;

  const geometry = useMemo(() => {
    const geo = new BufferGeometry();
    const verts = new Float32Array([
      -hw, 0, 0, hw, 0, 0, 0, height, 0,
      hw, 0, 0, -hw, 0, 0, 0, height, 0,
    ]);
    const normals = new Float32Array([
      0, 0, normalZ, 0, 0, normalZ, 0, 0, normalZ,
      0, 0, -normalZ, 0, 0, -normalZ, 0, 0, -normalZ,
    ]);
    geo.setAttribute("position", new Float32BufferAttribute(verts, 3));
    geo.setAttribute("normal", new Float32BufferAttribute(normals, 3));
    return geo;
  }, [hw, height, normalZ]);

  return (
    <mesh position={position} geometry={geometry}>
      <SketchMaterial baseColor={color} />
    </mesh>
  );
}

/* ── Yard: lawn, fence, stepping-stone path, plants, trees, contact shadows ── */
function Yard() {
  const postSpacing = 0.5;
  const fenceY = -0.65;
  const railHigh = -0.5;
  const railLow = -0.9;

  const fLeft = -4.5;
  const fRight = 4.5;
  const fFront = 4.5;
  const fBack = -4.5;
  const gateHalf = 0.6;

  const posts: [number, number, number][] = [];
  for (let x = fLeft; x <= -gateHalf; x += postSpacing) posts.push([x, fenceY, fFront]);
  for (let x = gateHalf; x <= fRight; x += postSpacing) posts.push([x, fenceY, fFront]);
  for (let x = fLeft; x <= fRight; x += postSpacing) posts.push([x, fenceY, fBack]);
  for (let z = fBack; z <= fFront; z += postSpacing) posts.push([fLeft, fenceY, z]);
  for (let z = fBack; z <= fFront; z += postSpacing) posts.push([fRight, fenceY, z]);

  const fWidth = fRight - fLeft;
  const fDepth = fFront - fBack;
  const frontLeftLen = -gateHalf - fLeft;
  const frontRightLen = fRight - gateHalf;

  // Stepping stones from the porch (z≈3) out to the gate (z≈4.4)
  const stones = useMemo(() => {
    const out: [number, number][] = [];
    for (let i = 0; i < 5; i++) {
      const z = 3.05 + i * 0.34;
      const jitter = Math.sin(i * 12.9) * 0.06;
      out.push([jitter, z]);
    }
    return out;
  }, []);

  // Green grass strays poking up
  const grassPositions = useMemo(() => {
    const out: [number, number, number, number][] = [];
    for (let gx = fLeft + 0.4; gx < fRight; gx += 0.8) {
      for (let gz = fBack + 0.4; gz < fFront; gz += 0.8) {
        if (Math.abs(gx) < 3.2 && Math.abs(gz) < 3.2) continue;
        if (Math.abs(gx) < 0.6 && gz > 2.8) continue;
        const h = 0.1 + (Math.sin(gx * 13.7 + gz * 7.3) * 0.5 + 0.5) * 0.14;
        const rot = Math.sin(gx * 5.1 + gz * 11.9) * 0.4;
        out.push([gx, gz, h, rot]);
      }
    }
    return out;
  }, [fLeft, fRight, fBack, fFront]);

  return (
    <group>
      {/* Lawn — opaque green; the page's blueprint grid shows beyond the fence */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.004, 0]}>
        <planeGeometry args={[fWidth, fDepth]} />
        <SketchMaterial baseColor={GRASS} side={DoubleSide} />
      </mesh>

      {/* Soft contact shadow grounding the house (unlit, no shadow maps) */}
      <ContactShadow position={[0, -0.992, 0]} radius={2.9} />

      {/* Grass strays */}
      {grassPositions.map(([gx, gz, h, rot], i) => (
        <mesh key={`grass-${i}`} position={[gx, -1 + h / 2, gz]} rotation={[0, rot, 0.15 * Math.sin(i)]}>
          <planeGeometry args={[0.015, h]} />
          <SketchMaterial baseColor={FOLIAGE} side={DoubleSide} />
        </mesh>
      ))}

      {/* Fence posts */}
      {posts.map((pos, i) => (
        <mesh key={`post-${i}`} position={pos}>
          <boxGeometry args={[0.04, 0.7, 0.04]} />
          <SketchMaterial baseColor={FENCE} />
          <Edges threshold={EDGE_THRESHOLD} color={EDGE_COLOR} />
        </mesh>
      ))}

      {/* Rails */}
      <FenceRail x={fLeft + frontLeftLen / 2} z={fFront} y={railHigh} length={frontLeftLen} axis="x" />
      <FenceRail x={fLeft + frontLeftLen / 2} z={fFront} y={railLow} length={frontLeftLen} axis="x" />
      <FenceRail x={gateHalf + frontRightLen / 2} z={fFront} y={railHigh} length={frontRightLen} axis="x" />
      <FenceRail x={gateHalf + frontRightLen / 2} z={fFront} y={railLow} length={frontRightLen} axis="x" />
      <FenceRail x={0} z={fBack} y={railHigh} length={fWidth} axis="x" />
      <FenceRail x={0} z={fBack} y={railLow} length={fWidth} axis="x" />
      <FenceRail x={fLeft} z={0} y={railHigh} length={fDepth} axis="z" />
      <FenceRail x={fLeft} z={0} y={railLow} length={fDepth} axis="z" />
      <FenceRail x={fRight} z={0} y={railHigh} length={fDepth} axis="z" />
      <FenceRail x={fRight} z={0} y={railLow} length={fDepth} axis="z" />

      {/* Gate posts (taller) */}
      <mesh position={[-gateHalf, -0.55, fFront]}>
        <boxGeometry args={[0.07, 0.9, 0.07]} />
        <SketchMaterial baseColor={FENCE_GATE} />
        <Edges threshold={EDGE_THRESHOLD} color={EDGE_COLOR} />
      </mesh>
      <mesh position={[gateHalf, -0.55, fFront]}>
        <boxGeometry args={[0.07, 0.9, 0.07]} />
        <SketchMaterial baseColor={FENCE_GATE} />
        <Edges threshold={EDGE_THRESHOLD} color={EDGE_COLOR} />
      </mesh>

      {/* Cozy stepping-stone path */}
      {stones.map(([sx, sz], i) => (
        <mesh key={`stone-${i}`} position={[sx, -0.985, sz]} rotation={[0, 0.3 * i, 0]}>
          <cylinderGeometry args={[0.28, 0.28, 0.04, 8]} />
          <SketchMaterial baseColor={PATH} />
        </mesh>
      ))}

      {/* Lollipop trees flanking the entrance (clear of the centered door) */}
      <Tree position={[-3.5, -1, 3.0]} />
      <Tree position={[3.5, -1, 3.0]} />

      {/* Bushes — front pair carries blossoms */}
      <Bush position={[-2.2, -0.7, 3.6]} scale={0.35} flowers />
      <Bush position={[2.2, -0.75, 3.6]} scale={0.3} flowers />
      <Bush position={[-3.6, -0.72, 1.5]} scale={0.33} />
      <Bush position={[3.6, -0.68, 1.5]} scale={0.38} />
      <Bush position={[-3.6, -0.74, -1.5]} scale={0.3} />
      <Bush position={[3.6, -0.72, -1.5]} scale={0.32} />
      <Bush position={[-2, -0.76, -3.6]} scale={0.28} />
      <Bush position={[2, -0.7, -3.6]} scale={0.34} />
    </group>
  );
}

function FenceRail({
  x,
  z,
  y,
  length,
  axis,
}: {
  x: number;
  z: number;
  y: number;
  length: number;
  axis: "x" | "z";
}) {
  const size: [number, number, number] =
    axis === "x" ? [length, 0.03, 0.03] : [0.03, 0.03, length];

  return (
    <mesh position={[x, y, z]}>
      <boxGeometry args={size} />
      <SketchMaterial baseColor={FENCE} />
    </mesh>
  );
}

/* ── Soft fake-AO disc (unlit, transparent) ── */
function ContactShadow({
  position,
  radius,
}: {
  position: [number, number, number];
  radius: number;
}) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={position}>
      <circleGeometry args={[radius, 16]} />
      <meshBasicMaterial color={CONTACT} transparent opacity={0.16} depthWrite={false} />
    </mesh>
  );
}

/* ── Lollipop tree ── */
function Tree({ position }: { position: [number, number, number] }) {
  return (
    <group position={position} scale={[1, 1.15, 1]}>
      <ContactShadow position={[0, 0.01, 0]} radius={0.55} />
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.06, 0.1, 0.7, 8]} />
        <SketchMaterial baseColor={TREE_TRUNK} aoRange={2} />
        <Edges threshold={EDGE_THRESHOLD} color={EDGE_COLOR} />
      </mesh>
      <mesh position={[0, 0.95, 0]}>
        <sphereGeometry args={[0.45, 7, 5]} />
        <SketchMaterial baseColor={FOLIAGE} aoRange={2} />
        <Edges threshold={EDGE_SOFT} color={EDGE_COLOR} />
      </mesh>
      <mesh position={[0.12, 1.28, 0.06]}>
        <sphereGeometry args={[0.32, 7, 5]} />
        <SketchMaterial baseColor={FOLIAGE_TOP} aoRange={2} />
        <Edges threshold={EDGE_SOFT} color={EDGE_COLOR} />
      </mesh>
    </group>
  );
}

/* ── Low-poly bush, optionally flowering ── */
function Bush({
  position,
  scale = 0.3,
  flowers = false,
}: {
  position: [number, number, number];
  scale?: number;
  flowers?: boolean;
}) {
  return (
    <group position={position} scale={scale}>
      <mesh>
        <sphereGeometry args={[1, 6, 4]} />
        <SketchMaterial baseColor={FOLIAGE} aoRange={2} />
        <Edges threshold={EDGE_SOFT} color={EDGE_COLOR} />
      </mesh>
      <mesh position={[0.3, 0.5, 0.1]} scale={0.6}>
        <sphereGeometry args={[1, 5, 3]} />
        <SketchMaterial baseColor={FOLIAGE_TOP} aoRange={2} />
        <Edges threshold={EDGE_SOFT} color={EDGE_COLOR} />
      </mesh>
      {flowers && (
        <>
          <Blossom position={[0.2, 0.85, 0.4]} color={BLOSSOM_CORAL} />
          <Blossom position={[-0.45, 0.55, 0.2]} color={BLOSSOM_BUTTER} />
          <Blossom position={[0.55, 0.3, -0.3]} color={BLOSSOM_CORAL} />
        </>
      )}
    </group>
  );
}

function Blossom({
  position,
  color,
}: {
  position: [number, number, number];
  color: string;
}) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[0.16, 5, 4]} />
      <SketchMaterial baseColor={color} emissive={color} emissiveStrength={0.2} aoRange={2} />
    </mesh>
  );
}

/* ── Gabled roof ── */
function GabledRoof({
  width,
  depth,
  peakHeight,
  baseY,
}: {
  width: number;
  depth: number;
  peakHeight: number;
  baseY: number;
}) {
  const halfWidth = width / 2;
  const slopeLength = Math.sqrt(halfWidth * halfWidth + peakHeight * peakHeight);
  const angle = Math.atan2(peakHeight, halfWidth);

  return (
    <group position={[0, baseY, 0]}>
      <mesh position={[-halfWidth / 2, peakHeight / 2, 0]} rotation={[0, 0, angle]}>
        <boxGeometry args={[slopeLength, 0.1, depth]} />
        <SketchMaterial baseColor={ROOF_MAIN} aoRange={4.5} />
        <Edges threshold={EDGE_THRESHOLD} color={EDGE_COLOR} />
      </mesh>
      <mesh position={[halfWidth / 2, peakHeight / 2, 0]} rotation={[0, 0, -angle]}>
        <boxGeometry args={[slopeLength, 0.1, depth]} />
        <SketchMaterial baseColor={ROOF_SHADOW} aoRange={4.5} />
        <Edges threshold={EDGE_THRESHOLD} color={EDGE_COLOR} />
      </mesh>
      <mesh position={[0, peakHeight, 0]}>
        <boxGeometry args={[0.08, 0.08, depth + 0.2]} />
        <SketchMaterial baseColor={TRIM} aoRange={4.5} />
        <Edges threshold={EDGE_THRESHOLD} color={EDGE_COLOR} />
      </mesh>
    </group>
  );
}
