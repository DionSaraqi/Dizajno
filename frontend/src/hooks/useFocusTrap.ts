"use client";

import { useEffect, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  );
}

/**
 * Traps keyboard focus within `containerRef` while `active` is true:
 * - moves focus into the container on activate (first focusable, else the container),
 * - cycles Tab / Shift+Tab within the container (and pulls focus back in if it
 *   ever escapes — e.g. to a portalled element),
 * - restores focus to the previously focused element on deactivate.
 *
 * The container should carry `tabIndex={-1}` so it can receive focus when it
 * holds no focusable children.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
): void {
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Move focus into the dialog on open.
    const focusables = getFocusable(container);
    (focusables[0] ?? container).focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const items = getFocusable(container as HTMLElement);
      if (items.length === 0) {
        e.preventDefault();
        (container as HTMLElement).focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (activeEl === first || !container!.contains(activeEl)) {
          e.preventDefault();
          last.focus();
        }
      } else if (activeEl === last || !container!.contains(activeEl)) {
        e.preventDefault();
        first.focus();
      }
    }

    // Listen on the document (capture phase) so the trap still fires — and the
    // "focus escaped" recovery branch is reachable — even if focus leaves the
    // container (e.g. to a portalled toast or a programmatically focused node).
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      // Restore focus to the trigger if it is still in the document.
      if (
        previouslyFocused &&
        document.contains(previouslyFocused) &&
        typeof previouslyFocused.focus === "function"
      ) {
        previouslyFocused.focus();
      }
    };
  }, [active, containerRef]);
}

export default useFocusTrap;
