"use client";

import React, { useState } from "react";
import {
  Pencil,
  MousePointer2,
  Sofa,
  Undo2,
  Redo2,
  RotateCw,
  Trash2,
  XCircle,
  Grid3X3,
  Box,
  Square,
  ChevronDown,
  Layers,
  DoorOpen,
  AppWindow,
} from "lucide-react";
import {
  useDesignerStore,
  useMode,
  useIs3D,
  useSnap,
  useWallThickness,
  useWallHeight,
  useSelectedIds,
  usePendingOpeningType,
} from "@/store/useDesignerStore";
import { Tooltip } from "@/components/ui";

// ── Sub-components ────────────────────────────────────────────────────────────

/** A vertical divider between toolbar groups */
function Divider() {
  return <div className="w-px h-6 bg-dizajno-border mx-1 flex-shrink-0" />;
}

/** Wall controls popover (thickness + height sliders) */
function WallControlsPopover({
  wallThickness,
  wallHeight,
  setWallThickness,
  setWallHeight,
}: {
  wallThickness: number;
  wallHeight: number;
  setWallThickness: (v: number) => void;
  setWallHeight: (v: number) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <Tooltip content="Wall settings — thickness & height" side="bottom">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={[
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
            open
              ? "bg-dizajno-elevated border border-dizajno-accent/40 text-dizajno-text"
              : "bg-dizajno-elevated text-dizajno-muted hover:text-dizajno-text hover:bg-dizajno-border",
          ].join(" ")}
          aria-expanded={open}
          aria-haspopup="true"
        >
          <Layers size={13} />
          <span>Walls</span>
          <ChevronDown
            size={11}
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      </Tooltip>

      {open && (
        <>
          {/* Click-outside overlay */}
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          {/* Popover */}
          <div className="absolute top-full left-0 mt-2 z-40 bg-dizajno-surface border border-dizajno-border rounded-lg shadow-xl p-3 w-52">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-dizajno-muted mb-3">
              Wall Properties
            </p>

            {/* Thickness */}
            <div className="space-y-1.5 mb-3">
              <div className="flex items-center justify-between">
                <label className="text-xs text-dizajno-muted">Thickness</label>
                <span className="text-xs text-dizajno-text font-mono tabular-nums">
                  {wallThickness.toFixed(2)}m
                </span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.4"
                step="0.05"
                value={wallThickness}
                onChange={(e) => setWallThickness(parseFloat(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-dizajno-accent"
                aria-label="Wall thickness"
                style={{
                  background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${
                    ((wallThickness - 0.05) / (0.4 - 0.05)) * 100
                  }%, #2e2e3a ${
                    ((wallThickness - 0.05) / (0.4 - 0.05)) * 100
                  }%, #2e2e3a 100%)`,
                }}
              />
              <div className="flex justify-between text-[9px] text-dizajno-muted">
                <span>0.05m</span>
                <span>0.40m</span>
              </div>
            </div>

            {/* Height */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs text-dizajno-muted">Height</label>
                <span className="text-xs text-dizajno-text font-mono tabular-nums">
                  {wallHeight.toFixed(2)}m
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="4"
                step="0.25"
                value={wallHeight}
                onChange={(e) => setWallHeight(parseFloat(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-dizajno-accent"
                aria-label="Wall height"
                style={{
                  background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${
                    ((wallHeight - 1) / (4 - 1)) * 100
                  }%, #2e2e3a ${
                    ((wallHeight - 1) / (4 - 1)) * 100
                  }%, #2e2e3a 100%)`,
                }}
              />
              <div className="flex justify-between text-[9px] text-dizajno-muted">
                <span>1.0m</span>
                <span>4.0m</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Toolbar ──────────────────────────────────────────────────────────────

export default function Toolbar() {
  const mode = useMode();
  const is3D = useIs3D();
  const snap = useSnap();
  const wallThickness = useWallThickness();
  const wallHeight = useWallHeight();
  const selectedIds = useSelectedIds();
  const pendingOpeningType = usePendingOpeningType();

  const setMode = useDesignerStore((s) => s.setMode);
  const setPendingOpeningType = useDesignerStore((s) => s.setPendingOpeningType);
  const toggleIs3D = useDesignerStore((s) => s.toggleIs3D);
  const setSnap = useDesignerStore((s) => s.setSnap);
  const setWallThickness = useDesignerStore((s) => s.setWallThickness);
  const setWallHeight = useDesignerStore((s) => s.setWallHeight);
  const rotateFurniture = useDesignerStore((s) => s.rotateFurniture);
  const deleteSelected = useDesignerStore((s) => s.deleteSelected);
  const clearAll = useDesignerStore((s) => s.clearAll);
  const furniture = useDesignerStore((s) => s.furniture);

  const handleUndo = () => useDesignerStore.temporal.getState().undo();
  const handleRedo = () => useDesignerStore.temporal.getState().redo();

  const handleRotateSelected = () => {
    const state = useDesignerStore.getState();
    for (const id of state.selectedIds) {
      if (state.furniture.some((f) => f.id === id)) {
        rotateFurniture(id);
      }
    }
  };

  const hasSelection = selectedIds.length > 0;
  const hasSelectedFurniture =
    hasSelection && selectedIds.some((id) => furniture.some((f) => f.id === id));

  // Mode button helper
  type ModeConfig = {
    id: "draw" | "select" | "furniture";
    icon: React.ReactNode;
    label: string;
    tooltip: string;
    shortcut: string;
  };

  const modes: ModeConfig[] = [
    {
      id: "draw",
      icon: <Pencil size={14} />,
      label: "Draw",
      tooltip: "Draw Walls",
      shortcut: "D",
    },
    {
      id: "select",
      icon: <MousePointer2 size={14} />,
      label: "Select",
      tooltip: "Select Objects",
      shortcut: "V",
    },
    {
      id: "furniture",
      icon: <Sofa size={14} />,
      label: "Place",
      tooltip: "Place Furniture",
      shortcut: "F",
    },
  ];

  return (
    <div
      className="h-11 bg-dizajno-surface border-b border-dizajno-border flex items-center px-3 gap-1 flex-shrink-0"
      role="toolbar"
      aria-label="Designer toolbar"
    >
      {/* ── Mode switcher ── */}
      <div
        className="flex gap-0.5 bg-dizajno-bg rounded-lg p-0.5 border border-dizajno-border"
        role="group"
        aria-label="Drawing mode"
      >
        {modes.map((m) => (
          <Tooltip
            key={m.id}
            content={`${m.tooltip} (${m.shortcut})`}
            side="bottom"
          >
            <button
              type="button"
              onClick={() => setMode(m.id)}
              aria-pressed={mode === m.id}
              className={[
                "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150",
                mode === m.id
                  ? "bg-dizajno-accent text-white shadow-sm"
                  : "text-dizajno-muted hover:text-dizajno-text hover:bg-dizajno-elevated",
              ].join(" ")}
            >
              {m.icon}
              <span>{m.label}</span>
            </button>
          </Tooltip>
        ))}
      </div>

      <Divider />

      {/* ── 2D / 3D toggle ── */}
      <Tooltip content={`Switch to ${is3D ? "2D" : "3D"} view`} side="bottom">
        <button
          type="button"
          onClick={toggleIs3D}
          aria-pressed={is3D}
          className={[
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all duration-150 border",
            is3D
              ? "bg-dizajno-accent text-white border-dizajno-accent shadow-sm"
              : "bg-dizajno-elevated text-dizajno-text border-dizajno-border hover:border-dizajno-accent/50",
          ].join(" ")}
        >
          {is3D ? <Box size={14} /> : <Square size={14} />}
          <span>{is3D ? "3D" : "2D"}</span>
        </button>
      </Tooltip>

      <Divider />

      {/* ── Snap to grid ── */}
      <Tooltip
        content={`${snap ? "Disable" : "Enable"} snap to grid (G)`}
        side="bottom"
      >
        <button
          type="button"
          onClick={() => setSnap(!snap)}
          aria-pressed={snap}
          className={[
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-150 border",
            snap
              ? "bg-dizajno-accent/10 text-dizajno-accent border-dizajno-accent/40"
              : "bg-dizajno-elevated text-dizajno-muted border-dizajno-border hover:text-dizajno-text hover:border-dizajno-accent/30",
          ].join(" ")}
        >
          <Grid3X3 size={13} />
          <span>Snap</span>
        </button>
      </Tooltip>

      <Divider />

      {/* ── Wall controls ── */}
      <WallControlsPopover
        wallThickness={wallThickness}
        wallHeight={wallHeight}
        setWallThickness={setWallThickness}
        setWallHeight={setWallHeight}
      />

      <Divider />

      {/* ── Openings (door / window) ── */}
      <div
        className="flex gap-0.5 bg-dizajno-bg rounded-lg p-0.5 border border-dizajno-border"
        role="group"
        aria-label="Opening tools"
      >
        <Tooltip content="Place Door (click on a wall)" side="bottom">
          <button
            type="button"
            onClick={() =>
              mode === "opening" && pendingOpeningType === "door"
                ? setMode("select")
                : setPendingOpeningType("door")
            }
            aria-pressed={mode === "opening" && pendingOpeningType === "door"}
            className={[
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150",
              mode === "opening" && pendingOpeningType === "door"
                ? "bg-dizajno-accent text-white shadow-sm"
                : "text-dizajno-muted hover:text-dizajno-text hover:bg-dizajno-elevated",
            ].join(" ")}
          >
            <DoorOpen size={14} />
            <span>Door</span>
          </button>
        </Tooltip>
        <Tooltip content="Place Window (click on a wall)" side="bottom">
          <button
            type="button"
            onClick={() =>
              mode === "opening" && pendingOpeningType === "window"
                ? setMode("select")
                : setPendingOpeningType("window")
            }
            aria-pressed={mode === "opening" && pendingOpeningType === "window"}
            className={[
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150",
              mode === "opening" && pendingOpeningType === "window"
                ? "bg-dizajno-accent text-white shadow-sm"
                : "text-dizajno-muted hover:text-dizajno-text hover:bg-dizajno-elevated",
            ].join(" ")}
          >
            <AppWindow size={14} />
            <span>Window</span>
          </button>
        </Tooltip>
      </div>

      <Divider />

      {/* ── Undo / Redo ── */}
      <div className="flex gap-0.5">
        <Tooltip content="Undo (Ctrl+Z)" side="bottom">
          <button
            type="button"
            onClick={handleUndo}
            className="w-8 h-8 flex items-center justify-center rounded-md text-dizajno-muted hover:text-dizajno-text hover:bg-dizajno-elevated transition-colors"
            aria-label="Undo"
          >
            <Undo2 size={15} />
          </button>
        </Tooltip>
        <Tooltip content="Redo (Ctrl+Shift+Z)" side="bottom">
          <button
            type="button"
            onClick={handleRedo}
            className="w-8 h-8 flex items-center justify-center rounded-md text-dizajno-muted hover:text-dizajno-text hover:bg-dizajno-elevated transition-colors"
            aria-label="Redo"
          >
            <Redo2 size={15} />
          </button>
        </Tooltip>
      </div>

      {/* ── Spacer ── */}
      <div className="flex-1" />

      {/* ── Selection-dependent actions ── */}
      {hasSelectedFurniture && (
        <>
          <Tooltip content="Rotate 90° (R)" side="bottom">
            <button
              type="button"
              onClick={handleRotateSelected}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-dizajno-elevated text-dizajno-text hover:bg-dizajno-border border border-dizajno-border transition-colors"
              aria-label="Rotate selected furniture"
            >
              <RotateCw size={13} />
              Rotate
            </button>
          </Tooltip>

          <Tooltip content="Delete selected (Del)" side="bottom">
            <button
              type="button"
              onClick={deleteSelected}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-red-900/30 text-red-400 hover:bg-red-900/50 hover:text-red-300 border border-red-900/40 transition-colors"
              aria-label="Delete selected"
            >
              <Trash2 size={13} />
              Delete
            </button>
          </Tooltip>

          <Divider />
        </>
      )}

      {/* ── Clear all ── */}
      <Tooltip content="Clear all walls and furniture" side="bottom">
        <button
          type="button"
          onClick={clearAll}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-dizajno-muted hover:text-red-400 hover:bg-red-900/20 border border-transparent hover:border-red-900/30 transition-colors"
          aria-label="Clear all"
        >
          <XCircle size={13} />
          Clear
        </button>
      </Tooltip>
    </div>
  );
}
