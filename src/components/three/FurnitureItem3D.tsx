"use client";

import React, { useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { FurnitureData } from "@/components/designer/DesignerProvider";
import { useDesignerState, useDesignerDispatch } from "@/components/designer/DesignerProvider";
import { checkFurnitureCollision } from "@/utils/collision";
import { snapToGrid } from "@/utils/snapToGrid";
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
  const state = useDesignerState();
  const dispatch = useDesignerDispatch();
  const [dragging, setDragging] = useState(false);
  const [dragPos, setDragPos] = useState<[number, number]>(item.position);
  const groupRef = useRef<any>(null);

  const isSelected = state.selectedId === item.id;
  const pos = dragging ? dragPos : item.position;

  const tempItem: FurnitureData = { ...item, position: pos };
  const hasCollision = dragging && checkFurnitureCollision(tempItem, state.furniture, state.walls);

  const ModelComponent = getModel(item.type);

  const handlePointerDown = (e: any) => {
    if (state.mode !== "select") return;
    e.stopPropagation();
    dispatch({ type: "SELECT", id: item.id });
    setDragging(true);
    (e.target as any)?.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: any) => {
    if (!dragging) return;
    e.stopPropagation();
    const point = e.point;
    if (point) {
      const x = state.snap ? snapToGrid(point.x, state.gridSize) : point.x;
      const z = state.snap ? snapToGrid(point.z, state.gridSize) : point.z;
      setDragPos([x, z]);
    }
  };

  const handlePointerUp = (e: any) => {
    if (!dragging) return;
    e.stopPropagation();
    setDragging(false);
    (e.target as any)?.releasePointerCapture?.(e.pointerId);

    if (!hasCollision) {
      dispatch({ type: "MOVE_FURNITURE", id: item.id, position: dragPos });
    }
    setDragPos(item.position);
  };

  return (
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

      {/* Selection outline */}
      {isSelected && (
        <mesh position={[0, item.height / 2, 0]}>
          <boxGeometry args={[item.width + 0.05, item.height + 0.05, item.depth + 0.05]} />
          <meshBasicMaterial color="#3B82F6" wireframe />
        </mesh>
      )}
    </group>
  );
}
