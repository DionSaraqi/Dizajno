"use client";

import React, { forwardRef } from "react";

const variantStyles = {
  primary:
    "bg-dizajno-text hover:bg-zinc-700 text-white shadow-card-sm border border-dizajno-text",
  accent:
    "bg-dizajno-accent hover:bg-dizajno-accent-hover text-white shadow-card-sm border border-dizajno-accent",
  secondary:
    "bg-dizajno-surface hover:bg-dizajno-elevated text-dizajno-text border border-dizajno-border shadow-card-sm",
  ghost:
    "bg-transparent hover:bg-dizajno-elevated text-dizajno-text-subtle hover:text-dizajno-text border border-transparent",
  danger:
    "bg-dizajno-danger hover:bg-red-700 text-white shadow-card-sm border border-dizajno-danger",
  "danger-outline":
    "bg-dizajno-surface hover:bg-dizajno-danger-soft text-dizajno-danger border border-dizajno-border hover:border-dizajno-danger/40 shadow-card-sm",
} as const;

const sizeStyles = {
  xs: "h-7 px-2.5 text-xs gap-1.5 rounded-md",
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-md",
  md: "h-9 px-3.5 text-sm gap-2 rounded-lg",
  lg: "h-10 px-4 text-sm gap-2 rounded-lg",
} as const;

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variantStyles;
  size?: keyof typeof sizeStyles;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "secondary",
      size = "md",
      loading = false,
      disabled,
      className = "",
      children,
      leftIcon,
      rightIcon,
      fullWidth = false,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        className={[
          "inline-flex items-center justify-center font-medium",
          "transition-[background-color,border-color,color,box-shadow,transform] duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dizajno-accent/40 focus-visible:ring-offset-1 focus-visible:ring-offset-dizajno-bg",
          "active:scale-[0.985]",
          variantStyles[variant],
          sizeStyles[size],
          fullWidth ? "w-full" : "",
          isDisabled
            ? "opacity-50 cursor-not-allowed active:scale-100"
            : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      >
        {loading ? (
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
              strokeWidth="3"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        ) : (
          leftIcon && <span className="shrink-0 [&_svg]:size-4">{leftIcon}</span>
        )}
        {children}
        {!loading && rightIcon && (
          <span className="shrink-0 [&_svg]:size-4">{rightIcon}</span>
        )}
      </button>
    );
  },
);

Button.displayName = "Button";

export default Button;
