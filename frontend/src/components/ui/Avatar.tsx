"use client";

import React from "react";

export interface AvatarProps {
  src?: string | null;
  alt?: string;
  /** Fallback initials when src is unavailable; e.g. "DS". */
  fallback?: string;
  size?: number;
  /** Rounded shape — circle or rounded-square. */
  shape?: "circle" | "square";
  className?: string;
}

/**
 * Stable color from a string — used for fallback initial backgrounds.
 */
function colorFromString(s: string) {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash << 5) - hash + s.charCodeAt(i);
    hash |= 0;
  }
  const palette = [
    "#f4f4f5", // zinc-100
    "#fef3c7", // amber-100
    "#dbeafe", // blue-100
    "#dcfce7", // green-100
    "#fce7f3", // pink-100
    "#e0e7ff", // indigo-100
    "#fee2e2", // red-100
    "#cffafe", // cyan-100
  ];
  return palette[Math.abs(hash) % palette.length];
}

export default function Avatar({
  src,
  alt,
  fallback = "?",
  size = 32,
  shape = "circle",
  className = "",
}: AvatarProps) {
  const radius = shape === "circle" ? "rounded-full" : "rounded-lg";
  const initials = fallback.slice(0, 2).toUpperCase();
  const bg = colorFromString(fallback || alt || "x");

  return (
    <span
      className={[
        "inline-flex items-center justify-center shrink-0",
        "border border-dizajno-border overflow-hidden",
        "text-[11px] font-semibold tracking-tight text-dizajno-text-subtle",
        radius,
        className,
      ].join(" ")}
      style={{ width: size, height: size, background: bg }}
      aria-label={alt}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt ?? ""}
          width={size}
          height={size}
          className="w-full h-full object-cover"
        />
      ) : (
        <span>{initials}</span>
      )}
    </span>
  );
}
