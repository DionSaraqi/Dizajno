"use client";

import React, { forwardRef } from "react";

const variantStyles = {
  primary:
    "bg-dizajno-accent hover:bg-dizajno-accent-hover text-white",
  secondary:
    "bg-dizajno-elevated hover:bg-dizajno-border text-dizajno-text",
  ghost:
    "bg-transparent hover:bg-dizajno-elevated text-dizajno-muted hover:text-dizajno-text",
  danger:
    "bg-dizajno-danger hover:bg-red-500 text-white",
} as const;

const sizeStyles = {
  sm: "w-7 h-7",
  md: "w-8 h-8",
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
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        title={tooltip}
        disabled={disabled}
        className={[
          "inline-flex items-center justify-center rounded-md transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-dizajno-accent/50",
          sizeStyles[size],
          active
            ? "bg-dizajno-accent text-white"
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
