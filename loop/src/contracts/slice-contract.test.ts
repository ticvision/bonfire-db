import { describe, expect, test } from "bun:test";
import { sliceContractSchema } from "./slice-contract.js";

function valid(): Record<string, unknown> {
  return {
    id: "BF-01",
    title: "Workspace boot",
    profile: "foundation",
    goal: "Boot the workspace and prove health.",
    why: "Every later slice depends on a clean boot.",
    dependsOn: [],
    allowedPaths: ["packages/**"],
    forbiddenPaths: ["apps/demo/**"],
    acceptance: ["docker compose up boots cleanly"],
    verify: ["bun run gate"],
    evals: ["boot-smoke"],
    dangerChecks: ["cross-tenant-leak"],
    caps: { maxAttempts: 3, maxTurns: 40, maxBudgetUSD: 5 },
    requiredAgents: ["maker", "verifier"],
    greptileRequired: true
  };
}

describe("sliceContractSchema", () => {
  test("accepts a valid contract", () => {
    expect(sliceContractSchema.safeParse(valid()).success).toBe(true);
  });

  test("accepts an empty forbiddenPaths (the security floor is global, not per-slice)", () => {
    expect(sliceContractSchema.safeParse({ ...valid(), forbiddenPaths: [] }).success).toBe(true);
  });

  // Each row asserts the schema REJECTS the mutation — the invariant is enforced,
  // not just documented. Inverting/deleting any rule would flip one of these.
  const rejects: readonly (readonly [string, Record<string, unknown>])[] = [
    ["bad id (one digit)", { ...valid(), id: "BF-1" }],
    ["non-BF id", { ...valid(), id: "XX-01" }],
    ["empty title", { ...valid(), title: "" }],
    ["unknown profile", { ...valid(), profile: "wizardry" }],
    ["empty acceptance", { ...valid(), acceptance: [] }],
    ["empty allowedPaths", { ...valid(), allowedPaths: [] }],
    ["empty verify", { ...valid(), verify: [] }],
    ["empty-string eval id", { ...valid(), evals: [""] }],
    ["invalid dangerCheck value", { ...valid(), dangerChecks: ["nonsense"] }],
    ["bad dependsOn id format", { ...valid(), dependsOn: ["BF-1"] }],
    [
      "negative maxAttempts",
      { ...valid(), caps: { maxAttempts: -1, maxTurns: 40, maxBudgetUSD: 5 } }
    ],
    [
      "non-integer maxAttempts",
      { ...valid(), caps: { maxAttempts: 2.5, maxTurns: 40, maxBudgetUSD: 5 } }
    ],
    ["zero maxTurns", { ...valid(), caps: { maxAttempts: 3, maxTurns: 0, maxBudgetUSD: 5 } }],
    ["zero budget", { ...valid(), caps: { maxAttempts: 3, maxTurns: 40, maxBudgetUSD: 0 } }],
    ["requiredAgents missing maker", { ...valid(), requiredAgents: ["verifier"] }],
    ["requiredAgents missing verifier", { ...valid(), requiredAgents: ["maker"] }],
    ["greptileRequired false", { ...valid(), greptileRequired: false }],
    ["unknown extra key (strict object)", { ...valid(), surprise: true }]
  ];

  for (const [name, obj] of rejects) {
    test(`rejects ${name}`, () => {
      expect(sliceContractSchema.safeParse(obj).success).toBe(false);
    });
  }
});
