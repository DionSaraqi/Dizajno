"use client";

import React from "react";

export interface TabsProps<T extends string = string> {
  tabs: ReadonlyArray<{ value: T; label: React.ReactNode; count?: number }>;
  value: T;
  onChange: (value: T) => void;
  /** `underline` is the dashboard default; `pill` is for compact filters. */
  variant?: "underline" | "pill";
  className?: string;
}

export default function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  variant = "underline",
  className = "",
}: TabsProps<T>) {
  if (variant === "pill") {
    return (
      <div
        className={[
          "inline-flex items-center gap-1 p-1 rounded-lg",
          "bg-dizajno-elevated border border-dizajno-border-subtle",
          className,
        ].join(" ")}
      >
        {tabs.map((tab) => {
          const active = tab.value === value;
          return (
            <button
              key={tab.value}
              onClick={() => onChange(tab.value)}
              className={[
                "px-3 h-7 rounded-md text-[13px] font-medium transition-colors",
                active
                  ? "bg-dizajno-surface text-dizajno-text shadow-card-sm border border-dizajno-border"
                  : "text-dizajno-muted hover:text-dizajno-text",
              ].join(" ")}
            >
              <span>{tab.label}</span>
              {typeof tab.count === "number" && (
                <span
                  className={[
                    "ml-1.5 text-[11px] font-medium tabular-nums",
                    active ? "text-dizajno-muted" : "text-dizajno-muted-subtle",
                  ].join(" ")}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={["flex items-center border-b border-dizajno-border", className].join(
        " ",
      )}
    >
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            onClick={() => onChange(tab.value)}
            className={[
              "relative inline-flex items-center gap-2 h-10 px-4 text-[13px] font-medium",
              "transition-colors",
              active
                ? "text-dizajno-text"
                : "text-dizajno-muted hover:text-dizajno-text",
            ].join(" ")}
          >
            <span>{tab.label}</span>
            {typeof tab.count === "number" && (
              <span
                className={[
                  "inline-flex items-center justify-center min-w-[20px] h-[18px] rounded-full px-1.5 text-[10.5px] font-medium tabular-nums",
                  active
                    ? "bg-dizajno-accent-soft text-dizajno-accent-ink"
                    : "bg-dizajno-elevated text-dizajno-muted",
                ].join(" ")}
              >
                {tab.count}
              </span>
            )}
            {active && (
              <span className="absolute left-3 right-3 -bottom-px h-px bg-dizajno-text" />
            )}
          </button>
        );
      })}
    </div>
  );
}
