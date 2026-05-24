"use client";

import React, { forwardRef } from "react";

const variantStyles = {
  primary:
    "bg-dizajno-text hover:bg-zinc-700 text-white border border-dizajno-text",
  accent:
    "bg-dizajno-accent hover:bg-dizajno-accent-hover text-white border border-dizajno-accent",
  secondary:
    "bg-dizajno-surface hover:bg-dizajno-elevated text-dizajno-text border border-dizajno-border",
  ghost:
    "bg-transparent hover:bg-dizajno-elevated text-dizajno-text-subtle hover:text-dizajno-text border border-transparent",
  danger:
    "bg-transparent hover:bg-dizajno-danger-soft text-dizajno-danger border border-transparent hover:border-dizajno-danger/30",
} as const;

const sizeStyles = {
  xs: "w-6 h-6 [&_svg]:size-3.5",
  sm: "w-7 h-7 [&_svg]:size-3.5",
  md: "w-8 h-8 [&_svg]:size-4",
  lg: "w-9 h-9 [&_svg]:size-4",
} as const;

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variantStyles;
  size?: keyof typeof sizeStyles;
  tooltip?: string;
  active?: boolean;
}

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      variant = "ghost",
      size = "md",
      tooltip,
      active = false,
      disabled,
      className = "",
      children,
      type = "button",
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        title={tooltip}
        disabled={disabled}
        className={[
          "inline-flex items-center justify-center rounded-md transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dizajno-accent/40",
          sizeStyles[size],
          active
            ? "bg-dizajno-accent-soft text-dizajno-accent border border-dizajno-accent/30"
            : variantStyles[variant],
          disabled ? "opacity-50 cursor-not-allowed" : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      >
        {children}
      </button>
    );
  },
);

IconButton.displayName = "IconButton";

export default IconButton;
