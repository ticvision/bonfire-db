import { describe, expect, test } from "bun:test";
import { sliceContractSchema } from "./slice-contract.js";

const validContract = {
  id: "BF-01",
  title: "Workspace boot",
  profile: "foundation",
  goal: "Boot the workspace and prove health.",
  why: "Every later slice depends on a clean boot.",
  dependsOn: [],
  allowedPaths: ["package.json", "loop/**"],
  forbiddenPaths: [".env", ".env.*", "fixtures/private/**", "seed/**/real*"],
  acceptance: ["docker compose up boots cleanly"],
  verify: ["bun run gate"],
  evals: [],
  dangerChecks: [],
  caps: { maxAttempts: 3, maxTurns: 40, maxBudgetUSD: 5 },
  requiredAgents: ["maker", "verifier"],
  greptileRequired: true
};

describe("sliceContractSchema", () => {
  test("parses a valid contract", () => {
    expect(sliceContractSchema.safeParse(validContract).success).toBe(true);
  });

  test("rejects a bad id", () => {
    expect(sliceContractSchema.safeParse({ ...validContract, id: "BF-1" }).success).toBe(false);
    expect(sliceContractSchema.safeParse({ ...validContract, id: "XX-01" }).success).toBe(false);
  });

  test("rejects empty acceptance", () => {
    expect(sliceContractSchema.safeParse({ ...validContract, acceptance: [] }).success).toBe(false);
  });

  test("rejects negative / non-integer caps", () => {
    expect(
      sliceContractSchema.safeParse({
        ...validContract,
        caps: { maxAttempts: -1, maxTurns: 40, maxBudgetUSD: 5 }
      }).success
    ).toBe(false);
    expect(
      sliceContractSchema.safeParse({
        ...validContract,
        caps: { maxAttempts: 3, maxTurns: 40, maxBudgetUSD: 0 }
      }).success
    ).toBe(false);
  });

  test("rejects an unknown profile", () => {
    expect(sliceContractSchema.safeParse({ ...validContract, profile: "wizardry" }).success).toBe(
      false
    );
  });

  test("rejects requiredAgents missing maker", () => {
    expect(
      sliceContractSchema.safeParse({ ...validContract, requiredAgents: ["verifier"] }).success
    ).toBe(false);
  });

  test("rejects forbiddenPaths missing the mandatory secret globs", () => {
    expect(
      sliceContractSchema.safeParse({ ...validContract, forbiddenPaths: [".env"] }).success
    ).toBe(false);
  });

  test("rejects unknown keys (strict object)", () => {
    expect(sliceContractSchema.safeParse({ ...validContract, surprise: true }).success).toBe(false);
  });
});
