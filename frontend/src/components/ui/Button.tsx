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
  sm: "px-2.5 py-1 text-xs",
  md: "px-3.5 py-1.5 text-sm",
} as const;

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variantStyles;
  size?: keyof typeof sizeStyles;
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      className = "",
      children,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={[
          "rounded-md transition-colors font-medium",
          "focus:outline-none focus:ring-2 focus:ring-dizajno-accent/50",
          variantStyles[variant],
          sizeStyles[size],
          isDisabled ? "opacity-50 cursor-not-allowed" : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      >
        {loading ? (
          <span className="inline-flex items-center gap-1.5">
            <svg
              className="animate-spin h-3.5 w-3.5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            {children}
          </span>
        ) : (
          children
        )}
      </button>
    );
  },
);

Button.displayName = "Button";

export default Button;
