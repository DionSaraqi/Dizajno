"use client";

/**
 * FurnishPanel — the "Furnish" floating catalog. Mirrors Planner5D's Rooms /
 * Categories tabs. Categories come straight from the catalog's `category`
 * field; Rooms is a curated front-end grouping (type → room), not backend
 * driven. Items are draggable onto the canvas (same flow as the old sidebar).
 */

import React, { useCallback, DragEvent } from "react";
import {
  useDesignerStore,
  useActiveFurnitureType,
} from "@/store/useDesignerStore";
import {
  furnitureCatalog,
  furnitureCategories,
  getFurnitureByCategory,
} from "@/utils/furnitureCatalog";
import type { FurnitureCatalogItem } from "@/types/designer";

// Curated room → furniture-type grouping. Types not present in the catalog are
// simply skipped (filter), so this is safe as the catalog evolves.
const ROOMS: { name: string; types: string[] }[] = [
  { name: "Living room", types: ["sofa", "chair", "table", "bookshelf"] },
  { name: "Bedroom", types: ["bed", "nightstand", "wardrobe"] },
  { name: "Office", types: ["desk", "chair", "bookshelf", "monitor"] },
  { name: "Dining", types: ["table", "chair"] },
];

interface FurnishPanelProps {
  search: string;
}

export default function FurnishPanel({ search }: FurnishPanelProps) {
  const activeFurnitureType = useActiveFurnitureType();
  const setMode = useDesignerStore((s) => s.setMode);
  const setActiveFurniture = useDesignerStore((s) => s.setActiveFurniture);
  const [tab, setTab] = React.useState<"rooms" | "categories">("categories");

  const handleDragStart = useCallback(
    (e: DragEvent<HTMLButtonElement>, item: FurnitureCatalogItem) => {
      e.dataTransfer.setData("application/x-furniture-type", item.type);
      e.dataTransfer.effectAllowed = "copy";
      setActiveFurniture(item.type);
      const emptyImg = new Image();
      emptyImg.src =
        "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
      e.dataTransfer.setDragImage(emptyImg, 0, 0);
    },
    [setActiveFurniture]
  );

  const handleClick = useCallback(
    (item: FurnitureCatalogItem) => {
      if (activeFurnitureType === item.type) setMode("select");
      else setActiveFurniture(item.type);
    },
    [activeFurnitureType, setMode, setActiveFurniture]
  );

  const filtered = search.trim()
    ? furnitureCatalog.filter(
        (item) =>
          item.label.toLowerCase().includes(search.toLowerCase()) ||
          item.type.toLowerCase().includes(search.toLowerCase()) ||
          item.category.toLowerCase().includes(search.toLowerCase())
      )
    : null;

  const renderItem = (item: FurnitureCatalogItem) => (
    <FurnitureButton
      key={item.type}
      item={item}
      isActive={activeFurnitureType === item.type}
      onClick={() => handleClick(item)}
      onDragStart={(e) => handleDragStart(e, item)}
    />
  );

  // Search overrides tabs with a flat result list.
  if (filtered) {
    return (
      <div className="space-y-1">
        {filtered.map(renderItem)}
        {filtered.length === 0 && (
          <p className="text-dizajno-muted text-xs text-center py-4">No furniture found</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Tabs */}
      <div className="flex gap-4 border-b border-dizajno-border -mt-1">
        {(["rooms", "categories"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={[
              "pb-2 text-xs font-medium capitalize border-b-2 -mb-px transition-colors",
              tab === t
                ? "border-dizajno-accent text-dizajno-text"
                : "border-transparent text-dizajno-muted hover:text-dizajno-text",
            ].join(" ")}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "categories"
        ? furnitureCategories.map((category) => {
            const items = getFurnitureByCategory(category);
            if (items.length === 0) return null;
            return (
              <div key={category}>
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-dizajno-muted px-1 mb-1">
                  {category}
                </h3>
                <div className="space-y-0.5">{items.map(renderItem)}</div>
              </div>
            );
          })
        : ROOMS.map((room) => {
            const items = furnitureCatalog.filter((i) => room.types.includes(i.type));
            if (items.length === 0) return null;
            return (
              <div key={room.name}>
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-dizajno-muted px-1 mb-1">
                  {room.name}
                </h3>
                <div className="space-y-0.5">{items.map(renderItem)}</div>
              </div>
            );
          })}
    </div>
  );
}

// ── FurnitureButton (moved from the old Sidebar) ──────────────────────────────
interface FurnitureButtonProps {
  item: FurnitureCatalogItem;
  isActive: boolean;
  onClick: () => void;
  onDragStart: (e: DragEvent<HTMLButtonElement>) => void;
}

function FurnitureButton({ item, isActive, onClick, onDragStart }: FurnitureButtonProps) {
  return (
    <button
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors cursor-grab active:cursor-grabbing ${
        isActive ? "bg-dizajno-accent text-white" : "text-dizajno-text hover:bg-dizajno-elevated"
      }`}
    >
      <div
        className={`w-10 h-10 flex-shrink-0 rounded ${
          isActive ? "text-white bg-dizajno-accent/10" : "text-dizajno-muted bg-dizajno-bg"
        }`}
        dangerouslySetInnerHTML={{ __html: item.svgPreview }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{item.label}</div>
        <div className={`text-[11px] ${isActive ? "text-white/70" : "text-dizajno-muted"}`}>
          {item.width}m &times; {item.depth}m
        </div>
      </div>
    </button>
  );
}
