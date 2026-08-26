"use client";

import React from "react";
import { RefreshCw, WifiOff } from "lucide-react";

import { errorTitle, toNormalizedError } from "@/lib/apiError";
import Alert, { type AlertProps } from "./Alert";
import Button from "./Button";

export interface ApiErrorAlertProps
  extends Pick<AlertProps, "onDismiss" | "size" | "live" | "className"> {
  /** Anything thrown — `ApiError`, a plain `Error`, or an unknown value. */
  error: unknown;
  /**
   * Verb phrase naming what failed, e.g. "load your projects". Used to build a
   * specific heading when the server gave no better one — the alternative is
   * the generic "Something went wrong", which tells the user nothing.
   */
  action?: string;
  /** Shows a "Try again" button, but only when retrying could plausibly help. */
  onRetry?: () => void;
  /** Extra recovery affordances rendered next to Try again. */
  children?: React.ReactNode;
}

/**
 * Renders any caught error through the shared Alert.
 *
 * This is the default choice for a failure scoped to a form, a panel, or an
 * action — anywhere the surrounding UI should stay usable.
 */
export default function ApiErrorAlert({
  error,
  action,
  onRetry,
  children,
  ...alertProps
}: ApiErrorAlertProps) {
  const normalized = toNormalizedError(error);
  const title = errorTitle(error, action);
  const messages = normalized.messages;

  return (
    <Alert
      tone="danger"
      title={title}
      icon={normalized.kind === "network" ? <WifiOff /> : undefined}
      traceId={normalized.traceId}
      technical={normalized.technical}
      action={
        (onRetry && normalized.retryable) || children ? (
          <>
            {onRetry && normalized.retryable && (
              <Button size="xs" variant="secondary" leftIcon={<RefreshCw />} onClick={onRetry}>
                Try again
              </Button>
            )}
            {children}
          </>
        ) : undefined
      }
      {...alertProps}
    >
      <ErrorBody messages={messages} detail={normalized.detail} />
    </Alert>
  );
}

/**
 * One message reads as a sentence; several read as a list. Stacking separate
 * banners instead would multiply the announcements and the visual weight.
 */
export function ErrorBody({
  messages,
  detail,
}: {
  messages: string[];
  detail: string;
}) {
  if (messages.length === 0) return <>{detail}</>;
  if (messages.length === 1) return <>{messages[0]}</>;
  return (
    <ul className="list-disc space-y-0.5 pl-4 marker:text-dizajno-muted-subtle">
      {messages.map((message, index) => (
        <li key={`${index}-${message}`}>{message}</li>
      ))}
    </ul>
  );
}
