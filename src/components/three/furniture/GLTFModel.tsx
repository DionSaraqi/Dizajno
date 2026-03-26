"use client";

import React, { useRef, useEffect, useMemo } from "react";
import { useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";

interface GLTFModelProps {
  url: string;
  width: number;
  depth: number;
  height: number;
  color?: string;
  opacity?: number;
  /** Per-material color overrides keyed by material name in the GLB */
  materialColors?: Record<string, string>;
  /** Per-material texture overrides keyed by material name in the GLB */
  materialTextures?: Record<string, string>;
  /** Called once after the model is scaled, with the actual rendered [width, height, depth] */
  onBoundsComputed?: (bounds: [number, number, number]) => void;
}

/**
 * Generic GLTF/GLB model loader that auto-scales the model to fit
 * the specified width/depth/height bounding box.
 * Each instance gets its own deep-cloned materials so color/opacity
 * changes don't bleed between placed items and ghost previews.
 */
export default function GLTFModel({ url, width, depth, height, color, opacity = 1, materialColors, materialTextures, onBoundsComputed }: GLTFModelProps) {
  const { scene } = useGLTF(url);
  const groupRef = useRef<THREE.Group>(null);

  // Clone scene and deep-clone all materials (only recompute when geometry changes)
  const { cloned, materials, materialsByName, originalColors, renderedSize } = useMemo(() => {
    const clone = scene.clone(true);
    const mats: THREE.Material[] = [];
    const byName = new Map<string, THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial>();
    const origColors = new Map<string, THREE.Color>();

    // Deep-clone every material so mutations are per-instance
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((m) => {
            const clonedMat = m.clone();
            mats.push(clonedMat);
            if (clonedMat.name && (clonedMat instanceof THREE.MeshStandardMaterial || clonedMat instanceof THREE.MeshPhysicalMaterial)) {
              byName.set(clonedMat.name, clonedMat);
              origColors.set(clonedMat.name, clonedMat.color.clone());
            }
            return clonedMat;
          });
        } else if (mesh.material) {
          mesh.material = mesh.material.clone();
          mats.push(mesh.material);
          const mat = mesh.material;
          if (mat.name && (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial)) {
            byName.set(mat.name, mat);
            origColors.set(mat.name, mat.color.clone());
          }
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

    // Actual rendered dimensions after uniform scaling
    const scaledSize = new THREE.Vector3();
    scaledBox.getSize(scaledSize);

    return {
      cloned: clone,
      materials: mats,
      materialsByName: byName,
      originalColors: origColors,
      renderedSize: [scaledSize.x, scaledSize.y, scaledSize.z] as [number, number, number],
    };
  }, [scene, width, depth, height]);

  // Report actual rendered bounds to parent
  useEffect(() => {
    onBoundsComputed?.(renderedSize);
  }, [renderedSize, onBoundsComputed]);

  // Apply color/opacity reactively (doesn't recreate the clone)
  useEffect(() => {
    const transparent = opacity < 1;
    const isCollision = color === "#EF4444";

    for (const mat of materials) {
      if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) {
        mat.transparent = transparent;
        mat.opacity = opacity;
        mat.depthWrite = !transparent;
        if (isCollision) {
          mat.emissive.set("#EF4444");
          mat.emissiveIntensity = 0.6;
        } else {
          mat.emissive.set(0x000000);
          mat.emissiveIntensity = 0;
        }
        mat.needsUpdate = true;
      }
    }
  }, [color, opacity, materials]);

  // Apply per-material color overrides by material name
  useEffect(() => {
    if (!materialColors) return;
    for (const [name, hex] of Object.entries(materialColors)) {
      const mat = materialsByName.get(name);
      if (mat) {
        mat.color.set(hex);
        mat.needsUpdate = true;
      }
    }
  }, [materialColors, materialsByName]);

  // Apply per-material texture overrides by material name
  useEffect(() => {
    if (!materialTextures) return;
    const loader = new THREE.TextureLoader();
    const loaded: THREE.Texture[] = [];

    for (const [name, textureUrl] of Object.entries(materialTextures)) {
      const mat = materialsByName.get(name);
      if (!mat) continue;

      if (!textureUrl) {
        // Remove texture and restore original color
        if (mat.map) {
          mat.map.dispose();
          mat.map = null;
        }
        // Restore color from materialColors or the original material color stored at clone time
        const overrideColor = materialColors?.[name];
        if (overrideColor) {
          mat.color.set(overrideColor);
        } else {
          // Restore from original scene material
          const origMat = originalColors.get(name);
          if (origMat) mat.color.copy(origMat);
        }
        mat.needsUpdate = true;
        continue;
      }

      loader.load(textureUrl, (texture) => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(4, 4);
        texture.colorSpace = THREE.SRGBColorSpace;
        mat.map = texture;
        // Apply color tint: materialColors override > original color
        const tint = materialColors?.[name];
        if (tint) {
          mat.color.set(tint);
        } else {
          const orig = originalColors.get(name);
          if (orig) mat.color.copy(orig);
        }
        mat.needsUpdate = true;
        loaded.push(texture);
      });
    }

    return () => {
      for (const tex of loaded) tex.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materialTextures, materialsByName]);

  return (
    <group ref={groupRef}>
      <primitive object={cloned} />
    </group>
  );
}

GLTFModel.preload = (url: string) => useGLTF.preload(url);
