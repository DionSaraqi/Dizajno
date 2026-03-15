"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

export interface PanelProps {
  title: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export default function Panel({
  title,
  collapsible = true,
  defaultOpen = true,
  children,
}: PanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-dizajno-border">
      <button
        type="button"
        onClick={() => collapsible && setIsOpen((o) => !o)}
        className={[
          "w-full flex items-center justify-between px-3 py-2",
          "text-xs font-semibold uppercase tracking-wider text-dizajno-muted",
          collapsible ? "cursor-pointer hover:text-dizajno-text" : "cursor-default",
          "transition-colors",
        ].join(" ")}
      >
        <span>{title}</span>
        {collapsible &&
          (isOpen ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          ))}
      </button>
      {isOpen && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}
