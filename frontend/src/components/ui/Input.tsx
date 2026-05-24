"use client";

import React, { forwardRef } from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  invalid?: boolean;
  size?: "sm" | "md";
}

const sizeMap = {
  sm: "h-8 text-[13px]",
  md: "h-9 text-sm",
};

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      leftIcon,
      rightIcon,
      invalid = false,
      size = "md",
      className = "",
      ...props
    },
    ref,
  ) => {
    return (
      <div
        className={[
          "group relative flex items-center w-full",
          "rounded-lg border bg-dizajno-surface",
          "transition-[box-shadow,border-color] duration-150",
          invalid
            ? "border-dizajno-danger/50 focus-within:ring-2 focus-within:ring-dizajno-danger/20"
            : "border-dizajno-border hover:border-dizajno-border-strong focus-within:border-dizajno-accent focus-within:ring-2 focus-within:ring-dizajno-accent/15",
          sizeMap[size],
          props.disabled ? "opacity-60 bg-dizajno-elevated" : "",
          className,
        ].join(" ")}
      >
        {leftIcon && (
          <span className="flex items-center justify-center pl-3 text-dizajno-muted [&_svg]:size-4">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          {...props}
          className={[
            "w-full bg-transparent outline-none placeholder:text-dizajno-muted-subtle",
            "text-dizajno-text",
            leftIcon ? "pl-2" : "pl-3",
            rightIcon ? "pr-2" : "pr-3",
            "py-1.5",
          ].join(" ")}
        />
        {rightIcon && (
          <span className="flex items-center justify-center pr-3 text-dizajno-muted [&_svg]:size-4">
            {rightIcon}
          </span>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";

export default Input;
