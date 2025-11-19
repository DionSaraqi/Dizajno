"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { DoubleSide, Group, Vector3 } from "three";
import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Door from "./Door";
import Room from "./Room";
import Lights from "./Lights";

export default function Scene() {
  const doorRef = useRef<Group>(null!);
  const { camera } = useThree();

  useEffect(() => {
    camera.lookAt(0.5, -0.13, 8);
  }, [camera]);

  const [animationPhase, setAnimationPhase] = useState<
    "idle" | "moving-to-front" | "opening-door"
  >("idle");
  const [progress, setProgress] = useState(0);
  const initialCameraPos = useRef(new Vector3(6, 6, 15));
  const frontViewPos = useRef(new Vector3(0, 0, 15));

  const initialLookAt = useRef(new Vector3(0.5, -0.13, 8));
  const targetLookAt = useRef(new Vector3(0, 0, 5));
  const currentLookAt = useRef(new Vector3());
  // fade overlay state
  const [isFading, setIsFading] = useState(false);
  const fadeProgress = useRef(0);
  const overlayEl = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const navigated = useRef(false);

  // ensure overlay DOM element exists
  useFadeOverlay(overlayEl);

  useFrame(() => {
    if (animationPhase === "moving-to-front") {
      const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
      const t = Math.min(progress * 2, 1);

      camera.position.lerpVectors(
        initialCameraPos.current,
        frontViewPos.current,
        easeOut(t)
      );

      currentLookAt.current.lerpVectors(
        initialLookAt.current,
        targetLookAt.current,
        easeOut(t)
      );
      camera.lookAt(currentLookAt.current);

      setProgress((p) => p + 0.003);

      if (t >= 1) {
        setAnimationPhase("opening-door");
        setProgress(0);
        // Start fading immediately when zoom begins
        setIsFading(true);
      }
    }

    if (animationPhase === "opening-door") {
      const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
      const doorTarget = -Math.PI / 2 + Math.PI / 180;

      // Open the door
      if (doorRef.current.rotation.y > doorTarget) {
        doorRef.current.rotation.y = Math.max(
          doorRef.current.rotation.y - 0.006,
          doorTarget
        );
      }

      if (progress < 1) {
        setProgress((p) => Math.min(p + 0.001, 1)); // Slower zoom speed
        const eased = easeOut(progress);
        camera.position.z = 15 - eased * 10;
        camera.lookAt(0, 0, 5);

        // Calculate fade progress - complete by the time camera reaches door position
        // Camera starts at z=15, door is around z=8, so fade completes around z=8
        const cameraZ = camera.position.z;
        const fadeCompleteZ = 8; // Adjust this value to control when fade completes
        const fadeStartZ = 15;

        // Calculate fade progress based on camera Z position
        const fadeAmount = Math.min(
          1,
          Math.max(0, (fadeStartZ - cameraZ) / (fadeStartZ - fadeCompleteZ))
        );
        fadeProgress.current = fadeAmount;

        // Update overlay with current fade progress
        if (overlayEl.current) {
          overlayEl.current.style.opacity = String(fadeProgress.current);
          overlayEl.current.style.pointerEvents = "auto";
        }

        // Navigate as soon as screen is completely black (fadeProgress >= 1)
        if (fadeProgress.current >= 1 && !navigated.current) {
          navigated.current = true;
          router.push("pages/designer");
        }
      }
    }
  });

  const handleDoorClick = () => {
    if (animationPhase === "idle") {
      initialCameraPos.current.copy(camera.position);
      initialLookAt.current.set(0.5, -0.13, 8);
      targetLookAt.current.set(0, 0, 5);
      setAnimationPhase("moving-to-front");
      setProgress(0);
    }
  };

  return (
    <>
      <Lights />

      <Door ref={doorRef} onClick={handleDoorClick} />

      <Room />
    </>
  );
}

// Create/destroy overlay in DOM outside the Canvas since r3f children render to WebGL
// using a side-effect so we can control visual fade independent of the 3D canvas.
function useFadeOverlay(
  overlayElRef: React.MutableRefObject<HTMLDivElement | null>
) {
  useEffect(() => {
    const el = document.createElement("div");
    el.style.position = "fixed";
    el.style.top = "0";
    el.style.left = "0";
    el.style.right = "0";
    el.style.bottom = "0";
    el.style.background = "#000";
    el.style.pointerEvents = "none";
    el.style.opacity = "0";
    el.style.transition = "opacity 0.05s linear"; // Faster transition for immediate response
    el.style.zIndex = "9999";
    document.body.appendChild(el);
    overlayElRef.current = el;

    return () => {
      if (overlayElRef.current && overlayElRef.current.parentElement) {
        overlayElRef.current.parentElement.removeChild(overlayElRef.current);
      }
      overlayElRef.current = null;
    };
  }, [overlayElRef]);
}
