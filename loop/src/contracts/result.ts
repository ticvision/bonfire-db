/**
 * The `Result` discriminated union used at the loop harness's public boundary.
 *
 * Decision CQ2 (loop-harness-plan.md section 6): the public surface returns a
 * tagged union rather than throwing for expected, recoverable outcomes. Callers
 * must branch on the `ok` tag, and TypeScript exhaustiveness forces that branch
 * before `value` or `error` is reachable. Only genuine programmer error throws.
 */

export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

/** Construct a success `Result`. */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/** Construct a failure `Result`. */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
