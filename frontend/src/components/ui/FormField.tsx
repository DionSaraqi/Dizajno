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
  /** Override the auto-generated id used to link the label and control. */
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}

type InjectableProps = {
  id?: string;
  invalid?: boolean;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-describedby"?: string;
  "aria-required"?: boolean;
};

/**
 * Wraps an input with a label, optional hint, and inline error message.
 * Designed to compose with Input/Textarea/Select/Slider.
 *
 * When the child is a single element, the label and a11y attributes are wired
 * automatically — no need to thread an id through every call site:
 * - `<label htmlFor>` ↔ control `id` (auto-generated via useId, or `htmlFor`),
 * - `aria-describedby` points at the description + error/hint text,
 * - `aria-invalid` (+ visual `invalid` on component children) reflects `error`.
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
  const autoId = React.useId();
  const fieldId = htmlFor ?? autoId;
  const messageId = `${fieldId}-message`;
  const descriptionId = `${fieldId}-description`;
  const hasMessage = Boolean(error || hint);

  const isElement = React.isValidElement(children);
  const labelFor = isElement || htmlFor ? fieldId : undefined;

  let control: React.ReactNode = children;
  if (isElement) {
    const child = children as React.ReactElement<InjectableProps>;
    const childProps = child.props;
    // Host elements (raw <input>) don't understand the custom `invalid` prop —
    // only pass it to component children (Input/Textarea/Select).
    const isHostElement = typeof child.type === "string";

    const describedBy =
      [
        childProps["aria-describedby"],
        description ? descriptionId : null,
        hasMessage ? messageId : null,
      ]
        .filter(Boolean)
        .join(" ") || undefined;

    control = React.cloneElement<InjectableProps>(child, {
      id: childProps.id ?? fieldId,
      "aria-describedby": describedBy,
      "aria-invalid": error ? true : childProps["aria-invalid"],
      "aria-required": required || childProps["aria-required"],
      ...(isHostElement
        ? {}
        : { invalid: childProps.invalid ?? (error ? true : undefined) }),
    });
  }

  return (
    <div className={["flex flex-col gap-1.5", className].join(" ")}>
      {(label || rightLabel) && (
        <div className="flex items-center justify-between gap-3">
          {label && (
            <label
              htmlFor={labelFor}
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
        <p
          id={descriptionId}
          className="text-[12.5px] text-dizajno-muted leading-relaxed -mt-0.5"
        >
          {description}
        </p>
      )}
      {control}
      {(error || hint) && (
        <p
          id={messageId}
          role={error ? "alert" : undefined}
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
