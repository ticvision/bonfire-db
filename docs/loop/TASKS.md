# Bonfire Task Breakdown

The machine-readable task registry is `docs/loop/tasks.json`. This file is the
human-readable map.

| ID | Profile | Task | Primary Gate |
|----|---------|------|--------------|
| BF-01 | foundation | Workspace and Docker boot scaffold | Bun install, typecheck, compose health |
| BF-02 | data | Schema, migrations, seed, synthetic tripwire | migration, idempotent seed, PHI scan |
| BF-03 | security | ABAC gate and hash-chained audit | allow/deny, append-only, tamper tests |
| BF-04 | contract | SDK and HTTP contract | Zod/Fastify schema parity |
| BF-05 | retrieval | Cited semantic search | golden queries, citations, offline smoke |
| BF-06 | UI | Demo UI search beat | Playwright search flow and screenshots |
| BF-07 | UI/security | Denial and audit UI beat | Playwright denial flow and log scan |
| BF-08 | agent-safety | Propose-only note flow | agent cannot approve; Clinician can |
| BF-09 | FHIR | FHIR export/import round-trip | document Bundle and reference integrity |
| BF-10 | MCP | Local MCP tools | allowlist and tool-poisoning tests |
| BF-11 | docs-release | Docs, GIF, hosted read-only playground | quickstart replay and claim audit |

## How Agents Pick Work

1. Run `scripts/loop/task.mjs next`.
2. Run `scripts/loop/task.mjs contract BF-XX`.
3. Create a worktree with the task id as slug.
4. Implement only that contract.
5. Verify with the task's profile-specific gates.
6. Update `task-status.json` only after verifier evidence exists.

## Task Profiles

### foundation

Optimizes for reproducibility. No product feature is accepted unless a clean
clone can install, typecheck, and boot the base stack.

### data

Optimizes for deterministic local state. Migrations and seed must be repeatable
from an empty DB and an existing volume.

### security

Optimizes for negative tests. Every allow path needs a deny path, and audit
immutability must be tested at the database level.

### contract

Optimizes for stable developer surface. Zod schemas drive SDK, HTTP, and later
MCP. Invalid inputs must produce typed errors.

### retrieval

Optimizes for falsifiability. Search must have golden queries, citation
integrity, no silent fallback, and an exact baseline for the demo corpus.

### ui

Optimizes for user-visible truth. Browser tests must run the flow as a user and
screenshots must prove the interface is readable.

### fhir

Optimizes for honest interoperability. v0 checks document Bundle invariants and
reference integrity; it does not claim to be a full FHIR server.

### mcp

Optimizes for tool safety. Tools are fixed, local, typed, and snapshot-tested.
No raw SQL, shell, file, or direct write tool is allowed.

### docs-release

Optimizes for OSS trust. Quickstart must work, claims must be honest, and the
repo must explain how contributors can help without real PHI.
