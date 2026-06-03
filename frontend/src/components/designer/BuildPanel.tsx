"use client";

/**
 * BuildPanel — the "Build" floating panel: drawing walls, placing openings, and
 * the Room tool. The Room tool creates a room from its USABLE footprint (walls
 * build outward), so a 5×5 you type is 25 m² usable. Two paths: a rectangle you
 * type exact dimensions for (and can resize later), or a custom polygon you draw.
 * Planner5D's Smart Wizard / Forms have no backing logic, so they stay disabled.
 */

import React, { useState } from "react";
import {
  Pencil,
  DoorOpen,
  AppWindow,
  Square,
  Wand2,
  Shapes,
  ChevronLeft,
  Plus,
  PenTool,
} from "lucide-react";
import {
  useDesignerStore,
  useMode,
  usePendingOpeningType,
} from "@/store/useDesignerStore";

function Tile({
  icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={disabled ? "Coming soon" : label}
      className={[
        "flex flex-col items-center justify-center gap-2 aspect-square rounded-xl border text-xs font-medium transition-colors",
        disabled
          ? "border-dizajno-border bg-dizajno-bg text-dizajno-muted/50 cursor-not-allowed"
          : active
          ? "border-dizajno-accent bg-dizajno-accent/10 text-dizajno-accent"
          : "border-dizajno-border bg-dizajno-bg text-dizajno-text hover:border-dizajno-accent/50 hover:bg-dizajno-elevated",
      ].join(" ")}
    >
      {icon}
      <span>{label}</span>
      {disabled && <span className="text-[9px] uppercase tracking-wider">Soon</span>}
    </button>
  );
}

// ── Rooms sub-view ────────────────────────────────────────────────────────────
function RoomsView({ onBack }: { onBack: () => void }) {
  const mode = useMode();
  const setMode = useDesignerStore((s) => s.setMode);
  const addRectRoom = useDesignerStore((s) => s.addRectRoom);
  const [width, setWidth] = useState("4");
  const [length, setLength] = useState("3");

  const w = Math.max(0.5, parseFloat(width) || 0);
  const l = Math.max(0.5, parseFloat(length) || 0);

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-xs font-medium text-dizajno-muted hover:text-dizajno-text transition-colors"
      >
        <ChevronLeft size={14} /> Build
      </button>

      {/* Rectangle room — exact usable size */}
      <div className="space-y-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-dizajno-muted">
          Rectangle room
        </h3>
        <p className="text-[11px] text-dizajno-muted">Usable inner size — walls build outward.</p>
        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] text-dizajno-muted">Width</span>
            <div className="flex items-center gap-1 bg-dizajno-bg border border-dizajno-border rounded px-2 py-1 focus-within:border-dizajno-accent">
              <input
                type="number"
                inputMode="decimal"
                min={0.5}
                step={0.1}
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                className="w-12 bg-transparent text-xs text-dizajno-text font-mono focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-[10px] text-dizajno-muted">m</span>
            </div>
          </label>
          <span className="text-dizajno-muted pb-1.5">×</span>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] text-dizajno-muted">Length</span>
            <div className="flex items-center gap-1 bg-dizajno-bg border border-dizajno-border rounded px-2 py-1 focus-within:border-dizajno-accent">
              <input
                type="number"
                inputMode="decimal"
                min={0.5}
                step={0.1}
                value={length}
                onChange={(e) => setLength(e.target.value)}
                className="w-12 bg-transparent text-xs text-dizajno-text font-mono focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-[10px] text-dizajno-muted">m</span>
            </div>
          </label>
        </div>
        <p className="text-[10px] text-dizajno-muted">
          = <span className="text-dizajno-text font-mono">{(w * l).toFixed(2)} m²</span> usable
        </p>
        <button
          type="button"
          onClick={() => addRectRoom(w, l)}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium bg-dizajno-accent text-white hover:bg-dizajno-accent/90 transition-colors"
        >
          <Plus size={13} /> Add room
        </button>
      </div>

      {/* Custom polygon room */}
      <div className="space-y-2 border-t border-dizajno-border pt-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-dizajno-muted">
          Custom shape
        </h3>
        <button
          type="button"
          onClick={() => setMode(mode === "room" ? "select" : "room")}
          className={[
            "w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border transition-colors",
            mode === "room"
              ? "border-dizajno-accent bg-dizajno-accent/10 text-dizajno-accent"
              : "border-dizajno-border bg-dizajno-bg text-dizajno-text hover:border-dizajno-accent/50 hover:bg-dizajno-elevated",
          ].join(" ")}
        >
          <PenTool size={13} /> {mode === "room" ? "Drawing… click first point to close" : "Draw custom room"}
        </button>
        {mode === "room" && (
          <p className="text-[10px] text-dizajno-muted">
            Click to drop corners; click the first corner (or press Esc) to finish.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Main panel ──────────────────────────────────────────────────────────────
export default function BuildPanel() {
  const mode = useMode();
  const pendingOpeningType = usePendingOpeningType();
  const setMode = useDesignerStore((s) => s.setMode);
  const setPendingOpeningType = useDesignerStore((s) => s.setPendingOpeningType);
  const [view, setView] = useState<"main" | "rooms">("main");

  if (view === "rooms") return <RoomsView onBack={() => setView("main")} />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5">
        <Tile
          icon={<Pencil size={22} />}
          label="Draw Walls"
          active={mode === "draw"}
          onClick={() => setMode(mode === "draw" ? "select" : "draw")}
        />
        <Tile
          icon={<Square size={22} />}
          label="Rooms"
          active={mode === "room"}
          onClick={() => setView("rooms")}
        />
        <Tile icon={<Wand2 size={22} />} label="Smart Wizard" disabled />
        <Tile icon={<Shapes size={22} />} label="Forms" disabled />
      </div>

      <div>
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-dizajno-muted mb-2">
          Construction
        </h3>
        <div className="grid grid-cols-2 gap-2.5">
          <Tile
            icon={<DoorOpen size={22} />}
            label="Door"
            active={mode === "opening" && pendingOpeningType === "door"}
            onClick={() =>
              mode === "opening" && pendingOpeningType === "door"
                ? setMode("select")
                : setPendingOpeningType("door")
            }
          />
          <Tile
            icon={<AppWindow size={22} />}
            label="Window"
            active={mode === "opening" && pendingOpeningType === "window"}
            onClick={() =>
              mode === "opening" && pendingOpeningType === "window"
                ? setMode("select")
                : setPendingOpeningType("window")
            }
          />
        </div>
      </div>
    </div>
  );
}
