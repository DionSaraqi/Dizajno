"use client";

import React from "react";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Slot for a Button (or two) underneath the description. */
  action?: React.ReactNode;
  /** When true, renders without the surrounding border/padding card. */
  bare?: boolean;
  className?: string;
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  bare = false,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={[
        "flex flex-col items-center justify-center text-center",
        "py-12 px-6",
        bare
          ? ""
          : "rounded-xl border border-dashed border-dizajno-border bg-dizajno-surface/60",
        className,
      ].join(" ")}
    >
      {icon && (
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-dizajno-elevated text-dizajno-muted [&_svg]:size-5">
          {icon}
        </div>
      )}
      <h4 className="text-[15px] font-semibold text-dizajno-text tracking-tight">
        {title}
      </h4>
      {description && (
        <p className="mt-1.5 max-w-sm text-[13px] text-dizajno-muted leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-5 flex items-center gap-2">{action}</div>}
    </div>
  );
}
