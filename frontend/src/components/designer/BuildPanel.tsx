"use client";

/**
 * BuildPanel — the "Build" floating panel: drawing walls + placing openings.
 * Maps onto the existing designer modes. Planner5D's Rooms / Smart Wizard /
 * Forms have no backing logic in Dizajno, so they are shown as disabled
 * "coming soon" tiles rather than faked.
 */

import React from "react";
import { Pencil, DoorOpen, AppWindow, Square, Wand2, Shapes } from "lucide-react";
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

export default function BuildPanel() {
  const mode = useMode();
  const pendingOpeningType = usePendingOpeningType();
  const setMode = useDesignerStore((s) => s.setMode);
  const setPendingOpeningType = useDesignerStore((s) => s.setPendingOpeningType);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5">
        <Tile
          icon={<Pencil size={22} />}
          label="Draw Walls"
          active={mode === "draw"}
          onClick={() => setMode("draw")}
        />
        <Tile icon={<Square size={22} />} label="Rooms" disabled />
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
