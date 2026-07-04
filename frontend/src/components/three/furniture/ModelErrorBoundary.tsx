"use client";

import React from "react";

interface ModelErrorBoundaryProps {
  /** Rendered instead of the model when loading/parsing throws. */
  fallback: React.ReactNode;
  /** Changing this value clears a previous error (pass the model URL). */
  resetKey?: string;
  children: React.ReactNode;
}

interface ModelErrorBoundaryState {
  hasError: boolean;
}

/**
 * Error boundary for GLB loads inside the R3F canvas. A supplier-hosted model
 * that 404s, fails CORS, or fails to parse throws from `useGLTF` during
 * render; without a boundary that unmounts the entire canvas. Missing assets
 * must degrade gracefully, never crash the designer — so render the
 * procedural/placeholder fallback instead.
 */
export class ModelErrorBoundary extends React.Component<
  ModelErrorBoundaryProps,
  ModelErrorBoundaryState
> {
  state: ModelErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ModelErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    // eslint-disable-next-line no-console
    console.warn("3D model failed to load — rendering fallback", error);
  }

  componentDidUpdate(prevProps: ModelErrorBoundaryProps): void {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render(): React.ReactNode {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

interface FallbackBoxProps {
  width: number;
  depth: number;
  height: number;
  color: string;
  opacity?: number;
}

/**
 * Solid box placeholder matching the item's catalog dimensions — used when a
 * GLB fails to load and the item has no procedural model to fall back to.
 */
export function FallbackBox({
  width,
  depth,
  height,
  color,
  opacity = 1,
}: FallbackBoxProps): React.JSX.Element {
  return (
    <mesh position={[0, height / 2, 0]}>
      <boxGeometry args={[width, height, depth]} />
      <meshStandardMaterial color={color} transparent={opacity < 1} opacity={opacity} />
    </mesh>
  );
}
