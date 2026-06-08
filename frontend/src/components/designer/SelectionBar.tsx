"use client";

/**
 * SelectionBar — Planner5D-style bottom-docked editor for the currently
 * selected entity. Replaces the old sidebar PropertiesSection: it adapts its
 * controls to the selection type (furniture / wall / opening / floor) and hosts
 * the material, paint, flooring and fixture pickers that used to live in the
 * sidebar. Numeric fields are shown in centimeters / degrees to match Planner5D.
 *
 * Shown only when exactly one entity is selected.
 */

import React, { useEffect, useState } from "react";
import { Palette, Trash2 } from "lucide-react";
import {
  useDesignerStore,
  useSelectedIds,
  useFurniture,
  useOpenings,
  useWalls,
  useFloors,
} from "@/store/useDesignerStore";
import { getFurnitureDef } from "@/utils/furnitureCatalog";
import { polygonArea } from "@/utils/areaCalc";
import { isAxisAlignedRect } from "@/utils/roomBuilder";
import { useFurnitureCatalog } from "@/hooks/useFurnitureCatalog";
import type { FurnitureCatalogItem } from "@/types/designer";
import MaterialPicker from "./MaterialPicker";

// ── Focus-aware numeric field ─────────────────────────────────────────────────
// Displays the canonical value (already converted to its display unit). While
// focused it lets the user type freely; when blurred / externally changed it
// resyncs. Commits any parseable value live.
function NumberField({
  label,
  value,
  unit,
  step = 1,
  min,
  max,
  readOnly,
  onCommit,
}: {
  label: string;
  value: number;
  unit: string;
  step?: number;
  min?: number;
  max?: number;
  readOnly?: boolean;
  onCommit?: (v: number) => void;
}) {
  const [text, setText] = useState(value.toFixed(2));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(value.toFixed(2));
  }, [value, focused]);

  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] text-dizajno-muted">{label}</span>
      <div className="flex items-center gap-1 bg-dizajno-bg border border-dizajno-border rounded px-2 py-1 focus-within:border-dizajno-accent">
        <input
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          max={max}
          readOnly={readOnly}
          value={readOnly ? value.toFixed(2) : text}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            setText(value.toFixed(2));
          }}
          onChange={(e) => {
            setText(e.target.value);
            const n = parseFloat(e.target.value);
            if (!Number.isNaN(n) && onCommit) {
              const clamped = Math.min(
                max ?? Infinity,
                Math.max(min ?? -Infinity, n)
              );
              onCommit(clamped);
            }
          }}
          className="w-16 bg-transparent text-xs text-dizajno-text font-mono tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="text-[10px] text-dizajno-muted">{unit}</span>
      </div>
    </label>
  );
}

// ── Variant <select> (paint / flooring / fixture) ─────────────────────────────
function VariantSelect({
  label,
  value,
  options,
  priceSuffix,
  emptyLabel,
  onChange,
}: {
  label: string;
  value: string | null | undefined;
  options: FurnitureCatalogItem[];
  priceSuffix?: (o: FurnitureCatalogItem) => string;
  emptyLabel: string;
  onChange: (variantId: string | null) => void;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] text-dizajno-muted">{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? e.target.value : null)}
        className="text-xs bg-dizajno-bg border border-dizajno-border rounded px-2 py-1 text-dizajno-text cursor-pointer focus:outline-none focus:border-dizajno-accent min-w-[9rem]"
      >
        <option value="">{emptyLabel}</option>
        {options.map((o) =>
          o.variantId ? (
            <option key={o.variantId} value={o.variantId}>
              {o.label}
              {priceSuffix ? priceSuffix(o) : ""}
            </option>
          ) : null
        )}
      </select>
    </label>
  );
}

// ── Material colors + textures popover (furniture) ────────────────────────────
function MaterialsButton({
  def,
  materialColors,
  materialTextures,
  onColor,
  onTexture,
}: {
  def: FurnitureCatalogItem;
  materialColors?: Record<string, string>;
  materialTextures?: Record<string, string>;
  onColor: (slot: string, hex: string) => void;
  onTexture: (slot: string, url: string) => void;
}) {
  const [open, setOpen] = useState(false);
  if (!def.materialSlots && !def.textureSlots) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={[
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors",
          open
            ? "bg-dizajno-accent/10 text-dizajno-accent border-dizajno-accent/40"
            : "bg-dizajno-elevated text-dizajno-text border-dizajno-border hover:border-dizajno-accent/40",
        ].join(" ")}
      >
        <Palette size={13} />
        Materials
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute bottom-full left-0 mb-2 z-50 w-56 bg-dizajno-surface border border-dizajno-border rounded-lg shadow-xl p-3">
            <MaterialPicker
              def={def}
              materialColors={materialColors}
              materialTextures={materialTextures}
              onColor={onColor}
              onTexture={onTexture}
            />
          </div>
        </>
      )}
    </div>
  );
}

