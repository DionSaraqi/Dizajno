"use client";

import React, { useMemo } from "react";
import { DoubleSide, BufferGeometry, Float32BufferAttribute } from "three";
import { Edges } from "@react-three/drei";
import SketchMaterial from "@/components/three/landing/SketchMaterial";

const EDGE_COLOR = "#d0d0d0";
const EDGE_THRESHOLD = 15;
const OPACITY = 0.95;

const WALL_FRONT = "#b8b8be";
const WALL_SIDE_LIT = "#a8a8b0";
const WALL_SIDE_SHADOW = "#909098";
const WALL_BACK = "#808088";
const FLOOR_COLOR = "#1a1a28";
const CEILING_COLOR = "#707078";
const ROOF_COLOR = "#9a9aa2";
const ROOF_SHADOW = "#88888f";
const WINDOW_GLASS = "#0a0a18";
const WINDOW_FRAME = "#606068";

export default function Room() {
  const wallHeight = 2;
  const roofPeakHeight = 1.2;

  return (
    <group position={[0, 0, 5]}>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
        <planeGeometry args={[6, 6]} />
        <SketchMaterial baseColor={FLOOR_COLOR} opacity={OPACITY} transparent />
        <Edges threshold={EDGE_THRESHOLD} color={EDGE_COLOR} />
      </mesh>

      {/* ── Flat ceiling (blocks view from top) ── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 1, 0]}>
        <planeGeometry args={[6, 6]} />
        <SketchMaterial baseColor={CEILING_COLOR} opacity={OPACITY} transparent />
      </mesh>

      {/* ── Walls ── */}

      {/* Left wall */}
      <mesh rotation={[0, Math.PI / 2, 0]} position={[-3, 0, 0]}>
        <planeGeometry args={[6, wallHeight]} />
        <SketchMaterial baseColor={WALL_SIDE_SHADOW} opacity={OPACITY} transparent />
        <Edges threshold={EDGE_THRESHOLD} color={EDGE_COLOR} />
      </mesh>

      {/* Right wall (outside + inside faces) */}
      <group>
        <mesh rotation={[0, Math.PI / 2, 0]} position={[3, 0, 0]}>
          <planeGeometry args={[6, wallHeight]} />
          <SketchMaterial baseColor={WALL_SIDE_LIT} opacity={OPACITY} transparent />
          <Edges threshold={EDGE_THRESHOLD} color={EDGE_COLOR} />
        </mesh>
        <mesh rotation={[0, -Math.PI / 2, 0]} position={[3, 0, 0]}>
          <planeGeometry args={[6, wallHeight]} />
          <SketchMaterial baseColor={WALL_SIDE_SHADOW} opacity={OPACITY} transparent />
        </mesh>
      </group>

      {/* Front wall with door hole — 3 pieces, NO edges */}
      <group position={[0, 0, 3]}>
        <mesh rotation={[0, -Math.PI, 0]} position={[-1.75, 0, 0]}>
          <planeGeometry args={[2.5, wallHeight]} />
          <SketchMaterial baseColor={WALL_FRONT} side={DoubleSide} opacity={OPACITY} transparent />
        </mesh>
        <mesh rotation={[0, -Math.PI, 0]} position={[1.75, 0, 0]}>
          <planeGeometry args={[2.5, wallHeight]} />
          <SketchMaterial baseColor={WALL_FRONT} side={DoubleSide} opacity={OPACITY} transparent />
        </mesh>
        <mesh rotation={[0, -Math.PI, 0]} position={[0, 0.875, 0]}>
          <planeGeometry args={[1, 0.25]} />
          <SketchMaterial baseColor={WALL_FRONT} side={DoubleSide} opacity={OPACITY} transparent />
        </mesh>
      </group>

      {/* Back wall */}
      <mesh rotation={[0, Math.PI, 0]} position={[0, 0, -3]}>
        <planeGeometry args={[6, wallHeight]} />
        <SketchMaterial baseColor={WALL_BACK} side={DoubleSide} opacity={OPACITY} transparent />
        <Edges threshold={EDGE_THRESHOLD} color={EDGE_COLOR} />
      </mesh>

      {/* ── Windows ── */}

      {/* Front wall — left of door (bigger, closer to door) */}
      <RectWindow position={[-1.4, 0, 3.03]} rotationY={0} width={1.0} height={0.8} />
      {/* Front wall — right of door */}
      <RectWindow position={[1.4, 0, 3.03]} rotationY={0} width={1.0} height={0.8} />

      {/* Round window above door (in the gable) */}
      <RoundWindow position={[0, 1.5, 3.03]} rotationY={0} />

      {/* Left wall — two windows */}
      <RectWindow position={[-3.03, 0, 1]} rotationY={Math.PI / 2} />
      <RectWindow position={[-3.03, 0, -1]} rotationY={Math.PI / 2} />

      {/* Right wall — two windows */}
      <RectWindow position={[3.03, 0, 1]} rotationY={-Math.PI / 2} />
      <RectWindow position={[3.03, 0, -1]} rotationY={-Math.PI / 2} />

      {/* ── Porch / yard ── */}
      <Porch />

      {/* ── Gable wall fills ── */}

      <GableWallTriangle
        width={6}
        height={roofPeakHeight}
        position={[0, 1, 3]}
        color={WALL_FRONT}
        normalZ={-1}
      />
      <GableWallTriangle
        width={6}
        height={roofPeakHeight}
        position={[0, 1, -3]}
        color={WALL_BACK}
        normalZ={1}
      />

      {/* ── Pitched Roof ── */}
      <GabledRoof
        width={6.4}
        depth={6.4}
        peakHeight={roofPeakHeight}
        baseY={1}
      />
    </group>
  );
}

