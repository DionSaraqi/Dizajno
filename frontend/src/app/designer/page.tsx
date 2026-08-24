"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { Save } from "lucide-react";
import { DesignerProvider } from "@/components/designer/DesignerProvider";
import DesignerHeader from "@/components/designer/DesignerHeader";
import LeftDock from "@/components/designer/LeftDock";
import Toolbar from "@/components/designer/Toolbar";
import StatusBar from "@/components/designer/StatusBar";
import SelectionBar from "@/components/designer/SelectionBar";
import CanvasDropZone from "@/components/designer/CanvasDropZone";
import NewProjectDialog from "@/components/projects/NewProjectDialog";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useSessionChrome } from "@/hooks/useSessionChrome";
import { useVariantLookup } from "@/hooks/useVariantLookup";
import { useDesignerStore } from "@/store/useDesignerStore";
import { mapStoreToApiScene } from "@/utils/sceneMapper";
import * as api from "@/lib/api";
import { Button } from "@/components/ui";

const DrawingSurface = dynamic(
  () => import("@/components/three/DrawingSurface"),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center bg-dizajno-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-dizajno-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-dizajno-muted font-mono">
            Loading canvas...
          </span>
        </div>
      </div>
    ),
  }
);

/** Reads the live store — event handlers only, never during render. */
function currentSceneSlice() {
  const s = useDesignerStore.getState();
  return {
    walls: s.walls,
    floors: s.floors,
    furniture: s.furniture,
    openings: s.openings,
  };
}

export default function DesignerPage() {
  useKeyboardShortcuts();
  const session = useSessionChrome();
  const lookup = useVariantLookup();

  const [saveOpen, setSaveOpen] = useState(false);
  const [unmappedCount, setUnmappedCount] = useState(0);

  const furnitureCount = useDesignerStore((s) => s.furniture.length);
  const wallCount = useDesignerStore((s) => s.walls.length);
  const openingCount = useDesignerStore((s) => s.openings.length);
  const sceneHasContent = furnitureCount + wallCount + openingCount > 0;

  // The mapper resolves each placed item's type to a product-variant id through
  // the catalog. Until that query settles every lookup misses, so saving would
  // write the walls and silently drop all the furniture — block instead.
  const catalogReady = lookup.isReady && !lookup.isError;

  const saveDisabledReason = !sceneHasContent
    ? "Draw a wall or place some furniture first"
    : !lookup.isReady
      ? "Waiting for the product catalog…"
      : lookup.isError
        ? "The product catalog failed to load, so saving would drop your furniture. Retry once the backend is reachable."
        : undefined;

  function handleSaveClick(): void {
    // Surface unsaveable items before the user commits to a name, rather than
    // failing (or worse, silently trimming the scene) mid-save.
    const { unmappedFurniture } = mapStoreToApiScene(currentSceneSlice(), lookup);
    setUnmappedCount(unmappedFurniture.length);
    setSaveOpen(true);
  }

  async function pushSceneToProject(project: api.ProjectDetail): Promise<void> {
    const { scene } = mapStoreToApiScene(currentSceneSlice(), lookup);
    await api.replaceScene(project.id, scene);
  }

  return (
    <DesignerProvider>
      <div className="w-full h-screen flex flex-col bg-dizajno-bg overflow-hidden">
        <DesignerHeader
          title="Untitled sketch"
          badge={
            <span className="font-mono text-[10px] uppercase tracking-label text-dizajno-muted-subtle">
              {session.isAuthed ? "Unsaved" : "Not signed in"}
            </span>
          }
          signInCta={{ label: "Sign in to save", href: "/login?redirect=/designer" }}
          actions={
            session.isAuthed ? (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Save />}
                onClick={handleSaveClick}
                disabled={!sceneHasContent || !catalogReady}
                title={saveDisabledReason}
              >
                Save to my projects
              </Button>
            ) : undefined
          }
        />
        <Toolbar />
        <div className="flex flex-1 overflow-hidden relative">
          <LeftDock />
          <CanvasDropZone>
            <DrawingSurface />
          </CanvasDropZone>
          {/* Planner5D-style bottom editor for the selected entity */}
          <SelectionBar />
        </div>
        <StatusBar />

        <NewProjectDialog
          open={saveOpen}
          onClose={() => setSaveOpen(false)}
          afterCreate={pushSceneToProject}
          title="Save to my projects"
          description="This sketch becomes a project you can reopen, share, and quote."
          submitLabel="Save"
          placeholder="e.g. Studio loft — Tirana"
          notice={
            unmappedCount > 0 ? (
              <div className="rounded-lg border border-dizajno-warning/30 bg-dizajno-warning-soft px-3 py-2.5 text-[12.5px] text-dizajno-warning leading-snug">
                {unmappedCount} placed item{unmappedCount === 1 ? "" : "s"}{" "}
                reference products that are no longer available and won&apos;t be
                saved. Everything else will be.
              </div>
            ) : undefined
          }
        />
      </div>
    </DesignerProvider>
  );
}
