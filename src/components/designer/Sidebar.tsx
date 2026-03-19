"use client";

import React, { useState, useCallback, DragEvent } from "react";
import {
  Bed,
  Lamp,
  Armchair,
  Sofa,
  Table,
  Monitor,
  DoorOpen,
  BookOpen,
  Search,
  ChevronDown,
  ChevronUp,
  Trash2,
  Copy,
} from "lucide-react";
import {
  useDesignerStore,
  useActiveFurnitureType,
  useMode,
  useSelectedIds,
  useFurniture,
} from "@/store/useDesignerStore";
import {
  furnitureCategories,
  getFurnitureByCategory,
  furnitureCatalog,
  getFurnitureDef,
} from "@/utils/furnitureCatalog";
import type { FurnitureCatalogItem } from "@/types/designer";
import Button from "@/components/ui/Button";

// Map icon string names from the catalog to lucide-react components
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const iconMap: Record<string, any> = {
  bed: Bed,
  lamp: Lamp,
  armchair: Armchair,
  sofa: Sofa,
  table: Table,
  monitor: Monitor,
  "door-open": DoorOpen,
  "book-open": BookOpen,
};

function FurnitureIcon({ name, size = 20, className }: { name: string; size?: number; className?: string }) {
  const Icon = iconMap[name];
  if (Icon) return <Icon size={size} className={className} />;
  return <span className={className}>{name}</span>;
}

const ROTATION_PRESETS = [
  { label: "0", value: 0 },
  { label: "90", value: Math.PI / 2 },
  { label: "180", value: Math.PI },
  { label: "270", value: (3 * Math.PI) / 2 },
] as const;

function radToDeg(rad: number): number {
  return Math.round(((rad * 180) / Math.PI) % 360);
}

// ── PropertiesSection ────────────────────────────────────────────────────────

