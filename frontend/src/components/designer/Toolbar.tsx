"use client";

import React, { useState } from "react";
import {
  Undo2,
  Redo2,
  XCircle,
  Grid3X3,
  Box,
  Square,
  ChevronDown,
  Layers,
  Settings,
  Ruler,
} from "lucide-react";
import {
  useDesignerStore,
  useIs3D,
  useSnap,
  useWallThickness,
  useWallHeight,
  useShowDimensions,
} from "@/store/useDesignerStore";
import { Tooltip } from "@/components/ui";

// ── Sub-components ────────────────────────────────────────────────────────────

/** A vertical divider between toolbar groups */
function Divider() {
  return <div className="w-px h-6 bg-dizajno-border mx-1 flex-shrink-0" />;
}

/** Wall controls popover (thickness + height sliders for future walls) */
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
      <Tooltip content="Wall settings — thickness & height for new walls" side="bottom">
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
          <ChevronDown size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </Tooltip>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute top-full left-0 mt-2 z-40 bg-dizajno-surface border border-dizajno-border rounded-lg shadow-xl p-3 w-52">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-dizajno-muted mb-3">
              New wall defaults
            </p>
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
              />
            </div>
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
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Settings popover (gear) — dimension display toggles. */
function SettingsPopover() {
  const [open, setOpen] = useState(false);
  const showDimensions = useShowDimensions();
  const setShowDimensions = useDesignerStore((s) => s.setShowDimensions);

  return (
    <div className="relative">
      <Tooltip content="Display settings" side="bottom">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-haspopup="true"
          className={[
            "w-8 h-8 flex items-center justify-center rounded-md transition-colors",
            open
              ? "bg-dizajno-elevated text-dizajno-text"
              : "text-dizajno-muted hover:text-dizajno-text hover:bg-dizajno-elevated",
          ].join(" ")}
        >
          <Settings size={15} />
        </button>
      </Tooltip>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute top-full right-0 mt-2 z-40 bg-dizajno-surface border border-dizajno-border rounded-lg shadow-xl p-3 w-56">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-dizajno-muted mb-2.5 flex items-center gap-1.5">
              <Ruler size={11} /> Dimensions
            </p>

            {/* Show dimensions toggle */}
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-xs text-dizajno-text">Show wall dimensions</span>
              <input
                type="checkbox"
                checked={showDimensions}
                onChange={(e) => setShowDimensions(e.target.checked)}
                className="accent-dizajno-accent w-4 h-4 cursor-pointer"
              />
            </label>
            <p className="text-[10px] text-dizajno-muted mt-2">
              Hover a wall to see its full length.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Toolbar ──────────────────────────────────────────────────────────────

export default function Toolbar() {
  const is3D = useIs3D();
  const snap = useSnap();
  const wallThickness = useWallThickness();
  const wallHeight = useWallHeight();

  const toggleIs3D = useDesignerStore((s) => s.toggleIs3D);
  const setSnap = useDesignerStore((s) => s.setSnap);
  const setWallThickness = useDesignerStore((s) => s.setWallThickness);
  const setWallHeight = useDesignerStore((s) => s.setWallHeight);
  const clearAll = useDesignerStore((s) => s.clearAll);

  const handleUndo = () => useDesignerStore.temporal.getState().undo();
  const handleRedo = () => useDesignerStore.temporal.getState().redo();

  return (
    <div
      className="relative h-11 bg-dizajno-surface border-b border-dizajno-border flex items-center px-3 gap-1 flex-shrink-0"
      role="toolbar"
      aria-label="Designer toolbar"
    >
      {/* ── Left group ── */}
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

      <Divider />

      <Tooltip content={`${snap ? "Disable" : "Enable"} snap to grid (G)`} side="bottom">
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

      <WallControlsPopover
        wallThickness={wallThickness}
        wallHeight={wallHeight}
        setWallThickness={setWallThickness}
        setWallHeight={setWallHeight}
      />

      {/* ── Centered 2D / 3D pill ── */}
      <div className="absolute left-1/2 -translate-x-1/2">
        <div
          className="flex gap-0.5 bg-dizajno-bg rounded-full p-0.5 border border-dizajno-border"
          role="group"
          aria-label="View mode"
        >
          {[
            { is3d: false, label: "2D", icon: <Square size={13} /> },
            { is3d: true, label: "3D", icon: <Box size={13} /> },
          ].map((v) => {
            const active = is3D === v.is3d;
            return (
              <button
                key={v.label}
                type="button"
                onClick={() => {
                  if (is3D !== v.is3d) toggleIs3D();
                }}
                aria-pressed={active}
                className={[
                  "flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold transition-all duration-150",
                  active
                    ? "bg-dizajno-accent text-white shadow-sm"
                    : "text-dizajno-muted hover:text-dizajno-text",
                ].join(" ")}
              >
                {v.icon}
                <span>{v.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Right group ── */}
      <div className="ml-auto flex items-center gap-1">
        <SettingsPopover />
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
    </div>
  );
}
