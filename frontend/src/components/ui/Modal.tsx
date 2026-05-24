"use client";

import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  /** Optional subtitle / description directly under the title. */
  description?: ReactNode;
  /** Width preset. Falls back to `md`. */
  size?: "sm" | "md" | "lg" | "xl";
  /** Footer slot — typically a row of Buttons. */
  footer?: ReactNode;
  /** Hide the close button + suppress the backdrop click handler. */
  modal?: boolean;
  children?: ReactNode;
}

const sizeMap: Record<NonNullable<ModalProps["size"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
};

/**
 * Generic modal shell — surface + header + body + footer.
 * Use this for forms, multi-step flows, non-confirm prompts.
 * For yes/no/destructive confirms, prefer ConfirmDialog.
 */
export default function Modal({
  open,
  onClose,
  title,
  description,
  size = "md",
  footer,
  modal = false,
  children,
}: ModalProps) {
  // Lock body scroll while modal is open
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape" && !modal) onClose();
    }
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open, modal, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
    >
      <div
        className="absolute inset-0 bg-zinc-950/40 backdrop-blur-[2px]"
        onClick={modal ? undefined : onClose}
      />
      <div
        className={[
          "relative w-full bg-dizajno-surface rounded-2xl shadow-card-lg border border-dizajno-border",
          "animate-scale-in",
          sizeMap[size],
        ].join(" ")}
      >
        {(title || !modal) && (
          <header className="flex items-start justify-between gap-4 px-5 pt-5 pb-4">
            <div className="flex-1 min-w-0">
              {title && (
                <h2
                  id="modal-title"
                  className="text-[15px] font-semibold text-dizajno-text leading-tight tracking-tight"
                >
                  {title}
                </h2>
              )}
              {description && (
                <p className="mt-1 text-[13px] text-dizajno-muted leading-relaxed">
                  {description}
                </p>
              )}
            </div>
            {!modal && (
              <button
                onClick={onClose}
                aria-label="Close dialog"
                className="shrink-0 -m-1.5 p-1.5 rounded-md text-dizajno-muted hover:text-dizajno-text hover:bg-dizajno-elevated transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </header>
        )}

        <div className="px-5 pb-5">{children}</div>

        {footer && (
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-dizajno-border bg-dizajno-bg/40 rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
