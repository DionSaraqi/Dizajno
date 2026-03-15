"use client";

import React from "react";

const trackSizes = {
  sm: "w-7 h-4",
  md: "w-9 h-5",
} as const;

const dotSizes = {
  sm: "w-3 h-3",
  md: "w-3.5 h-3.5",
} as const;

const dotTranslate = {
  sm: "translate-x-3",
  md: "translate-x-4",
} as const;

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  size?: "sm" | "md";
  disabled?: boolean;
}

export default function Toggle({
  checked,
  onChange,
  label,
  size = "md",
  disabled = false,
}: ToggleProps) {
  return (
    <label
      className={[
        "inline-flex items-center gap-2 select-none",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
      ].join(" ")}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        className={[
          "relative inline-flex items-center rounded-full transition-colors",
          trackSizes[size],
          checked ? "bg-dizajno-accent" : "bg-dizajno-border",
        ].join(" ")}
      >
        <span
          className={[
            "absolute left-0.5 rounded-full bg-white transition-transform",
            dotSizes[size],
            checked ? dotTranslate[size] : "translate-x-0",
          ].join(" ")}
        />
      </span>
      {label && (
        <span className="text-xs text-dizajno-muted">{label}</span>
      )}
    </label>
  );
}
