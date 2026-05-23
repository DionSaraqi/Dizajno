"use client";

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { useFurnitureCatalog } from "@/hooks/useFurnitureCatalog";

interface MaterialAppearance {
  /** When set, the variant's tileable texture (already configured for RepeatWrapping + SRGB). */
  map: THREE.Texture | null;
  /** Tint color: either the variant's color (when a variant is assigned) or null to use the
   *  caller-provided default. Multiplied with the texture when both are present. */
  color: string | null;
  /** True while we have a variant assigned but the texture is still loading or its file is missing. */
  fallbackOnly: boolean;
}

/**
 * Resolves a material-variant id (paint or flooring) to a THREE.Texture + tint
 * color. Used by `FloorMesh` and `WallMesh` to skin surfaces with whatever the
 * user picked in the catalog. Falls back to `variant.color` when the texture
 * URL is null or the image fails to load — no fatal errors.
 *
 * The hook deliberately calls `THREE.TextureLoader.load` directly rather than
 * `useLoader`/`useTexture` because we need a non-suspending behavior with
 * graceful fallback when the file is missing (a user might have assigned a
 * material whose JPG they haven't dropped into `public/textures/` yet).
 */
export function useMaterialTexture(
  variantId: string | null | undefined
): MaterialAppearance {
  const { items: catalog } = useFurnitureCatalog();
  const variant = useMemo(
    () => (variantId ? catalog.find((c) => c.variantId === variantId) : undefined),
    [catalog, variantId]
  );
  const textureUrl = variant?.textureUrl ?? null;
  const color = variant?.color ?? null;

  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    if (!textureUrl) {
      setTexture(null);
      return;
    }
    let cancelled = false;
    const loader = new THREE.TextureLoader();
    loader.load(
      textureUrl,
      (tex) => {
        if (cancelled) {
          tex.dispose();
          return;
        }
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        setTexture(tex);
      },
      undefined,
      () => {
        // File missing or load error — leave texture null so the caller falls
        // back to the variant color. Three.js already logs to the console.
        if (!cancelled) setTexture(null);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [textureUrl]);

  // Dispose previous textures when they go out of scope.
  useEffect(() => {
    return () => {
      texture?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texture]);

  return {
    map: texture,
    color,
    fallbackOnly: variant != null && texture == null,
  };
}
