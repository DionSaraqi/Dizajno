"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Optional descriptive text shown above any custom body content. */
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Affects the primary button styling — `danger` is for destructive actions. */
  confirmTone?: "default" | "danger";
  /** Disables both buttons while a mutation is in flight. */
  busy?: boolean;
  /** Independently disables the confirm button (e.g. while a form field is invalid). */
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Optional custom body (form fields, etc.) rendered between the description and buttons. */
  children?: ReactNode;
}

/**
 * Generic confirmation modal styled to match the rest of the Dizajno UI.
 * Used in place of native `window.confirm` / `window.prompt` so destructive
 * actions read consistently with the surrounding app.
 */
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  confirmTone = "default",
  busy = false,
  confirmDisabled = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  if (!open) return null;

  const confirmClasses =
    confirmTone === "danger"
      ? "border-red-500/40 bg-red-500/15 hover:bg-red-500/25 text-red-300"
      : "border-white/20 bg-white/10 hover:bg-white/20 text-dizajno-text";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-lg border border-white/10 bg-dizajno-bg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-5 py-3 border-b border-white/10">
          <h2 className="font-mono text-sm tracking-widest uppercase text-dizajno-text">
            {title}
          </h2>
          <button
            onClick={onCancel}
            className="text-dizajno-muted hover:text-dizajno-text"
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </header>

        <div className="p-5 space-y-4">
          {description && (
            <p className="font-mono text-sm text-dizajno-text/90 leading-relaxed">
              {description}
            </p>
          )}
          {children}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onCancel}
              disabled={busy}
              className="flex-1 rounded border border-white/10 bg-black/30 hover:bg-white/5 disabled:opacity-50 py-2 font-mono text-xs tracking-wider text-dizajno-muted hover:text-dizajno-text transition"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              disabled={busy || confirmDisabled}
              className={`flex-1 rounded border disabled:opacity-40 disabled:cursor-not-allowed py-2 font-mono text-xs tracking-wider transition ${confirmClasses}`}
            >
              {busy ? "Working…" : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
