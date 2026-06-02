"use client";

/**
 * IconRail — Planner5D-style slim vertical icon rail. Each icon toggles a
 * floating catalog panel (Build / Furnish). A few decorative entries are shown
 * disabled for visual parity with Planner5D.
 */

import React from "react";
import { Search, Home, Sofa, Trees, Sparkles, PackagePlus } from "lucide-react";
import { useDesignerStore, useActivePanel } from "@/store/useDesignerStore";
import type { DesignerState } from "@/types/designer";

type Panel = NonNullable<DesignerState["activePanel"]>;

export default function IconRail() {
  const activePanel = useActivePanel();
  const setActivePanel = useDesignerStore((s) => s.setActivePanel);

  const toggle = (panel: Panel) =>
    setActivePanel(activePanel === panel ? null : panel);

  const items: {
    key: Panel | string;
    icon: React.ReactNode;
    label: string;
    onClick?: () => void;
    disabled?: boolean;
  }[] = [
    { key: "search", icon: <Search size={18} />, label: "Search", onClick: () => toggle("furnish") },
    { key: "build", icon: <Home size={18} />, label: "Build", onClick: () => toggle("build") },
    { key: "furnish", icon: <Sofa size={18} />, label: "Furnish", onClick: () => toggle("furnish") },
    { key: "plants", icon: <Trees size={18} />, label: "Outdoor", disabled: true },
    { key: "decor", icon: <Sparkles size={18} />, label: "Decor", disabled: true },
    { key: "import", icon: <PackagePlus size={18} />, label: "Import", disabled: true },
  ];

  return (
    <div className="w-14 h-full flex-shrink-0 bg-dizajno-surface border-r border-dizajno-border flex flex-col items-center py-3 gap-1.5 z-40">
      {items.map((item) => {
        const isActive =
          (item.key === "build" && activePanel === "build") ||
          ((item.key === "furnish" || item.key === "search") && activePanel === "furnish");
        return (
          <button
            key={item.key}
            type="button"
            disabled={item.disabled}
            onClick={item.onClick}
            title={item.disabled ? `${item.label} — coming soon` : item.label}
            className={[
              "w-10 h-10 flex items-center justify-center rounded-lg transition-colors",
              item.disabled
                ? "text-dizajno-muted/40 cursor-not-allowed"
                : isActive
                ? "bg-dizajno-accent/10 text-dizajno-accent"
                : "text-dizajno-muted hover:text-dizajno-text hover:bg-dizajno-elevated",
            ].join(" ")}
          >
            {item.icon}
          </button>
        );
      })}
    </div>
  );
}
