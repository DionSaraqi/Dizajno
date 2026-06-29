"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { Group, Vector3 } from "three";
import { useRef, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Door from "./Door";
import Room from "./Room";
import Lights from "./Lights";
import { tickSketchMaterials } from "./SketchMaterial";

// Approximate center of the house model (used as pivot for rotation)
const HOUSE_CENTER: [number, number, number] = [0, 0, 5];

export default function LandingScene() {
  const doorRef = useRef<Group>(null!);
  const houseGroupRef = useRef<Group>(null!);
  // Parent wrapper (pivoted at HOUSE_CENTER) for gentle pointer parallax — kept above the
  // drag-rotated house so the user's manual Y-spin is preserved.
  const parallaxRef = useRef<Group>(null!);
  const { camera } = useThree();

  // Honour prefers-reduced-motion: zero out the boiling-line + parallax for those users.
  const reducedMotion = useRef(false);
  useEffect(() => {
    reducedMotion.current =
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    camera.lookAt(0.5, -0.13, 8);
  }, [camera]);

  const [animationPhase, setAnimationPhase] = useState<
    "idle" | "returning" | "moving-to-front" | "opening-door"
  >("idle");
  const isAnimating = animationPhase !== "idle";
  // Per-frame animation progress lives in a ref — advancing it must NOT re-render the
  // whole house subtree (~150 meshes) every frame during the door click-through.
  const progress = useRef(0);
  const initialCameraPos = useRef(new Vector3(6, 6, 15));
  const frontViewPos = useRef(new Vector3(0, 0, 15));

  const initialLookAt = useRef(new Vector3(0.5, -0.13, 8));
  const targetLookAt = useRef(new Vector3(0, 0, 5));
  const currentLookAt = useRef(new Vector3());

  // House rotation via pointer drag (Y-axis only)
  const isDragging = useRef(false);
  const lastPointerX = useRef(0);
  const houseRotation = useRef(0);
  const returnFromRotation = useRef(0);

  // fade overlay state
  const fadeProgress = useRef(0);
  const overlayEl = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const navigated = useRef(false);

  // ensure overlay DOM element exists
  useFadeOverlay(overlayEl);

  // Pointer handlers for house rotation
  const handlePointerDown = useCallback((e: any) => {
    if (isAnimating) return;
    isDragging.current = true;
    lastPointerX.current = e.clientX ?? e.pageX ?? 0;
  }, [isAnimating]);

  const handlePointerMove = useCallback((e: any) => {
    if (!isDragging.current || isAnimating) return;
    const x = e.clientX ?? e.pageX ?? 0;
    const delta = (x - lastPointerX.current) * 0.005;
    houseRotation.current += delta;
    lastPointerX.current = x;
    if (houseGroupRef.current) {
      houseGroupRef.current.rotation.y = houseRotation.current;
    }
  }, [isAnimating]);

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  // Attach/detach window listeners for drag (so dragging works even outside canvas)
  useEffect(() => {
    const onMove = (e: PointerEvent) => handlePointerMove(e);
    const onUp = () => handlePointerUp();
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  useFrame((state, delta) => {
    // Drive the boiling-line clock across every SketchMaterial in one place (frozen for
    // reduced-motion users so the linework sits still).
    tickSketchMaterials(reducedMotion.current ? 0 : state.clock.elapsedTime);

    // Gentle pointer parallax — a few degrees of tilt that eases toward the cursor, off
    // while the camera is flying in or under reduced motion.
    if (parallaxRef.current) {
      const idle = !isAnimating && !reducedMotion.current;
      const targetX = idle ? -state.pointer.y * 0.05 : 0;
      const targetY = idle ? state.pointer.x * 0.06 : 0;
      const k = 1 - Math.exp(-4 * Math.min(delta, 0.1));
      parallaxRef.current.rotation.x += (targetX - parallaxRef.current.rotation.x) * k;
      parallaxRef.current.rotation.y += (targetY - parallaxRef.current.rotation.y) * k;
    }

    // Smoothly return house rotation to 0 before starting the door animation
    if (animationPhase === "returning") {
      const easeInOut = (t: number) => t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const t = Math.min(progress.current, 1);
      const eased = easeInOut(t);

      // Lerp house rotation back to 0
      const currentRot = returnFromRotation.current * (1 - eased);
      houseRotation.current = currentRot;
      if (houseGroupRef.current) {
        houseGroupRef.current.rotation.y = currentRot;
      }

      progress.current += 0.018;

      if (t >= 1) {
        houseRotation.current = 0;
        if (houseGroupRef.current) {
          houseGroupRef.current.rotation.y = 0;
        }
        initialCameraPos.current.copy(camera.position);
        setAnimationPhase("moving-to-front");
        progress.current = 0;
      }
      return;
    }

    if (animationPhase === "moving-to-front") {
      const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
      const t = Math.min(progress.current * 2, 1);

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

      progress.current += 0.009;

      if (t >= 1) {
        setAnimationPhase("opening-door");
        progress.current = 0;
      }
    }

    if (animationPhase === "opening-door") {
      const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
      const doorTarget = -Math.PI / 2 + Math.PI / 180;

      // Open the door
      if (doorRef.current.rotation.y > doorTarget) {
        doorRef.current.rotation.y = Math.max(
          doorRef.current.rotation.y - 0.018,
          doorTarget
        );
      }

      if (progress.current < 1) {
        progress.current = Math.min(progress.current + 0.003, 1);
        const eased = easeOut(progress.current);
        camera.position.z = 15 - eased * 10;
        camera.lookAt(0, 0, 5);

        const cameraZ = camera.position.z;
        const fadeCompleteZ = 8;
        const fadeStartZ = 15;

        const fadeAmount = Math.min(
          1,
          Math.max(0, (fadeStartZ - cameraZ) / (fadeStartZ - fadeCompleteZ))
        );
        fadeProgress.current = fadeAmount;

        if (overlayEl.current) {
          overlayEl.current.style.opacity = String(fadeProgress.current);
          overlayEl.current.style.pointerEvents = "auto";
        }

        if (fadeProgress.current >= 1 && !navigated.current) {
          navigated.current = true;
          router.push("/designer");
        }
      }
    }
  });

  const handleDoorClick = () => {
    if (animationPhase === "idle") {
      // Capture current rotation to animate back from
      returnFromRotation.current = houseRotation.current;
      isDragging.current = false;
      initialLookAt.current.set(0.5, -0.13, 8);
      targetLookAt.current.set(0, 0, 5);
      setAnimationPhase("returning");
      progress.current = 0;
    }
  };

  return (
    <>
      <Lights />

      {/* Parallax wrapper — pivots at HOUSE_CENTER, tilts a few degrees toward the cursor */}
      <group ref={parallaxRef} position={HOUSE_CENTER}>
        <group position={[-HOUSE_CENTER[0], -HOUSE_CENTER[1], -HOUSE_CENTER[2]]}>
          {/* Rotatable house group — pivots around HOUSE_CENTER on Y axis only */}
          <group
            ref={houseGroupRef}
            position={HOUSE_CENTER}
            onPointerDown={handlePointerDown}
          >
            <group position={[-HOUSE_CENTER[0], -HOUSE_CENTER[1], -HOUSE_CENTER[2]]}>
              <Door ref={doorRef} onClick={handleDoorClick} />
              <Room />
            </group>
          </group>
        </group>
      </group>
    </>
  );
}

// Create/destroy overlay in DOM outside the Canvas since r3f children render to WebGL
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
    el.style.transition = "opacity 0.05s linear";
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
