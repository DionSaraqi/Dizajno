"use client";

import React, { useMemo } from "react";
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
 */
export default function GLTFModel({ url, width, depth, height, color, opacity = 1 }: GLTFModelProps) {
  const { scene } = useGLTF(url);
  const transparent = opacity < 1;

  // Clone the scene so each instance is independent
  const cloned = useMemo(() => {
    const clone = scene.clone(true);

    // Compute bounding box of the original model
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    box.getSize(size);

    // Scale to fit the target dimensions
    const scaleX = size.x > 0 ? width / size.x : 1;
    const scaleY = size.y > 0 ? height / size.y : 1;
    const scaleZ = size.z > 0 ? depth / size.z : 1;
    // Use uniform scale (smallest axis) to preserve proportions
    const uniformScale = Math.min(scaleX, scaleY, scaleZ);
    clone.scale.setScalar(uniformScale);

    // Recompute bounds after scaling
    const scaledBox = new THREE.Box3().setFromObject(clone);
    const scaledSize = new THREE.Vector3();
    scaledBox.getSize(scaledSize);
    const center = new THREE.Vector3();
    scaledBox.getCenter(center);

    // Center horizontally and on Z, sit on the ground (y=0)
    clone.position.set(-center.x, -scaledBox.min.y, -center.z);

    // Apply color/opacity overrides to all mesh materials
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((mat) => {
            if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) {
              if (transparent) {
                mat.transparent = true;
                mat.opacity = opacity;
              }
              mat.needsUpdate = true;
            }
          });
        }
      }
    });

    return clone;
  }, [scene, width, depth, height, color, opacity, transparent]);

  return <primitive object={cloned} />;
}

// Preload helper — call with the URL to start loading early
GLTFModel.preload = (url: string) => useGLTF.preload(url);
