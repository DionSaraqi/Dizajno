"use client";

import React from "react";
import { Search, X } from "lucide-react";

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
}: SearchInputProps) {
  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dizajno-muted pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={[
          "w-full pl-8 pr-8 py-1.5 text-sm rounded-md",
          "bg-dizajno-surface border border-dizajno-border",
          "text-dizajno-text placeholder:text-dizajno-muted",
          "focus:outline-none focus:ring-2 focus:ring-dizajno-accent/50 focus:border-dizajno-accent",
          "transition-colors",
        ].join(" ")}
      />
      {value.length > 0 && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-dizajno-muted hover:text-dizajno-text transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
