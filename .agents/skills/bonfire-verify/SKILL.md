---
name: bonfire-verify
description: Verify a Bonfire slice or PR before it can move toward merge. Produces PASS, FAIL, or NEEDS-HUMAN and checks CI, local gates, security posture, and Greptile readiness.
---

# Bonfire Verify

Use this skill as the checker stage of the loop.

1. Read `AGENTS.md`, `docs/loop/ACCEPTANCE.md`, `docs/loop/tasks.json`,
   `docs/loop/task-status.json`, and the slice contract.
2. Inspect the diff against the base branch.
3. Confirm the task profile and required agents.
4. Run or request the task-specific verify commands plus `scripts/loop/verify.sh`.
5. Check whether the security auditor is required. If yes, run it before
   returning PASS.
6. For PRs, check Greptile status. Merge is blocked unless Greptile reports
   `5/5`.
7. Update `task-status.json` only if evidence supports the new state.

Output:

```text
VERDICT: PASS | FAIL | NEEDS-HUMAN
BLOCKING:
NON-BLOCKING:
GATES:
  CI:
  verify.sh:
  security:
  Greptile:
ACCEPTANCE TRACE:
```
