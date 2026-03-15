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
} from "lucide-react";
import { useDesignerStore, useActiveFurnitureType, useMode } from "@/store/useDesignerStore";
import {
  furnitureCategories,
  getFurnitureByCategory,
  furnitureCatalog,
} from "@/utils/furnitureCatalog";
import type { FurnitureCatalogItem } from "@/types/designer";

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
    []
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
      <FurnitureIcon
        name={item.icon}
        size={18}
        className={isActive ? "text-white" : "text-dizajno-muted"}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{item.label}</div>
        <div
          className={`text-[11px] ${
            isActive ? "text-white/70" : "text-dizajno-muted"
          }`}
        >
          {item.width}m x {item.depth}m x {item.height}m
        </div>
      </div>
    </button>
  );
}
