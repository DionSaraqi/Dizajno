"use client";

/**
 * FloatingPanel — Planner5D-style floating card anchored beside the icon rail.
 * Provides the title bar (title + expand + close) and an optional search box;
 * the body is supplied by the caller (BuildPanel / FurnishPanel).
 */

import React, { useState } from "react";
import { Maximize2, Minimize2, X, Search } from "lucide-react";

interface FloatingPanelProps {
  title: string;
  onClose: () => void;
  search?: { value: string; onChange: (v: string) => void; placeholder?: string };
  children: React.ReactNode;
}

export default function FloatingPanel({ title, onClose, search, children }: FloatingPanelProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={[
        "absolute left-[3.75rem] top-3 bottom-3 z-30 flex flex-col",
        "bg-dizajno-surface border border-dizajno-border rounded-xl shadow-2xl overflow-hidden",
        expanded ? "w-[26rem]" : "w-72",
      ].join(" ")}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-dizajno-border">
        <h2 className="text-sm font-semibold text-dizajno-text">{title}</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            title={expanded ? "Shrink" : "Expand"}
            className="w-6 h-6 flex items-center justify-center rounded text-dizajno-muted hover:text-dizajno-text hover:bg-dizajno-elevated transition-colors"
          >
            {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="w-6 h-6 flex items-center justify-center rounded text-dizajno-muted hover:text-dizajno-text hover:bg-dizajno-elevated transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Optional search */}
      {search && (
        <div className="px-3 py-2 border-b border-dizajno-border">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dizajno-muted" />
            <input
              type="text"
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
              placeholder={search.placeholder ?? "Search…"}
              className="w-full pl-8 pr-3 py-1.5 bg-dizajno-bg border border-dizajno-border rounded-md text-xs text-dizajno-text placeholder:text-dizajno-muted focus:outline-none focus:border-dizajno-accent"
            />
          </div>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3">{children}</div>
    </div>
  );
}
