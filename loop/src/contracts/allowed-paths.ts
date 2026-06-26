/**
 * Allowed-paths drift check: the gate that keeps a maker inside its slice.
 *
 * DEFAULT-DENY (loop-harness-plan.md section 3.3): a changed file passes only if
 * it matches at least one `allowedPaths` glob AND zero `forbiddenPaths` globs. A
 * file that matches nothing is a violation; a file matching a forbidden glob is a
 * violation even when it also matches an allowed glob. This is a recoverable,
 * expected outcome, so it is returned as a `Result`, never thrown.
 */
import picomatch from "picomatch";
import type { Result } from "./result.js";
import { err, ok } from "./result.js";
import type { SliceContract } from "./slice-contract.js";

/** A single out-of-scope file together with why it was rejected. */
export interface AllowedPathsViolation {
  readonly file: string;
  readonly reason: string;
}

/** The failure payload: every changed file that fell outside the slice's scope. */
export interface AllowedPathsFailure {
  readonly violations: readonly AllowedPathsViolation[];
}

// `dot: true` so forbidden globs catch dotfiles (e.g. `.env`) and `**` matches
// hidden segments — a security matcher must not silently skip hidden paths.
const MATCHER_OPTIONS: picomatch.PicomatchOptions = { dot: true };

/**
 * Check a set of changed files against a slice's allowed/forbidden globs.
 * Returns `ok({ ok: true })` when every file is in scope, otherwise the full
 * list of violations.
 */
export function checkAllowedPaths(
  slice: SliceContract,
  changedFiles: readonly string[]
): Result<{ readonly ok: true }, AllowedPathsFailure> {
  const isAllowed = picomatch(slice.allowedPaths, MATCHER_OPTIONS);
  const isForbidden = picomatch(slice.forbiddenPaths, MATCHER_OPTIONS);

  const violations: AllowedPathsViolation[] = [];
  for (const file of changedFiles) {
    if (isForbidden(file)) {
      violations.push({ file, reason: `matches a forbidden path in slice ${slice.id}` });
    } else if (!isAllowed(file)) {
      violations.push({
        file,
        reason: `matches no allowed path in slice ${slice.id} (default-deny)`
      });
    }
  }

  if (violations.length > 0) {
    return err({ violations });
  }
  return ok({ ok: true });
}
