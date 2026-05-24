import React from "react";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Set to "circle" for avatar placeholders. */
  shape?: "rect" | "circle";
}

export default function Skeleton({
  shape = "rect",
  className = "",
  ...props
}: SkeletonProps) {
  return (
    <div
      className={[
        "animate-pulse bg-dizajno-elevated",
        shape === "circle" ? "rounded-full" : "rounded-md",
        className,
      ].join(" ")}
      {...props}
    />
  );
}
