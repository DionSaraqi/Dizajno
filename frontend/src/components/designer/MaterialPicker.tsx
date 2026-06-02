"use client";

/**
 * MaterialPicker — shared body for editing a furniture item's per-slot material
 * colors and textures. Used by both the bottom SelectionBar and the in-canvas
 * RadialMenu so the two stay in sync. Renders nothing if the item's catalog def
 * exposes no material/texture slots.
 */

import React from "react";
import type { FurnitureCatalogItem } from "@/types/designer";

export default function MaterialPicker({
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
  if (!def.materialSlots && !def.textureSlots) return null;

  return (
    <div className="space-y-2">
      {def.materialSlots && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-dizajno-muted mb-1.5">
            Colors
          </p>
          <div className="space-y-1.5">
            {Object.entries(def.materialSlots).map(([slot, defHex]) => (
              <div key={slot} className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-dizajno-muted truncate">{slot}</span>
                <input
                  type="color"
                  value={materialColors?.[slot] ?? defHex}
                  onChange={(e) => onColor(slot, e.target.value)}
                  className="w-7 h-5 rounded cursor-pointer border border-dizajno-border bg-transparent"
                  title={slot}
                />
              </div>
            ))}
          </div>
        </div>
      )}
      {def.textureSlots && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-dizajno-muted mb-1.5">
            Textures
          </p>
          <div className="space-y-1.5">
            {Object.entries(def.textureSlots).map(([slot, textures]) => (
              <div key={slot} className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-dizajno-muted truncate">{slot}</span>
                <select
                  value={materialTextures?.[slot] ?? ""}
                  onChange={(e) => onTexture(slot, e.target.value)}
                  className="text-[10px] bg-dizajno-bg border border-dizajno-border rounded px-1.5 py-0.5 text-dizajno-text cursor-pointer"
                >
                  <option value="">None</option>
                  {textures.filter(Boolean).map((tex) => (
                    <option key={tex} value={tex}>
                      {tex.split("/").pop()?.replace(/\.[^.]+$/, "")}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
