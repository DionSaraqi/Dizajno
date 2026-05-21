"use client";

/**
 * SnapIndicator — renders a glowing blue line along the snapped edge
 * when wall-snap or furniture-snap is active.
 */

import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import type { SnapEdge } from "@/utils/snapToGrid";

interface SnapIndicatorProps {
  snapEdge: SnapEdge | null;
}

export default function SnapIndicator({ snapEdge }: SnapIndicatorProps) {
  const matRef = useRef<THREE.LineBasicMaterial>(null!);

  const geo = useMemo(() => {
    if (!snapEdge) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [
          snapEdge.p1[0], 0.06, snapEdge.p1[1],
          snapEdge.p2[0], 0.06, snapEdge.p2[1],
        ],
        3
      )
    );
    return g;
  }, [snapEdge]);

  if (!snapEdge || !geo) return null;

  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial ref={matRef} color="#3b82f6" linewidth={2} />
    </lineSegments>
  );
}
