"use client";

import React, { useRef, useState } from "react";
import { Edges } from "@react-three/drei";
import {
  useDesignerStore,
  useSelectedIds,
  useSnap,
  useGridSize,
  useIs3D,
} from "@/store/useDesignerStore";
import type { FurnitureData } from "@/types/designer";
import { checkFurnitureCollision } from "@/utils/collision";
import { smartSnap, type SnapEdge } from "@/utils/snapToGrid";
import Measurements from "./Measurements";
import SnapIndicator from "./SnapIndicator";
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

  const select = useDesignerStore((s) => s.select);
  const toggleSelect = useDesignerStore((s) => s.toggleSelect);
  const moveFurniture = useDesignerStore((s) => s.moveFurniture);
  const setStoreDragging = useDesignerStore((s) => s.setDragging);
  const furniture = useDesignerStore((s) => s.furniture);
  const walls = useDesignerStore((s) => s.walls);

  const [dragging, setDragging] = useState(false);
  const [dragPos, setDragPos] = useState<[number, number]>(item.position);
  const [snapEdge, setSnapEdge] = useState<SnapEdge | null>(null);
  const groupRef = useRef<any>(null);

  const isSelected = selectedIds.includes(item.id);
  const pos = dragging ? dragPos : item.position;

  const tempItem: FurnitureData = { ...item, position: pos };
  const hasCollision =
    dragging && checkFurnitureCollision(tempItem, furniture, walls);

  const ModelComponent = getModel(item.type);

  // Item descriptor for snap calculations
  const itemDesc = { id: item.id, rotation: item.rotation, width: item.width, depth: item.depth };

  const handlePointerDown = (e: any) => {
    e.stopPropagation();

    if (e.nativeEvent?.shiftKey || e.shiftKey) {
      toggleSelect(item.id);
    } else {
      select(item.id);
    }

    setDragging(true);
    setStoreDragging(true);
    (e.target as any)?.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: any) => {
    if (!dragging) return;
    e.stopPropagation();
    const point = e.point;
    if (!point) return;

    const result = smartSnap(
      point.x,
      point.z,
      itemDesc,
      walls,
      furniture,
      snap,
      gridSize
    );

    setDragPos(result.position);
    setSnapEdge(result.snapEdge);
  };

  const handlePointerUp = (e: any) => {
    if (!dragging) return;
    e.stopPropagation();
    setDragging(false);
    setStoreDragging(false);
    setSnapEdge(null);
    (e.target as any)?.releasePointerCapture?.(e.pointerId);

    if (!hasCollision) {
      moveFurniture(item.id, dragPos);
    }
    setDragPos(item.position);
  };

  // Show measurements in 2D when selected and not currently dragging (or while dragging)
  const showMeasurements = !is3D && isSelected;

  return (
    <>
      <group
        ref={groupRef}
        position={[pos[0], 0, pos[1]]}
        rotation={[0, item.rotation, 0]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {ModelComponent && (
          <ModelComponent
            width={item.width}
            depth={item.depth}
            height={item.height}
            color={hasCollision ? "#EF4444" : item.color}
          />
        )}

        {/* Selection highlight */}
        {isSelected && (
          <mesh position={[0, item.height / 2, 0]}>
            <boxGeometry
              args={[item.width + 0.02, item.height + 0.02, item.depth + 0.02]}
            />
            <meshBasicMaterial visible={false} />
            <Edges threshold={15} color="#6366f1" />
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
