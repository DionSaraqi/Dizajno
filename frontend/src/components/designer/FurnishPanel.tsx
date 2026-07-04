"use client";

/**
 * FurnishPanel — the "Furnish" floating catalog with Planner5D's Rooms /
 * Categories tabs. Groupings are drill-in: the tab first shows group CARDS;
 * clicking a card opens that group's items (with a back button). Categories
 * come from the catalog's `category` field; Rooms is a curated front-end
 * grouping (type → room), not backend driven. Search overrides with a flat list.
 */

import React, { useCallback, useMemo, useState, DragEvent } from "react";
import { ChevronLeft } from "lucide-react";
import {
  useDesignerStore,
  useActiveFurnitureType,
} from "@/store/useDesignerStore";
import { useFurnitureCatalog } from "@/hooks/useFurnitureCatalog";
import type { FurnitureCatalogItem } from "@/types/designer";

// Families that are drag-placed on the canvas. Fixtures attach to openings via
// their own picker and building materials flow through the wall/floor pickers,
// so neither belongs in the Furnish list. The offline fallback catalog carries
// no `family` — it is furniture-only, so default to "Furniture".
const PLACEABLE_FAMILIES = new Set(["Furniture", "Lighting", "Appliance"]);

// Curated room → furniture-type grouping. Types absent from the catalog are
// skipped (filter), so this stays safe as the catalog evolves.
const ROOMS: { name: string; types: string[] }[] = [
  { name: "Living room", types: ["sofa", "chair", "table", "bookshelf"] },
  { name: "Bedroom", types: ["bed", "nightstand", "wardrobe"] },
  { name: "Office", types: ["desk", "chair", "bookshelf", "monitor"] },
  { name: "Dining", types: ["table", "chair"] },
];

interface Group {
  key: string;
  name: string;
  items: FurnitureCatalogItem[];
}

interface FurnishPanelProps {
  search: string;
}

export default function FurnishPanel({ search }: FurnishPanelProps) {
  const activeFurnitureType = useActiveFurnitureType();
  const setMode = useDesignerStore((s) => s.setMode);
  const setActiveFurniture = useDesignerStore((s) => s.setActiveFurniture);
  const [tab, setTab] = useState<"rooms" | "categories">("categories");
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  // Live backend catalog (falls back to the bundled array while loading /
  // offline) — this is what makes supplier-uploaded products browsable.
  const { items } = useFurnitureCatalog();
  const placeable = useMemo(
    () => items.filter((i) => PLACEABLE_FAMILIES.has(i.family ?? "Furniture")),
    [items]
  );

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

  const renderItem = (item: FurnitureCatalogItem) => (
    <FurnitureButton
      key={item.type}
      item={item}
      isActive={activeFurnitureType === item.type}
      onClick={() => handleClick(item)}
      onDragStart={(e) => handleDragStart(e, item)}
    />
  );

  // Search overrides tabs + drill-down with a flat result list.
  const filtered = search.trim()
    ? placeable.filter(
        (item) =>
          item.label.toLowerCase().includes(search.toLowerCase()) ||
          item.type.toLowerCase().includes(search.toLowerCase()) ||
          item.category.toLowerCase().includes(search.toLowerCase())
      )
    : null;

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

  // Categories are derived from the live items (catalog order) so supplier
  // products under brand-new categories get a card automatically.
  const groups: Group[] =
    tab === "categories"
      ? Array.from(new Set(placeable.map((i) => i.category))).map((c) => ({
          key: c,
          name: c,
          items: placeable.filter((i) => i.category === c),
        }))
      : ROOMS.map((r) => ({
          key: r.name,
          name: r.name,
          items: placeable.filter((i) => r.types.includes(i.type)),
        })).filter((g) => g.items.length > 0);

  const switchTab = (t: "rooms" | "categories") => {
    setTab(t);
    setOpenGroup(null);
  };

  const current = openGroup ? groups.find((g) => g.key === openGroup) : null;

  return (
    <div className="space-y-3">
      {/* Tabs */}
      <div className="flex gap-4 border-b border-dizajno-border -mt-1">
        {(["rooms", "categories"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => switchTab(t)}
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

      {current ? (
        // Drilled into a group → back button + that group's items.
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setOpenGroup(null)}
            className="flex items-center gap-1 text-xs font-medium text-dizajno-muted hover:text-dizajno-text transition-colors"
          >
            <ChevronLeft size={14} /> {current.name}
          </button>
          <div className="space-y-0.5">{current.items.map(renderItem)}</div>
        </div>
      ) : (
        // Group cards (the extra click) — 2-col grid, Planner5D style.
        <div className="grid grid-cols-2 gap-2.5">
          {groups.map((g) => (
            <button
              key={g.key}
              type="button"
              onClick={() => setOpenGroup(g.key)}
              className="flex flex-col rounded-xl border border-dizajno-border bg-dizajno-bg overflow-hidden text-left hover:border-dizajno-accent/50 hover:bg-dizajno-elevated transition-colors"
            >
              <div
                className="aspect-[4/3] w-full bg-dizajno-surface flex items-center justify-center p-3 text-dizajno-muted"
                dangerouslySetInnerHTML={{ __html: g.items[0]?.svgPreview ?? "" }}
              />
              <div className="px-2.5 py-2">
                <div className="text-xs font-medium text-dizajno-text truncate">{g.name}</div>
                <div className="text-[10px] text-dizajno-muted">{g.items.length} items</div>
              </div>
            </button>
          ))}
        </div>
      )}
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
