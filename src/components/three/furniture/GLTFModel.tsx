"use client";

import React, { useRef, useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

interface GLTFModelProps {
  url: string;
  width: number;
  depth: number;
  height: number;
  color?: string;
  opacity?: number;
}

/**
 * Generic GLTF/GLB model loader that auto-scales the model to fit
 * the specified width/depth/height bounding box.
 * Each instance gets its own deep-cloned materials so color/opacity
 * changes don't bleed between placed items and ghost previews.
 */
export default function GLTFModel({ url, width, depth, height, color, opacity = 1 }: GLTFModelProps) {
  const { scene } = useGLTF(url);
  const groupRef = useRef<THREE.Group>(null);

  // Clone scene and deep-clone all materials (only recompute when geometry changes)
  const { cloned, materials } = useMemo(() => {
    const clone = scene.clone(true);
    const mats: THREE.Material[] = [];

    // Deep-clone every material so mutations are per-instance
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((m) => {
            const clonedMat = m.clone();
            mats.push(clonedMat);
            return clonedMat;
          });
        } else if (mesh.material) {
          mesh.material = mesh.material.clone();
          mats.push(mesh.material);
        }
      }
    });

    // Compute bounding box and scale
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    box.getSize(size);

    const scaleX = size.x > 0 ? width / size.x : 1;
    const scaleY = size.y > 0 ? height / size.y : 1;
    const scaleZ = size.z > 0 ? depth / size.z : 1;
    const uniformScale = Math.min(scaleX, scaleY, scaleZ);
    clone.scale.setScalar(uniformScale);

    // Center and ground
    const scaledBox = new THREE.Box3().setFromObject(clone);
    const center = new THREE.Vector3();
    scaledBox.getCenter(center);
    clone.position.set(-center.x, -scaledBox.min.y, -center.z);

    return { cloned: clone, materials: mats };
  }, [scene, width, depth, height]);

  // Apply color/opacity reactively (doesn't recreate the clone)
  useEffect(() => {
    const transparent = opacity < 1;
    const overrideColor = color ? new THREE.Color(color) : null;

    for (const mat of materials) {
      if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) {
        mat.transparent = transparent;
        mat.opacity = opacity;
        mat.depthWrite = !transparent;
        if (overrideColor && color === "#EF4444") {
          // Collision red — tint via emissive so model shape is still visible
          mat.emissive.set(overrideColor);
          mat.emissiveIntensity = 0.6;
        } else {
          mat.emissive.set(0x000000);
          mat.emissiveIntensity = 0;
        }
        mat.needsUpdate = true;
      }
    }
  }, [color, opacity, materials]);

  return (
    <group ref={groupRef}>
      <primitive object={cloned} />
    </group>
  );
}

GLTFModel.preload = (url: string) => useGLTF.preload(url);
