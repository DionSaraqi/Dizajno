"use client";

/**
 * LeftDock — replaces the old fixed Sidebar. Renders the slim IconRail and,
 * when a panel is active, the matching FloatingPanel (Build / Furnish) that
 * overlays the canvas, Planner5D-style.
 */

import React, { useState } from "react";
import { useDesignerStore, useActivePanel } from "@/store/useDesignerStore";
import IconRail from "./IconRail";
import FloatingPanel from "./FloatingPanel";
import BuildPanel from "./BuildPanel";
import FurnishPanel from "./FurnishPanel";

export default function LeftDock() {
  const activePanel = useActivePanel();
  const setActivePanel = useDesignerStore((s) => s.setActivePanel);
  const [search, setSearch] = useState("");

  const close = () => setActivePanel(null);

  return (
    <div className="relative h-full flex-shrink-0">
      <IconRail />

      {activePanel === "build" && (
        <FloatingPanel title="Build" onClose={close}>
          <BuildPanel />
        </FloatingPanel>
      )}

      {(activePanel === "furnish" || activePanel === "search") && (
        <FloatingPanel
          title="Furnish"
          onClose={close}
          search={{ value: search, onChange: setSearch, placeholder: "Search furniture…" }}
        >
          <FurnishPanel search={search} />
        </FloatingPanel>
      )}
    </div>
  );
}
