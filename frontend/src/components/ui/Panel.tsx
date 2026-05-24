"use client";

import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

export interface PanelProps {
  title: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  /** Optional right-aligned content next to the title (badge, action, etc.). */
  trailing?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Sidebar / panel section. Tightly styled for the designer left rail.
 */
export default function Panel({
  title,
  collapsible = true,
  defaultOpen = true,
  trailing,
  children,
}: PanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-dizajno-border last:border-b-0">
      <button
        type="button"
        onClick={() => collapsible && setIsOpen((o) => !o)}
        className={[
          "w-full flex items-center justify-between gap-2 px-3 h-9",
          "text-[11px] font-semibold uppercase tracking-label text-dizajno-muted",
          collapsible
            ? "cursor-pointer hover:text-dizajno-text"
            : "cursor-default",
          "transition-colors",
        ].join(" ")}
      >
        <span className="flex items-center gap-2 min-w-0">
          {collapsible && (
            <ChevronDown
              className={[
                "w-3 h-3 shrink-0 transition-transform",
                isOpen ? "" : "-rotate-90",
              ].join(" ")}
            />
          )}
          <span className="truncate">{title}</span>
        </span>
        {trailing && (
          <span
            onClick={(e) => e.stopPropagation()}
            className="text-dizajno-muted normal-case tracking-normal text-xs"
          >
            {trailing}
          </span>
        )}
      </button>
      {isOpen && <div className="px-3 pb-3 pt-1">{children}</div>}
    </div>
  );
}
