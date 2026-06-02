"use client";

import React from "react";
import dynamic from "next/dynamic";
import { DesignerProvider } from "@/components/designer/DesignerProvider";
import Sidebar from "@/components/designer/Sidebar";
import Toolbar from "@/components/designer/Toolbar";
import StatusBar from "@/components/designer/StatusBar";
import SelectionBar from "@/components/designer/SelectionBar";
import CanvasDropZone from "@/components/designer/CanvasDropZone";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

const DrawingSurface = dynamic(
  () => import("@/components/three/DrawingSurface"),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center bg-dizajno-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-dizajno-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-dizajno-muted font-mono">
            Loading canvas...
          </span>
        </div>
      </div>
    ),
  }
);

export default function DesignerPage() {
  useKeyboardShortcuts();

  return (
    <DesignerProvider>
      <div className="w-full h-screen flex flex-col bg-dizajno-bg overflow-hidden">
        <Toolbar />
        <div className="flex flex-1 overflow-hidden relative">
          <Sidebar />
          <CanvasDropZone>
            <DrawingSurface />
          </CanvasDropZone>
          {/* Planner5D-style bottom editor for the selected entity */}
          <SelectionBar />
        </div>
        <StatusBar />
      </div>
    </DesignerProvider>
  );
}
