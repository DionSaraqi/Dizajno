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

    // Update drag preview position so the 3D scene can show a ghost
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    useDesignerStore.getState().setDragPreview({ ndcX, ndcY });
  }, []);

  const handleDragLeave = useCallback(() => {
    useDesignerStore.getState().setDragPreview(null);
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

    // Clear drag preview and store the pending drop
    const state = useDesignerStore.getState();
    state.setDragPreview(null);
    state.setPendingDrop({
      type: furnitureType,
      ndcX,
      ndcY,
    });
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative flex-1 h-full"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}
    </div>
  );
}
