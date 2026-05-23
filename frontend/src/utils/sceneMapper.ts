/**
 * Two-way mapper between the live Zustand designer store shape and the
 * `/api/projects/{id}/scene` API contract. The frontend uses [x, z] tuples and
 * lowercase opening kinds; the backend uses scalar columns and PascalCase
 * enum strings.
 */

import type {
  WallData,
  FloorData,
  FurnitureData,
  OpeningData,
  OpeningType,
} from "@/types/designer";
import { getFurnitureDef } from "@/utils/furnitureCatalog";
import type {
  FloorApi,
  OpeningApi,
  OpeningTypeApi,
  PlacedItemApi,
  SceneApi,
  WallApi,
} from "@/lib/api";

interface VariantLookup {
  /** Returns the backend product-variant uuid for a frontend furniture type slug. */
  variantIdForType(type: string): string | undefined;
  /** Returns the frontend furniture-type slug for a backend product-variant uuid. */
  typeForVariantId(variantId: string): string | undefined;
}

function toOpeningApiType(t: OpeningType): OpeningTypeApi {
  return t === "door" ? "Door" : "Window";
}

function fromOpeningApiType(t: OpeningTypeApi): OpeningType {
  return t === "Door" ? "door" : "window";
}

interface SceneStateSlice {
  walls: WallData[];
  floors: FloorData[];
  furniture: FurnitureData[];
  openings: OpeningData[];
}

interface MapToApiResult {
  scene: SceneApi;
  /** Furniture entries whose type slug has no backend variant — silently dropped. */
  unmappedFurniture: FurnitureData[];
}

export function mapStoreToApiScene(
  state: SceneStateSlice,
  lookup: VariantLookup
): MapToApiResult {
  const walls: WallApi[] = state.walls.map((w) => ({
    id: w.id,
    startX: w.start[0],
    startZ: w.start[1],
    endX: w.end[0],
    endZ: w.end[1],
    thickness: w.thickness,
    height: w.height,
  }));

  const floors: FloorApi[] = state.floors.map((f) => ({
    id: f.id,
    vertices: f.vertices.map(([x, z]) => [x, z]),
  }));

  const openings: OpeningApi[] = state.openings.map((o) => ({
    id: o.id,
    wallId: o.wallId,
    type: toOpeningApiType(o.type),
    offsetFromStart: o.offsetFromStart,
    width: o.width,
    height: o.height,
    sillHeight: o.sillHeight,
    productVariantId: o.productVariantId ?? null,
    materialOverrides: null,
  }));

  const placedItems: PlacedItemApi[] = [];
  const unmappedFurniture: FurnitureData[] = [];
  for (const f of state.furniture) {
    const variantId = lookup.variantIdForType(f.type);
    if (!variantId) {
      unmappedFurniture.push(f);
      continue;
    }
    placedItems.push({
      id: f.id,
      productVariantId: variantId,
      positionX: f.position[0],
      positionZ: f.position[1],
      rotation: f.rotation,
      scale: f.scale ?? 1,
      scaledWidth: f.width,
      scaledDepth: f.depth,
      scaledHeight: f.height,
      materialColors: f.materialColors ?? null,
      materialTextures: f.materialTextures ?? null,
    });
  }

  return {
    scene: { walls, floors, openings, placedItems },
    unmappedFurniture,
  };
}

export interface ApiToStoreResult {
  walls: WallData[];
  floors: FloorData[];
  furniture: FurnitureData[];
  openings: OpeningData[];
  /** Placed items whose backend variant id no longer maps to a catalog slug. */
  unmappedPlacedItems: PlacedItemApi[];
}

export function mapApiSceneToStore(
  api: SceneApi,
  lookup: VariantLookup
): ApiToStoreResult {
  const walls: WallData[] = api.walls.map((w) => ({
    id: w.id,
    start: [w.startX, w.startZ],
    end: [w.endX, w.endZ],
    thickness: w.thickness,
    height: w.height,
  }));

  const floors: FloorData[] = api.floors.map((f) => ({
    id: f.id,
    vertices: f.vertices.map(([x, z]) => [x, z] as [number, number]),
  }));

  const openings: OpeningData[] = api.openings.map((o) => ({
    id: o.id,
    wallId: o.wallId,
    type: fromOpeningApiType(o.type),
    offsetFromStart: o.offsetFromStart,
    width: o.width,
    height: o.height,
    sillHeight: o.sillHeight,
    productVariantId: o.productVariantId ?? null,
  }));

  const furniture: FurnitureData[] = [];
  const unmappedPlacedItems: PlacedItemApi[] = [];
  for (const p of api.placedItems) {
    const type = lookup.typeForVariantId(p.productVariantId);
    if (!type) {
      unmappedPlacedItems.push(p);
      continue;
    }
    // The API doesn't persist `color` (it's a catalog property, not user state),
    // so fall back to the catalog default. Procedural models use this as their
    // material color; GLB models use it as a tint over the texture.
    const def = getFurnitureDef(type);
    furniture.push({
      id: p.id,
      type,
      position: [p.positionX, p.positionZ],
      rotation: p.rotation,
      width: p.scaledWidth,
      depth: p.scaledDepth,
      height: p.scaledHeight,
      color: def?.color ?? "#ffffff",
      locked: true,
      scale: p.scale,
      materialColors: p.materialColors ?? undefined,
      materialTextures: p.materialTextures ?? undefined,
    });
  }

  return { walls, floors, furniture, openings, unmappedPlacedItems };
}
