"use client";

import { useEffect } from "react";
import { useDesignerStore } from "@/store/useDesignerStore";

export function useKeyboardShortcuts() {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore if user is typing in an input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;

      // Ctrl+Z: undo
      if (ctrl && !shift && e.key === "z") {
        e.preventDefault();
        useDesignerStore.temporal.getState().undo();
        return;
      }

      // Ctrl+Shift+Z: redo
      if (ctrl && shift && e.key === "Z") {
        e.preventDefault();
        useDesignerStore.temporal.getState().redo();
        return;
      }

      // Ctrl+A: select all
      if (ctrl && e.key === "a") {
        e.preventDefault();
        useDesignerStore.getState().selectAll();
        return;
      }

      // Delete / Backspace: delete selected
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        useDesignerStore.getState().deleteSelected();
        return;
      }

      // Arrow keys: nudge the selected room wall along its normal (precision
      // fallback for the wall drag — grid-sized steps with snap on, 1 cm off).
      // dragWall validates eligibility and clamps, so ineligible walls no-op.
      // 2D select mode only (mirrors the drag), and no key auto-repeat — each
      // nudge is a separate undo entry, so a held key would flood the history.
      if (e.key.startsWith("Arrow")) {
        if (e.repeat) return;
        const state = useDesignerStore.getState();
        if (state.mode !== "select" || state.is3D) return;
        if (state.readOnly || state.selectedIds.length !== 1) return;
        const wall = state.walls.find((w) => w.id === state.selectedIds[0]);
        if (!wall) return;
        const horizontal =
          Math.abs(wall.end[0] - wall.start[0]) >= Math.abs(wall.end[1] - wall.start[1]);
        const step = state.snap ? state.gridSize : 0.01;
        let delta = 0;
        if (horizontal && e.key === "ArrowUp") delta = -step;
        else if (horizontal && e.key === "ArrowDown") delta = step;
        else if (!horizontal && e.key === "ArrowLeft") delta = -step;
        else if (!horizontal && e.key === "ArrowRight") delta = step;
        if (delta === 0) return;
        e.preventDefault();
        state.dragWall(wall.id, delta);
        return;
      }

      // R: rotate first selected furniture
      if (e.key === "r" || e.key === "R") {
        const state = useDesignerStore.getState();
        if (state.selectedIds.length > 0) {
          // Rotate each selected furniture item
          for (const id of state.selectedIds) {
            const isFurniture = state.furniture.some((f) => f.id === id);
            if (isFurniture) {
              state.rotateFurniture(id);
            }
          }
        }
        return;
      }

      // Escape: deselect all / cancel drawing / finish room or opening mode
      if (e.key === "Escape") {
        const state = useDesignerStore.getState();
        if (state.drawingFrom) {
          state.setDrawingFrom(null);
        }
        state.clearSelection();
        if (state.activeFurnitureType) {
          state.setActiveFurniture(null);
          state.setMode("select");
        }
        // Cancel an in-progress custom room or opening placement (setMode clears
        // the room draft).
        if (state.mode === "room" || state.mode === "opening") {
          state.setMode("select");
        }
        return;
      }

      // D: draw mode
      if (e.key === "d" || e.key === "D") {
        useDesignerStore.getState().setMode("draw");
        return;
      }

      // V: select mode
      if (e.key === "v" || e.key === "V") {
        useDesignerStore.getState().setMode("select");
        return;
      }

      // G: toggle snap
      if (e.key === "g" || e.key === "G") {
        const snap = useDesignerStore.getState().snap;
        useDesignerStore.getState().setSnap(!snap);
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
