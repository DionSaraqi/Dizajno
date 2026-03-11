"use client";

import React from "react";
import { DesignerProvider } from "@/components/designer/DesignerProvider";
import Sidebar from "@/components/designer/Sidebar";
import Toolbar from "@/components/designer/Toolbar";
import DrawingSurface from "@/components/three/DrawingSurface";

export default function DesignerPage() {
  return (
    <DesignerProvider>
      <div className="w-full h-screen flex flex-col bg-gray-900 overflow-hidden">
        {/* Top toolbar */}
        <Toolbar />

        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar - furniture menu */}
          <Sidebar />

          {/* 3D Canvas area */}
          <div className="flex-1 relative">
            <DrawingSurface />
          </div>
        </div>
      </div>
    </DesignerProvider>
  );
}
