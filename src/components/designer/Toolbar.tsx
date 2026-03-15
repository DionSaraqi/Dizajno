"use client";

import React from "react";
import {
  Pencil,
  MousePointer2,
  Box,
  Undo2,
  Redo2,
  RotateCw,
  Trash2,
  XCircle,
  Grid3X3,
} from "lucide-react";
import {
  useDesignerStore,
  useMode,
  useIs3D,
  useSnap,
  useWallThickness,
  useWallHeight,
  useSelectedIds,
} from "@/store/useDesignerStore";

export default function Toolbar() {
  const mode = useMode();
  const is3D = useIs3D();
  const snap = useSnap();
  const wallThickness = useWallThickness();
  const wallHeight = useWallHeight();
  const selectedIds = useSelectedIds();

  const setMode = useDesignerStore((s) => s.setMode);
  const toggleIs3D = useDesignerStore((s) => s.toggleIs3D);
  const setSnap = useDesignerStore((s) => s.setSnap);
  const setWallThickness = useDesignerStore((s) => s.setWallThickness);
  const setWallHeight = useDesignerStore((s) => s.setWallHeight);
  const rotateFurniture = useDesignerStore((s) => s.rotateFurniture);
  const deleteSelected = useDesignerStore((s) => s.deleteSelected);
  const clearAll = useDesignerStore((s) => s.clearAll);
  const furniture = useDesignerStore((s) => s.furniture);

  const handleUndo = () => {
    useDesignerStore.temporal.getState().undo();
  };

  const handleRedo = () => {
    useDesignerStore.temporal.getState().redo();
  };

  const handleRotateSelected = () => {
    const state = useDesignerStore.getState();
    for (const id of state.selectedIds) {
      const isFurniture = state.furniture.some((f) => f.id === id);
      if (isFurniture) {
        rotateFurniture(id);
      }
    }
  };

  const btnBase =
    "px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5";
  const btnActive = "bg-dizajno-accent text-white";
  const btnInactive =
    "bg-dizajno-elevated text-dizajno-text hover:bg-dizajno-border";

  const hasSelection = selectedIds.length > 0;
  const hasSelectedFurniture =
    hasSelection && selectedIds.some((id) => furniture.some((f) => f.id === id));

  return (
    <div className="h-12 bg-dizajno-surface border-b border-dizajno-border flex items-center px-4 gap-3">
      {/* Mode buttons */}
      <div className="flex gap-0.5 bg-dizajno-bg rounded-lg p-0.5">
        <button
          onClick={() => setMode("draw")}
          className={`${btnBase} ${mode === "draw" ? btnActive : btnInactive}`}
          title="Draw Walls (D)"
        >
          <Pencil size={14} />
          Draw
        </button>
        <button
          onClick={() => setMode("select")}
          className={`${btnBase} ${mode === "select" ? btnActive : btnInactive}`}
          title="Select (V)"
        >
          <MousePointer2 size={14} />
          Select
        </button>
      </div>

      <div className="w-px h-6 bg-dizajno-border" />

      {/* 2D / 3D toggle */}
      <button
        onClick={toggleIs3D}
        className={`${btnBase} ${
          is3D
            ? "bg-dizajno-accent text-white"
            : "bg-dizajno-elevated text-dizajno-text hover:bg-dizajno-border"
        }`}
        title="Toggle 2D/3D View"
      >
        <Box size={14} />
        {is3D ? "3D" : "2D"}
      </button>

      <div className="w-px h-6 bg-dizajno-border" />

      {/* Snap */}
      <button
        onClick={() => setSnap(!snap)}
        className={`${btnBase} ${
          snap
            ? "bg-dizajno-accent/20 text-dizajno-accent border border-dizajno-accent/40"
            : "bg-dizajno-elevated text-dizajno-muted hover:bg-dizajno-border"
        }`}
        title="Toggle Snap to Grid (G)"
      >
        <Grid3X3 size={14} />
        Snap
      </button>

      <div className="w-px h-6 bg-dizajno-border" />

      {/* Wall thickness */}
      <label className="flex items-center gap-1.5 text-xs text-dizajno-muted">
        Thick
        <input
          type="range"
          min="0.05"
          max="0.4"
          step="0.05"
          value={wallThickness}
          onChange={(e) => setWallThickness(parseFloat(e.target.value))}
          className="w-14 h-1 appearance-none bg-dizajno-border rounded-lg cursor-pointer accent-dizajno-accent"
        />
        <span className="text-dizajno-text w-10 text-[11px]">
          {wallThickness.toFixed(2)}m
        </span>
      </label>

      {/* Wall height */}
      <label className="flex items-center gap-1.5 text-xs text-dizajno-muted">
        Height
        <input
          type="range"
          min="1"
          max="4"
          step="0.25"
          value={wallHeight}
          onChange={(e) => setWallHeight(parseFloat(e.target.value))}
          className="w-14 h-1 appearance-none bg-dizajno-border rounded-lg cursor-pointer accent-dizajno-accent"
        />
        <span className="text-dizajno-text w-10 text-[11px]">
          {wallHeight.toFixed(1)}m
        </span>
      </label>

      <div className="w-px h-6 bg-dizajno-border" />

      {/* Undo / Redo */}
      <button
        onClick={handleUndo}
        className={`${btnBase} bg-dizajno-elevated text-dizajno-text hover:bg-dizajno-border`}
        title="Undo (Ctrl+Z)"
      >
        <Undo2 size={14} />
      </button>
      <button
        onClick={handleRedo}
        className={`${btnBase} bg-dizajno-elevated text-dizajno-text hover:bg-dizajno-border`}
        title="Redo (Ctrl+Shift+Z)"
      >
        <Redo2 size={14} />
      </button>

      <div className="flex-1" />

      {/* Selected item actions */}
      {hasSelectedFurniture && (
        <>
          <button
            onClick={handleRotateSelected}
            className={`${btnBase} bg-dizajno-elevated text-dizajno-text hover:bg-dizajno-border`}
            title="Rotate (R)"
          >
            <RotateCw size={14} />
            Rotate
          </button>
          <button
            onClick={deleteSelected}
            className={`${btnBase} bg-dizajno-danger text-white hover:bg-red-500`}
            title="Delete (Del)"
          >
            <Trash2 size={14} />
            Delete
          </button>
        </>
      )}

      {/* Clear all */}
      <button
        onClick={clearAll}
        className={`${btnBase} bg-dizajno-bg text-dizajno-muted hover:bg-red-900/50 hover:text-red-300`}
        title="Clear All"
      >
        <XCircle size={14} />
        Clear
      </button>
    </div>
  );
}
