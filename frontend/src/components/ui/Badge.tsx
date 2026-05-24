"use client";

import React from "react";

const toneStyles = {
  neutral:
    "bg-dizajno-elevated text-dizajno-text-subtle border-dizajno-border",
  accent:
    "bg-dizajno-accent-soft text-dizajno-accent-ink border-dizajno-accent/20",
  success:
    "bg-dizajno-success-soft text-dizajno-success border-dizajno-success/20",
  warning:
    "bg-dizajno-warning-soft text-dizajno-warning border-dizajno-warning/25",
  danger:
    "bg-dizajno-danger-soft text-dizajno-danger border-dizajno-danger/20",
  outline:
    "bg-transparent text-dizajno-text-subtle border-dizajno-border",
} as const;

const dotColor = {
  neutral: "bg-dizajno-muted",
  accent: "bg-dizajno-accent",
  success: "bg-dizajno-success",
  warning: "bg-dizajno-warning",
  danger: "bg-dizajno-danger",
  outline: "bg-dizajno-muted",
} as const;

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: keyof typeof toneStyles;
  /** Show a colored leading dot (status indicator). */
  dot?: boolean;
  /** Compact monospace mode for SKUs, IDs, timestamps. */
  mono?: boolean;
  /** Small or medium size. */
  size?: "sm" | "md";
}

export default function Badge({
  tone = "neutral",
  dot = false,
  mono = false,
  size = "md",
  className = "",
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border",
        "font-medium leading-none whitespace-nowrap",
        size === "sm"
          ? "px-1.5 py-0.5 text-[10.5px]"
          : "px-2 py-0.5 text-[11.5px]",
        mono ? "font-mono tracking-tight" : "tracking-tight",
        toneStyles[tone],
        className,
      ].join(" ")}
      {...props}
    >
      {dot && (
        <span
          className={["inline-block w-1.5 h-1.5 rounded-full", dotColor[tone]].join(
            " ",
          )}
        />
      )}
      {children}
    </span>
  );
}
