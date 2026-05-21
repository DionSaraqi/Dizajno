"use client";

import React from "react";
import { useWalls, useFurniture, useMode } from "@/store/useDesignerStore";

export default function StatusBar() {
  const walls = useWalls();
  const furniture = useFurniture();
  const mode = useMode();

  return (
    <div className="h-6 flex items-center px-3 gap-4 bg-dizajno-surface border-t border-dizajno-border text-xs text-dizajno-muted font-mono select-none shrink-0">
      <span>Cursor: 0.00, 0.00</span>
      <span>Zoom: 100%</span>
      <span>Walls: {walls.length}</span>
      <span>Furniture: {furniture.length}</span>
      <span className="ml-auto">
        {mode === "draw" && "Draw Mode"}
        {mode === "select" && "Select Mode"}
        {mode === "furniture" && "Furniture Mode"}
      </span>
    </div>
  );
}
