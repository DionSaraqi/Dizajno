"use client";

import React from "react";
import { useDesignerState, useDesignerDispatch, useCanUndo } from "./DesignerProvider";

export default function Toolbar() {
  const state = useDesignerState();
  const dispatch = useDesignerDispatch();
  const canUndo = useCanUndo();

  const btnBase = "px-3 py-1.5 rounded text-xs font-medium transition-colors";
  const btnActive = "bg-blue-600 text-white";
  const btnInactive = "bg-gray-700 text-gray-300 hover:bg-gray-600";

  return (
    <div className="h-12 bg-gray-900 border-b border-gray-700 flex items-center px-4 gap-3">
      {/* Mode buttons */}
      <div className="flex gap-1 bg-gray-800 rounded-lg p-0.5">
        <button
          onClick={() => dispatch({ type: "SET_MODE", mode: "draw" })}
          className={`${btnBase} ${state.mode === "draw" ? btnActive : btnInactive}`}
        >
          Draw Walls
        </button>
        <button
          onClick={() => dispatch({ type: "SET_MODE", mode: "select" })}
          className={`${btnBase} ${state.mode === "select" ? btnActive : btnInactive}`}
        >
          Select
        </button>
      </div>

      <div className="w-px h-6 bg-gray-700" />

      {/* 2D / 3D toggle */}
      <button
        onClick={() => dispatch({ type: "TOGGLE_3D" })}
        className={`${btnBase} ${state.is3D ? "bg-indigo-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}
      >
        {state.is3D ? "3D View" : "2D View"}
      </button>

      <div className="w-px h-6 bg-gray-700" />

      {/* Snap */}
      <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
        <input
          type="checkbox"
          checked={state.snap}
          onChange={(e) => dispatch({ type: "SET_SNAP", snap: e.target.checked })}
          className="w-3.5 h-3.5 rounded border-gray-600 text-blue-600 focus:ring-blue-500 bg-gray-800"
        />
        Snap
      </label>

      <div className="w-px h-6 bg-gray-700" />

      {/* Wall thickness */}
      <label className="flex items-center gap-1.5 text-xs text-gray-400">
        Thickness
        <input
          type="range"
          min="0.05"
          max="0.4"
          step="0.05"
          value={state.wallThickness}
          onChange={(e) => dispatch({ type: "SET_WALL_THICKNESS", thickness: parseFloat(e.target.value) })}
          className="w-16 h-1 appearance-none bg-gray-700 rounded-lg cursor-pointer"
        />
        <span className="text-gray-300 w-10">{state.wallThickness.toFixed(2)}m</span>
      </label>

      {/* Wall height */}
      <label className="flex items-center gap-1.5 text-xs text-gray-400">
        Height
        <input
          type="range"
          min="1"
          max="4"
          step="0.25"
          value={state.wallHeight}
          onChange={(e) => dispatch({ type: "SET_WALL_HEIGHT", height: parseFloat(e.target.value) })}
          className="w-16 h-1 appearance-none bg-gray-700 rounded-lg cursor-pointer"
        />
        <span className="text-gray-300 w-10">{state.wallHeight.toFixed(1)}m</span>
      </label>

      <div className="w-px h-6 bg-gray-700" />

      {/* Undo */}
      <button
        onClick={() => dispatch({ type: "UNDO" })}
        disabled={!canUndo}
        className={`${btnBase} ${canUndo ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-800 text-gray-600 cursor-not-allowed"}`}
      >
        Undo
      </button>

      <div className="flex-1" />

      {/* Delete selected */}
      {state.selectedId && (
        <>
          <button
            onClick={() => {
              const f = state.furniture.find((f) => f.id === state.selectedId);
              if (f) {
                dispatch({ type: "ROTATE_FURNITURE", id: f.id });
              }
            }}
            className={`${btnBase} bg-gray-700 text-gray-300 hover:bg-gray-600`}
          >
            Rotate
          </button>
          <button
            onClick={() => {
              dispatch({ type: "REMOVE_FURNITURE", id: state.selectedId! });
            }}
            className={`${btnBase} bg-red-600 text-white hover:bg-red-500`}
          >
            Delete
          </button>
        </>
      )}

      {/* Clear all */}
      <button
        onClick={() => dispatch({ type: "CLEAR_ALL" })}
        className={`${btnBase} bg-gray-800 text-gray-400 hover:bg-red-900 hover:text-red-300`}
      >
        Clear All
      </button>
    </div>
  );
}
