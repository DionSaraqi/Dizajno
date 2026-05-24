import React from "react";

export interface LogoProps {
  size?: number;
  className?: string;
}

/**
 * Dizajno wordmark glyph — two stacked "rooms" suggesting plan + elevation.
 * Pure SVG so it scales cleanly and inherits color when used in dark contexts.
 */
export default function Logo({ size = 24, className = "" }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="4"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-dizajno-text"
      />
      <path
        d="M3 10h18M10 3v18"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-dizajno-text"
      />
      <rect
        x="10"
        y="10"
        width="11"
        height="11"
        fill="currentColor"
        className="text-dizajno-accent"
        rx="1"
      />
    </svg>
  );
}