/* ── Rectangular window — single horizontal divider ── */
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
      {/* Glass pane — fully see-through, just the outline */}
      <mesh renderOrder={1}>
        <planeGeometry args={[width, height]} />
        <SketchMaterial baseColor={WINDOW_GLASS} opacity={0.15} transparent side={DoubleSide} />
        <Edges threshold={1} color={EDGE_COLOR} />
      </mesh>
    </group>
  );
}

/* ── Round window with cross beams ── */
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
      {/* Round glass — fully see-through */}
      <mesh renderOrder={1}>
        <circleGeometry args={[radius, 24]} />
        <SketchMaterial baseColor={WINDOW_GLASS} opacity={0.15} transparent side={DoubleSide} />
        <Edges threshold={1} color={EDGE_COLOR} />
      </mesh>
      {/* Cross beams */}
      <mesh position={[0, 0, 0.005]} renderOrder={2}>
        <planeGeometry args={[radius * 2, 0.03]} />
        <SketchMaterial baseColor={WINDOW_FRAME} opacity={OPACITY} transparent side={DoubleSide} />
      </mesh>
      <mesh position={[0, 0, 0.005]} renderOrder={2}>
        <planeGeometry args={[0.03, radius * 2]} />
        <SketchMaterial baseColor={WINDOW_FRAME} opacity={OPACITY} transparent side={DoubleSide} />
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
      -hw, 0, 0,  hw, 0, 0,  0, height, 0,
       hw, 0, 0, -hw, 0, 0,  0, height, 0,
    ]);
    const normals = new Float32Array([
      0, 0, normalZ,  0, 0, normalZ,  0, 0, normalZ,
      0, 0, -normalZ, 0, 0, -normalZ, 0, 0, -normalZ,
    ]);
    geo.setAttribute("position", new Float32BufferAttribute(verts, 3));
    geo.setAttribute("normal", new Float32BufferAttribute(normals, 3));
    return geo;
  }, [hw, height, normalZ]);

  return (
    <mesh position={position} geometry={geometry}>
      <SketchMaterial baseColor={color} opacity={OPACITY} transparent />
    </mesh>
  );
}

