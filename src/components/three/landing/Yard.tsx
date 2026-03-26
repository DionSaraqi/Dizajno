"use client";

import { Edges } from "@react-three/drei/core/Edges";
import SketchMaterial from "@/components/three/landing/SketchMaterial";

const EDGE_COLOR = "#c0c0c0";
const EDGE_THRESHOLD = 15;

export default function Yard() {
  return (
    <group>
      {/* ── Ground Plane ── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[12, 10]} />
        <SketchMaterial baseColor="#161620" />
      </mesh>

      {/* ── Property Ground (slightly lighter) ── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[8, 7]} />
        <SketchMaterial baseColor="#c8c8d0" />
      </mesh>

      {/* ── Walkway from fence to door ── */}
      <Walkway />

      {/* ── Picket Fence ── */}
      <Fence />

      {/* ── Bushes ── */}
      <Bush position={[-1.6, 0.2, 1.2]} scale={0.35} />
      <Bush position={[1.6, 0.15, 1.2]} scale={0.28} />
      <Bush position={[-1.7, 0.18, -1.2]} scale={0.32} />
      <Bush position={[1.7, 0.22, -1.0]} scale={0.38} />
      <Bush position={[0.0, 0.12, -1.5]} scale={0.25} />
    </group>
  );
}

/** Flat walkway from fence gate to front door */
function Walkway() {
  return (
    <group>
      {/* Main path */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 2.8]}>
        <planeGeometry args={[0.9, 2.2]} />
        <SketchMaterial baseColor="#252530" />
      </mesh>
      {/* Path border lines (chalk outlines) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-0.47, 0.006, 2.8]}>
        <planeGeometry args={[0.02, 2.2]} />
        <SketchMaterial baseColor="#505060" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.47, 0.006, 2.8]}>
        <planeGeometry args={[0.02, 2.2]} />
        <SketchMaterial baseColor="#505060" />
      </mesh>
    </group>
  );
}

/** Picket fence around property */
function Fence() {
  const posts: [number, number, number][] = [];
  const fenceY = 0.3;
  const postSpacing = 0.4;

  // Front fence (Z+ side), split for gate opening
  const frontZ = 3.9;
  for (let x = -3.6; x <= -0.6; x += postSpacing) {
    posts.push([x, fenceY, frontZ]);
  }
  for (let x = 0.6; x <= 3.6; x += postSpacing) {
    posts.push([x, fenceY, frontZ]);
  }

  // Back fence (Z- side)
  const backZ = -3.1;
  for (let x = -3.6; x <= 3.6; x += postSpacing) {
    posts.push([x, fenceY, backZ]);
  }

  // Left fence
  const leftX = -3.6;
  for (let z = -3.1; z <= 3.9; z += postSpacing) {
    posts.push([leftX, fenceY, z]);
  }

  // Right fence
  const rightX = 3.6;
  for (let z = -3.1; z <= 3.9; z += postSpacing) {
    posts.push([rightX, fenceY, z]);
  }

  return (
    <group>
      {/* Fence posts */}
      {posts.map((pos, i) => (
        <mesh key={i} position={pos}>
          <boxGeometry args={[0.04, 0.6, 0.04]} />
          <SketchMaterial baseColor="#3a3a42" />
          <Edges threshold={EDGE_THRESHOLD} color={EDGE_COLOR} />
        </mesh>
      ))}

      {/* Horizontal rails — front left */}
      <FenceRail
        from={[-3.6, 0.45, frontZ]}
        to={[-0.6, 0.45, frontZ]}
        length={3.0}
      />
      <FenceRail
        from={[-3.6, 0.2, frontZ]}
        to={[-0.6, 0.2, frontZ]}
        length={3.0}
      />

      {/* Front right */}
      <FenceRail
        from={[0.6, 0.45, frontZ]}
        to={[3.6, 0.45, frontZ]}
        length={3.0}
      />
      <FenceRail
        from={[0.6, 0.2, frontZ]}
        to={[3.6, 0.2, frontZ]}
        length={3.0}
      />

      {/* Back */}
      <FenceRail
        from={[-3.6, 0.45, backZ]}
        to={[3.6, 0.45, backZ]}
        length={7.2}
      />
      <FenceRail
        from={[-3.6, 0.2, backZ]}
        to={[3.6, 0.2, backZ]}
        length={7.2}
      />

      {/* Left side */}
      <FenceRailZ
        from={[leftX, 0.45, -3.1]}
        to={[leftX, 0.45, 3.9]}
        length={7.0}
      />
      <FenceRailZ
        from={[leftX, 0.2, -3.1]}
        to={[leftX, 0.2, 3.9]}
        length={7.0}
      />

      {/* Right side */}
      <FenceRailZ
        from={[rightX, 0.45, -3.1]}
        to={[rightX, 0.45, 3.9]}
        length={7.0}
      />
      <FenceRailZ
        from={[rightX, 0.2, -3.1]}
        to={[rightX, 0.2, 3.9]}
        length={7.0}
      />

      {/* Gate posts (taller) */}
      <mesh position={[-0.55, 0.4, frontZ]}>
        <boxGeometry args={[0.06, 0.8, 0.06]} />
        <SketchMaterial baseColor="#4a4a52" />
        <Edges threshold={EDGE_THRESHOLD} color={EDGE_COLOR} />
      </mesh>
      <mesh position={[0.55, 0.4, frontZ]}>
        <boxGeometry args={[0.06, 0.8, 0.06]} />
        <SketchMaterial baseColor="#4a4a52" />
        <Edges threshold={EDGE_THRESHOLD} color={EDGE_COLOR} />
      </mesh>
    </group>
  );
}

/** Horizontal fence rail along X axis */
function FenceRail({
  from,
  length,
}: {
  from: [number, number, number];
  to: [number, number, number];
  length: number;
}) {
  return (
    <mesh position={[from[0] + length / 2, from[1], from[2]]}>
      <boxGeometry args={[length, 0.03, 0.03]} />
      <SketchMaterial baseColor="#3a3a42" />
    </mesh>
  );
}

/** Horizontal fence rail along Z axis */
function FenceRailZ({
  from,
  length,
}: {
  from: [number, number, number];
  to: [number, number, number];
  length: number;
}) {
  return (
    <mesh position={[from[0], from[1], from[2] + length / 2]}>
      <boxGeometry args={[0.03, 0.03, length]} />
      <SketchMaterial baseColor="#3a3a42" />
    </mesh>
  );
}

/** Low-poly bush */
function Bush({
  position,
  scale = 0.3,
}: {
  position: [number, number, number];
  scale?: number;
}) {
  return (
    <group position={position} scale={scale}>
      {/* Main bush body */}
      <mesh>
        <sphereGeometry args={[1, 6, 4]} />
        <SketchMaterial baseColor="#252530" />
        <Edges threshold={EDGE_THRESHOLD} color={EDGE_COLOR} />
      </mesh>
      {/* Smaller top lobe */}
      <mesh position={[0.3, 0.5, 0.1]} scale={0.65}>
        <sphereGeometry args={[1, 5, 3]} />
        <SketchMaterial baseColor="#2a2a35" />
        <Edges threshold={EDGE_THRESHOLD} color={EDGE_COLOR} />
      </mesh>
    </group>
  );
}