// ── Shell ─────────────────────────────────────────────────────────────────────
function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
      <div className="flex items-end gap-3 bg-dizajno-surface/95 backdrop-blur border border-dizajno-border rounded-xl shadow-2xl px-4 py-2.5">
        <span className="text-xs font-semibold text-dizajno-text self-center pr-1 border-r border-dizajno-border">
          {title}
        </span>
        {children}
      </div>
    </div>
  );
}

// Delete action shared by every selection type.
function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-dizajno-danger hover:bg-red-500 text-white transition-colors"
    >
      <Trash2 size={13} /> Delete
    </button>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function SelectionBar() {
  const selectedIds = useSelectedIds();
  const furniture = useFurniture();
  const walls = useWalls();
  const openings = useOpenings();
  const floors = useFloors();
  const { items: liveCatalog } = useFurnitureCatalog();

  const resizeFurniture = useDesignerStore((s) => s.resizeFurniture);
  const setFurnitureRotation = useDesignerStore((s) => s.setFurnitureRotation);
  const setFurnitureElevation = useDesignerStore((s) => s.setFurnitureElevation);
  const setFurnitureMaterialColors = useDesignerStore((s) => s.setFurnitureMaterialColors);
  const setFurnitureMaterialTextures = useDesignerStore((s) => s.setFurnitureMaterialTextures);
  const updateWall = useDesignerStore((s) => s.updateWall);
  const updateOpening = useDesignerStore((s) => s.updateOpening);
  const updateFloor = useDesignerStore((s) => s.updateFloor);
  const resizeRectRoom = useDesignerStore((s) => s.resizeRectRoom);
  const removeFurniture = useDesignerStore((s) => s.removeFurniture);
  const removeWall = useDesignerStore((s) => s.removeWall);
  const removeOpening = useDesignerStore((s) => s.removeOpening);
  const removeFloor = useDesignerStore((s) => s.removeFloor);

  if (selectedIds.length !== 1) return null;
  const id = selectedIds[0];

  const furn = furniture.find((f) => f.id === id);
  const wall = walls.find((w) => w.id === id);
  const opening = openings.find((o) => o.id === id);
  const floor = floors.find((f) => f.id === id);

  // ── Furniture ──
  if (furn) {
    const def = getFurnitureDef(furn.type);
    const angleDeg = ((furn.rotation * 180) / Math.PI) % 360;
    return (
      <Shell title={def?.label ?? furn.type}>
        <NumberField label="Width" unit="cm" value={furn.width * 100} step={1} min={5}
          onCommit={(v) => resizeFurniture(furn.id, { width: v / 100 })} />
        <NumberField label="Depth" unit="cm" value={furn.depth * 100} step={1} min={5}
          onCommit={(v) => resizeFurniture(furn.id, { depth: v / 100 })} />
        <NumberField label="Height" unit="cm" value={furn.height * 100} step={1} min={5}
          onCommit={(v) => resizeFurniture(furn.id, { height: v / 100 })} />
        <NumberField label="Angle" unit="°" value={Math.round(angleDeg)} step={1}
          onCommit={(v) => setFurnitureRotation(furn.id, (v * Math.PI) / 180)} />
        <NumberField label="Levitation" unit="cm" value={(furn.elevation ?? 0) * 100} step={1} min={0}
          onCommit={(v) => setFurnitureElevation(furn.id, v / 100)} />
        {def && (
          <MaterialsButton
            def={def}
            materialColors={furn.materialColors}
            materialTextures={furn.materialTextures}
            onColor={(slot, hex) => setFurnitureMaterialColors(furn.id, { [slot]: hex })}
            onTexture={(slot, url) => setFurnitureMaterialTextures(furn.id, { [slot]: url })}
          />
        )}
        <DeleteButton onClick={() => removeFurniture(furn.id)} />
      </Shell>
    );
  }

  // ── Wall ──
  if (wall) {
    const length = Math.hypot(wall.end[0] - wall.start[0], wall.end[1] - wall.start[1]);
    const paintOptions = liveCatalog.filter(
      (i) => i.family === "BuildingMaterial" && i.category === "Paint"
    );
    return (
      <Shell title="Wall">
        <NumberField label="Length" unit="m" value={length} readOnly />
        <NumberField label="Thickness" unit="cm" value={wall.thickness * 100} step={1} min={5} max={50}
          onCommit={(v) => updateWall(wall.id, { thickness: v / 100 })} />
        <NumberField label="Height" unit="cm" value={wall.height * 100} step={1} min={100} max={500}
          onCommit={(v) => updateWall(wall.id, { height: v / 100 })} />
        {paintOptions.length > 0 && (
          <VariantSelect
            label="Paint"
            value={wall.paintVariantId}
            options={paintOptions}
            emptyLabel="None (unpainted)"
            priceSuffix={(o) => (o.basePrice != null ? ` — €${o.basePrice}/L` : "")}
            onChange={(v) => updateWall(wall.id, { paintVariantId: v })}
          />
        )}
        <DeleteButton onClick={() => removeWall(wall.id)} />
      </Shell>
    );
  }

  // ── Opening (door / window) ──
  if (opening) {
    const isDoor = opening.type === "door";
    const fixtureOptions = liveCatalog.filter(
      (i) => i.family === "Fixture" && i.category === (isDoor ? "Doors" : "Windows")
    );
    return (
      <Shell title={isDoor ? "Door" : "Window"}>
        <NumberField label="Width" unit="cm" value={opening.width * 100} step={1}
          min={isDoor ? 60 : 40} max={isDoor ? 240 : 200}
          onCommit={(v) => updateOpening(opening.id, { width: v / 100 })} />
        <NumberField label="Height" unit="cm" value={opening.height * 100} step={1}
          min={isDoor ? 180 : 40} max={isDoor ? 240 : 150}
          onCommit={(v) => updateOpening(opening.id, { height: v / 100 })} />
        {!isDoor && (
          <NumberField label="Sill" unit="cm" value={opening.sillHeight * 100} step={1} min={30} max={120}
            onCommit={(v) => updateOpening(opening.id, { sillHeight: v / 100 })} />
        )}
        {fixtureOptions.length > 0 && (
          <VariantSelect
            label="Fixture"
            value={opening.productVariantId}
            options={fixtureOptions}
            emptyLabel="None (generic)"
            onChange={(v) => updateOpening(opening.id, { productVariantId: v })}
          />
        )}
        <DeleteButton onClick={() => removeOpening(opening.id)} />
      </Shell>
    );
  }

  // ── Floor ──
  if (floor) {
    const flooringOptions = liveCatalog.filter(
      (i) => i.family === "BuildingMaterial" && i.category === "Flooring"
    );
    const rect = isAxisAlignedRect(floor.vertices);
    // Floor polygons are stored as the inner usable area, so the rectangle's
    // span IS the usable W×L (matches the Room-tool input directly).
    let usableW = 0;
    let usableL = 0;
    if (rect) {
      const xs = floor.vertices.map((v) => v[0]);
      const zs = floor.vertices.map((v) => v[1]);
      usableW = Math.max(0, Math.max(...xs) - Math.min(...xs));
      usableL = Math.max(0, Math.max(...zs) - Math.min(...zs));
    }
    return (
      <Shell title="Floor">
        {rect ? (
          <>
            <NumberField label="Width" unit="m" value={usableW} step={0.1} min={0.5}
              onCommit={(v) => resizeRectRoom(floor.id, v, usableL)} />
            <NumberField label="Length" unit="m" value={usableL} step={0.1} min={0.5}
              onCommit={(v) => resizeRectRoom(floor.id, usableW, v)} />
          </>
        ) : (
          <NumberField label="Area" unit="m²" value={polygonArea(floor.vertices)} readOnly />
        )}
        {flooringOptions.length > 0 && (
          <VariantSelect
            label="Flooring"
            value={floor.flooringVariantId}
            options={flooringOptions}
            emptyLabel="None (bare floor)"
            priceSuffix={(o) => (o.basePrice != null ? ` — €${o.basePrice}/m²` : "")}
            onChange={(v) => updateFloor(floor.id, { flooringVariantId: v })}
          />
        )}
        <DeleteButton onClick={() => removeFloor(floor.id)} />
      </Shell>
    );
  }

  return null;
}
