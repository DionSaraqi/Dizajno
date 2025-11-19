"use client";

import React, { useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import {
  Grid,
  OrbitControls,
  PerspectiveCamera,
  OrthographicCamera,
  Html,
} from "@react-three/drei";
import * as THREE from "three";

const Wall = ({ start, end, thickness = 0.1, height = 1 }) => {
  const startVec = new THREE.Vector3(...start);
  const endVec = new THREE.Vector3(...end);
  const direction = new THREE.Vector3().subVectors(endVec, startVec);
  const length = direction.length();

  if (length === 0) return null;

  const center = new THREE.Vector3()
    .addVectors(startVec, endVec)
    .multiplyScalar(0.5);

  // Calculate angle in XZ plane
  // We want to rotate a box initially aligned with X axis
  const angle = Math.atan2(direction.z, direction.x);

  return (
    <group>
      <mesh
        position={[center.x, height / 2, center.z]}
        rotation={[0, -angle, 0]}
      >
        <boxGeometry args={[length, height, thickness]} />
        <meshStandardMaterial color="#4a4a4a" />
      </mesh>
      {/* Joints to fix gaps */}
      <mesh position={[startVec.x, height / 2, startVec.z]}>
        <cylinderGeometry args={[thickness / 2, thickness / 2, height, 16]} />
        <meshStandardMaterial color="#4a4a4a" />
      </mesh>
      <mesh position={[endVec.x, height / 2, endVec.z]}>
        <cylinderGeometry args={[thickness / 2, thickness / 2, height, 16]} />
        <meshStandardMaterial color="#4a4a4a" />
      </mesh>
    </group>
  );
};

const DrawingPlane = ({ snap, gridSize, is3D, drawingMode }) => {
  const [walls, setWalls] = useState([]);
  const [drawing, setDrawing] = useState(false);
  const [currentStart, setCurrentStart] = useState(null);
  const [currentEnd, setCurrentEnd] = useState(null);

  const getPoint = (e) => {
    const point = e.point.clone();
    point.y = 0;
    if (snap) {
      point.x = Math.round(point.x / gridSize) * gridSize;
      point.z = Math.round(point.z / gridSize) * gridSize;
    }
    return point;
  };

  const handlePointerDown = (e) => {
    // Only handle right click (button 2) and if drawing mode is active
    if (e.button !== 2 || !drawingMode) return;

    e.stopPropagation();
    const point = getPoint(e);

    if (!drawing) {
      setDrawing(true);
      setCurrentStart(point.toArray());
      setCurrentEnd(point.toArray());
    } else {
      // Finish wall
      const start = new THREE.Vector3(...currentStart);
      const end = new THREE.Vector3(...point.toArray());

      if (start.distanceTo(end) > 0.01) {
        setWalls([...walls, { start: currentStart, end: point.toArray() }]);
      }

      setDrawing(false);
      setCurrentStart(null);
      setCurrentEnd(null);
    }
  };
  const handlePointerMove = (e) => {
    if (drawing && currentStart) {
      const point = getPoint(e);
      setCurrentEnd(point.toArray());
    }
  };

  // Calculate length for current wall being drawn
  const currentLength =
    drawing && currentStart && currentEnd
      ? new THREE.Vector3(...currentStart).distanceTo(
          new THREE.Vector3(...currentEnd)
        )
      : 0;

  const currentCenter =
    drawing && currentStart && currentEnd
      ? new THREE.Vector3()
          .addVectors(
            new THREE.Vector3(...currentStart),
            new THREE.Vector3(...currentEnd)
          )
          .multiplyScalar(0.5)
      : null;

  return (
    <>
      <Grid
        position={[0, 0.01, 0]}
        args={[100, 100]}
        cellSize={gridSize}
        cellThickness={1}
        cellColor="#6f6f6f"
        sectionSize={gridSize * 5}
        sectionThickness={1.5}
        sectionColor="#000000"
        fadeDistance={50}
        infiniteGrid
      />

      {/* Invisible plane for raycasting */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
      >
        <planeGeometry args={[100, 100]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {walls.map((wall, i) => (
        <Wall key={i} start={wall.start} end={wall.end} />
      ))}

      {drawing && currentStart && currentEnd && (
        <>
          <Wall start={currentStart} end={currentEnd} />
          <Html position={[currentCenter.x, 1.5, currentCenter.z]} center>
            <div className="bg-black text-white px-2 py-1 rounded text-xs whitespace-nowrap">
              {currentLength.toFixed(2)}m
            </div>
          </Html>
        </>
      )}
    </>
  );
};

export default function DrawingSurface() {
  const [snap, setSnap] = useState(true);
  const [gridSize, setGridSize] = useState(1);
  const [is3D, setIs3D] = useState(false);
  const [drawingMode, setDrawingMode] = useState(true);

  return (
    <div
      className="relative w-full h-full"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Custom UI Overlay */}
      <div className="absolute top-4 right-4 z-10 bg-white p-4 rounded-lg shadow-lg flex flex-col gap-4 min-w-[200px]">
        <h3 className="font-bold text-gray-800">Drawing Settings</h3>

        <div className="flex items-center justify-between">
          <label className="text-sm text-gray-600">Mode</label>
          <button
            onClick={() => setIs3D(!is3D)}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              is3D
                ? "bg-blue-500 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            {is3D ? "3D View" : "2D View"}
          </button>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm text-gray-600">Drawing</label>
          <button
            onClick={() => setDrawingMode(!drawingMode)}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              drawingMode ? "bg-green-500 text-white" : "bg-red-500 text-white"
            }`}
          >
            {drawingMode ? "ON" : "OFF"}
          </button>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm text-gray-600">Snap to Grid</label>
          <input
            type="checkbox"
            checked={snap}
            onChange={(e) => setSnap(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm text-gray-600">
            Grid Size: {gridSize}m
          </label>
          <input
            type="range"
            min="0.5"
            max="5"
            step="0.5"
            value={gridSize}
            onChange={(e) => setGridSize(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>

      <Canvas shadows>
        <color attach="background" args={["#e0e0e0"]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} castShadow />

        {is3D ? (
          <PerspectiveCamera makeDefault position={[10, 10, 10]} fov={50} />
        ) : (
          <OrthographicCamera
            makeDefault
            position={[0, 20, 0]}
            zoom={40}
            near={0.1}
            far={1000}
          />
        )}

        <DrawingPlane
          snap={snap}
          gridSize={gridSize}
          is3D={is3D}
          drawingMode={drawingMode}
        />

        <OrbitControls
          makeDefault
          enableRotate={is3D}
          minPolarAngle={0}
          maxPolarAngle={Math.PI / 2.1} // Prevent going below ground
          minZoom={10} // Limit zoom out for Orthographic
          maxZoom={100} // Limit zoom in for Orthographic
          minDistance={2} // Limit zoom in for Perspective
          maxDistance={50} // Limit zoom out for Perspective
          mouseButtons={{
            LEFT: is3D ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN,
            MIDDLE: THREE.MOUSE.PAN,
            RIGHT: undefined, // Right click is used for drawing
          }}
        />
      </Canvas>
    </div>
  );
}
