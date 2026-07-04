/**
 * Browser-side GLB analysis for the supplier portal: parse the picked file
 * with the same loader family the designer uses, measure its bounding box,
 * count triangles, and list named materials. A parse failure here means the
 * designer would fail to render the model too — the portal blocks the upload
 * and shows the reason instead of letting a broken file into the catalog.
 *
 * Browser-only (GLTFLoader touches DOM APIs for embedded textures) — call from
 * client components; never during SSR.
 */

import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { isGlbBuffer, type GlbMeasurement } from "./glbChecks";

let sharedLoader: GLTFLoader | null = null;

function getLoader(): GLTFLoader {
  if (!sharedLoader) {
    sharedLoader = new GLTFLoader();
    // Pinned to the decoder version drei@9's useGLTF defaults to (1.5.5), so
    // Draco-compressed uploads that measure here also decode in the designer.
    // Note the designer renders via drei's three-stdlib loader fork — near-
    // identical to three's own for GLB parsing, but not the same code, so
    // "parses here" is a very strong signal, not a hard guarantee.
    const draco = new DRACOLoader();
    draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.5/");
    sharedLoader.setDRACOLoader(draco);
  }
  return sharedLoader;
}

function measureScene(gltf: GLTF, fileSizeBytes: number): GlbMeasurement {
  const box = new THREE.Box3().setFromObject(gltf.scene);
  const size = new THREE.Vector3();
  box.getSize(size);

  let triangles = 0;
  const materialNames = new Set<string>();
  gltf.scene.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry;
    const meshTriangles = geometry.index
      ? geometry.index.count / 3
      : (geometry.attributes.position?.count ?? 0) / 3;
    // EXT_mesh_gpu_instancing: the real on-screen load is per-instance.
    const instances = (child as THREE.InstancedMesh).isInstancedMesh
      ? (child as THREE.InstancedMesh).count
      : 1;
    triangles += meshTriangles * instances;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (material?.name) materialNames.add(material.name);
    }
  });

  return {
    size: [size.x, size.y, size.z],
    triangleCount: Math.round(triangles),
    materialNames: Array.from(materialNames),
    fileSizeBytes,
  };
}

export function analyzeGlbBuffer(
  buffer: ArrayBuffer,
  fileSizeBytes: number
): Promise<GlbMeasurement> {
  if (!isGlbBuffer(buffer)) {
    return Promise.reject(
      new Error(
        "This is not a binary glTF (.glb) file. Re-export it as glTF 2.0 Binary (.glb) from your 3D tool."
      )
    );
  }
  return new Promise((resolve, reject) => {
    getLoader().parse(
      buffer,
      "",
      (gltf) => {
        try {
          resolve(measureScene(gltf, fileSizeBytes));
        } catch (error: unknown) {
          reject(error instanceof Error ? error : new Error("Failed to measure the model."));
        }
      },
      (error: unknown) => {
        const detail = error instanceof Error ? error.message : String(error);
        reject(
          new Error(
            `The model could not be parsed — the designer would fail to render it. (${detail})`
          )
        );
      }
    );
  });
}

export async function analyzeGlbFile(file: File): Promise<GlbMeasurement> {
  const buffer = await file.arrayBuffer();
  return analyzeGlbBuffer(buffer, file.size);
}

/** Analyze an already-uploaded model by URL (subject to the host's CORS). */
export async function analyzeGlbUrl(url: string): Promise<GlbMeasurement> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not fetch the model (HTTP ${response.status}).`);
  }
  const buffer = await response.arrayBuffer();
  return analyzeGlbBuffer(buffer, buffer.byteLength);
}
