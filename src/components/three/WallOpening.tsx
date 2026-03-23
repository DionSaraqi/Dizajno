"use client";

import React from "react";
import * as THREE from "three";
import { Edges } from "@react-three/drei";
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
  onClick?: (e: any) => void;
  onPointerOver?: (e: any) => void;
  onPointerOut?: (e: any) => void;
}

const FRAME_COLOR = "#C8A96E";
const FRAME_WIDTH = 0.05;

export default function WallOpening({
  opening,
  wallStart,
  wallEnd,
  wallThickness,
  wallHeight,
  selected = false,
  hovered = false,
  ghost = false,
  onClick,
  onPointerOver,
  onPointerOut,
}: WallOpeningProps) {
  const startVec = new THREE.Vector3(wallStart[0], 0, wallStart[1]);
  const endVec = new THREE.Vector3(wallEnd[0], 0, wallEnd[1]);
  const direction = new THREE.Vector3().subVectors(endVec, startVec);
  const wallLength = direction.length();
  if (wallLength < 0.01) return null;

  const unitDir = direction.clone().normalize();
  const angle = Math.atan2(direction.z, direction.x);

  const { offsetFromStart, width, height, sillHeight, type } = opening;

  // Frame protrudes 0.02 per side beyond wall — avoids z-fighting
  const frameDepth = wallThickness + 0.04;

  const midOffset = offsetFromStart + width / 2;
  const worldCenter = startVec.clone().addScaledVector(unitDir, midOffset);

  const edgeColor = selected ? "#ffffff" : hovered ? "#00aaff" : null;

  const stopAndCall = (handler?: (e: any) => void) => (e: any) => {
    e.stopPropagation();
    handler?.(e);
  };

  const hitboxY = sillHeight + height / 2;

  // ── Ghost preview: two flat planes on each face of the wall ──
  // This avoids ALL z-fighting because flat planes sit outside the wall surface,
  // not inside it like 3D box geometry would.
  if (ghost) {
    const halfThick = wallThickness / 2 + 0.005; // tiny offset outside each wall face
    const ghostColor = type === "door" ? "#818cf8" : "#67e8f9";
    const fillColor = type === "door" ? "#6366f1" : "#22d3ee";

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

  // ── Placed frame: 3D box geometry that protrudes slightly beyond wall ──
  return (
    <group
      position={[worldCenter.x, 0, worldCenter.z]}
      rotation={[0, -angle, 0]}
      renderOrder={1}
      onClick={stopAndCall(onClick)}
      onPointerOver={stopAndCall(onPointerOver)}
      onPointerOut={stopAndCall(onPointerOut)}
    >
      {/* Transparent hit area */}
      <mesh position={[0, hitboxY, 0]}>
        <boxGeometry args={[width, height, wallThickness + 0.02]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Left jamb */}
      <mesh position={[-(width / 2) - FRAME_WIDTH / 2, sillHeight + height / 2, 0]}>
        <boxGeometry args={[FRAME_WIDTH, height + FRAME_WIDTH * 2, frameDepth]} />
        <meshStandardMaterial color={FRAME_COLOR} />
        {edgeColor && <Edges threshold={1} color={edgeColor} />}
      </mesh>

      {/* Right jamb */}
      <mesh position={[width / 2 + FRAME_WIDTH / 2, sillHeight + height / 2, 0]}>
        <boxGeometry args={[FRAME_WIDTH, height + FRAME_WIDTH * 2, frameDepth]} />
        <meshStandardMaterial color={FRAME_COLOR} />
        {edgeColor && <Edges threshold={1} color={edgeColor} />}
      </mesh>

      {/* Lintel (top) */}
      <mesh position={[0, sillHeight + height + FRAME_WIDTH / 2, 0]}>
        <boxGeometry args={[width + FRAME_WIDTH * 2, FRAME_WIDTH, frameDepth]} />
        <meshStandardMaterial color={FRAME_COLOR} />
        {edgeColor && <Edges threshold={1} color={edgeColor} />}
      </mesh>

      {/* Sill (bottom) — windows only */}
      {type === "window" && sillHeight > 0.001 && (
        <mesh position={[0, sillHeight - FRAME_WIDTH / 2, 0]}>
          <boxGeometry args={[width + FRAME_WIDTH * 2, FRAME_WIDTH, frameDepth]} />
          <meshStandardMaterial color={FRAME_COLOR} />
          {edgeColor && <Edges threshold={1} color={edgeColor} />}
        </mesh>
      )}
    </group>
  );
}
