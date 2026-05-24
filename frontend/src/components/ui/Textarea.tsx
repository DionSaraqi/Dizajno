"use client";

import React, { forwardRef } from "react";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ invalid = false, className = "", ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        {...props}
        className={[
          "block w-full rounded-lg border bg-dizajno-surface px-3 py-2",
          "text-sm text-dizajno-text placeholder:text-dizajno-muted-subtle",
          "transition-[box-shadow,border-color] duration-150",
          "outline-none",
          invalid
            ? "border-dizajno-danger/50 focus:ring-2 focus:ring-dizajno-danger/20"
            : "border-dizajno-border hover:border-dizajno-border-strong focus:border-dizajno-accent focus:ring-2 focus:ring-dizajno-accent/15",
          props.disabled ? "opacity-60 bg-dizajno-elevated" : "",
          className,
        ].join(" ")}
      />
    );
  },
);

Textarea.displayName = "Textarea";

export default Textarea;
