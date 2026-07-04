import { describe, it, expect, beforeEach, vi } from "vitest";
import type { FurnitureCatalogItem } from "@/types/designer";
import {
  setRuntimeCatalog,
  clearRuntimeCatalog,
  lookupRuntimeDef,
  getRuntimeCatalog,
  subscribeToCatalog,
  getCatalogVersion,
} from "./catalogRegistry";
import { getFurnitureDef, getFurnitureByCategory } from "./furnitureCatalog";

function makeItem(overrides: Partial<FurnitureCatalogItem> & { type: string }): FurnitureCatalogItem {
  return {
    label: overrides.type,
    width: 1,
    depth: 1,
    height: 1,
    color: "#ffffff",
    icon: "box",
    category: "Seating",
    svgPreview: "<svg />",
    ...overrides,
  };
}

beforeEach(() => {
  clearRuntimeCatalog();
});

describe("catalogRegistry", () => {
  it("starts with no runtime catalog", () => {
    expect(getRuntimeCatalog()).toBeNull();
    expect(lookupRuntimeDef("sofa")).toBeUndefined();
  });

  it("stores items and looks them up by type", () => {
    const supplierItem = makeItem({ type: "acme-recliner", modelUrl: "https://r2.example/acme.glb" });
    setRuntimeCatalog([supplierItem]);

    expect(getRuntimeCatalog()).toEqual([supplierItem]);
    expect(lookupRuntimeDef("acme-recliner")).toBe(supplierItem);
  });

  it("replaces the previous runtime catalog wholesale", () => {
    setRuntimeCatalog([makeItem({ type: "first" })]);
    setRuntimeCatalog([makeItem({ type: "second" })]);

    expect(lookupRuntimeDef("first")).toBeUndefined();
    expect(lookupRuntimeDef("second")).toBeDefined();
  });

  it("bumps the version and notifies subscribers on set", () => {
    const before = getCatalogVersion();
    const listener = vi.fn();
    const unsubscribe = subscribeToCatalog(listener);

    setRuntimeCatalog([makeItem({ type: "x" })]);
    expect(getCatalogVersion()).toBeGreaterThan(before);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    setRuntimeCatalog([makeItem({ type: "y" })]);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("skips notification when the same array reference is set again", () => {
    const items = [makeItem({ type: "x" })];
    setRuntimeCatalog(items);
    const version = getCatalogVersion();
    const listener = vi.fn();
    subscribeToCatalog(listener);

    setRuntimeCatalog(items);
    expect(getCatalogVersion()).toBe(version);
    expect(listener).not.toHaveBeenCalled();
  });

  it("notifies on a new reference even with identical content (relies on React Query structural sharing to avoid this)", () => {
    setRuntimeCatalog([makeItem({ type: "x" })]);
    const listener = vi.fn();
    subscribeToCatalog(listener);

    // A referentially-new but content-equal array DOES notify — React Query's
    // structuralSharing default is what prevents this from firing on every
    // refetch. This test documents the contract.
    setRuntimeCatalog([makeItem({ type: "x" })]);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("clearRuntimeCatalog notifies once and is a no-op when already clear", () => {
    setRuntimeCatalog([makeItem({ type: "x" })]);
    const listener = vi.fn();
    subscribeToCatalog(listener);

    clearRuntimeCatalog();
    expect(getRuntimeCatalog()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);

    clearRuntimeCatalog();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("getFurnitureDef with runtime catalog", () => {
  it("falls back to the bundled catalog when no runtime catalog is set", () => {
    const def = getFurnitureDef("bed");
    expect(def).toBeDefined();
    expect(def!.type).toBe("bed");
  });

  it("resolves supplier-only types from the runtime catalog", () => {
    setRuntimeCatalog([makeItem({ type: "acme-recliner", modelUrl: "https://r2.example/acme.glb" })]);

    const def = getFurnitureDef("acme-recliner");
    expect(def).toBeDefined();
    expect(def!.modelUrl).toBe("https://r2.example/acme.glb");
  });

  it("prefers the runtime item over the bundled one for the same type", () => {
    setRuntimeCatalog([makeItem({ type: "bed", width: 2.22 })]);

    expect(getFurnitureDef("bed")!.width).toBe(2.22);
  });

  it("falls back per-type to the bundled catalog for types missing from the runtime catalog", () => {
    setRuntimeCatalog([makeItem({ type: "acme-recliner" })]);

    const def = getFurnitureDef("bed");
    expect(def).toBeDefined();
    expect(def!.type).toBe("bed");
  });
});

describe("getFurnitureByCategory with runtime catalog", () => {
  it("uses the bundled catalog when no runtime catalog is set", () => {
    expect(getFurnitureByCategory("Bedroom").length).toBeGreaterThan(0);
  });

  it("uses the runtime catalog once set", () => {
    setRuntimeCatalog([
      makeItem({ type: "acme-recliner", category: "Seating" }),
      makeItem({ type: "acme-bed", category: "Bedroom" }),
    ]);

    const bedroom = getFurnitureByCategory("Bedroom");
    expect(bedroom.map((i) => i.type)).toEqual(["acme-bed"]);
  });
});
