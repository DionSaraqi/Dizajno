"use client";

import { Canvas } from "@react-three/fiber";
import Scene from "../components/three/Scene";

export default function HomePage() {
  return (
    <main className="h-screen w-screen m-0 p-0 overflow-hidden bg-gray-900">
      <Canvas camera={{ position: [6, 6, 15], fov: 50 }}>
        <Scene />
      </Canvas>
    </main>
  );
}
