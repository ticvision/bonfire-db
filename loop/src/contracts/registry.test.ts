import { describe, expect, test } from "bun:test";
import { allSlices, getSlice, validateRegistry } from "./registry.js";

const EXPECTED_IDS = Array.from(
  { length: 12 },
  (_unused, index) => `BF-${String(index + 1).padStart(2, "0")}`
);

describe("slice registry", () => {
  test("the real registry validates and holds all 12 slices", () => {
    const result = validateRegistry();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.slices).toHaveLength(12);
    } else {
      throw new Error(`registry invalid: ${result.error.issues.map((i) => i.message).join("; ")}`);
    }
  });

  test("ids are unique and cover exactly BF-01..BF-12", () => {
    const ids = allSlices().map((slice) => slice.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
    expect([...unique].sort()).toEqual(EXPECTED_IDS);
  });

  test("every dependsOn resolves to a known slice (and no cycle)", () => {
    const ids = new Set(allSlices().map((slice) => slice.id));
    for (const slice of allSlices()) {
      for (const dep of slice.dependsOn) {
        expect(ids.has(dep)).toBe(true);
      }
    }
    // validateRegistry only returns ok when the graph is also acyclic.
    expect(validateRegistry().ok).toBe(true);
  });

  test("getSlice resolves a known id and returns undefined for an unknown id", () => {
    expect(getSlice("BF-01")?.id).toBe("BF-01");
    expect(getSlice("BF-99")).toBeUndefined();
  });
});
