"use client";

import React from "react";
import { AlertCircle } from "lucide-react";

import { errorTitle, toNormalizedError } from "@/lib/apiError";

export interface ErrorSummaryProps {
  /** Anything thrown. Renders nothing when null/undefined. */
  error: unknown;
  /**
   * Maps a field name from the server's validation map to the DOM id of its
   * input, turning each message into a link that focuses the offending field.
   *
   * Field names arrive camelCased (`email`, `basePrice`) — see `toFieldName`.
   * Any field with no entry here still renders, as plain text; a message that
   * silently vanished because the backend renamed a property would be worse
   * than one that merely isn't clickable.
   */
  fieldIds?: Record<string, string>;
  /** Verb phrase naming what failed, e.g. "sign in". */
  action?: string;
  className?: string;
}

/**
 * Form-level error summary shown after a failed submit.
 *
 * Follows the GOV.UK validation contract: summary at the top of the form,
 * focus moved to it so keyboard and screen-reader users learn the submit
 * failed, and each message linked to the field it belongs to.
 *
 * It takes focus rather than `role="alert"` — doing both makes several screen
 * readers announce the same content twice.
 */
export default function ErrorSummary({
  error,
  fieldIds,
  action,
  className = "",
}: ErrorSummaryProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const normalized = error == null ? null : toNormalizedError(error);

  // Re-focus whenever the failure changes, so a second failed submit announces
  // itself too rather than sitting silently on screen.
  const signature = normalized
    ? `${normalized.kind}:${normalized.messages.join("|")}`
    : "";

  React.useEffect(() => {
    if (signature) containerRef.current?.focus();
  }, [signature]);

  if (!normalized) return null;

  const fieldEntries = Object.entries(normalized.fieldErrors ?? {});
  // Messages already covered by a field entry would otherwise appear twice.
  const fieldMessages = new Set(fieldEntries.flatMap(([, list]) => list));
  const generalMessages = normalized.messages.filter((m) => !fieldMessages.has(m));

  const items: Array<{ key: string; message: string; targetId?: string }> = [
    ...fieldEntries.flatMap(([field, list]) =>
      list.map((message, index) => ({
        key: `${field}-${index}`,
        message,
        targetId: fieldIds?.[field],
      })),
    ),
    ...generalMessages.map((message, index) => ({
      key: `general-${index}`,
      message,
    })),
  ];

  if (items.length === 0) {
    items.push({ key: "detail", message: normalized.detail });
  }

  const hasLinks = items.some((item) => item.targetId);

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      className={[
        "flex items-start gap-2.5 rounded-xl border border-dizajno-danger-border",
        "bg-dizajno-danger-soft px-4 py-3.5 animate-fade-in",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dizajno-danger/30",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span aria-hidden className="mt-px shrink-0 text-dizajno-danger">
        <AlertCircle className="size-4" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold leading-snug tracking-tight text-dizajno-danger-ink">
          {items.length > 1 ? "There is a problem" : errorTitle(error, action)}
        </p>

        {items.length === 1 && !hasLinks ? (
          <p className="mt-1 text-[13px] leading-relaxed text-dizajno-text-subtle">
            {items[0].message}
          </p>
        ) : (
          <ul className="mt-1.5 space-y-1 text-[13px] leading-relaxed text-dizajno-text-subtle">
            {items.map((item) => (
              <li key={item.key}>
                {item.targetId ? (
                  <a
                    href={`#${item.targetId}`}
                    onClick={(event) => {
                      // Focus the input directly — a bare hash jump scrolls the
                      // label into view without putting the caret anywhere.
                      const target = document.getElementById(item.targetId!);
                      if (!target) return;
                      event.preventDefault();
                      target.focus();
                      target.scrollIntoView({ block: "center", behavior: "smooth" });
                    }}
                    className="text-dizajno-danger underline underline-offset-2 hover:text-dizajno-danger-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dizajno-danger/30 rounded"
                  >
                    {item.message}
                  </a>
                ) : (
                  item.message
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
