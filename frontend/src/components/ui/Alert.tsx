"use client";

import React from "react";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Info,
  X,
} from "lucide-react";

export type AlertTone = "danger" | "warning" | "success" | "info";

const toneStyles = {
  danger: {
    container: "border-dizajno-danger-border bg-dizajno-danger-soft",
    icon: "text-dizajno-danger",
    title: "text-dizajno-danger-ink",
    defaultIcon: AlertCircle,
  },
  warning: {
    container: "border-dizajno-warning-border bg-dizajno-warning-soft",
    icon: "text-dizajno-warning",
    title: "text-dizajno-warning-ink",
    defaultIcon: AlertTriangle,
  },
  success: {
    container: "border-dizajno-success-border bg-dizajno-success-soft",
    icon: "text-dizajno-success",
    title: "text-dizajno-success-ink",
    defaultIcon: CheckCircle2,
  },
  info: {
    container: "border-dizajno-accent-border bg-dizajno-accent-soft",
    icon: "text-dizajno-accent",
    title: "text-dizajno-accent-ink",
    defaultIcon: Info,
  },
} as const;

export interface AlertProps {
  tone?: AlertTone;
  /** Short noun phrase. Omit for a single-line alert with no heading. */
  title?: React.ReactNode;
  /** The body. A string array renders as a list; anything else renders as-is. */
  children?: React.ReactNode;
  /** Overrides the tone's default icon. Pass `null` to drop it entirely. */
  icon?: React.ReactNode | null;
  /** Slot for recovery buttons ("Try again", "Sign in"), shown under the body. */
  action?: React.ReactNode;
  /** Renders a dismiss control. Omit for errors the user must resolve. */
  onDismiss?: () => void;
  /**
   * How assistive tech announces this.
   * - `alert` (default for danger) — announced immediately; correct for a
   *   failure that appears in response to something the user just did.
   * - `status` — announced at the next graceful pause.
   * - `off` — no announcement; for alerts already present on first paint,
   *   where an interruption would be noise.
   *
   * Never combine with moving focus to the alert: several screen readers
   * announce such an element twice. `ErrorSummary` focuses instead.
   */
  live?: "alert" | "status" | "off";
  /** Correlation id from the server, shown in the details disclosure. */
  traceId?: string;
  /**
   * Diagnostic text. Logged to the console always, but only rendered — behind
   * a collapsed disclosure — outside production, since server exception text
   * can name internal paths and configuration keys.
   */
  technical?: string;
  size?: "sm" | "md";
  className?: string;
}

/**
 * The one error/notice surface for the app.
 *
 * Deliberately persistent and non-auto-dismissing: an error that vanishes on a
 * timer is an unadjustable time limit (WCAG 2.2.1) and can disappear before a
 * screen-reader user reaches it.
 */
export default function Alert({
  tone = "danger",
  title,
  children,
  icon,
  action,
  onDismiss,
  live,
  traceId,
  technical,
  size = "md",
  className = "",
}: AlertProps) {
  const styles = toneStyles[tone];
  const DefaultIcon = styles.defaultIcon;
  const politeness = live ?? (tone === "danger" ? "alert" : "status");

  // Diagnostics always reach the console, whether or not they are rendered.
  React.useEffect(() => {
    if (technical) {
      // eslint-disable-next-line no-console
      console.error(`[${tone}]`, title ?? "", technical);
    }
  }, [technical, tone, title]);

  const showTechnical =
    process.env.NODE_ENV !== "production" && Boolean(technical);
  const hasDisclosure = showTechnical || Boolean(traceId);

  return (
    <div
      role={politeness === "alert" ? "alert" : politeness === "status" ? "status" : undefined}
      className={[
        "flex items-start gap-2.5 border animate-fade-in",
        size === "sm" ? "rounded-lg px-3 py-2.5" : "rounded-xl px-4 py-3.5",
        styles.container,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {icon !== null && (
        <span
          aria-hidden
          className={["shrink-0 [&_svg]:size-4 mt-px", styles.icon].join(" ")}
        >
          {icon ?? <DefaultIcon />}
        </span>
      )}

      <div className="min-w-0 flex-1">
        {title && (
          <p
            className={[
              "text-[13px] font-semibold leading-snug tracking-tight",
              styles.title,
            ].join(" ")}
          >
            {title}
          </p>
        )}
        {children != null && (
          <div
            className={[
              "text-[13px] leading-relaxed text-dizajno-text-subtle",
              title ? "mt-1" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {children}
          </div>
        )}

        {hasDisclosure && (
          <ErrorDisclosure
            traceId={traceId}
            technical={showTechnical ? technical : undefined}
          />
        )}

        {action && <div className="mt-2.5 flex flex-wrap items-center gap-2">{action}</div>}
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className={[
            "-mr-1 -mt-0.5 shrink-0 rounded-md p-1 transition-colors",
            "text-dizajno-muted hover:text-dizajno-text hover:bg-black/5",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dizajno-accent/40",
          ].join(" ")}
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/** Collapsed technical detail with a copy-to-clipboard affordance. */
function ErrorDisclosure({
  traceId,
  technical,
}: {
  traceId?: string;
  technical?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const payload = [traceId && `Reference: ${traceId}`, technical]
    .filter(Boolean)
    .join("\n\n");

  React.useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
    } catch {
      // Clipboard blocked (insecure context, denied permission) — the text is
      // already on screen and selectable, so there is nothing to recover from.
    }
  }

  return (
    <details className="group mt-2">
      <summary
        className={[
          "inline-flex cursor-pointer list-none items-center gap-1 text-[11.5px]",
          "text-dizajno-muted hover:text-dizajno-text-subtle transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dizajno-accent/40 rounded",
        ].join(" ")}
      >
        <span className="transition-transform group-open:rotate-90">›</span>
        Technical details
      </summary>
      <div className="mt-1.5 flex items-start gap-2">
        <pre className="min-w-0 flex-1 overflow-x-auto rounded-md bg-black/[0.04] px-2 py-1.5 font-mono text-[11px] leading-relaxed text-dizajno-muted whitespace-pre-wrap break-words">
          {payload}
        </pre>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? "Copied" : "Copy technical details"}
          className={[
            "shrink-0 rounded-md p-1.5 transition-colors",
            "text-dizajno-muted hover:text-dizajno-text hover:bg-black/5",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dizajno-accent/40",
          ].join(" ")}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </button>
      </div>
    </details>
  );
}
