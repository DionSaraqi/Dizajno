import { toast } from "sonner";

import { errorTitle, toNormalizedError } from "./apiError";

export interface ErrorToastOptions {
  /** Verb phrase naming what failed, e.g. "save your changes". */
  action?: string;
  /** Stable id so repeated failures replace the toast instead of stacking. */
  id?: string;
  /** Label for a recovery button. Requires `onRetry`. */
  retryLabel?: string;
  onRetry?: () => void;
}

/**
 * Surfaces an error as a toast.
 *
 * Reach for this only when there is nowhere on screen to put an inline
 * message — a background job, or an action whose surface has already closed.
 * Anything the user must read or act on belongs in an `ApiErrorAlert` instead:
 * a toast can be missed, and it sits outside the flow of the thing that failed.
 *
 * Error toasts never auto-dismiss. A message on a timer is an unadjustable
 * time limit (WCAG 2.2.1) and can expire before a screen-reader user reaches it.
 */
export function toastApiError(error: unknown, options: ErrorToastOptions = {}): void {
  const normalized = toNormalizedError(error);

  if (normalized.technical) {
    // eslint-disable-next-line no-console
    console.error("[api]", normalized.technical);
  }

  toast.error(errorTitle(error, options.action), {
    description: normalized.messages[0] ?? normalized.detail,
    duration: Number.POSITIVE_INFINITY,
    // A stable id collapses a burst of identical failures (a polling query, a
    // retrying autosave) into one toast rather than a stack of them.
    id: options.id ?? `api-error:${normalized.kind}:${options.action ?? ""}`,
    action:
      options.onRetry && normalized.retryable
        ? { label: options.retryLabel ?? "Try again", onClick: options.onRetry }
        : undefined,
  });
}
