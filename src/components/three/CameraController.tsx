"use client";

import React, { useRef } from "react";
import { OrbitControls, PerspectiveCamera, OrthographicCamera } from "@react-three/drei";
import * as THREE from "three";

interface CameraControllerProps {
  is3D: boolean;
  drawingMode: boolean;
}

export default function CameraController({ is3D, drawingMode }: CameraControllerProps) {
  const controlsRef = useRef<any>(null);

  return (
    <>
      {is3D ? (
        <PerspectiveCamera makeDefault position={[8, 8, 8]} fov={50} />
      ) : (
        <OrthographicCamera
          makeDefault
          position={[0, 50, 0]}
          zoom={35}
          near={0.1}
          far={1000}
        />
      )}

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableRotate={is3D}
        enablePan={true}
        enableDamping={true}
        dampingFactor={0.1}
        minPolarAngle={0.1}
        maxPolarAngle={Math.PI / 2.2}
        minZoom={10}
        maxZoom={120}
        minDistance={3}
        maxDistance={30}
        mouseButtons={
          is3D
            ? {
                LEFT: THREE.MOUSE.ROTATE,
                MIDDLE: THREE.MOUSE.DOLLY,
                RIGHT: THREE.MOUSE.PAN,
              }
            : {
                LEFT: drawingMode ? (undefined as any) : THREE.MOUSE.PAN,
                MIDDLE: THREE.MOUSE.PAN,
                RIGHT: THREE.MOUSE.PAN,
              }
        }
        touches={{
          ONE: is3D ? THREE.TOUCH.ROTATE : THREE.TOUCH.PAN,
          TWO: THREE.TOUCH.DOLLY_PAN,
        }}
      />
    </>
  );
}
