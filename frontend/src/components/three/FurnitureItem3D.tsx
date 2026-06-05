"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { Edges } from "@react-three/drei";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  useDesignerStore,
  useSelectedIds,
  useSnap,
  useGridSize,
  useIs3D,
  useHoveredId,
  useReadOnly,
} from "@/store/useDesignerStore";
import type { FurnitureData } from "@/types/designer";
import { checkFurnitureCollision } from "@/utils/collision";
import { smartSnap, type SnapEdge } from "@/utils/snapToGrid";
import { getFurnitureDef } from "@/utils/furnitureCatalog";
import Measurements from "./Measurements";
import SnapIndicator from "./SnapIndicator";
import GLTFModel from "./furniture/GLTFModel";
import BedModel from "./furniture/BedModel";
import TableModel from "./furniture/TableModel";
import ChairModel from "./furniture/ChairModel";
import SofaModel from "./furniture/SofaModel";
import WardrobeModel from "./furniture/WardrobeModel";
import DeskModel from "./furniture/DeskModel";
import BookshelfModel from "./furniture/BookshelfModel";
import NightstandModel from "./furniture/NightstandModel";

interface FurnitureItem3DProps {
  item: FurnitureData;
}

function getModel(type: string) {
  switch (type) {
    case "bed": return BedModel;
    case "table": return TableModel;
    case "chair": return ChairModel;
    case "sofa": return SofaModel;
    case "wardrobe": return WardrobeModel;
    case "desk": return DeskModel;
    case "bookshelf": return BookshelfModel;
    case "nightstand": return NightstandModel;
    default: return null;
  }
}

