"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import LandingScene from "@/components/landing/three/LandingScene";

/**
 * The 3D house hero. Pointer events stay on so the house can be dragged to rotate and
 * the door clicked. z-[3] keeps it above the blueprint-grid pseudo-elements (z 0/1) and
 * the aurora (z 2) in LandingChrome.
 */
export default function LandingCanvas() {
  return (
    <div className="absolute inset-0 z-[3]">
      <Suspense
        fallback={
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-mono text-[11px] uppercase tracking-label text-dizajno-muted">
              Loading studio…
            </span>
          </div>
        }
      >
        <Canvas
          camera={{ position: [6, 6, 15], fov: 50 }}
          gl={{ alpha: true, antialias: true }}
          dpr={[1, 1.5]}
          style={{ background: "transparent" }}
        >
          <LandingScene />
        </Canvas>
      </Suspense>
    </div>
  );
}