/* ── Porch / yard around the house ── */
function Porch() {
  const PENCIL = WALL_FRONT;       // same bright pencil-white as walls
  const PENCIL_DIM = WALL_SIDE_LIT; // slightly dimmer variant

  const postSpacing = 0.5;
  const fenceY = -0.65; // center of 0.7-tall posts, bottom flush with ground at y=-1
  const railHigh = -0.5;
  const railLow = -0.9; // bottom rail near ground level

  // Fence boundaries (room local space)
  const fLeft = -4.5;
  const fRight = 4.5;
  const fFront = 4.5;
  const fBack = -4.5;

  // Gate opening half-width
  const gateHalf = 0.6;

  // Generate fence posts
  const posts: [number, number, number][] = [];

  // Front fence (z=fFront) — split for gate
  for (let x = fLeft; x <= -gateHalf; x += postSpacing) {
    posts.push([x, fenceY, fFront]);
  }
  for (let x = gateHalf; x <= fRight; x += postSpacing) {
    posts.push([x, fenceY, fFront]);
  }
  // Back fence
  for (let x = fLeft; x <= fRight; x += postSpacing) {
    posts.push([x, fenceY, fBack]);
  }
  // Left fence
  for (let z = fBack; z <= fFront; z += postSpacing) {
    posts.push([fLeft, fenceY, z]);
  }
  // Right fence
  for (let z = fBack; z <= fFront; z += postSpacing) {
    posts.push([fRight, fenceY, z]);
  }

  const fWidth = fRight - fLeft;
  const fDepth = fFront - fBack;
  const frontLeftLen = -gateHalf - fLeft;
  const frontRightLen = fRight - gateHalf;

  // Grid stripe spacing
  const gridSpacing = 0.8;

  // Generate grid stripes (lines on the ground)
  const xStripes: number[] = [];
  for (let x = fLeft; x <= fRight; x += gridSpacing) xStripes.push(x);
  const zStripes: number[] = [];
  for (let z = fBack; z <= fFront; z += gridSpacing) zStripes.push(z);

  // Generate grass strays — small random-ish lines poking up
  const grassPositions: [number, number, number, number][] = []; // x, z, height, rotation
  for (let gx = fLeft + 0.3; gx < fRight; gx += 0.7) {
    for (let gz = fBack + 0.3; gz < fFront; gz += 0.7) {
      // Skip area under the house and walkway
      if (Math.abs(gx) < 3.2 && Math.abs(gz) < 3.2) continue;
      if (Math.abs(gx) < 0.6 && gz > 2.8) continue;
      const h = 0.08 + (Math.sin(gx * 13.7 + gz * 7.3) * 0.5 + 0.5) * 0.12;
      const rot = Math.sin(gx * 5.1 + gz * 11.9) * 0.4;
      grassPositions.push([gx, gz, h, rot]);
    }
  }

  return (
    <group>
      {/* Yard ground — same size as fence, transparent white */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.005, 0]}>
        <planeGeometry args={[fWidth, fDepth]} />
        <SketchMaterial baseColor={PENCIL} opacity={0.12} transparent side={DoubleSide} />
      </mesh>

      {/* Grid stripes on the ground — X direction */}
      {xStripes.map((x, i) => (
        <mesh key={`gx-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, -1.003, 0]}>
          <planeGeometry args={[0.01, fDepth]} />
          <SketchMaterial baseColor={PENCIL} opacity={0.2} transparent side={DoubleSide} />
        </mesh>
      ))}
      {/* Grid stripes on the ground — Z direction */}
      {zStripes.map((z, i) => (
        <mesh key={`gz-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.003, z]}>
          <planeGeometry args={[fWidth, 0.01]} />
          <SketchMaterial baseColor={PENCIL} opacity={0.2} transparent side={DoubleSide} />
        </mesh>
      ))}

      {/* Grass strays — small pencil-white lines poking up */}
      {grassPositions.map(([gx, gz, h, rot], i) => (
        <mesh key={`grass-${i}`} position={[gx, -1 + h / 2, gz]} rotation={[0, rot, 0.15 * Math.sin(i)]}>
          <planeGeometry args={[0.01, h]} />
          <SketchMaterial baseColor={PENCIL} opacity={0.5} transparent side={DoubleSide} />
        </mesh>
      ))}

      {/* Fence posts */}
      {posts.map((pos, i) => (
        <mesh key={`post-${i}`} position={pos}>
          <boxGeometry args={[0.04, 0.7, 0.04]} />
          <SketchMaterial baseColor={PENCIL} opacity={OPACITY} transparent />
          <Edges threshold={EDGE_THRESHOLD} color={EDGE_COLOR} />
        </mesh>
      ))}

      {/* ── Horizontal rails ── */}

      {/* Front left rails */}
      <FenceRail x={fLeft + frontLeftLen / 2} z={fFront} y={railHigh} length={frontLeftLen} axis="x" />
      <FenceRail x={fLeft + frontLeftLen / 2} z={fFront} y={railLow} length={frontLeftLen} axis="x" />
      {/* Front right rails */}
      <FenceRail x={gateHalf + frontRightLen / 2} z={fFront} y={railHigh} length={frontRightLen} axis="x" />
      <FenceRail x={gateHalf + frontRightLen / 2} z={fFront} y={railLow} length={frontRightLen} axis="x" />
      {/* Back rails */}
      <FenceRail x={0} z={fBack} y={railHigh} length={fWidth} axis="x" />
      <FenceRail x={0} z={fBack} y={railLow} length={fWidth} axis="x" />
      {/* Left rails */}
      <FenceRail x={fLeft} z={0} y={railHigh} length={fDepth} axis="z" />
      <FenceRail x={fLeft} z={0} y={railLow} length={fDepth} axis="z" />
      {/* Right rails */}
      <FenceRail x={fRight} z={0} y={railHigh} length={fDepth} axis="z" />
      <FenceRail x={fRight} z={0} y={railLow} length={fDepth} axis="z" />

      {/* Gate posts (taller, flush with ground) */}
      <mesh position={[-gateHalf, -0.55, fFront]}>
        <boxGeometry args={[0.07, 0.9, 0.07]} />
        <SketchMaterial baseColor={PENCIL} opacity={OPACITY} transparent />
        <Edges threshold={EDGE_THRESHOLD} color={EDGE_COLOR} />
      </mesh>
      <mesh position={[gateHalf, -0.55, fFront]}>
        <boxGeometry args={[0.07, 0.9, 0.07]} />
        <SketchMaterial baseColor={PENCIL} opacity={OPACITY} transparent />
        <Edges threshold={EDGE_THRESHOLD} color={EDGE_COLOR} />
      </mesh>

      {/* Walkway from gate to front door */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.995, (3 + fFront) / 2]}>
        <planeGeometry args={[1.0, fFront - 3]} />
        <SketchMaterial baseColor={PENCIL_DIM} opacity={OPACITY} transparent side={DoubleSide} />
        <Edges threshold={EDGE_THRESHOLD} color={EDGE_COLOR} />
      </mesh>

      {/* Bushes */}
      <Bush position={[-2.2, -0.7, 3.6]} scale={0.35} color={PENCIL_DIM} highlight={PENCIL} />
      <Bush position={[2.2, -0.75, 3.6]} scale={0.3} color={PENCIL_DIM} highlight={PENCIL} />
      <Bush position={[-3.5, -0.72, 1.5]} scale={0.33} color={PENCIL_DIM} highlight={PENCIL} />
      <Bush position={[3.5, -0.68, 1.5]} scale={0.38} color={PENCIL_DIM} highlight={PENCIL} />
      <Bush position={[-3.5, -0.74, -1.5]} scale={0.3} color={PENCIL_DIM} highlight={PENCIL} />
      <Bush position={[3.5, -0.72, -1.5]} scale={0.32} color={PENCIL_DIM} highlight={PENCIL} />
      <Bush position={[-2, -0.76, -3.6]} scale={0.28} color={PENCIL_DIM} highlight={PENCIL} />
      <Bush position={[2, -0.7, -3.6]} scale={0.34} color={PENCIL_DIM} highlight={PENCIL} />
    </group>
  );
}

