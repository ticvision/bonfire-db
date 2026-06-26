import { describe, expect, test } from "bun:test";
import { checkAllowedPaths } from "./allowed-paths.js";
import type { SliceContract } from "./slice-contract.js";

const slice: SliceContract = {
  id: "BF-02",
  title: "Schema + migrations",
  profile: "data",
  goal: "Add the canonical schema.",
  why: "Every read and write needs the tables.",
  dependsOn: ["BF-01"],
  allowedPaths: ["drizzle/**", "packages/core/src/**"],
  forbiddenPaths: [".env", ".env.*", "fixtures/private/**", "seed/**/real*"],
  acceptance: ["migrations apply on a clean db"],
  verify: ["bun test packages/core"],
  evals: [],
  dangerChecks: ["cross-tenant-leak"],
  caps: { maxAttempts: 3, maxTurns: 40, maxBudgetUSD: 5 },
  requiredAgents: ["maker", "verifier"],
  greptileRequired: true
};

describe("checkAllowedPaths", () => {
  test("an in-scope file passes (ok branch)", () => {
    const result = checkAllowedPaths(slice, ["packages/core/src/db.ts", "drizzle/0001_init.sql"]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ ok: true });
    } else {
      throw new Error("expected ok");
    }
  });

  test("a file matching nothing is a violation (default-deny)", () => {
    const result = checkAllowedPaths(slice, ["README.md"]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.violations).toHaveLength(1);
      expect(result.error.violations[0]?.file).toBe("README.md");
      expect(result.error.violations[0]?.reason).toContain("default-deny");
    } else {
      throw new Error("expected violation");
    }
  });

  test("an out-of-scope (other package) file fails", () => {
    const result = checkAllowedPaths(slice, ["apps/api/src/server.ts"]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.violations[0]?.file).toBe("apps/api/src/server.ts");
    } else {
      throw new Error("expected violation");
    }
  });

  test("a forbidden-path match fails even when allowedPaths is wide", () => {
    const wideSlice: SliceContract = { ...slice, allowedPaths: ["**"] };
    const result = checkAllowedPaths(wideSlice, [".env"]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.violations[0]?.reason).toContain("forbidden");
    } else {
      throw new Error("expected violation");
    }
  });

  test("an empty changeset is vacuously in scope", () => {
    const result = checkAllowedPaths(slice, []);
    expect(result.ok).toBe(true);
  });
});
