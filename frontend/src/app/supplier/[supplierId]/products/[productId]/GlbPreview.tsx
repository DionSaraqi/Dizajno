"use client";

/**
 * Mini 3D preview for the variant editor: renders the GLB through the exact
 * same component the designer uses (GLTFModel — uniform scale into the typed
 * width/height/depth box, centered, grounded) plus a wireframe of that box.
 * Gaps between model and wireframe are the dead-space hitbox the supplier
 * should fix by applying the measured dimensions.
 *
 * Import with next/dynamic({ ssr: false }) — R3F needs the browser.
 */

import { Suspense, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import GLTFModel from "@/components/three/furniture/GLTFModel";
import {
  ModelErrorBoundary,
  FallbackBox,
} from "@/components/three/furniture/ModelErrorBoundary";

interface GlbPreviewProps {
  url: string;
  width: number;
  depth: number;
  height: number;
}

export default function GlbPreview({ url, width, depth, height }: GlbPreviewProps) {
  // Revoking a blob URL doesn't free drei's useGLTF cache (parsed scene graph,
  // decoded textures) — evict the entry when the preview swaps models or
  // unmounts, or every analyze→re-upload iteration leaks the previous model.
  useEffect(() => {
    return () => {
      useGLTF.clear(url);
    };
  }, [url]);

  const maxDim = Math.max(width, depth, height, 0.5);
  return (
    <div className="h-72 rounded-lg border border-dizajno-border bg-dizajno-bg/60 overflow-hidden">
      <Canvas camera={{ position: [maxDim * 1.7, maxDim * 1.3, maxDim * 1.7], fov: 42 }}>
        <ambientLight intensity={0.75} />
        <directionalLight position={[4, 8, 4]} intensity={1.1} />
        <ModelErrorBoundary
          resetKey={url}
          fallback={<FallbackBox width={width} depth={depth} height={height} color="#999999" />}
        >
          <Suspense fallback={null}>
            <GLTFModel url={url} width={width} depth={depth} height={height} />
          </Suspense>
        </ModelErrorBoundary>
        {/* The exact box the designer uses for selection + collision */}
        <mesh position={[0, height / 2, 0]}>
          <boxGeometry args={[width, height, depth]} />
          <meshBasicMaterial wireframe color="#818cf8" transparent opacity={0.55} depthWrite={false} />
        </mesh>
        <gridHelper args={[Math.max(4, maxDim * 3), 24, "#555555", "#333333"]} />
        <OrbitControls makeDefault target={[0, height / 2, 0]} enablePan={false} />
      </Canvas>
    </div>
  );
}
