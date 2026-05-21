import React from "react";

export interface SeparatorProps {
  orientation?: "horizontal" | "vertical";
}

export default function Separator({
  orientation = "vertical",
}: SeparatorProps) {
  if (orientation === "horizontal") {
    return <div className="h-px w-full bg-dizajno-border" />;
  }
  return <div className="w-px h-6 bg-dizajno-border" />;
}
