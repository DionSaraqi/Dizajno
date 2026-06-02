"use client";

/**
 * LeftDock — replaces the old fixed Sidebar. Renders the slim floating IconRail
 * and, when a panel is active, the matching FloatingPanel (Build / Furnish).
 * Both float over the canvas (Planner5D-style), detached from the screen edges.
 */

import React, { useEffect, useState } from "react";
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

  // Drawing / door / window placement is tied to the Build panel. When the
  // Build panel isn't the active panel, drop out of those modes so selecting
  // and furnishing stay friction-free. Runs only when the active panel changes.
  useEffect(() => {
    if (activePanel !== "build") {
      const s = useDesignerStore.getState();
      if (s.mode === "draw" || s.mode === "opening") s.setMode("select");
    }
  }, [activePanel]);

  return (
    <>
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
    </>
  );
}
