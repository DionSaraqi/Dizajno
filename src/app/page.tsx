"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Mesh, DoubleSide, Group, SpotLight, Vector3 } from "three";
import { useRef, useState, useEffect } from "react";

function Scene() {
  const doorRef = useRef<Group>(null!);
  const { camera } = useThree();

  useEffect(() => {
    // Make the camera initially look at the door pivot (door group position)
    camera.lookAt(0.5, -0.13, 8);
  }, [camera]);

  const [animationPhase, setAnimationPhase] = useState<
    "idle" | "moving-to-front" | "opening-door"
  >("idle");
  const [progress, setProgress] = useState(0);
  const spotLightRef = useRef<SpotLight>(null!);

  // Store initial and target positions for smooth transitions
  const initialCameraPos = useRef(new Vector3(6, 6, 15));
  const frontViewPos = useRef(new Vector3(0, 0, 15));

  // Store look-at targets for smooth interpolation
  const initialLookAt = useRef(new Vector3(0.5, -0.13, 8)); // Door position
  const targetLookAt = useRef(new Vector3(0, 0, 5)); // Room center
  const currentLookAt = useRef(new Vector3()); // For interpolation

  useFrame(() => {
    if (animationPhase === "moving-to-front") {
      // Smooth transition to front view
      const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
      const t = Math.min(progress * 2, 1);

      // Move camera to front position (0, 0, 15)
      camera.position.lerpVectors(
        initialCameraPos.current,
        frontViewPos.current,
        easeOut(t)
      );

      // Smoothly interpolate look-at target from door to room center
      currentLookAt.current.lerpVectors(
        initialLookAt.current,
        targetLookAt.current,
        easeOut(t)
      );
      camera.lookAt(currentLookAt.current);

      // Update progress - slowed down
      setProgress((p) => p + 0.003);

      // When transition is complete, move to next phase
      if (t >= 1) {
        setAnimationPhase("opening-door");
        setProgress(0); // Reset progress for next phase
      }
    }

    if (animationPhase === "opening-door") {
      const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
      const doorTarget = -Math.PI / 2 + Math.PI / 180; // stop 1° before full 90°

      // Open the door faster (hinge from right), stop 1° early.
      if (doorRef.current.rotation.y > doorTarget) {
        doorRef.current.rotation.y = Math.max(
          doorRef.current.rotation.y - 0.006,
          doorTarget
        );
      }

      // Smooth zoom in — slowed dramatically and zoom to 0 (inside room)
      if (progress < 1) {
        setProgress((p) => Math.min(p + 0.0005, 1));
        const eased = easeOut(progress);
        camera.position.z = 15 - eased * 10; // zoom from 15 → 0
        camera.lookAt(0, 0, 5);
      }
    }
  });

  const handleDoorClick = () => {
    if (animationPhase === "idle") {
      // Store current camera position and look-at as starting point
      initialCameraPos.current.copy(camera.position);

      // Get current look-at direction and calculate a point in that direction
      // This is an approximation - we'll use the door position as initial look-at
      initialLookAt.current.set(0.5, -0.13, 8); // Door position
      targetLookAt.current.set(0, 0, 5); // Room center

      setAnimationPhase("moving-to-front");
      setProgress(0);
    }
  };

  return (
    <>
      {/* Dim ambient light for outside only */}
      <ambientLight intensity={0.3} />

      {/* Directional light that only illuminates outside */}
      <directionalLight
        position={[5, 10, 15]}
        intensity={0.4}
        target-position={[0, 0, 10]} // Aim toward the door/outside area
      />

      {/* Door (hinged on right side) */}
      <group
        ref={doorRef}
        position={[0.5, -0.13, 8]} // pivot at right edge of the door
        onClick={handleDoorClick}
      >
        <mesh
          position={
            [
              -0.5, 0, 0,
            ] /* center the box so its right edge sits at group origin */
          }
        >
          <boxGeometry args={[1, 1.75, 0.1]} />
          <meshStandardMaterial color="#4F46E5" />
        </mesh>
      </group>

      {/* Room (walls smaller than screen size) */}
      <group position={[0, 0, 5]}>
        {/* Floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
          <planeGeometry args={[6, 6]} />
          <meshStandardMaterial color="#2a2a2a" /> {/* Darker color */}
        </mesh>

        {/* Ceiling (white outside, black inside) */}
        <group>
          {/* outside-facing ceiling (visible from above) */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 1.01, 0]}>
            <planeGeometry args={[6, 6]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>

          {/* inside-facing ceiling (visible from below) */}
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.99, 0]}>
            <planeGeometry args={[6, 6]} />
            <meshStandardMaterial color="#000000" />
          </mesh>
        </group>

        {/* Left Wall */}
        <mesh rotation={[0, Math.PI / 2, 0]} position={[-3, 0, 0]}>
          <planeGeometry args={[6, 2]} />
          <meshStandardMaterial color="#333333" /> {/* Dark gray */}
        </mesh>

        {/* Right Wall */}
        <group>
          <mesh rotation={[0, Math.PI / 2, 0]} position={[3, 0, 0]}>
            <planeGeometry args={[6, 2]} />
            <meshStandardMaterial color="#ffffff" /> {/* Dark gray */}
          </mesh>
          <mesh rotation={[0, -Math.PI / 2, 0]} position={[3, 0, 0]}>
            <planeGeometry args={[6, 2]} />
            <meshStandardMaterial color="#333333" /> {/* Dark gray */}
          </mesh>
        </group>
        {/* Front Wall */}
        <group position={[0, 0, 3]}>
          {/* left panel */}
          <mesh rotation={[0, -Math.PI, 0]} position={[-1.75, 0, 0]}>
            <planeGeometry args={[2.5, 2]} />
            <meshStandardMaterial color="#ffffff" side={DoubleSide} />{" "}
            {/* Dark gray */}
          </mesh>

          {/* right panel */}
          <mesh rotation={[0, -Math.PI, 0]} position={[1.75, 0, 0]}>
            <planeGeometry args={[2.5, 2]} />
            <meshStandardMaterial color="#ffffff" side={DoubleSide} />{" "}
            {/* Dark gray */}
          </mesh>

          {/* top panel above door */}
          <mesh rotation={[0, -Math.PI, 0]} position={[0, 0.875, 0]}>
            <planeGeometry args={[1, 0.25]} />
            <meshStandardMaterial color="#ffffff" side={DoubleSide} />{" "}
            {/* Dark gray */}
          </mesh>
        </group>

        {/* Back Wall */}
        <mesh rotation={[0, Math.PI, 0]} position={[0, 0, -3]}>
          <planeGeometry args={[6, 2]} />
          <meshStandardMaterial color="#252525" side={DoubleSide} />{" "}
          {/* Very dark */}
        </mesh>
      </group>
    </>
  );
}

export default function HomePage() {
  return (
    <main className="h-screen w-screen m-0 p-0 overflow-hidden bg-gray-900">
      <Canvas camera={{ position: [6, 6, 15], fov: 50 }}>
        <Scene />
      </Canvas>
    </main>
  );
}