function FenceRail({
  x, z, y, length, axis,
}: {
  x: number; z: number; y: number; length: number; axis: "x" | "z";
}) {
  const size: [number, number, number] =
    axis === "x" ? [length, 0.03, 0.03] : [0.03, 0.03, length];

  return (
    <mesh position={[x, y, z]}>
      <boxGeometry args={size} />
      <SketchMaterial baseColor={WALL_FRONT} opacity={OPACITY} transparent />
    </mesh>
  );
}

function Bush({
  position, scale = 0.3, color, highlight,
}: {
  position: [number, number, number]; scale?: number; color: string; highlight: string;
}) {
  return (
    <group position={position} scale={scale}>
      <mesh>
        <sphereGeometry args={[1, 6, 4]} />
        <SketchMaterial baseColor={color} opacity={OPACITY} transparent />
        <Edges threshold={EDGE_THRESHOLD} color={EDGE_COLOR} />
      </mesh>
      <mesh position={[0.3, 0.5, 0.1]} scale={0.6}>
        <sphereGeometry args={[1, 5, 3]} />
        <SketchMaterial baseColor={highlight} opacity={OPACITY} transparent />
        <Edges threshold={EDGE_THRESHOLD} color={EDGE_COLOR} />
      </mesh>
    </group>
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
        <boxGeometry args={[slopeLength, 0.06, depth]} />
        <SketchMaterial baseColor={ROOF_COLOR} opacity={OPACITY} transparent />
        <Edges threshold={EDGE_THRESHOLD} color={EDGE_COLOR} />
      </mesh>
      <mesh position={[halfWidth / 2, peakHeight / 2, 0]} rotation={[0, 0, -angle]}>
        <boxGeometry args={[slopeLength, 0.06, depth]} />
        <SketchMaterial baseColor={ROOF_SHADOW} opacity={OPACITY} transparent />
        <Edges threshold={EDGE_THRESHOLD} color={EDGE_COLOR} />
      </mesh>
      <mesh position={[0, peakHeight, 0]}>
        <boxGeometry args={[0.06, 0.06, depth + 0.2]} />
        <SketchMaterial baseColor="#aaaaaf" opacity={OPACITY} transparent />
        <Edges threshold={EDGE_THRESHOLD} color={EDGE_COLOR} />
      </mesh>
    </group>
  );
}
