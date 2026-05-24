"use client";

import React from "react";
import { Search, X } from "lucide-react";

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Compact (32px) or default (36px) height. */
  size?: "sm" | "md";
  /** Right-aligned hint like "⌘K". */
  hint?: React.ReactNode;
  className?: string;
  autoFocus?: boolean;
}

export default function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  size = "md",
  hint,
  className = "",
  autoFocus = false,
}: SearchInputProps) {
  const heightClass = size === "sm" ? "h-8 text-[13px]" : "h-9 text-sm";
  return (
    <div
      className={[
        "group relative flex items-center w-full rounded-lg border bg-dizajno-surface",
        "border-dizajno-border hover:border-dizajno-border-strong",
        "focus-within:border-dizajno-accent focus-within:ring-2 focus-within:ring-dizajno-accent/15",
        "transition-[box-shadow,border-color] duration-150",
        heightClass,
        className,
      ].join(" ")}
    >
      <Search
        size={14}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-dizajno-muted pointer-events-none"
      />
      <input
        type="text"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={[
          "w-full bg-transparent pl-9 pr-9 outline-none",
          "text-dizajno-text placeholder:text-dizajno-muted-subtle",
        ].join(" ")}
      />
      {value.length > 0 ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-dizajno-muted hover:text-dizajno-text transition-colors p-0.5 rounded"
          aria-label="Clear"
        >
          <X size={14} />
        </button>
      ) : (
        hint && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-dizajno-muted-subtle font-mono pointer-events-none">
            {hint}
          </span>
        )
      )}
    </div>
  );
}
