---
name: bonfire-loop
description: Run the Bonfire autonomous build loop for one bounded slice: load loop state, create or use an isolated worktree, enforce maker/checker separation, and stop at draft PR readiness.
---

# Bonfire Loop

Use this skill when asked to run, continue, or inspect the Bonfire build loop.

## Process

1. Read `AGENTS.md`, `docs/loop/STATE.md`, `docs/loop/RUNBOOK.md`, and
   `docs/loop/ACCEPTANCE.md`.
2. Run `scripts/loop/task.mjs validate`.
3. Pick exactly one slice with `scripts/loop/task.mjs next` unless the user
   named a task id.
4. Generate the slice contract with `scripts/loop/task.mjs contract BF-XX`.
5. Write or restate the slice contract before any implementation.
6. Create an isolated worktree with `scripts/loop/create-worktree.sh <slice>`
   unless already inside the intended worktree.
7. Mark the task active in `docs/loop/task-status.json`.
8. Use `bonfire-maker` for implementation.
9. Run the task-specific verify commands and `scripts/loop/verify.sh` when the
   app scaffold exists. For harness-only
   slices, run shell and Node syntax checks for changed scripts.
10. Use `bonfire-verifier` for read-only verification.
11. Use `bonfire-security-auditor` when the slice touches data, authz, audit,
   FHIR, MCP, logging, seeds, fixtures, or hosted playground code.
12. Open or update a draft PR only after local gates pass.
13. Require Greptile `5/5` before the PR is eligible for human merge.

## Stop

Stop and report instead of continuing when the same verifier finding repeats,
the slice cap is reached, a product decision is missing, or the security auditor
returns `BLOCKING`.