export default function FurnitureItem3D({ item }: FurnitureItem3DProps) {
  const selectedIds = useSelectedIds();
  const snap = useSnap();
  const gridSize = useGridSize();
  const is3D = useIs3D();
  const readOnly = useReadOnly();
  const { raycaster, camera, pointer } = useThree();

  const hoveredId = useHoveredId();
  const select = useDesignerStore((s) => s.select);
  const toggleSelect = useDesignerStore((s) => s.toggleSelect);
  const moveFurniture = useDesignerStore((s) => s.moveFurniture);
  const setStoreDragging = useDesignerStore((s) => s.setDragging);
  const setHoveredId = useDesignerStore((s) => s.setHoveredId);
  const furniture = useDesignerStore((s) => s.furniture);
  const walls = useDesignerStore((s) => s.walls);

  const [dragging, setDragging] = useState(false);
  const [dragPos, setDragPos] = useState<[number, number]>(item.position);
  const [snapEdge, setSnapEdge] = useState<SnapEdge | null>(null);
  // Actual rendered model dimensions (from GLTFModel's uniform scaling)
  const [modelBounds, setModelBounds] = useState<[number, number, number] | null>(null);
  const handleBoundsComputed = useCallback((bounds: [number, number, number]) => setModelBounds(bounds), []);
  const groupRef = useRef<any>(null);
  const groundPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  // Track pointer-down state before drag threshold is met
  const pointerDownRef = useRef(false);
  const pointerStartRef = useRef<{ x: number; z: number } | null>(null);
  const DRAG_THRESHOLD = 0.05; // world-space distance before drag starts

  const isSelected = selectedIds.includes(item.id);
  const isHovered = hoveredId === item.id && !dragging;
  const pos = dragging ? dragPos : item.position;

  const tempItem: FurnitureData = { ...item, position: pos };
  const hasCollision =
    dragging && checkFurnitureCollision(tempItem, furniture, walls);

  const ModelComponent = getModel(item.type);
  const catalogDef = getFurnitureDef(item.type);
  const hasGLTF = !!catalogDef?.modelUrl;

  // Item descriptor for snap calculations
  const itemDesc = { id: item.id, rotation: item.rotation, width: item.width, depth: item.depth };

  const handlePointerOver = (e: any) => {
    e.stopPropagation();
    setHoveredId(item.id);
  };

  const handlePointerOut = (e: any) => {
    e.stopPropagation();
    setHoveredId(null);
  };

  const handlePointerDown = (e: any) => {
    e.stopPropagation();

    // KNOWN-ISSUE(furniture-floor-interaction): see docs/KNOWN_ISSUES.md.
    // Selection happens here on pointer-DOWN (with stopPropagation), but there's
    // no onClick to stop the synthesized click on pointer-up, so when the item
    // sits on a floor the click falls through to FloorMesh.onClick and the
    // selection switches to the floor. A moving cursor also makes this down miss
    // the thin hitbox and land on whatever is behind. Remove when fixed.
    if (e.nativeEvent?.shiftKey || e.shiftKey) {
      toggleSelect(item.id);
    } else {
      select(item.id);
    }

    // In read-only (share viewer), allow selection but never start a drag.
    if (readOnly) return;

    // Record pointer-down; actual drag starts after threshold is exceeded
    pointerDownRef.current = true;
    raycaster.setFromCamera(pointer, camera);
    const startPt = new THREE.Vector3();
    raycaster.ray.intersectPlane(groundPlane.current, startPt);
    pointerStartRef.current = { x: startPt.x, z: startPt.z };
  };

  // Update drag position every frame using ground-plane raycast
  // Drag only begins after the pointer moves beyond DRAG_THRESHOLD while held
  useFrame(() => {
    if (!pointerDownRef.current) return;

    raycaster.setFromCamera(pointer, camera);
    const intersection = new THREE.Vector3();
    const hit = raycaster.ray.intersectPlane(groundPlane.current, intersection);
    if (!hit) return;

    // Check threshold before activating drag
    if (!dragging) {
      const start = pointerStartRef.current;
      if (!start) return;
      const dx = intersection.x - start.x;
      const dz = intersection.z - start.z;
      if (Math.sqrt(dx * dx + dz * dz) < DRAG_THRESHOLD) return;
      setDragging(true);
      setStoreDragging(true);
    }

    const result = smartSnap(
      intersection.x,
      intersection.z,
      itemDesc,
      walls,
      furniture,
      snap,
      gridSize
    );

    setDragPos(result.position);
    setSnapEdge(result.snapEdge);
  });

  const finishDrag = useCallback(() => {
    pointerDownRef.current = false;
    pointerStartRef.current = null;

    if (!dragging) return;
    setDragging(false);
    setStoreDragging(false);
    setSnapEdge(null);

    if (!hasCollision) {
      moveFurniture(item.id, dragPos);
    }
    setDragPos(item.position);
  }, [dragging, hasCollision, dragPos, item.id, item.position, moveFurniture, setStoreDragging]);

  const handlePointerUp = (e: any) => {
    e.stopPropagation();
    finishDrag();
  };

  // Global pointerup so drag ends even when released outside the item mesh
  useEffect(() => {
    if (!pointerDownRef.current && !dragging) return;
    const onUp = () => finishDrag();
    window.addEventListener("pointerup", onUp);
    return () => window.removeEventListener("pointerup", onUp);
  }, [dragging, finishDrag]);

  // Show measurements in 2D when selected and not currently dragging (or while dragging)
  const showMeasurements = !is3D && isSelected;

  return (
    <>
      <group
        ref={groupRef}
        position={[pos[0], item.elevation ?? 0, pos[1]]}
        rotation={[0, item.rotation, 0]}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        {hasGLTF ? (
          <GLTFModel
            url={catalogDef!.modelUrl!}
            width={item.width}
            depth={item.depth}
            height={item.height}
            color={hasCollision ? "#EF4444" : item.color}
            opacity={1}
            materialColors={item.materialColors}
            materialTextures={item.materialTextures}
            onBoundsComputed={handleBoundsComputed}
          />
        ) : ModelComponent ? (
          <ModelComponent
            width={item.width}
            depth={item.depth}
            height={item.height}
            color={hasCollision ? "#EF4444" : item.color}
          />
        ) : null}

        {/* Hover / selection outline */}
        {(isSelected || isHovered) && (
          <mesh position={[0, item.height / 2, 0]}>
            <boxGeometry
              args={[item.width + 0.02, item.height + 0.02, item.depth + 0.02]}
            />
            <meshBasicMaterial visible={false} />
            <Edges threshold={15} color={isSelected ? "#ffffff" : "#00aaff"} />
          </mesh>
        )}
      </group>

      {/* Snap edge indicator (outside rotation group so it renders in world space) */}
      {dragging && snapEdge && <SnapIndicator snapEdge={snapEdge} />}

      {/* Measurements (outside rotation group — world space) */}
      {showMeasurements && (
        <Measurements
          item={tempItem}
          walls={walls}
          allFurniture={furniture}
        />
      )}
    </>
  );
}
