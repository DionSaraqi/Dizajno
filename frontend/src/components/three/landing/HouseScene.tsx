"use client";

import { useRef, useState, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, PointLight as PointLightType } from "three";
import House from "@/components/three/landing/House";
import BlueDoor from "@/components/three/landing/BlueDoor";
import Yard from "@/components/three/landing/Yard";

type AnimationPhase = "idle" | "door-opening" | "transitioning";

interface HouseSceneProps {
  onTransitionComplete: () => void;
  onFlashStart: () => void;
}

export default function HouseScene({
  onTransitionComplete,
  onFlashStart,
}: HouseSceneProps) {
  const doorRef = useRef<Group>(null!);
  const insideLightRef = useRef<PointLightType>(null!);
  const [phase, setPhase] = useState<AnimationPhase>("idle");
  const progressRef = useRef(0);
  const flashTriggered = useRef(false);

  useFrame((_, delta) => {
    if (phase === "door-opening") {
      progressRef.current += delta;

      // Door rotation: swing open over ~0.5s
      const doorProgress = Math.min(progressRef.current / 0.2, 1);
      const eased = 1 - Math.pow(1 - doorProgress, 3); // easeOutCubic
      if (doorRef.current) {
        doorRef.current.rotation.y = -eased * (Math.PI / 2 - 0.02);
      }

      // Inside light ramps up as door opens
      if (insideLightRef.current) {
        insideLightRef.current.intensity = eased * 8;
      }

      // After door is open, begin flash
      if (doorProgress >= 1) {
        setPhase("transitioning");
        progressRef.current = 0;
      }
    }

    if (phase === "transitioning") {
      progressRef.current += delta;

      // Ramp light to maximum
      if (insideLightRef.current) {
        insideLightRef.current.intensity = 8 + progressRef.current * 50;
      }

      // Trigger flash overlay after 200ms
      if (progressRef.current > 0.08 && !flashTriggered.current) {
        flashTriggered.current = true;
        onFlashStart();
      }

      // Navigate after flash completes (~600ms total from transition start)
      if (progressRef.current > 0.25) {
        onTransitionComplete();
      }
    }
  });

  const handleDoorClick = useCallback(() => {
    if (phase === "idle") {
      progressRef.current = 0;
      flashTriggered.current = false;
      setPhase("door-opening");
    }
  }, [phase]);

  const isAnimating = phase !== "idle";

  return (
    <>
      {/* Ambient light — subtle, sketch feel */}
      <ambientLight intensity={0.4} />

      {/* Key light (upper-right-front) for sketch shadows */}
      <directionalLight
        position={[6, 8, 4]}
        intensity={0.5}
        color="#e0e0e0"
      />

      {/* Fill light (left side) */}
      <directionalLight
        position={[-4, 5, 2]}
        intensity={0.2}
        color="#c0c0d0"
      />

      {/* Light from inside doorway (starts at 0, ramps up on click) */}
      <pointLight
        ref={insideLightRef}
        position={[0, 1.2, 1.0]}
        intensity={0}
        color="#ffffff"
        distance={8}
      />

      {/* House structure */}
      <House />

      {/* Interactive blue door */}
      <BlueDoor
        ref={doorRef}
        onDoorClick={handleDoorClick}
        isAnimating={isAnimating}
      />

      {/* Yard with fence, bushes, walkway */}
      <Yard />
    </>
  );
}