function PropertiesSection() {
  const [open, setOpen] = useState(true);
  const selectedIds = useSelectedIds();
  const furniture = useFurniture();
  const walls = useDesignerStore((s) => s.walls);
  const removeFurniture = useDesignerStore((s) => s.removeFurniture);
  const removeWall = useDesignerStore((s) => s.removeWall);
  const duplicateFurniture = useDesignerStore((s) => s.duplicateFurniture);
  const rotateFurniture = useDesignerStore((s) => s.rotateFurniture);
  const scaleFurniture = useDesignerStore((s) => s.scaleFurniture);
  const updateWall = useDesignerStore((s) => s.updateWall);

  if (selectedIds.length !== 1) return null;
  const selectedId = selectedIds[0];

  const selectedFurniture = furniture.find((f) => f.id === selectedId);
  const selectedWall = walls.find((w) => w.id === selectedId);

  if (!selectedFurniture && !selectedWall) return null;

  const def = selectedFurniture ? getFurnitureDef(selectedFurniture.type) : null;

  function handleSetRotation(radians: number) {
    if (!selectedFurniture) return;
    const currentSteps =
      Math.round(selectedFurniture.rotation / (Math.PI / 2)) % 4;
    const targetSteps = Math.round(radians / (Math.PI / 2)) % 4;
    const stepsNeeded = (targetSteps - currentSteps + 4) % 4;
    for (let i = 0; i < stepsNeeded; i++) {
      rotateFurniture(selectedFurniture.id);
    }
  }

  // Calculate wall length for display
  const wallLength = selectedWall
    ? Math.sqrt(
        (selectedWall.end[0] - selectedWall.start[0]) ** 2 +
        (selectedWall.end[1] - selectedWall.start[1]) ** 2
      )
    : 0;

  return (
    <div className="border-t border-dizajno-border">
      {/* Section header / toggle */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-dizajno-elevated transition-colors"
      >
        <div className="min-w-0">
          <span className="text-xs font-semibold text-dizajno-text truncate block">
            {selectedWall ? "Wall" : (def?.label ?? selectedFurniture!.type)}
          </span>
          <span className="text-[10px] text-dizajno-muted">Properties</span>
        </div>
        {open ? (
          <ChevronUp size={14} className="text-dizajno-muted flex-shrink-0 ml-2" />
        ) : (
          <ChevronDown size={14} className="text-dizajno-muted flex-shrink-0 ml-2" />
        )}
      </button>

      {/* Collapsible body */}
      {open && (
        <div className="pb-2">
          {/* ── Wall properties ── */}
          {selectedWall && (
            <>
              <div className="px-4 py-2 border-t border-dizajno-border">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-dizajno-muted mb-1.5">
                  Dimensions
                </h4>
                <div className="grid grid-cols-3 gap-1.5">
                  <div>
                    <span className="text-[10px] text-dizajno-muted block">Length</span>
                    <span className="text-xs text-dizajno-text font-mono">
                      {wallLength.toFixed(2)}m
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-dizajno-muted block">Thick</span>
                    <span className="text-xs text-dizajno-text font-mono">
                      {selectedWall.thickness.toFixed(2)}m
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-dizajno-muted block">Height</span>
                    <span className="text-xs text-dizajno-text font-mono">
                      {selectedWall.height.toFixed(1)}m
                    </span>
                  </div>
                </div>
              </div>

              {/* Thickness slider */}
              <div className="px-4 py-2 border-t border-dizajno-border">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-dizajno-muted mb-1.5">
                  Thickness
                </h4>
                <input
                  type="range"
                  min="0.05"
                  max="0.5"
                  step="0.05"
                  value={selectedWall.thickness}
                  onChange={(e) => updateWall(selectedWall.id, { thickness: parseFloat(e.target.value) })}
                  className="w-full slider-input"
                />
              </div>

              {/* Height slider */}
              <div className="px-4 py-2 border-t border-dizajno-border">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-dizajno-muted mb-1.5">
                  Height
                </h4>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="0.1"
                  value={selectedWall.height}
                  onChange={(e) => updateWall(selectedWall.id, { height: parseFloat(e.target.value) })}
                  className="w-full slider-input"
                />
              </div>

              {/* Delete wall */}
              <div className="px-4 pt-2">
                <button
                  onClick={() => removeWall(selectedWall.id)}
                  title="Delete Wall"
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs rounded-md bg-dizajno-danger hover:bg-red-500 text-white transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-dizajno-accent/50"
                >
                  <Trash2 size={12} />
                  Delete Wall
                </button>
              </div>
            </>
          )}

          {/* ── Furniture properties ── */}
          {selectedFurniture && (
            <>
              {/* Dimensions */}
              <div className="px-4 py-2 border-t border-dizajno-border">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-dizajno-muted mb-1.5">
                  Dimensions
                </h4>
                <div className="grid grid-cols-3 gap-1.5">
                  <div>
                    <span className="text-[10px] text-dizajno-muted block">W</span>
                    <span className="text-xs text-dizajno-text font-mono">
                      {selectedFurniture.width.toFixed(1)}m
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-dizajno-muted block">D</span>
                    <span className="text-xs text-dizajno-text font-mono">
                      {selectedFurniture.depth.toFixed(1)}m
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-dizajno-muted block">H</span>
                    <span className="text-xs text-dizajno-text font-mono">
                      {selectedFurniture.height.toFixed(1)}m
                    </span>
                  </div>
                </div>
              </div>

              {/* Rotation */}
              <div className="px-4 py-2 border-t border-dizajno-border">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-dizajno-muted mb-1.5">
                  Rotation ({radToDeg(selectedFurniture.rotation)}&deg;)
                </h4>
                <div className="grid grid-cols-4 gap-1">
                  {ROTATION_PRESETS.map((preset) => {
                    const isActive =
                      Math.round(selectedFurniture.rotation / (Math.PI / 2)) % 4 ===
                      Math.round(preset.value / (Math.PI / 2)) % 4;
                    return (
                      <button
                        key={preset.label}
                        onClick={() => handleSetRotation(preset.value)}
                        className={[
                          "py-1 text-xs rounded-md transition-colors font-mono",
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

              {/* Scale */}
              <div className="px-4 py-2 border-t border-dizajno-border">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-dizajno-muted mb-1.5">
                  Scale ({Math.round((selectedFurniture.scale ?? 1) * 100)}%)
                </h4>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.05"
                  value={selectedFurniture.scale ?? 1}
                  onChange={(e) => scaleFurniture(selectedFurniture.id, parseFloat(e.target.value))}
                  className="w-full slider-input"
                />
                <div className="flex justify-between text-[9px] text-dizajno-muted font-mono mt-0.5">
                  <span>50%</span>
                  <span>100%</span>
                  <span>200%</span>
                </div>
              </div>

              {/* Actions */}
              <div className="px-4 pt-2 flex gap-1.5">
                <button
                  onClick={() => duplicateFurniture(selectedFurniture.id)}
                  title="Duplicate"
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs rounded-md bg-dizajno-elevated hover:bg-dizajno-border text-dizajno-text transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-dizajno-accent/50"
                >
                  <Copy size={12} />
                  Copy
                </button>
                <button
                  onClick={() => removeFurniture(selectedFurniture.id)}
                  title="Delete"
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs rounded-md bg-dizajno-danger hover:bg-red-500 text-white transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-dizajno-accent/50"
                >
                  <Trash2 size={12} />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sidebar ──────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const activeFurnitureType = useActiveFurnitureType();
  const mode = useMode();
  const setMode = useDesignerStore((s) => s.setMode);
  const setActiveFurniture = useDesignerStore((s) => s.setActiveFurniture);

  const [search, setSearch] = useState("");

  const handleDragStart = useCallback(
    (e: DragEvent<HTMLButtonElement>, item: FurnitureCatalogItem) => {
      e.dataTransfer.setData("application/x-furniture-type", item.type);
      e.dataTransfer.effectAllowed = "copy";

      // Set active furniture type so the 3D ghost preview knows what to show
      setActiveFurniture(item.type);

      // Create a custom drag image
      const dragEl = document.createElement("div");
      dragEl.textContent = item.label;
      dragEl.style.cssText =
        "position:absolute;top:-999px;padding:6px 12px;background:#6366f1;color:white;border-radius:6px;font-size:12px;font-weight:500;pointer-events:none;";
      document.body.appendChild(dragEl);
      e.dataTransfer.setDragImage(dragEl, 40, 16);
      // Clean up
      requestAnimationFrame(() => document.body.removeChild(dragEl));
    },
    [setActiveFurniture]
  );

  const handleClick = useCallback(
    (item: FurnitureCatalogItem) => {
      if (activeFurnitureType === item.type) {
        setMode("select");
      } else {
        setActiveFurniture(item.type);
      }
    },
    [activeFurnitureType, setMode, setActiveFurniture]
  );

  // Filter items by search
  const filteredCatalog = search.trim()
    ? furnitureCatalog.filter(
        (item) =>
          item.label.toLowerCase().includes(search.toLowerCase()) ||
          item.type.toLowerCase().includes(search.toLowerCase()) ||
          item.category.toLowerCase().includes(search.toLowerCase())
      )
    : null;

  return (
    <div className="w-56 h-full bg-dizajno-surface border-r border-dizajno-border flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-dizajno-border">
        <h2 className="text-dizajno-text font-semibold text-sm tracking-wide">
          Furniture
        </h2>
      </div>

      {/* Search input */}
      <div className="px-3 py-2 border-b border-dizajno-border">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dizajno-muted"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search furniture..."
            className="w-full pl-8 pr-3 py-1.5 bg-dizajno-bg border border-dizajno-border rounded-md text-xs text-dizajno-text placeholder:text-dizajno-muted focus:outline-none focus:border-dizajno-accent"
          />
        </div>
      </div>

      {/* Furniture list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {filteredCatalog ? (
          // Show flat search results
          <div className="space-y-1">
            {filteredCatalog.map((item) => (
              <FurnitureButton
                key={item.type}
                item={item}
                isActive={activeFurnitureType === item.type}
                onClick={() => handleClick(item)}
                onDragStart={(e) => handleDragStart(e, item)}
              />
            ))}
            {filteredCatalog.length === 0 && (
              <p className="text-dizajno-muted text-xs text-center py-4">
                No furniture found
              </p>
            )}
          </div>
        ) : (
          // Show categorized
          furnitureCategories.map((category) => {
            const items = getFurnitureByCategory(category);
            return (
              <div key={category}>
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-dizajno-muted px-2 mb-1">
                  {category}
                </h3>
                <div className="space-y-0.5">
                  {items.map((item) => (
                    <FurnitureButton
                      key={item.type}
                      item={item}
                      isActive={activeFurnitureType === item.type}
                      onClick={() => handleClick(item)}
                      onDragStart={(e) => handleDragStart(e, item)}
                    />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Properties section — shown only when a furniture item is selected */}
      <PropertiesSection />

      {/* Mode info */}
      <div className="px-3 py-2 border-t border-dizajno-border text-[11px] text-dizajno-muted">
        {mode === "draw" && "Click & drag to draw walls"}
        {mode === "furniture" && "Drag to canvas or click to place"}
        {mode === "select" && "Click to select, Shift+click for multi"}
      </div>
    </div>
  );
}

// ── FurnitureButton ─────────────────────────────────────────────────────────

interface FurnitureButtonProps {
  item: FurnitureCatalogItem;
  isActive: boolean;
  onClick: () => void;
  onDragStart: (e: DragEvent<HTMLButtonElement>) => void;
}

function FurnitureButton({
  item,
  isActive,
  onClick,
  onDragStart,
}: FurnitureButtonProps) {
  return (
    <button
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors cursor-grab active:cursor-grabbing ${
        isActive
          ? "bg-dizajno-accent text-white"
          : "text-dizajno-text hover:bg-dizajno-elevated"
      }`}
    >
      {/* SVG preview thumbnail */}
      <div
        className={`w-10 h-10 flex-shrink-0 rounded ${
          isActive ? "text-white bg-white/10" : "text-dizajno-muted bg-dizajno-bg"
        }`}
        dangerouslySetInnerHTML={{ __html: item.svgPreview }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{item.label}</div>
        <div
          className={`text-[11px] ${
            isActive ? "text-white/70" : "text-dizajno-muted"
          }`}
        >
          {item.width}m &times; {item.depth}m
        </div>
      </div>
    </button>
  );
}
