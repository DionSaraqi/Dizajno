"use client";

import React, { useCallback, useRef, DragEvent } from "react";
import { useDesignerStore } from "@/store/useDesignerStore";

interface CanvasDropZoneProps {
  children: React.ReactNode;
}

/**
 * Invisible HTML overlay that captures HTML5 drag-and-drop events
 * over the Three.js Canvas area. On drop, it calculates a normalized
 * position and writes it to the Zustand store as a pendingDrop, which
 * the 3D scene then picks up and converts to world coordinates.
 */
export default function CanvasDropZone({ children }: CanvasDropZoneProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();

    const furnitureType = e.dataTransfer.getData("application/x-furniture-type");
    if (!furnitureType) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Normalized device coordinates relative to the canvas area
    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    // Store the pending drop for the 3D scene to pick up
    useDesignerStore.getState().setPendingDrop({
      type: furnitureType,
      ndcX,
      ndcY,
    });
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}
    </div>
  );
}
