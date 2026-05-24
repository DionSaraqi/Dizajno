import React from "react";

export interface SeparatorProps {
  orientation?: "horizontal" | "vertical";
  className?: string;
}

export default function Separator({
  orientation = "vertical",
  className = "",
}: SeparatorProps) {
  if (orientation === "horizontal") {
    return (
      <div
        className={["h-px w-full bg-dizajno-border", className].join(" ")}
        role="separator"
      />
    );
  }
  return (
    <div
      className={["w-px h-5 bg-dizajno-border", className].join(" ")}
      role="separator"
    />
  );
}
