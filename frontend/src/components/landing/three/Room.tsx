"use client";

import React, { useMemo } from "react";
import {
  DoubleSide,
  BufferGeometry,
  Float32BufferAttribute,
  PlaneGeometry,
  BoxGeometry,
  Shape,
  ShapeGeometry,
  IcosahedronGeometry,
  Vector3,
} from "three";
import {
  toCreasedNormals,
  mergeGeometries,
  mergeVertices,
} from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Edges, ContactShadows } from "@react-three/drei";
import SketchMaterial from "@/components/landing/three/SketchMaterial";

const EDGE_COLOR = "#d0d0d0";
const EDGE_THRESHOLD = 15;
const OPACITY = 0.95;

const WALL_MAIN = "#b4b4bc";   // single wall tone — real shading does the directional work now
const WALL_DIM = "#a8a8b0";    // dimmer pencil tone for yard accents
const FLOOR_COLOR = "#c8c8d0";
const CEILING_COLOR = "#707078";
const ROOF_COLOR = "#9aa0a8";
const WINDOW_GLASS = "#0a0a18";
const WINDOW_FRAME = "#606068";

const WALL_HEIGHT = 2;        // walls span y ∈ [-1, 1]
const ROOF_PEAK = 1.2;        // gable/ridge peak at y = 1 + ROOF_PEAK
const HALF = 3;               // walls at x,z = ±3
const DOOR_HALF = 0.5;        // door opening x ∈ [-0.5, 0.5]
const DOOR_TOP = 0.75;        // door opening rises to y = 0.75

/**
 * Strip a geometry down to position+normal, non-indexed, so a batch of differently-built
 * geometries (planes, boxes, shapes, triangles) can be merged into one buffer.
 */
function prep(g: BufferGeometry): BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g;
  out.deleteAttribute("uv");
  return out;
}

