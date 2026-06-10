"use client";

/**
 * OpeningRadialMenu — the same Planner5D-style ring `RadialMenu` gives
 * furniture, but for a selected door/window. Buttons:
 *   - sill up / down (windows only) — visually identical to the furniture
 *     levitate pair, but they move the window's sill instead of elevating
 *   - palette — opens a popover listing the branded fixtures applicable to
 *     this opening type (doors/windows), mirroring the furniture material
 *     palette; hidden when the catalog has no fixtures (e.g. backend offline)
 *   - delete
 * Width/height editing stays in the bottom SelectionBar.
 */

import React, { useState } from "react";
import { Html } from "@react-three/drei";
import { ChevronUp, ChevronDown, Trash2, Palette } from "lucide-react";
import { useDesignerStore } from "@/store/useDesignerStore";
import { useFurnitureCatalog } from "@/hooks/useFurnitureCatalog";
import type { OpeningData, WallData } from "@/types/designer";

const SILL_STEP = 0.1; // meters per click, same feel as furniture's ELEVATE_STEP
const SILL_MIN = 0.3; // matches the SelectionBar sill field's 30–120 cm range
const SILL_MAX = 1.2;

interface OpeningRadialMenuProps {
  opening: OpeningData;
  wall: WallData;
}

export default function OpeningRadialMenu({ opening, wall }: OpeningRadialMenuProps) {
  const updateOpening = useDesignerStore((s) => s.updateOpening);
  const removeOpening = useDesignerStore((s) => s.removeOpening);
  const { items: catalog } = useFurnitureCatalog();

  const [showFixtures, setShowFixtures] = useState(false);

  const isDoor = opening.type === "door";
  const fixtureOptions = catalog.filter(
    (i) =>
      i.family === "Fixture" &&
      i.category === (isDoor ? "Doors" : "Windows") &&
      i.variantId
  );

  const setSill = (delta: number) =>
    updateOpening(opening.id, {
      sillHeight: Math.min(SILL_MAX, Math.max(SILL_MIN, opening.sillHeight + delta)),
    });

  const buttons: { icon: React.ReactNode; title: string; onClick: () => void; danger?: boolean; active?: boolean }[] = [
    ...(!isDoor
      ? [
          { icon: <ChevronUp size={15} />, title: "Raise sill", onClick: () => setSill(SILL_STEP) },
          { icon: <ChevronDown size={15} />, title: "Lower sill", onClick: () => setSill(-SILL_STEP) },
        ]
      : []),
    ...(fixtureOptions.length > 0
      ? [{ icon: <Palette size={15} />, title: "Fixtures", onClick: () => setShowFixtures((v) => !v), active: showFixtures }]
      : []),
    { icon: <Trash2 size={15} />, title: "Delete", onClick: () => removeOpening(opening.id), danger: true },
  ];

  // Anchor at the opening's world center on its wall.
  const dx = wall.end[0] - wall.start[0];
  const dz = wall.end[1] - wall.start[1];
  const wallLen = Math.hypot(dx, dz);
  if (wallLen < 0.01) return null;
  const t = (opening.offsetFromStart + opening.width / 2) / wallLen;
  const cx = wall.start[0] + dx * t;
  const cz = wall.start[1] + dz * t;
  const cy = opening.sillHeight + opening.height / 2;

  const radius = 52;

  return (
    <Html
      position={[cx, cy, cz]}
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

        {/* Fixture popover — branded variants applicable to this opening type */}
        {showFixtures && (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              left: radius + 22,
              top: -48,
              pointerEvents: "auto",
            }}
            className="w-52 bg-white rounded-lg shadow-xl border border-slate-200 p-2"
          >
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-1 pb-1">
              {isDoor ? "Door fixtures" : "Window fixtures"}
            </div>
            <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto">
              <button
                type="button"
                onClick={() => updateOpening(opening.id, { productVariantId: null })}
                className={[
                  "flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors",
                  !opening.productVariantId
                    ? "bg-dizajno-accent/10 text-dizajno-accent font-medium"
                    : "text-slate-700 hover:bg-slate-100",
                ].join(" ")}
              >
                <span className="w-3 h-3 rounded-full border border-slate-300 bg-white shrink-0" />
                None (generic)
              </button>
              {fixtureOptions.map((o) => (
                <button
                  key={o.variantId}
                  type="button"
                  onClick={() => updateOpening(opening.id, { productVariantId: o.variantId })}
                  className={[
                    "flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors",
                    opening.productVariantId === o.variantId
                      ? "bg-dizajno-accent/10 text-dizajno-accent font-medium"
                      : "text-slate-700 hover:bg-slate-100",
                  ].join(" ")}
                >
                  <span
                    className="w-3 h-3 rounded-full border border-slate-300 shrink-0"
                    style={{ background: o.color }}
                  />
                  <span className="truncate">{o.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Html>
  );
}
