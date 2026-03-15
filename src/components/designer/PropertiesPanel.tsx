"use client";

import React from "react";
import {
  useDesignerStore,
  useSelectedIds,
  useFurniture,
} from "@/store/useDesignerStore";
import { getFurnitureDef } from "@/utils/furnitureCatalog";
import Button from "@/components/ui/Button";

const ROTATION_PRESETS = [
  { label: "0", value: 0 },
  { label: "90", value: Math.PI / 2 },
  { label: "180", value: Math.PI },
  { label: "270", value: (3 * Math.PI) / 2 },
] as const;

function radToDeg(rad: number): number {
  return Math.round(((rad * 180) / Math.PI) % 360);
}

export default function PropertiesPanel() {
  const selectedIds = useSelectedIds();
  const furniture = useFurniture();
  const removeFurniture = useDesignerStore((s) => s.removeFurniture);
  const duplicateFurniture = useDesignerStore((s) => s.duplicateFurniture);
  const rotateFurniture = useDesignerStore((s) => s.rotateFurniture);

  const selectedItem =
    selectedIds.length === 1
      ? furniture.find((f) => f.id === selectedIds[0])
      : null;

  if (!selectedItem) return null;

  const def = getFurnitureDef(selectedItem.type);

  function handleSetRotation(radians: number) {
    if (!selectedItem) return;
    // Calculate steps needed to reach the target rotation
    const currentSteps =
      Math.round(selectedItem.rotation / (Math.PI / 2)) % 4;
    const targetSteps = Math.round(radians / (Math.PI / 2)) % 4;
    let stepsNeeded = (targetSteps - currentSteps + 4) % 4;
    for (let i = 0; i < stepsNeeded; i++) {
      rotateFurniture(selectedItem.id);
    }
  }

  return (
    <div className="w-56 bg-dizajno-surface border-l border-dizajno-border flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-dizajno-border">
        <h3 className="text-sm font-semibold text-dizajno-text">
          {def?.label ?? selectedItem.type}
        </h3>
        <p className="text-xs text-dizajno-muted mt-0.5">Properties</p>
      </div>

      {/* Dimensions */}
      <div className="px-3 py-2.5 border-b border-dizajno-border">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-dizajno-muted mb-2">
          Dimensions
        </h4>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <span className="text-[10px] text-dizajno-muted block">W</span>
            <span className="text-xs text-dizajno-text font-mono">
              {selectedItem.width.toFixed(1)}m
            </span>
          </div>
          <div>
            <span className="text-[10px] text-dizajno-muted block">D</span>
            <span className="text-xs text-dizajno-text font-mono">
              {selectedItem.depth.toFixed(1)}m
            </span>
          </div>
          <div>
            <span className="text-[10px] text-dizajno-muted block">H</span>
            <span className="text-xs text-dizajno-text font-mono">
              {selectedItem.height.toFixed(1)}m
            </span>
          </div>
        </div>
      </div>

      {/* Position */}
      <div className="px-3 py-2.5 border-b border-dizajno-border">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-dizajno-muted mb-2">
          Position
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-[10px] text-dizajno-muted block">X</span>
            <span className="text-xs text-dizajno-text font-mono">
              {selectedItem.position[0].toFixed(2)}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-dizajno-muted block">Z</span>
            <span className="text-xs text-dizajno-text font-mono">
              {selectedItem.position[1].toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Rotation */}
      <div className="px-3 py-2.5 border-b border-dizajno-border">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-dizajno-muted mb-2">
          Rotation ({radToDeg(selectedItem.rotation)}&deg;)
        </h4>
        <div className="grid grid-cols-4 gap-1">
          {ROTATION_PRESETS.map((preset) => {
            const isActive =
              Math.round(selectedItem.rotation / (Math.PI / 2)) % 4 ===
              Math.round(preset.value / (Math.PI / 2)) % 4;
            return (
              <button
                key={preset.label}
                onClick={() => handleSetRotation(preset.value)}
                className={[
                  "px-2 py-1 text-xs rounded-md transition-colors font-mono",
                  "focus:outline-none focus:ring-2 focus:ring-dizajno-accent/50",
                  isActive
                    ? "bg-dizajno-accent text-white"
                    : "bg-dizajno-elevated text-dizajno-muted hover:text-dizajno-text hover:bg-dizajno-border",
                ].join(" ")}
              >
                {preset.label}&deg;
              </button>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="px-3 py-2.5 flex flex-col gap-1.5">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => duplicateFurniture(selectedItem.id)}
          className="w-full"
        >
          Duplicate
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={() => removeFurniture(selectedItem.id)}
          className="w-full"
        >
          Delete
        </Button>
      </div>
    </div>
  );
}
