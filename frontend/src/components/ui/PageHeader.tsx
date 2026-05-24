"use client";

import Link from "next/link";
import React from "react";
import { ChevronRight } from "lucide-react";

export interface BreadcrumbItem {
  label: React.ReactNode;
  href?: string;
}

export interface PageHeaderProps {
  /** Small uppercase eyebrow above the title. */
  eyebrow?: React.ReactNode;
  /** Breadcrumb trail. The last item renders inert (no link). */
  breadcrumbs?: BreadcrumbItem[];
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Right-side action slot — typically a Button or stack of Buttons. */
  actions?: React.ReactNode;
  /** Bottom-row slot — typically Tabs or a SearchInput row. */
  bottom?: React.ReactNode;
  /** Adds a horizontal rule beneath the header. */
  divided?: boolean;
  className?: string;
}

export default function PageHeader({
  eyebrow,
  breadcrumbs,
  title,
  description,
  actions,
  bottom,
  divided = true,
  className = "",
}: PageHeaderProps) {
  return (
    <header
      className={[
        "pt-8 pb-5",
        divided ? "border-b border-dizajno-border" : "",
        className,
      ].join(" ")}
    >
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1 text-[12.5px] text-dizajno-muted mb-3"
        >
          {breadcrumbs.map((crumb, i) => {
            const isLast = i === breadcrumbs.length - 1;
            return (
              <React.Fragment key={i}>
                {crumb.href && !isLast ? (
                  <Link
                    href={crumb.href}
                    className="hover:text-dizajno-text transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    className={isLast ? "text-dizajno-text-subtle font-medium" : ""}
                  >
                    {crumb.label}
                  </span>
                )}
                {!isLast && (
                  <ChevronRight
                    size={12}
                    className="text-dizajno-muted-subtle shrink-0"
                  />
                )}
              </React.Fragment>
            );
          })}
        </nav>
      )}

      {eyebrow && (
        <div className="text-[11px] font-medium uppercase tracking-label text-dizajno-muted mb-2">
          {eyebrow}
        </div>
      )}

      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <h1 className="text-[26px] font-semibold tracking-tight text-dizajno-text leading-tight">
            {title}
          </h1>
          {description && (
            <p className="mt-1.5 text-[14px] text-dizajno-muted leading-relaxed max-w-2xl">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0">{actions}</div>
        )}
      </div>

      {bottom && <div className="mt-5">{bottom}</div>}
    </header>
  );
}
