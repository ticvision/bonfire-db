# Bonfire DB — MVP Build Spec (v2)

Status: PRIMARY product source of truth for the loop harness.
Supersedes the prior local demo plan (recoverable in git history).
Derived from the live Co-founder Plan at https://plans.bonfiredb.dev/ (captured
locally as `docs/plans/cofounder-plan.html`), "research-backed rewrite",
dated 2026-06-25. Where this file and the live page disagree, the live page wins.

Purpose: an engineering build spec the autonomous loop executes to ship the
14-day OSS MVP — a clean clone that boots, a five-beat wow under 5 minutes with
zero API keys, an open published benchmark number, and a reference AI-scribe app.

## Thesis (one design decision)

Agents are bad at clinical data (cap ~42–50% accuracy on raw FHIR) and clinical
agent loops are expensive (a full FHIR record runs to millions of tokens). Bonfire
fixes both with ONE decision: **the agent never reads raw FHIR; it reads a Cited
Context Projection (CCP) we build from canonical FHIR underneath.** Cheaper and
more accurate are the same move. We prove it with an open benchmark (BTAB).

Positioning: the open-source, agent-native backend for AI-health apps. Start with
AI scribes; become the default backend. Apache-2.0, run real PHI on your own infra.

## The three primitives (built-in from row zero, never an afterthought)

### Security as a primitive
- **RLS fail-closed on every row, from row zero** — `practice_id` + Row-Level
  Security across SQL, vector, and agent paths. Retrofitting security is how you
  leak; a cross-tenant leak is one dead company.
- **ABAC policy receipt on every read** — scope-before-retrieve; deny is
  default; every allow/deny carries a structured receipt.
- **Tamper-evident audit** — append-only, `prev_hash` + `row_hash` hash chain;
  tamper is detectable; audit survives to the citation (CCP spans carry the hash).
- **Propose-only governance** — the agent proposes; it cannot approve or commit;
  approval is a human action and is audited.
- **HIPAA 45 CFR 164.312 mapping in code** — RLS→access control, hash-chained
  log→audit+integrity, identity→authn, TLS→transmission; Jan-2025 NPRM floor
  (AES-256, TLS 1.3, MFA-ready, immutable audit). Not "compliant out of the box";
  it removes the grunt work.
- **Synthetic-only in v0** — no real PHI in the repo; nothing PHI-bearing through
  a cloud sandbox; semantic synthetic-only scanner as a tripwire.

### Performance as a primitive
- **Read off indexed typed projections (`vd_*`), never JSONB scans** — the
  Medplum/HAPI model; Aidbox-style JSONB-direct search does not scale. Target
  <5ms typed reads.
- **One write path** — typed primitive → canonical FHIR R4 (JSONB) → typed
  projection upsert, all in one atomic transaction. Never a dual write.
- **Outbox for async work** — embeddings + reindex run off an outbox, off the
  write hot path. The read side is droppable and rebuildable from canonical FHIR.
- **Token-lean CCP** — ~10–100x fewer tokens vs raw FHIR, dominated by the
  "return only the slice" architecture lever (serialization is a ~1.4–2.5x
  residual; caching cuts cost not token count and is reported separately).

### AI-nativeness as a primitive
- **Cited Context Projection (CCP)** — compact serialization + span citations
  (resource id + JSONB path + audit hash) + U-shape ordering. The agent's default
  read surface; raw FHIR is an explicit, rarely-needed escape hatch.
- **Typed MCP tools** — narrow typed allowlist; no raw SQL / FHIRPath / shell /
  filesystem; prompt-injection sanitization; propose-only.
- **Auto-generated typed TS SDK** (type-schema IR) + reactive `useClinicalQuery`
  (LISTEN/NOTIFY).
- **BTAB as the proof** — the benchmark is the marketing artifact; honesty is the
  moat.

## Architecture in one picture

```
            WRITE (one atomic tx)                         READ (agent / app / SDK)
  typed primitive --map--> FHIR R4 -----+              +--> typed projections (vd_*)  <5ms
                                        |              |
   INSERT fhir_resources (JSONB canon) -+--> COMMIT ---+--> Cited Context Projection (compact, span-cited)
   INSERT history + write_inputs        |              |
   UPSERT typed projection (same tx)    |              +--> FHIR search (spidx) / 1-call FHIR export
   INSERT outbox --(async)--> embeddings, reindex      |
                                                       +--> typed MCP tools (propose-only, governed)

  every row: practice_id + RLS fail-closed   |   every read: ABAC policy receipt + hash-chained audit
```

- FHIR R4 is the source of truth; the typed primitive is just the write API.
- Keep the raw typed payload (`write_inputs`) so FHIR can be re-derived when the
  mapping improves.

## Core build modules

1. **Typed write primitives → lossless FHIR R4 / US Core 6.1.0** for the ~8 scribe
   resources; `write_inputs` replay; golden round-trip fixtures validated against
   the HL7 validator; **loss-ledger** (a field may be dropped only via an ADR +
   human sign-off).
