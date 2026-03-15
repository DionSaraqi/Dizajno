"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import Scene from "@/components/three/Scene";

export default function HomePage() {
  const router = useRouter();

  // Prefetch the designer route on mount
  useEffect(() => {
    router.prefetch("/designer");
  }, [router]);

  return (
    <main className="relative h-screen w-screen m-0 p-0 overflow-hidden blueprint-grid">
      {/* 3D Canvas */}
      <div className="absolute inset-0">
        <Suspense
          fallback={
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-dizajno-muted font-mono text-sm tracking-wider">
                Loading...
              </div>
            </div>
          }
        >
          <Canvas
            camera={{ position: [6, 6, 15], fov: 50 }}
            gl={{ alpha: true, antialias: true }}
            dpr={[1, 1.5]}
            style={{ background: "transparent" }}
          >
            <Scene />
          </Canvas>
        </Suspense>
      </div>

      {/* Top-left: Logo + tagline */}
      <div className="absolute top-8 left-8 z-10 pointer-events-none select-none">
        <h1 className="font-mono text-3xl font-bold tracking-[0.2em] text-dizajno-text">
          DIZAJNO
        </h1>
        <p className="font-mono text-xs tracking-wider text-dizajno-muted mt-1">
          browser-based room designer
        </p>
      </div>

      {/* Bottom center: hint text */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 pointer-events-none select-none">
        <p className="font-mono text-sm text-dizajno-muted tracking-wider opacity-70">
          Click the door to start designing
        </p>
      </div>

      {/* Version */}
      <div className="absolute top-8 right-8 z-10 pointer-events-none select-none">
        <p className="font-mono text-[10px] text-dizajno-muted opacity-40 tracking-widest">
          v1.0
        </p>
      </div>
    </main>
  );
}
