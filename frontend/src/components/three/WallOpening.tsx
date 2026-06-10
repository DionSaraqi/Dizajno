"use client";

import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { Edges } from "@react-three/drei";
import { useFurnitureCatalog } from "@/hooks/useFurnitureCatalog";
import type { OpeningData } from "@/types/designer";

interface WallOpeningProps {
  opening: OpeningData;
  wallStart: [number, number];
  wallEnd: [number, number];
  wallThickness: number;
  wallHeight: number;
  selected?: boolean;
  hovered?: boolean;
  ghost?: boolean;
  /** 2D top-down mode — render a flat architectural symbol instead of the 3D frame. */
  flat?: boolean;
  /** Dragged to an illegal position (overlap / off-wall) — tint red. */
  invalid?: boolean;
  /**
   * When false, pointer events pass through to the wall behind (no
   * stopPropagation) — needed in opening-placement mode so hovering/clicking
   * over an existing opening still drives the wall's ghost preview and
   * placement instead of being swallowed by this opening's hitbox.
   */
  interactive?: boolean;
  /**
   * Which side of the wall the 2D door swing arc opens toward (local Z sign).
   * The caller picks the side that lands inside a room; purely symbolic.
   */
  swingSide?: 1 | -1;
  onClick?: (e: any) => void;
  onPointerDown?: (e: any) => void;
  onPointerOver?: (e: any) => void;
  onPointerOut?: (e: any) => void;
}

const DEFAULT_FRAME_COLOR = "#C8A96E";
const FRAME_WIDTH = 0.05;
// The frame buries this far into the opening so its faces are never exactly
// coplanar with the wall segments' cut faces (coplanar faces depth-fight and
// let the wall flicker through the frame at certain view angles).
const FRAME_OVERLAP = 0.01;
// How far the frame protrudes beyond each wall face. Chunky on purpose — at
// 0.02 the frame was a sliver that walls visually swallowed at glancing angles.
const FRAME_PROTRUSION = 0.06;
// Y level for flat 2D symbols — just above the 0.15-tall 2D walls.
const SYMBOL_Y = 0.2;

const GHOST_OUTLINE: Record<OpeningData["type"], string> = {
  door: "#818cf8",
  window: "#67e8f9",
};
const GHOST_FILL: Record<OpeningData["type"], string> = {
  door: "#6366f1",
  window: "#22d3ee",
};

/**
 * Quarter-circle door swing arc in the local XZ plane, hinged at (-w/2, 0),
 * sweeping toward local Z × `side`.
 */
function useSwingArc(width: number, side: 1 | -1, color: string) {
  const line = useMemo(() => {
    const pts: number[] = [];
    const SEGS = 24;
    for (let i = 0; i <= SEGS; i++) {
      const a = (i / SEGS) * (Math.PI / 2);
      pts.push(-width / 2 + width * Math.cos(a), 0, side * width * Math.sin(a));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    const mat = new THREE.LineBasicMaterial();
    const l = new THREE.Line(geo, mat);
    // three's Line raycast has a 1 world-unit default threshold — left active,
    // the arc would steal clicks from the floor a meter around every door.
    l.raycast = () => {};
    return l;
  }, [width, side]);

  useEffect(
    () => () => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    },
    [line]
  );

  (line.material as THREE.LineBasicMaterial).color.set(color);
  return line;
}

/** Flat top-down architectural symbol: door = jambs + leaf + swing arc; window = triple line. */
function FlatSymbol({
  type,
  width,
  wallThickness,
  color,
  ghost,
  swingSide = 1,
}: {
  type: OpeningData["type"];
  width: number;
  wallThickness: number;
  color: string;
  ghost: boolean;
  swingSide?: 1 | -1;
}) {
  const arc = useSwingArc(width, swingSide, color);
  const lineH = 0.04; // symbol box height (visual thickness from top is its footprint)
  const opacity = ghost ? 0.85 : 1;

  return (
    <group position={[0, SYMBOL_Y, 0]}>
      {type === "door" ? (
        <>
          {/* Jamb blocks at both sides of the opening */}
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * (width / 2 + FRAME_WIDTH / 2), 0, 0]}>
              <boxGeometry args={[FRAME_WIDTH, lineH, wallThickness]} />
              <meshBasicMaterial color={color} transparent opacity={opacity} />
            </mesh>
          ))}
          {/* Door leaf, drawn open at 90° from the hinge side */}
          <mesh position={[-width / 2 + 0.02, 0, (swingSide * width) / 2]}>
            <boxGeometry args={[0.04, lineH, width]} />
            <meshBasicMaterial color={color} transparent opacity={opacity} />
          </mesh>
          {/* Swing arc from the leaf tip to the far jamb */}
          <primitive object={arc} />
        </>
      ) : (
        <>
          {/* Classic plan symbol: three thin parallel lines across the span */}
          {[-wallThickness / 3, 0, wallThickness / 3].map((zOff, i) => (
            <mesh key={i} position={[0, 0, zOff]}>
              <boxGeometry args={[width, lineH, 0.022]} />
              <meshBasicMaterial color={color} transparent opacity={opacity} />
            </mesh>
          ))}
          {/* Jamb blocks bound the symbol */}
          {[-1, 1].map((side) => (
            <mesh key={`j${side}`} position={[side * (width / 2 + FRAME_WIDTH / 2), 0, 0]}>
              <boxGeometry args={[FRAME_WIDTH, lineH, wallThickness]} />
              <meshBasicMaterial color={color} transparent opacity={opacity} />
            </mesh>
          ))}
        </>
      )}
    </group>
  );
}

