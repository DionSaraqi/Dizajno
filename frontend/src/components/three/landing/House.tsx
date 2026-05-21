"use client";

import { Edges } from "@react-three/drei/core/Edges";
import SketchMaterial from "@/components/three/landing/SketchMaterial";

const EDGE_COLOR = "#d0d0d0";
const EDGE_THRESHOLD = 15;

/**
 * Procedural house: 4 walls, pitched gabled roof, windows.
 * All sketch-style with white chalk outlines.
 */
export default function House() {
  const wallHeight = 2.2;
  const wallWidth = 4;
  const wallDepth = 3.5;
  const wallThickness = 0.08;
  const roofOverhang = 0.3;
  const roofPeakHeight = 1.4;

  return (
    <group>
      {/* ── Ground-floor Walls ── */}

      {/* Front wall (Z+) - has door cutout, we leave a gap for the door */}
      {/* Left section of front wall */}
      <mesh position={[-1.2, wallHeight / 2, wallDepth / 2]}>
        <boxGeometry args={[1.5, wallHeight, wallThickness]} />
        <SketchMaterial baseColor="#2a2a2a" />
        <Edges threshold={EDGE_THRESHOLD} color={EDGE_COLOR} />
      </mesh>

      {/* Right section of front wall */}
      <mesh position={[1.2, wallHeight / 2, wallDepth / 2]}>
        <boxGeometry args={[1.5, wallHeight, wallThickness]} />
        <SketchMaterial baseColor="#2a2a2a" />
        <Edges threshold={EDGE_THRESHOLD} color={EDGE_COLOR} />
      </mesh>

      {/* Above door section */}
      <mesh position={[0, wallHeight - 0.25, wallDepth / 2]}>
        <boxGeometry args={[0.9, 0.5, wallThickness]} />
        <SketchMaterial baseColor="#2a2a2a" />
        <Edges threshold={EDGE_THRESHOLD} color={EDGE_COLOR} />
      </mesh>

      {/* Back wall (Z-) */}
      <mesh position={[0, wallHeight / 2, -wallDepth / 2]}>
        <boxGeometry args={[wallWidth, wallHeight, wallThickness]} />
        <SketchMaterial baseColor="#222222" />
        <Edges threshold={EDGE_THRESHOLD} color={EDGE_COLOR} />
      </mesh>

      {/* Left wall (X-) */}
      <mesh position={[-wallWidth / 2, wallHeight / 2, 0]}>
        <boxGeometry args={[wallThickness, wallHeight, wallDepth]} />
        <SketchMaterial baseColor="#2e2e2e" />
        <Edges threshold={EDGE_THRESHOLD} color={EDGE_COLOR} />
      </mesh>

      {/* Right wall (X+) */}
      <mesh position={[wallWidth / 2, wallHeight / 2, 0]}>
        <boxGeometry args={[wallThickness, wallHeight, wallDepth]} />
        <SketchMaterial baseColor="#2e2e2e" />
        <Edges threshold={EDGE_THRESHOLD} color={EDGE_COLOR} />
      </mesh>

      {/* ── Windows ── */}
      {/* Left wall windows */}
      <Window position={[-wallWidth / 2 - 0.01, wallHeight * 0.55, -0.6]} rotationY={-Math.PI / 2} />
      <Window position={[-wallWidth / 2 - 0.01, wallHeight * 0.55, 0.8]} rotationY={-Math.PI / 2} />

      {/* Right wall windows */}
      <Window position={[wallWidth / 2 + 0.01, wallHeight * 0.55, -0.6]} rotationY={Math.PI / 2} />
      <Window position={[wallWidth / 2 + 0.01, wallHeight * 0.55, 0.8]} rotationY={Math.PI / 2} />

      {/* Back wall window */}
      <Window position={[0, wallHeight * 0.55, -wallDepth / 2 - 0.01]} rotationY={Math.PI} />

      {/* ── Pitched Gabled Roof ── */}
      <GabledRoof
        width={wallWidth + roofOverhang * 2}
        depth={wallDepth + roofOverhang * 2}
        peakHeight={roofPeakHeight}
        baseY={wallHeight}
      />
    </group>
  );
}

/** A dark inset window box on a wall surface */
function Window({
  position,
  rotationY = 0,
}: {
  position: [number, number, number];
  rotationY?: number;
}) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Window frame */}
      <mesh>
        <boxGeometry args={[0.7, 0.6, 0.06]} />
        <SketchMaterial baseColor="#151515" />
        <Edges threshold={EDGE_THRESHOLD} color={EDGE_COLOR} />
      </mesh>
      {/* Window cross bars */}
      <mesh position={[0, 0, 0.035]}>
        <boxGeometry args={[0.7, 0.04, 0.02]} />
        <SketchMaterial baseColor="#3a3a3a" />
      </mesh>
      <mesh position={[0, 0, 0.035]}>
        <boxGeometry args={[0.04, 0.6, 0.02]} />
        <SketchMaterial baseColor="#3a3a3a" />
      </mesh>
    </group>
  );
}

/** Pitched gabled roof using two angled planes */
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
  // Angle of roof slope
  const slopeLength = Math.sqrt(halfWidth * halfWidth + peakHeight * peakHeight);
  const angle = Math.atan2(peakHeight, halfWidth);

  return (
    <group position={[0, baseY, 0]}>
      {/* Left roof slope */}
      <mesh
        position={[-halfWidth / 2, peakHeight / 2, 0]}
        rotation={[0, 0, angle]}
      >
        <boxGeometry args={[slopeLength, 0.06, depth]} />
        <SketchMaterial baseColor="#333333" />
        <Edges threshold={EDGE_THRESHOLD} color={EDGE_COLOR} />
      </mesh>

      {/* Right roof slope */}
      <mesh
        position={[halfWidth / 2, peakHeight / 2, 0]}
        rotation={[0, 0, -angle]}
      >
        <boxGeometry args={[slopeLength, 0.06, depth]} />
        <SketchMaterial baseColor="#383838" />
        <Edges threshold={EDGE_THRESHOLD} color={EDGE_COLOR} />
      </mesh>

      {/* Front gable triangle (filled) */}
      <GableTriangle
        width={width}
        height={peakHeight}
        position={[0, 0, depth / 2]}
        color="#2a2a2a"
      />

      {/* Back gable triangle */}
      <GableTriangle
        width={width}
        height={peakHeight}
        position={[0, 0, -depth / 2]}
        color="#222222"
        flipZ
      />

      {/* Ridge beam at peak */}
      <mesh position={[0, peakHeight, 0]}>
        <boxGeometry args={[0.06, 0.06, depth + 0.1]} />
        <SketchMaterial baseColor="#444444" />
        <Edges threshold={EDGE_THRESHOLD} color={EDGE_COLOR} />
      </mesh>
    </group>
  );
}

/** Triangular gable end fill using a custom BufferGeometry */
function GableTriangle({
  width,
  height,
  position,
  color,
  flipZ = false,
}: {
  width: number;
  height: number;
  position: [number, number, number];
  color: string;
  flipZ?: boolean;
}) {
  const hw = width / 2;
  // Vertices for a triangle: bottom-left, bottom-right, peak
  const vertices = new Float32Array(
    flipZ
      ? [
          -hw, 0, 0,
          hw, 0, 0,
          0, height, 0,
        ]
      : [
          hw, 0, 0,
          -hw, 0, 0,
          0, height, 0,
        ]
  );

  return (
    <mesh position={position}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[vertices, 3]}
        />
      </bufferGeometry>
      <SketchMaterial baseColor={color} />
    </mesh>
  );
}
