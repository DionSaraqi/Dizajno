"use client";

import React from "react";

export interface SliderProps {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  label: string;
  unit?: string;
  disabled?: boolean;
}

export default function Slider({
  min,
  max,
  step,
  value,
  onChange,
  label,
  unit = "",
  disabled = false,
}: SliderProps) {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-dizajno-muted">{label}</span>
        <span className="text-xs text-dizajno-text font-mono tabular-nums">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="slider-input w-full h-1.5 rounded-full appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        style={{
          background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${percentage}%, #d8d8e3 ${percentage}%, #d8d8e3 100%)`,
        }}
      />
    </div>
  );
}