export default function WallOpening({
  opening,
  wallStart,
  wallEnd,
  wallThickness,
  wallHeight,
  selected = false,
  hovered = false,
  ghost = false,
  flat = false,
  invalid = false,
  interactive = true,
  swingSide = 1,
  onClick,
  onPointerDown,
  onPointerOver,
  onPointerOut,
}: WallOpeningProps) {
  // Phase 6: if the opening references a branded fixture variant, look up its
  // color in the live catalog and tint the frame with it. Falls back to the
  // default gold-brown otherwise. Reads via the same TanStack Query cache the
  // rest of the designer uses, so the lookup is free after first render.
  const { items: catalog } = useFurnitureCatalog();
  const variantColor = opening.productVariantId
    ? catalog.find((item) => item.variantId === opening.productVariantId)?.color
    : undefined;
  const frameColor = variantColor ?? DEFAULT_FRAME_COLOR;

  const startVec = new THREE.Vector3(wallStart[0], 0, wallStart[1]);
  const endVec = new THREE.Vector3(wallEnd[0], 0, wallEnd[1]);
  const direction = new THREE.Vector3().subVectors(endVec, startVec);
  const wallLength = direction.length();
  if (wallLength < 0.01) return null;

  const unitDir = direction.clone().normalize();
  const angle = Math.atan2(direction.z, direction.x);

  const { offsetFromStart, width, height, sillHeight, type } = opening;

  const frameDepth = wallThickness + FRAME_PROTRUSION * 2;

  const midOffset = offsetFromStart + width / 2;
  const worldCenter = startVec.clone().addScaledVector(unitDir, midOffset);

  const edgeColor = selected ? "#ffffff" : hovered ? "#00aaff" : null;

  const stopAndCall = (handler?: (e: any) => void) => (e: any) => {
    if (interactive) e.stopPropagation();
    handler?.(e);
  };

  const hitboxY = sillHeight + height / 2;

  // ── Ghost preview ──────────────────────────────────────────────────────────
  if (ghost) {
    const ghostColor = invalid ? "#EF4444" : GHOST_OUTLINE[type];
    const fillColor = invalid ? "#EF4444" : GHOST_FILL[type];

    // 2D: flat architectural symbol + a translucent span bar.
    if (flat) {
      return (
        <group position={[worldCenter.x, 0, worldCenter.z]} rotation={[0, -angle, 0]}>
          <mesh position={[0, SYMBOL_Y - 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[width, wallThickness + 0.06]} />
            <meshBasicMaterial color={fillColor} transparent opacity={0.3} depthWrite={false} />
          </mesh>
          <FlatSymbol
            type={type}
            width={width}
            wallThickness={wallThickness}
            color={ghostColor}
            ghost
            swingSide={swingSide}
          />
        </group>
      );
    }

    // 3D: two flat planes on each face of the wall. This avoids ALL z-fighting
    // because flat planes sit outside the wall surface, not inside it like 3D
    // box geometry would.
    const halfThick = wallThickness / 2 + 0.005; // tiny offset outside each wall face

    return (
      <group
        position={[worldCenter.x, 0, worldCenter.z]}
        rotation={[0, -angle, 0]}
        renderOrder={10}
      >
        {/* Render on both faces of the wall */}
        {[halfThick, -halfThick].map((zOff, face) => (
          <group key={face} position={[0, 0, zOff]}>
            {/* Tinted fill */}
            <mesh position={[0, sillHeight + height / 2, 0]} renderOrder={11}>
              <planeGeometry args={[width, height]} />
              <meshBasicMaterial
                color={fillColor}
                transparent
                opacity={0.25}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>

            {/* Outline border — left, right, top (+ bottom for windows) */}
            {/* Left edge */}
            <mesh position={[-(width / 2), sillHeight + height / 2, 0]} renderOrder={12}>
              <planeGeometry args={[FRAME_WIDTH, height + FRAME_WIDTH]} />
              <meshBasicMaterial color={ghostColor} transparent opacity={0.7} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
            {/* Right edge */}
            <mesh position={[width / 2, sillHeight + height / 2, 0]} renderOrder={12}>
              <planeGeometry args={[FRAME_WIDTH, height + FRAME_WIDTH]} />
              <meshBasicMaterial color={ghostColor} transparent opacity={0.7} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
            {/* Top edge */}
            <mesh position={[0, sillHeight + height, 0]} renderOrder={12}>
              <planeGeometry args={[width + FRAME_WIDTH, FRAME_WIDTH]} />
              <meshBasicMaterial color={ghostColor} transparent opacity={0.7} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
            {/* Bottom edge (sill for windows, floor line for doors) */}
            <mesh position={[0, sillHeight, 0]} renderOrder={12}>
              <planeGeometry args={[width + FRAME_WIDTH, FRAME_WIDTH]} />
              <meshBasicMaterial color={ghostColor} transparent opacity={0.7} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
          </group>
        ))}
      </group>
    );
  }

  const placedColor = invalid ? "#EF4444" : frameColor;

  // ── Placed, 2D top-down: flat architectural symbol + invisible hit target ──
  if (flat) {
    const symbolColor = invalid
      ? "#EF4444"
      : selected
      ? "#6366f1"
      : hovered
      ? "#00aaff"
      : frameColor;
    return (
      <group
        position={[worldCenter.x, 0, worldCenter.z]}
        rotation={[0, -angle, 0]}
        onClick={stopAndCall(onClick)}
        onPointerDown={stopAndCall(onPointerDown)}
        onPointerOver={stopAndCall(onPointerOver)}
        onPointerOut={stopAndCall(onPointerOut)}
      >
        {/* Invisible hit target over the wall span (not the swing arc — that
            would steal click-to-select from the floor underneath) */}
        <mesh position={[0, hitboxY, 0]}>
          <boxGeometry args={[width + FRAME_WIDTH * 2, height, wallThickness + 0.04]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        <FlatSymbol
          type={type}
          width={width}
          wallThickness={wallThickness}
          color={symbolColor}
          ghost={false}
          swingSide={swingSide}
        />
      </group>
    );
  }

  // ── Placed, 3D: box-geometry frame ─────────────────────────────────────────
  // Each piece overlaps FRAME_OVERLAP into the opening so no face is exactly
  // coplanar with the wall segments' cut faces, and protrudes FRAME_PROTRUSION
  // beyond each wall face so the frame stays visible at glancing angles.
  return (
    <group
      position={[worldCenter.x, 0, worldCenter.z]}
      rotation={[0, -angle, 0]}
      renderOrder={1}
      onClick={stopAndCall(onClick)}
      onPointerDown={stopAndCall(onPointerDown)}
      onPointerOver={stopAndCall(onPointerOver)}
      onPointerOut={stopAndCall(onPointerOut)}
    >
      {/* Transparent hit area */}
      <mesh position={[0, hitboxY, 0]}>
        <boxGeometry args={[width, height, wallThickness + 0.02]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Left jamb */}
      <mesh position={[-(width / 2) - FRAME_WIDTH / 2 + FRAME_OVERLAP, sillHeight + height / 2, 0]}>
        <boxGeometry args={[FRAME_WIDTH, height + FRAME_WIDTH * 2, frameDepth]} />
        <meshStandardMaterial color={placedColor} />
        {edgeColor && <Edges threshold={1} color={edgeColor} />}
      </mesh>

      {/* Right jamb */}
      <mesh position={[width / 2 + FRAME_WIDTH / 2 - FRAME_OVERLAP, sillHeight + height / 2, 0]}>
        <boxGeometry args={[FRAME_WIDTH, height + FRAME_WIDTH * 2, frameDepth]} />
        <meshStandardMaterial color={placedColor} />
        {edgeColor && <Edges threshold={1} color={edgeColor} />}
      </mesh>

      {/* Lintel (top) */}
      <mesh position={[0, sillHeight + height + FRAME_WIDTH / 2 - FRAME_OVERLAP, 0]}>
        <boxGeometry args={[width + FRAME_WIDTH * 2, FRAME_WIDTH, frameDepth]} />
        <meshStandardMaterial color={placedColor} />
        {edgeColor && <Edges threshold={1} color={edgeColor} />}
      </mesh>

      {/* Sill (bottom) — windows only */}
      {type === "window" && sillHeight > 0.001 && (
        <mesh position={[0, sillHeight - FRAME_WIDTH / 2 + FRAME_OVERLAP, 0]}>
          <boxGeometry args={[width + FRAME_WIDTH * 2, FRAME_WIDTH, frameDepth]} />
          <meshStandardMaterial color={placedColor} />
          {edgeColor && <Edges threshold={1} color={edgeColor} />}
        </mesh>
      )}
    </group>
  );
}
