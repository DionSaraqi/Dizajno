"use client";

import React, { useRef } from "react";
import { OrbitControls, PerspectiveCamera, OrthographicCamera } from "@react-three/drei";
import * as THREE from "three";
import type { DesignerMode } from "@/types/designer";
import { useIsDragging } from "@/store/useDesignerStore";

interface CameraControllerProps {
  is3D: boolean;
  mode: DesignerMode;
}

/** Default orthographic (2D) zoom — the "100%" reference for the status bar readout. */
export const DEFAULT_ORTHO_ZOOM = 35;

/** Initial 3D camera position. Its distance to the orbit target is the "100%" 3D zoom reference. */
export const PERSPECTIVE_START: [number, number, number] = [8, 8, 8];
export const DEFAULT_PERSP_DISTANCE = Math.hypot(...PERSPECTIVE_START);

export default function CameraController({ is3D, mode }: CameraControllerProps) {
  const controlsRef = useRef<any>(null);
  const isDragging = useIsDragging();

  // In draw mode, left-click must NOT be captured by OrbitControls so the
  // mesh pointer events can fire for wall drawing.  In all other 2D modes,
  // left-click drags pan the canvas (convenient and non-destructive).
  // Right-click ALWAYS pans in 2D so the user never has to switch modes to
  // navigate.  Middle-click zooms (dolly) in both 2D and 3D.
  // Draw + Room modes need left-click to reach the canvas meshes (drawing walls
  // / placing room corners), so OrbitControls must NOT capture it — otherwise
  // each click pans (2D) or rotates (3D) the camera.
  const leftFreeForCanvas = mode === "draw" || mode === "room";

  const mouseButtons2D = {
    LEFT: leftFreeForCanvas ? (undefined as any) : THREE.MOUSE.PAN,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN,
  };

  const mouseButtons3D = {
    LEFT: leftFreeForCanvas ? (undefined as any) : THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN,
  };

  return (
    <>
      {is3D ? (
        <PerspectiveCamera makeDefault position={PERSPECTIVE_START} fov={50} />
      ) : (
        <OrthographicCamera
          makeDefault
          position={[0, 50, 0]}
          zoom={DEFAULT_ORTHO_ZOOM}
          near={0.1}
          far={1000}
        />
      )}

      <OrbitControls
        ref={controlsRef}
        makeDefault
        // Disable all controls while dragging/placing furniture
        enabled={!isDragging}
        // ── Rotation ───────────────────────────────────────────────────────
        enableRotate={is3D}
        // Lock the pitch so the camera can't flip through the floor in 3D
        minPolarAngle={is3D ? Math.PI / 8 : 0}
        maxPolarAngle={is3D ? Math.PI / 2.1 : 0}
        // ── Pan ────────────────────────────────────────────────────────────
        enablePan={true}
        // Faster right-click pan in 3D (left-click is ROTATE there, so this only
        // affects right-click). 2D keeps the default so left-click pan is
        // unchanged.
        panSpeed={is3D ? 2 : undefined}
        // ── Zoom / Dolly ───────────────────────────────────────────────────
        enableZoom={true}
        enableDamping={true}
        dampingFactor={0.1}
        // Orthographic zoom limits (2D)
        minZoom={is3D ? undefined : 8}
        maxZoom={is3D ? undefined : 200}
        // Perspective distance limits (3D) — don't clip floor, don't fly too far.
        // minDistance 0.5 lets the user zoom in close (~2800% on the readout).
        minDistance={is3D ? 0.5 : undefined}
        maxDistance={is3D ? 40 : undefined}
        // ── Mouse button mapping ───────────────────────────────────────────
        mouseButtons={is3D ? mouseButtons3D : mouseButtons2D}
        // ── Touch mapping ──────────────────────────────────────────────────
        touches={{
          ONE: is3D ? THREE.TOUCH.ROTATE : THREE.TOUCH.PAN,
          TWO: THREE.TOUCH.DOLLY_PAN,
        }}
      />
    </>
  );
}
