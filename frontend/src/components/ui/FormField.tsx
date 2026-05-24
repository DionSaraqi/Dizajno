"use client";

import React from "react";

export interface FormFieldProps {
  label?: React.ReactNode;
  /** Renders a small required-marker dot next to the label. */
  required?: boolean;
  /** Hint shown above the field, below the label. */
  description?: React.ReactNode;
  /** Helper text shown below the field. Overridden by `error`. */
  hint?: React.ReactNode;
  /** Error text shown below the field. When set, takes precedence over hint. */
  error?: React.ReactNode;
  /** Optional right-aligned secondary element next to the label (e.g. "Forgot?" link). */
  rightLabel?: React.ReactNode;
  /** Apply the field's id to the label's `htmlFor`. */
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Wraps an input with a label, optional hint, and inline error message.
 * Designed to compose with Input/Textarea/Select/Slider.
 */
export default function FormField({
  label,
  required = false,
  description,
  hint,
  error,
  rightLabel,
  htmlFor,
  children,
  className = "",
}: FormFieldProps) {
  return (
    <div className={["flex flex-col gap-1.5", className].join(" ")}>
      {(label || rightLabel) && (
        <div className="flex items-center justify-between gap-3">
          {label && (
            <label
              htmlFor={htmlFor}
              className="text-[13px] font-medium text-dizajno-text leading-none"
            >
              {label}
              {required && (
                <span
                  aria-hidden
                  className="inline-block w-1 h-1 rounded-full bg-dizajno-danger align-top ml-1 translate-y-1"
                />
              )}
            </label>
          )}
          {rightLabel && <div className="text-[12px]">{rightLabel}</div>}
        </div>
      )}
      {description && (
        <p className="text-[12.5px] text-dizajno-muted leading-relaxed -mt-0.5">
          {description}
        </p>
      )}
      {children}
      {(error || hint) && (
        <p
          className={[
            "text-[12px] leading-snug",
            error ? "text-dizajno-danger" : "text-dizajno-muted",
          ].join(" ")}
        >
          {error || hint}
        </p>
      )}
    </div>
  );
}
