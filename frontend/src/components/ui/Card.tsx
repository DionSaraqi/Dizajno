"use client";

import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** When true, removes default padding so caller can lay out content edge-to-edge. */
  flush?: boolean;
  /** `bare` removes the surface chrome (no border, no shadow); useful for nesting cards. */
  variant?: "default" | "muted" | "bare";
  /** Adds a thin accent stripe along the left edge. */
  accentStripe?: boolean;
}

/**
 * Generic surface container — the workhorse of the new design system.
 * Pair with CardHeader / CardBody / CardFooter, or just drop children inside.
 */
export function Card({
  flush = false,
  variant = "default",
  accentStripe = false,
  className = "",
  children,
  ...props
}: CardProps) {
  const variantClasses = {
    default: "bg-dizajno-surface border border-dizajno-border shadow-card-sm",
    muted: "bg-dizajno-elevated border border-dizajno-border-subtle",
    bare: "bg-transparent",
  }[variant];

  return (
    <div
      className={[
        "relative rounded-xl",
        variantClasses,
        accentStripe
          ? "before:absolute before:left-0 before:top-3 before:bottom-3 before:w-px before:bg-gradient-to-b before:from-dizajno-accent/0 before:via-dizajno-accent before:to-dizajno-accent/0"
          : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={[
        "flex items-start justify-between gap-4 px-5 py-4",
        "border-b border-dizajno-border",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={[
        "text-[15px] font-semibold tracking-tight text-dizajno-text leading-tight",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={[
        "text-[13px] text-dizajno-muted leading-relaxed mt-0.5",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </p>
  );
}

export function CardBody({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={["px-5 py-4", className].join(" ")} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={[
        "flex items-center justify-end gap-2 px-5 py-3.5",
        "border-t border-dizajno-border bg-dizajno-bg/40 rounded-b-xl",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}

export default Card;
