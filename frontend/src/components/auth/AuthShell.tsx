"use client";

import Link from "next/link";
import React from "react";
import { Logo } from "@/components/ui";

export interface AuthShellProps {
  /** Small eyebrow above the title — e.g. "Sign in". */
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Right-side meta (e.g. "Already have an account? Sign in"). */
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Two-column auth layout. Left = form on a clean surface; right = subtle
 * architectural backdrop with a marketing line. Collapses to single column
 * under md.
 */
export default function AuthShell({
  eyebrow,
  title,
  subtitle,
  footer,
  children,
}: AuthShellProps) {
  return (
    <main className="min-h-screen w-screen bg-dizajno-bg grid md:grid-cols-[1.05fr_1fr] overflow-hidden">
      {/* Left column — form */}
      <section className="relative flex flex-col px-6 sm:px-10 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-dizajno-text w-fit"
        >
          <Logo size={22} />
          <span className="font-semibold text-[15px] tracking-tight">
            Dizajno
          </span>
        </Link>

        <div className="flex-1 flex items-center justify-center py-12">
          <div className="w-full max-w-[380px]">
            {eyebrow && (
              <div className="text-[11px] font-medium uppercase tracking-label text-dizajno-muted mb-3">
                {eyebrow}
              </div>
            )}
            <h1 className="text-[28px] font-semibold text-dizajno-text tracking-tight leading-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-2 text-[14.5px] text-dizajno-muted leading-relaxed">
                {subtitle}
              </p>
            )}

            <div className="mt-8">{children}</div>
          </div>
        </div>

        {footer && (
          <div className="text-[13px] text-dizajno-muted text-center md:text-left">
            {footer}
          </div>
        )}
      </section>

      {/* Right column — decorative */}
      <aside className="relative hidden md:block overflow-hidden border-l border-dizajno-border">
        <div className="absolute inset-0 hairline-grid" />
        <div className="absolute inset-0 spotlight opacity-90" />

        {/* Architectural floor plan illustration */}
        <svg
          aria-hidden
          viewBox="0 0 600 600"
          className="absolute inset-0 w-full h-full text-dizajno-text/70"
          fill="none"
        >
          <defs>
            <pattern
              id="dots"
              width="24"
              height="24"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="12" cy="12" r="0.6" fill="currentColor" opacity="0.15" />
            </pattern>
          </defs>
          <rect width="600" height="600" fill="url(#dots)" />

          {/* Outer walls */}
          <g
            stroke="currentColor"
            strokeWidth="1.25"
            opacity="0.9"
            strokeLinecap="round"
          >
            <path d="M120 120 H 480 V 480 H 120 Z" />
            <path d="M120 280 H 320" />
            <path d="M320 280 V 480" />
            <path d="M320 120 V 200" />
            <path d="M320 230 V 280" />
            {/* Door swing */}
            <path
              d="M320 200 A 30 30 0 0 1 350 230"
              opacity="0.5"
            />
            {/* Furniture: sofa */}
            <rect x="155" y="180" width="120" height="55" rx="4" />
            <rect x="170" y="185" width="20" height="45" rx="2" />
            <rect x="240" y="185" width="20" height="45" rx="2" />
            {/* Table + chairs */}
            <rect x="380" y="170" width="70" height="70" rx="3" />
            <circle cx="415" cy="155" r="12" />
            <circle cx="415" cy="255" r="12" />
            <circle cx="365" cy="205" r="12" />
            <circle cx="465" cy="205" r="12" />
            {/* Bed (top-right room) */}
            <rect x="370" y="320" width="90" height="140" rx="3" />
            <rect x="370" y="320" width="90" height="30" rx="3" opacity="0.4" />
            {/* Rug */}
            <rect x="155" y="380" width="135" height="80" rx="2" opacity="0.35" />
          </g>

          {/* Dimension marks */}
          <g
            stroke="currentColor"
            strokeWidth="0.75"
            opacity="0.35"
            strokeLinecap="round"
          >
            <path d="M120 96 H 480" />
            <path d="M120 90 V 102" />
            <path d="M480 90 V 102" />
            <path d="M504 120 V 480" />
            <path d="M498 120 H 510" />
            <path d="M498 480 H 510" />
          </g>

          {/* Labels */}
          <g
            className="font-mono"
            fill="currentColor"
            opacity="0.45"
            style={{ fontSize: "9px", letterSpacing: "0.08em" }}
          >
            <text x="285" y="86" textAnchor="middle">
              6.40 M
            </text>
            <text
              x="528"
              y="305"
              textAnchor="middle"
              transform="rotate(-90 528 305)"
            >
              6.40 M
            </text>
            <text x="215" y="170" textAnchor="middle">
              LIVING · 18 M²
            </text>
            <text x="415" y="310" textAnchor="middle">
              BEDROOM · 12 M²
            </text>
          </g>
        </svg>

        <div className="relative z-10 h-full flex flex-col justify-end p-12">
          <div className="max-w-md">
            <p className="text-[11px] font-medium uppercase tracking-label text-dizajno-muted mb-3">
              From plan to procurement
            </p>
            <p className="text-[22px] font-semibold tracking-tight text-dizajno-text leading-snug">
              Draw your room. Drop in real products. Request quotes from
              the suppliers behind them.
            </p>
            <div className="mt-6 flex items-center gap-6 text-[12px] text-dizajno-muted">
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-dizajno-accent" />
                2D + 3D designer
              </span>
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-dizajno-success" />
                Multi-supplier RFQ
              </span>
            </div>
          </div>
        </div>
      </aside>
    </main>
  );
}
