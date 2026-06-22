# Bonfire Loop Runbook

The loop exists to build the Bonfire demo in small, verified slices. It may
create worktrees, make changes, run checks, push branches, and open draft PRs.
It may not merge.

## Modes

### 1. Manual

Use this until the first end-to-end slice has passed.

```bash
scripts/loop/create-worktree.sh harness-smoke
scripts/loop/ledger.mjs add --key harness-001 --source manual --sev med \
  --title "Harness smoke" --action "Run verifier on the harness skeleton"
```

### 2. Semi-auto

Default once one manual slice works.

1. Run `scripts/loop/task.mjs next`.
2. Run `scripts/loop/task.mjs contract BF-XX` and paste that contract into the
   maker prompt.
3. Mark the task active:
   `scripts/loop/task.mjs status BF-XX active --branch loop/BF-XX`.
4. Create a worktree with `scripts/loop/create-worktree.sh BF-XX`.
5. Run a maker agent against the slice contract.
6. Run the task's verify commands, then `scripts/loop/verify.sh` once scaffold
   exists.
7. Run the Bonfire verifier agent.
8. Run the security auditor when the slice touches data, authz, audit, FHIR,
   MCP, logging, or hosted playground code.
9. Open a draft PR.
10. Iterate on CI, verifier findings, security findings, and Greptile until
   Greptile reports `5/5`.
11. Mark the task `passed` only after human review confirms the PR is merged or
    intentionally accepted.

### 3. Scheduled Triage

Allowed only for discovery. A scheduled loop may update the inbox but may not
implement without an explicit human-triggered slice contract.

## Slice Order

The canonical slice order lives in `docs/loop/tasks.json`. For a human-readable
view, read `docs/loop/TASKS.md` or run:

```bash
scripts/loop/task.mjs list
```

Do not skip ahead unless the skipped task is explicitly marked `blocked` in
`task-status.json` with a note explaining why.

## Session Start Checklist

Every maker/checker session starts with:

```bash
pwd
git log --oneline -5
scripts/loop/task.mjs validate
scripts/loop/task.mjs list
scripts/loop/task.mjs next
```

Then read only the relevant task contract and impacted files. Keep context
small; avoid loading the entire repo into the model.

## Stop Conditions

Stop and report instead of continuing when:

- The same verifier finding fails twice.
- `MAX ATTEMPTS`, `MAX TURNS`, or `MAX BUDGET USD` is reached.
- The task needs a product decision not covered by the slice contract.
- A security auditor returns `BLOCKING`.
- Greptile cannot be read from GitHub after the PR is ready for review.
- A task requires files outside its `allowedPaths`; stop and update the task
  contract in a separate harness PR.

## Merge Contract

Merge is allowed only after:

- CI green.
- `scripts/loop/verify.sh` green.
- Bonfire verifier: `PASS`.
- Security auditor: `CLEAR` when applicable.
- Greptile: `5/5`.
- Human final review complete.
