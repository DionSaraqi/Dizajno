"use client";
import dynamic from "next/dynamic";
import React from "react";
import DrawingSurface from "@/components/three/DrawingSurface";
// Dynamically import the 3D drawing surface to disable SSR
// const DrawingSurface = dynamic(
//   () => import("@/components/three/DrawingSurface"),
//   {
//     ssr: false,
//   }
// );

export default function DesignerPage() {
  return (
    <div className="w-full h-screen bg-gray-100">
      <DrawingSurface />
    </div>
  );
}
