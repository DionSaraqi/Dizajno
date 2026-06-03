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
