"use client";

import React from "react";

export interface SliderProps {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  label?: string;
  unit?: string;
  disabled?: boolean;
  /** Hide the value readout in the label row. */
  hideValue?: boolean;
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
  hideValue = false,
}: SliderProps) {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="flex flex-col gap-1.5">
      {(label || !hideValue) && (
        <div className="flex items-center justify-between">
          {label && (
            <span className="text-[12.5px] text-dizajno-muted">{label}</span>
          )}
          {!hideValue && (
            <span className="text-[12.5px] text-dizajno-text font-mono tabular-nums">
              {value}
              {unit}
            </span>
          )}
        </div>
      )}
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
          background: `linear-gradient(to right, #5e63d4 0%, #5e63d4 ${percentage}%, #e4e4e7 ${percentage}%, #e4e4e7 100%)`,
        }}
      />
    </div>
  );
}