/** A flat triangle in the z-plane with an explicit +z / -z facing normal. */
function gableTriangle(z: number, faceForward: boolean): BufferGeometry {
  const g = new BufferGeometry();
  const a: [number, number, number] = [-HALF, 1, z];
  const b: [number, number, number] = [HALF, 1, z];
  const c: [number, number, number] = [0, 1 + ROOF_PEAK, z];
  // Winding order sets the normal: A,B,C → +z ; A,C,B → -z
  const tri = faceForward ? [...a, ...b, ...c] : [...a, ...c, ...b];
  g.setAttribute("position", new Float32BufferAttribute(tri, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * The whole house SHELL as one welded mesh: 4 walls (front/back built as single faces with
 * a real door opening, so there are no lintel seams) + both gables, all with correct
 * outward normals. Coplanar joins (wall→gable, front-wall pieces) weld shut; only true
 * corners and the door outline survive as edges.
 */
function buildWallsGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];

  // Left wall (normal -x) and right wall (normal +x)
  let g: BufferGeometry = new PlaneGeometry(2 * HALF, WALL_HEIGHT); g.rotateY(-Math.PI / 2); g.translate(-HALF, 0, 0); parts.push(prep(g));
  g = new PlaneGeometry(2 * HALF, WALL_HEIGHT); g.rotateY(Math.PI / 2); g.translate(HALF, 0, 0); parts.push(prep(g));

  // Back wall (normal -z) — solid rectangle
  g = new PlaneGeometry(2 * HALF, WALL_HEIGHT); g.rotateY(Math.PI); g.translate(0, 0, -HALF); parts.push(prep(g));

  // Front wall (normal +z) — a single concave face with the door notched out of the bottom
  const front = new Shape();
  front.moveTo(-HALF, -1);
  front.lineTo(-DOOR_HALF, -1);
  front.lineTo(-DOOR_HALF, DOOR_TOP);
  front.lineTo(DOOR_HALF, DOOR_TOP);
  front.lineTo(DOOR_HALF, -1);
  front.lineTo(HALF, -1);
  front.lineTo(HALF, 1);
  front.lineTo(-HALF, 1);
  front.closePath();
  g = new ShapeGeometry(front); g.translate(0, 0, HALF); parts.push(prep(g));

  // Gables fill the triangle between wall-top (y=1) and the ridge; they weld to the wall
  // tops so the front reads as one continuous surface.
  parts.push(prep(gableTriangle(HALF, true)));
  parts.push(prep(gableTriangle(-HALF, false)));

  const merged = mergeGeometries(parts, false);
  return mergeVertices(merged, 1e-4);
}

/** Pitched roof (two slopes + ridge) merged into one welded mesh. */
function buildRoofGeometry(): BufferGeometry {
  const baseY = 1;
  const width = 6.4;
  const depth = 6.4;
  const halfWidth = width / 2;
  const slopeLength = Math.sqrt(halfWidth * halfWidth + ROOF_PEAK * ROOF_PEAK);
  const angle = Math.atan2(ROOF_PEAK, halfWidth);
  const parts: BufferGeometry[] = [];

  let g = new BoxGeometry(slopeLength, 0.06, depth); g.rotateZ(angle); g.translate(-halfWidth / 2, baseY + ROOF_PEAK / 2, 0); parts.push(prep(g));
  g = new BoxGeometry(slopeLength, 0.06, depth); g.rotateZ(-angle); g.translate(halfWidth / 2, baseY + ROOF_PEAK / 2, 0); parts.push(prep(g));
  g = new BoxGeometry(0.06, 0.06, depth + 0.2); g.translate(0, baseY + ROOF_PEAK, 0); parts.push(prep(g));

  const merged = mergeGeometries(parts, false);
  return mergeVertices(merged, 1e-4);
}

export default function Room() {
  const wallsGeo = useMemo(buildWallsGeometry, []);
  const roofGeo = useMemo(buildRoofGeometry, []);

  return (
    <group position={[0, 0, 5]}>
      {/* Soft contact shadow grounding the house on the yard (baked once; co-rotates with
          the house group, so it stays aligned under it as the user spins the model). */}
      <ContactShadows
        position={[0, -0.99, 0]}
        scale={8}
        far={3.5}
        blur={2.8}
        opacity={0.35}
        resolution={512}
        color="#23232a"
        frames={1}
      />

      {/* Floor (interior — kept separate; no boil so it doesn't seam at the base) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
        <planeGeometry args={[6, 6]} />
        <SketchMaterial baseColor={FLOOR_COLOR} opacity={OPACITY} transparent jitter={false} rim={false} />
      </mesh>

      {/* Flat ceiling (blocks the top-down view in) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 1, 0]}>
        <planeGeometry args={[6, 6]} />
        <SketchMaterial baseColor={CEILING_COLOR} opacity={OPACITY} transparent jitter={false} rim={false} />
      </mesh>

      {/* ── Unified house shell: walls + both gables as ONE welded mesh ── */}
      <mesh geometry={wallsGeo}>
        <SketchMaterial baseColor={WALL_MAIN} side={DoubleSide} opacity={OPACITY} transparent />
        <Edges threshold={EDGE_THRESHOLD} color={EDGE_COLOR} />
      </mesh>

      {/* ── Unified pitched roof as ONE welded mesh ── */}
      <mesh geometry={roofGeo}>
        <SketchMaterial baseColor={ROOF_COLOR} opacity={OPACITY} transparent />
        <Edges threshold={EDGE_THRESHOLD} color={EDGE_COLOR} />
      </mesh>

      {/* ── Windows (transparent overlays on the solid shell) ── */}
      <RectWindow position={[-1.4, 0, 3.03]} rotationY={0} width={1.0} height={0.8} />
      <RectWindow position={[1.4, 0, 3.03]} rotationY={0} width={1.0} height={0.8} />
      <RoundWindow position={[0, 1.5, 3.03]} rotationY={0} />
      <RectWindow position={[-3.03, 0, 1]} rotationY={Math.PI / 2} />
      <RectWindow position={[-3.03, 0, -1]} rotationY={Math.PI / 2} />
      <RectWindow position={[3.03, 0, 1]} rotationY={-Math.PI / 2} />
      <RectWindow position={[3.03, 0, -1]} rotationY={-Math.PI / 2} />

      {/* ── Porch / yard ── */}
      <Porch />
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
        <SketchMaterial baseColor={WINDOW_GLASS} opacity={0.15} transparent side={DoubleSide} rim={false} grain={false} jitter={false} />
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
        <SketchMaterial baseColor={WINDOW_GLASS} opacity={0.15} transparent side={DoubleSide} rim={false} grain={false} jitter={false} />
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

/* ── Porch / yard around the house ── */
function Porch() {
  const PENCIL = WALL_MAIN;
  const PENCIL_DIM = WALL_DIM;

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
        <SketchMaterial baseColor={PENCIL} opacity={0.12} transparent side={DoubleSide} rim={false} jitter={false} />
      </mesh>

      {/* Grid stripes on the ground — X direction */}
      {xStripes.map((x, i) => (
        <mesh key={`gx-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, -1.003, 0]}>
          <planeGeometry args={[0.01, fDepth]} />
          <SketchMaterial baseColor={PENCIL} opacity={0.2} transparent side={DoubleSide} rim={false} jitter={false} />
        </mesh>
      ))}
      {/* Grid stripes on the ground — Z direction */}
      {zStripes.map((z, i) => (
        <mesh key={`gz-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.003, z]}>
          <planeGeometry args={[fWidth, 0.01]} />
          <SketchMaterial baseColor={PENCIL} opacity={0.2} transparent side={DoubleSide} rim={false} jitter={false} />
        </mesh>
      ))}

      {/* Grass strays — small pencil-white lines poking up */}
      {grassPositions.map(([gx, gz, h, rot], i) => (
        <mesh key={`grass-${i}`} position={[gx, -1 + h / 2, gz]} rotation={[0, rot, 0.15 * Math.sin(i)]}>
          <planeGeometry args={[0.01, h]} />
          <SketchMaterial baseColor={PENCIL} opacity={0.5} transparent side={DoubleSide} rim={false} jitter={false} />
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
        <SketchMaterial baseColor={PENCIL_DIM} opacity={OPACITY} transparent side={DoubleSide} rim={false} jitter={false} />
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
      <SketchMaterial baseColor={WALL_MAIN} opacity={OPACITY} transparent />
    </mesh>
  );
}

function Bush({
  position, scale = 0.3, color, highlight,
}: {
  position: [number, number, number]; scale?: number; color: string; highlight: string;
}) {
  // Chunky hand-sculpted clump: an icosahedron displaced by a deterministic noise (seeded
  // per bush so no two match), with creased normals for a crisp low-poly read — no pinched
  // poles or lat/long banding like the old UV sphere.
  const seed = position[0] * 1.7 + position[2] * 3.1;
  const geo = useMemo(() => {
    const g = new IcosahedronGeometry(1, 2);
    const pos = g.attributes.position;
    const v = new Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const n =
        Math.sin(v.x * 4.1 + seed) *
        Math.cos(v.y * 3.7 + seed) *
        Math.sin(v.z * 5.3 + seed);
      v.multiplyScalar(1 + 0.18 * n);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return toCreasedNormals(g, Math.PI / 6);
  }, [seed]);

  return (
    <group position={position} scale={scale}>
      <mesh geometry={geo}>
        <SketchMaterial baseColor={color} opacity={OPACITY} transparent />
        <Edges threshold={20} color={EDGE_COLOR} />
      </mesh>
      <mesh position={[0.35, 0.5, 0.1]} scale={0.6} geometry={geo}>
        <SketchMaterial baseColor={highlight} opacity={OPACITY} transparent />
        <Edges threshold={20} color={EDGE_COLOR} />
      </mesh>
    </group>
  );
}