2. **SQL-on-FHIR v2 ViewDefinition runner** (TS + Postgres + pgvector, fhirpath.js)
   → `vd_*` projection tables; search-param index (`spidx`); passes the HL7
   sql-on-fhir conformance suite. (Does not exist yet; the standards-credible
   contributor magnet.)
3. **Cited search** — lexical `tsvector` first (hybrid vector + rerank is
   post-launch); scope-before-retrieve; results carry citations, freshness,
   `excludedByPolicy`, policy receipt, and audit id.
4. **Cited Context Projection** — compact serialization + span citations + U-shape
   ordering.
5. **Typed TS SDK** (type-schema IR) + reactive `useClinicalQuery` (LISTEN/NOTIFY).
6. **Local MCP server** — typed tool allowlist, propose-only, injection-sanitized.
7. **Governance** — propose → approve → commit; agent cannot approve (audited);
   committed/signed-note schema.
8. **FHIR import path** — bring-your-own-bundle, so existing-FHIR teams get value.
9. **BTAB benchmark** — 3 arms (raw FHIR / compact JSON / Bonfire CCP), named
   tokenizer per model; metrics: median tokens/query, task accuracy on a fixed
   golden-query suite, citation precision/recall, primary = accuracy per 1K
   tokens; SHA-256 pre-registered held-out splits; token delta runs offline with
   zero keys; synthetic corpus only in v0; publish `RESULTS.md`.
10. **Reference app** — flagship OSS AI-scribe built entirely on Bonfire (the
    onboarding funnel) + LLM-consumable docs + `npx bonfire init`.

## Data model (key invariants)

- `fhir_resources` (canonical JSONB) + `history` + `write_inputs`.
- `vd_*` typed projection tables (rebuildable from canonical FHIR) + `spidx`.
- `audit` append-only with `prev_hash` + `row_hash` (tamper-evident).
- `practice_id` + RLS fail-closed on every row (clinical, vector, audit).
- Seed is idempotent and synthetic-only; records a completion marker.

## Public surface

- Typed write primitives (the write API), CCP read, cited search, 1-call FHIR
  export, FHIR import. Typed TS SDK mirrors the HTTP surface. MCP exposes a narrow
  propose-only typed tool allowlist (no raw SQL/FHIRPath/shell/file, no
  approve/commit tool).

## Scope

IN (14-day MVP): the deterministic cited-search wow, lossless FHIR mapping for ~8
scribe resources, SQL-on-FHIR runner, CCP, typed SDK + MCP, propose-only
governance, FHIR import, the BTAB number, the reference app, the compliance pack.

NOT in scope (post-launch): hybrid vector search + rerankers + clinical
embeddings, MIMIC benchmark, Cedar policy engine, FHIR R6, bulk `$export`,
terminology server, offline sync, remote hosted MCP, the BYOC managed control
plane.

## Done when

- Clean clone boots with `docker compose up`, zero API keys.
- Five-beat wow works in the browser in under 5 minutes.
- BTAB number is published and reproducible (baseline + named tokenizer stated).
- Reference AI-scribe app runs entirely on Bonfire.
- RLS proofs + policy analysis + audit-chain verification + 164.312 map shipped.
- At least one design-partner acceptance test is defined and passes.

## Loop slice order (the harness slice registry derives from this)

```
BF-01  Workspace + Docker + Postgres18/pgvector boot + health; RLS scaffolding from row zero.
BF-02  fhir_resources (JSONB canon) + history + write_inputs + migrations + synthetic-only scanner + RLS fail-closed.
BF-03  Typed write primitive -> lossless FHIR R4 (US Core, ~8 resources) + loss-ledger + golden round-trip vs HL7 validator.
BF-04  SQL-on-FHIR v2 ViewDefinition runner -> vd_* + spidx + HL7 conformance suite.
BF-05  ABAC policy receipt + hash-chained tamper-evident audit + tamper detection.
BF-06  Cited search (tsvector), scope-before-retrieve, citations/freshness/receipt/audit-id.
BF-07  Cited Context Projection (compact, span-cited) + token measurement hooks.
BF-08  Auto-generated typed TS SDK + reactive useClinicalQuery + local MCP typed tools (propose-only).
BF-09  Propose -> approve -> commit governance (agent cannot approve; audited).
BF-10  1-call FHIR export + FHIR import path (bring-your-own-bundle).
BF-11  BTAB benchmark (3 arms, named tokenizer) + publish RESULTS.md.
BF-12  Reference AI-scribe app + LLM-consumable docs + compliance evidence pack + launch assets.
```

## Dangerous failure modes (must be eval-gated by the harness)

- Retrieval returned before the ABAC/RLS filter (scope-after-retrieve leak).
- Cross-`practice_id` / cross-tenant leak on any path (SQL, vector, agent).
- Lossy FHIR mapping passing as "lossless" (round-trip drift without a loss-ledger entry).
- Fake "FHIR-valid" / "conformant" confidence (claim without the HL7 validator/suite).
- Audit append-only bypass or hash-chain tamper going undetected.
- Agent able to approve/commit (propose-only invariant broken).
