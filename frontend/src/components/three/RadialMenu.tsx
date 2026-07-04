"use client";

/**
 * RadialMenu — Planner5D-style ring of action buttons floating around the
 * selected furniture item, rendered as a screen-space <Html> overlay anchored
 * to the item's world position. Furniture-only; hidden while dragging.
 *
 * Most buttons are pure actions; the Palette button opens a material popover
 * (same picker as the bottom SelectionBar) so colors/textures can be edited
 * straight from the ring.
 */

import React, { useState } from "react";
import { Html } from "@react-three/drei";
import {
  RotateCw,
  RotateCcw,
  Copy,
  ChevronUp,
  ChevronDown,
  Trash2,
  Palette,
} from "lucide-react";
import { useDesignerStore } from "@/store/useDesignerStore";
import { getFurnitureDef } from "@/utils/furnitureCatalog";
import { useCatalogVersion } from "@/hooks/useCatalogVersion";
import MaterialPicker from "@/components/designer/MaterialPicker";
import type { FurnitureData } from "@/types/designer";

const ELEVATE_STEP = 0.1; // meters per click

interface RadialMenuProps {
  item: FurnitureData;
}

export default function RadialMenu({ item }: RadialMenuProps) {
  // Re-render when the runtime catalog arrives so the Materials button appears
  // for supplier products resolved after mount.
  useCatalogVersion();
  const rotateFurniture = useDesignerStore((s) => s.rotateFurniture);
  const setFurnitureRotation = useDesignerStore((s) => s.setFurnitureRotation);
  const duplicateFurniture = useDesignerStore((s) => s.duplicateFurniture);
  const setFurnitureElevation = useDesignerStore((s) => s.setFurnitureElevation);
  const removeFurniture = useDesignerStore((s) => s.removeFurniture);
  const setFurnitureMaterialColors = useDesignerStore((s) => s.setFurnitureMaterialColors);
  const setFurnitureMaterialTextures = useDesignerStore((s) => s.setFurnitureMaterialTextures);

  const [showMaterials, setShowMaterials] = useState(false);

  const def = getFurnitureDef(item.type);
  const hasMaterials = !!(def?.materialSlots || def?.textureSlots);

  const buttons: { icon: React.ReactNode; title: string; onClick: () => void; danger?: boolean; active?: boolean }[] = [
    { icon: <RotateCcw size={15} />, title: "Rotate left 90°", onClick: () => setFurnitureRotation(item.id, item.rotation - Math.PI / 2) },
    { icon: <RotateCw size={15} />, title: "Rotate right 90°", onClick: () => rotateFurniture(item.id) },
    { icon: <Copy size={15} />, title: "Duplicate", onClick: () => duplicateFurniture(item.id) },
    { icon: <ChevronUp size={15} />, title: "Levitate up", onClick: () => setFurnitureElevation(item.id, (item.elevation ?? 0) + ELEVATE_STEP) },
    { icon: <ChevronDown size={15} />, title: "Levitate down", onClick: () => setFurnitureElevation(item.id, (item.elevation ?? 0) - ELEVATE_STEP) },
    ...(hasMaterials
      ? [{ icon: <Palette size={15} />, title: "Materials", onClick: () => setShowMaterials((v) => !v), active: showMaterials }]
      : []),
    { icon: <Trash2 size={15} />, title: "Delete", onClick: () => removeFurniture(item.id), danger: true },
  ];

  const radius = 52;
  const cy = item.height / 2 + (item.elevation ?? 0);

  return (
    <Html
      position={[item.position[0], cy, item.position[1]]}
      center
      zIndexRange={[100, 0]}
      style={{ pointerEvents: "none" }}
    >
      <div style={{ position: "relative", width: 0, height: 0 }}>
        {buttons.map((b, i) => {
          const a = (i / buttons.length) * 2 * Math.PI - Math.PI / 2;
          const x = Math.cos(a) * radius;
          const y = Math.sin(a) * radius;
          return (
            <button
              key={b.title}
              type="button"
              title={b.title}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                b.onClick();
              }}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                pointerEvents: "auto",
              }}
              className={[
                "w-8 h-8 flex items-center justify-center rounded-full shadow-md border transition-colors",
                b.danger
                  ? "bg-white text-red-500 border-red-200 hover:bg-red-50"
                  : b.active
                  ? "bg-dizajno-accent text-white border-dizajno-accent"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100",
              ].join(" ")}
            >
              {b.icon}
            </button>
          );
        })}

        {/* Material popover — same picker as the bottom SelectionBar */}
        {showMaterials && def && (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              left: radius + 22,
              top: -48,
              pointerEvents: "auto",
            }}
            className="w-52 bg-white rounded-lg shadow-xl border border-slate-200 p-3"
          >
            <MaterialPicker
              def={def}
              materialColors={item.materialColors}
              materialTextures={item.materialTextures}
              onColor={(slot, hex) => setFurnitureMaterialColors(item.id, { [slot]: hex })}
              onTexture={(slot, url) => setFurnitureMaterialTextures(item.id, { [slot]: url })}
            />
          </div>
        )}
      </div>
    </Html>
  );
}
