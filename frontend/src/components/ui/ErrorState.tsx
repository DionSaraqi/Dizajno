"use client";

import React from "react";
import { AlertCircle, Ban, RefreshCw, SearchX, WifiOff } from "lucide-react";

import { errorTitle, toNormalizedError, type ApiErrorKind } from "@/lib/apiError";
import Button from "./Button";

/**
 * Icon per failure kind. Pairing a distinct glyph with the colour and the text
 * gives three redundant signals, so the state never depends on colour alone.
 */
const KIND_ICONS: Partial<Record<ApiErrorKind, React.ComponentType<{ className?: string }>>> = {
  network: WifiOff,
  unavailable: WifiOff,
  "not-found": SearchX,
  forbidden: Ban,
  unauthorized: Ban,
  "session-expired": Ban,
};

export interface ErrorStateProps {
  error: unknown;
  /** Verb phrase naming what failed, e.g. "load your projects". */
  action?: string;
  onRetry?: () => void;
  /** Extra recovery affordances (a "Back to projects" link, say). */
  children?: React.ReactNode;
  /** Drops the surrounding card so it can sit inside an existing panel. */
  bare?: boolean;
  className?: string;
}

/**
 * A whole-section failure state, for when a load fails and there is simply no
 * content to show. Mirrors `EmptyState` so a failed list and an empty list
 * differ only in tone and affordance.
 *
 * Use this only when the section genuinely has nothing to render. If usable
 * content is already on screen, prefer `ApiErrorAlert` above it — replacing a
 * working view with an error page loses the user's context.
 */
export default function ErrorState({
  error,
  action,
  onRetry,
  children,
  bare = false,
  className = "",
}: ErrorStateProps) {
  const normalized = toNormalizedError(error);
  const Icon = KIND_ICONS[normalized.kind] ?? AlertCircle;
  const messages = normalized.messages;

  React.useEffect(() => {
    if (normalized.technical) {
      // eslint-disable-next-line no-console
      console.error("[error-state]", normalized.technical);
    }
  }, [normalized.technical]);

  return (
    <div
      role="alert"
      className={[
        "flex flex-col items-center justify-center text-center py-12 px-6",
        bare ? "" : "rounded-xl border border-dizajno-danger-border bg-dizajno-danger-soft/50",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-dizajno-danger-soft text-dizajno-danger">
        <Icon className="size-5" />
      </div>

      <h4 className="text-[15px] font-semibold tracking-tight text-dizajno-danger-ink">
        {errorTitle(error, action)}
      </h4>

      <div className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-dizajno-text-subtle">
        {messages.length > 1 ? (
          <ul className="space-y-0.5">
            {messages.map((message, index) => (
              <li key={`${index}-${message}`}>{message}</li>
            ))}
          </ul>
        ) : (
          (messages[0] ?? normalized.detail)
        )}
      </div>

      {normalized.traceId && (
        <p className="mt-2 font-mono text-[11px] text-dizajno-muted-subtle">
          Reference: {normalized.traceId}
        </p>
      )}

      {(onRetry && normalized.retryable) || children ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {onRetry && normalized.retryable && (
            <Button size="sm" variant="secondary" leftIcon={<RefreshCw />} onClick={onRetry}>
              Try again
            </Button>
          )}
          {children}
        </div>
      ) : null}
    </div>
  );
}
