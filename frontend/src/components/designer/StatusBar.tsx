"use client";

import React from "react";
import { useWalls, useFurniture, useMode, useCursor, useZoom } from "@/store/useDesignerStore";

export default function StatusBar() {
  const walls = useWalls();
  const furniture = useFurniture();
  const mode = useMode();
  const cursor = useCursor();
  const zoom = useZoom();

  const cursorLabel = cursor
    ? `${cursor[0].toFixed(2)}, ${cursor[1].toFixed(2)}`
    : "—, —";

  return (
    <div className="h-6 flex items-center px-3 gap-4 bg-dizajno-surface border-t border-dizajno-border text-xs text-dizajno-muted font-mono select-none shrink-0">
      <span>Cursor: {cursorLabel}</span>
      <span>Zoom: {zoom}%</span>
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
