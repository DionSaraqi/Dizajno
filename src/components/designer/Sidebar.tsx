"use client";

import React from "react";
import { furnitureCatalog } from "@/utils/furnitureCatalog";
import { useDesignerState, useDesignerDispatch } from "./DesignerProvider";

export default function Sidebar() {
  const state = useDesignerState();
  const dispatch = useDesignerDispatch();

  return (
    <div className="w-56 h-full bg-gray-900 border-r border-gray-700 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700">
        <h2 className="text-white font-semibold text-sm tracking-wide">Furniture</h2>
      </div>

      {/* Furniture list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {furnitureCatalog.map((item) => {
          const isActive = state.activeFurnitureType === item.type;
          return (
            <button
              key={item.type}
              onClick={() => {
                if (isActive) {
                  dispatch({ type: "SET_MODE", mode: "select" });
                } else {
                  dispatch({ type: "SET_ACTIVE_FURNITURE", furnitureType: item.type });
                }
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{item.label}</div>
                <div className="text-xs text-gray-400">
                  {item.width}m × {item.depth}m
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Mode info */}
      <div className="px-3 py-2 border-t border-gray-700 text-xs text-gray-500">
        {state.mode === "draw" && "Right-click to draw walls"}
        {state.mode === "furniture" && "Click on floor to place"}
        {state.mode === "select" && "Click to select & drag"}
      </div>
    </div>
  );
}
