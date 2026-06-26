/**
 * The slice contract: the typed, Zod-validated unit of work the loop gates.
 *
 * Each Bonfire product slice (BF-01..BF-12, mvp-demo-plan.md) is described by one
 * contract. The schema is the boundary: every field is parsed, not trusted, so a
 * malformed registry entry can never reach the gate pipeline. Shape source of
 * truth: loop-harness-plan.md section 3.3.
 */
import { z } from "zod";

/** The kind of work a slice represents; drives gate profile and agent selection. */
export const sliceProfileSchema = z.enum([
  "foundation",
  "data",
  "fhir",
  "retrieval",
  "security",
  "contract",
  "mcp",
  "agent-safety",
  "ui",
  "ui-security",
  "benchmark",
  "docs-release"
]);
export type SliceProfile = z.infer<typeof sliceProfileSchema>;

/**
 * Product failure modes a slice is responsible for guarding (mvp-demo-plan.md
 * "Dangerous failure modes"). A slice declares only the checks it owns.
 */
export const dangerCheckSchema = z.enum([
  "scope-after-retrieve",
  "cross-tenant-leak",
  "lossy-fhir",
  "fake-conformance",
  "fail-open-authz",
  "audit-bypass",
  "propose-only-broken"
]);
export type DangerCheck = z.infer<typeof dangerCheckSchema>;

/** Harness agents a slice may require. `maker` and `verifier` are always required. */
export const requiredAgentSchema = z.enum(["planner", "maker", "verifier", "security-auditor"]);
export type RequiredAgent = z.infer<typeof requiredAgentSchema>;

/** Slice id pattern: `BF-` followed by exactly two digits (BF-01 .. BF-12). */
export const SLICE_ID_PATTERN = /^BF-\d{2}$/;

/**
 * forbiddenPaths globs every slice MUST carry so secrets and real/private data
 * can never be reached through `allowedPaths`. Enforced by the schema (a machine
 * default-deny invariant, not a prose convention an agent might forget).
 */
export const MANDATORY_FORBIDDEN_PATHS = [
  ".env",
  ".env.*",
  "fixtures/private/**",
  "seed/**/real*"
] as const;

const sliceIdSchema = z.string().regex(SLICE_ID_PATTERN, "must match /^BF-\\d{2}$/");

const nonEmptyString = z.string().min(1);

const capsSchema = z.strictObject({
  maxAttempts: z.number().int().min(1),
  maxTurns: z.number().int().min(1),
  maxBudgetUSD: z.number().positive()
});

const forbiddenPathsSchema = z
  .array(nonEmptyString)
  .refine((paths) => MANDATORY_FORBIDDEN_PATHS.every((required) => paths.includes(required)), {
    message: `forbiddenPaths must include all of: ${MANDATORY_FORBIDDEN_PATHS.join(", ")}`
  });

const requiredAgentsSchema = z
  .array(requiredAgentSchema)
  .refine((agents) => agents.includes("maker") && agents.includes("verifier"), {
    message: "requiredAgents must include both 'maker' and 'verifier'"
  });

export const sliceContractSchema = z.strictObject({
  id: sliceIdSchema,
  title: nonEmptyString,
  profile: sliceProfileSchema,
  goal: nonEmptyString,
  why: nonEmptyString,
  dependsOn: z.array(sliceIdSchema),
  allowedPaths: z.array(nonEmptyString).min(1),
  forbiddenPaths: forbiddenPathsSchema,
  acceptance: z.array(nonEmptyString).min(1),
  verify: z.array(nonEmptyString).min(1),
  evals: z.array(z.string()),
  dangerChecks: z.array(dangerCheckSchema),
  caps: capsSchema,
  requiredAgents: requiredAgentsSchema,
  greptileRequired: z.literal(true)
});

export type SliceContract = z.infer<typeof sliceContractSchema>;
