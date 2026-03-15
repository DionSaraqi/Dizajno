"use client";

import React, { useEffect, useRef } from "react";

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  separator?: boolean;
}

export interface ContextMenuProps {
  items: ContextMenuItem[];
  position: { x: number; y: number };
  onClose: () => void;
}

export default function ContextMenu({
  items,
  position,
  onClose,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[160px] bg-dizajno-elevated border border-dizajno-border rounded-lg shadow-xl py-1"
      style={{ left: position.x, top: position.y }}
    >
      {items.map((item, i) => {
        if (item.separator) {
          return (
            <div
              key={i}
              className="h-px mx-2 my-1 bg-dizajno-border"
            />
          );
        }

        return (
          <button
            key={i}
            type="button"
            disabled={item.disabled}
            onClick={() => {
              item.onClick?.();
              onClose();
            }}
            className={[
              "w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left transition-colors",
              item.danger
                ? "text-dizajno-danger hover:bg-dizajno-surface"
                : "text-dizajno-text hover:bg-dizajno-surface",
              item.disabled ? "opacity-50 cursor-not-allowed" : "",
            ].join(" ")}
          >
            {item.icon && (
              <span className="w-4 h-4 flex-shrink-0">{item.icon}</span>
            )}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
