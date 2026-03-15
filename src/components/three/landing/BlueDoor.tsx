"use client";

import { forwardRef, useState, useRef, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import { Edges } from "@react-three/drei/core/Edges";
import { Group, Color } from "three";
import SketchMaterial from "@/components/three/landing/SketchMaterial";

const DOOR_COLOR = "#3B7DDD";
const DOOR_GLOW_COLOR = "#5B9DFF";
const EDGE_COLOR = "#d0d0d0";

interface BlueDoorProps {
  onDoorClick: () => void;
  isAnimating: boolean;
}

const BlueDoor = forwardRef<Group, BlueDoorProps>(function BlueDoor(
  { onDoorClick, isAnimating },
  ref
) {
  const [hovered, setHovered] = useState(false);
  const emissiveRef = useRef(0);
  const materialRef = useRef<{ baseColor: Color } | null>(null);

  // Oscillate emissive glow on hover
  useFrame((_, delta) => {
    if (!materialRef.current) return;

    if (hovered && !isAnimating) {
      emissiveRef.current += delta * 3;
      const pulse = 0.15 + Math.sin(emissiveRef.current) * 0.1;
      const r = 0.231 + pulse;
      const g = 0.49 + pulse;
      const b = 0.867 + pulse;
      materialRef.current.baseColor.setRGB(r, g, b);
    } else if (!isAnimating) {
      // Reset to base blue
      materialRef.current.baseColor.set(DOOR_COLOR);
    }
  });

  const handlePointerOver = useCallback(() => {
    if (!isAnimating) {
      setHovered(true);
      document.body.style.cursor = "pointer";
    }
  }, [isAnimating]);

  const handlePointerOut = useCallback(() => {
    setHovered(false);
    document.body.style.cursor = "auto";
  }, []);

  const handleClick = useCallback(() => {
    if (!isAnimating) {
      setHovered(false);
      document.body.style.cursor = "auto";
      onDoorClick();
    }
  }, [isAnimating, onDoorClick]);

  return (
    <group
      ref={ref}
      // Pivot at the left edge of the door (hinge side)
      position={[-0.45, 0, 1.75]}
    >
      {/* Door panel — offset so hinge is at group origin */}
      <mesh
        position={[0.4, 0.95, 0]}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      >
        <boxGeometry args={[0.8, 1.7, 0.08]} />
        <sketchMaterial
          ref={materialRef}
          baseColor={new Color(hovered ? DOOR_GLOW_COLOR : DOOR_COLOR)}
          opacity={1.0}
          attach="material"
        />
        <Edges threshold={15} color={EDGE_COLOR} />
      </mesh>

      {/* Door handle */}
      <mesh position={[0.65, 0.9, 0.06]}>
        <boxGeometry args={[0.06, 0.12, 0.06]} />
        <SketchMaterial baseColor="#888888" />
      </mesh>

      {/* Door frame lines (top and sides) */}
      <mesh position={[0.4, 1.82, 0]}>
        <boxGeometry args={[0.88, 0.04, 0.1]} />
        <SketchMaterial baseColor="#444444" />
        <Edges threshold={15} color={EDGE_COLOR} />
      </mesh>
    </group>
  );
});

export default BlueDoor;
