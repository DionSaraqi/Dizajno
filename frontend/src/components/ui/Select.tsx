"use client";

import React, { forwardRef } from "react";
import { ChevronDown } from "lucide-react";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
  size?: "sm" | "md";
}

const sizeMap = {
  sm: "h-8 text-[13px] pl-3 pr-9",
  md: "h-9 text-sm pl-3 pr-9",
};

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ invalid = false, size = "md", className = "", children, ...props }, ref) => {
    return (
      <div
        className={[
          "relative w-full",
          props.disabled ? "opacity-60" : "",
        ].join(" ")}
      >
        <select
          ref={ref}
          {...props}
          className={[
            "appearance-none w-full bg-dizajno-surface rounded-lg border",
            "text-dizajno-text",
            "transition-[box-shadow,border-color] duration-150",
            "outline-none cursor-pointer",
            invalid
              ? "border-dizajno-danger/50 focus:ring-2 focus:ring-dizajno-danger/20"
              : "border-dizajno-border hover:border-dizajno-border-strong focus:border-dizajno-accent focus:ring-2 focus:ring-dizajno-accent/15",
            sizeMap[size],
            className,
          ].join(" ")}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-dizajno-muted"
          size={14}
        />
      </div>
    );
  },
);

Select.displayName = "Select";

export default Select;
