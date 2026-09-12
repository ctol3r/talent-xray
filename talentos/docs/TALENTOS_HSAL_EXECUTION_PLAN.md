# TalentOS × HSAL — Execution Plan (Search Strategy / Pipeline Diagnosis)

Date: 2026-09-06
Scope: first domain integration between TalentOS and HSAL (Human State Access Layer).
Use case: _Why is search SP104 underperforming, what competing explanations exist, and what is the
best next experiment to reduce uncertainty?_

---

## 0. Existing Architecture Assessment

### Repository topology (actual)

Two separate repositories, both local:

| System   | Path                                                   | Branch                                                               | State                                                                  |
| -------- | ------------------------------------------------------ | -------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| HSAL     | `/Users/christoler/hsal`                               | `main` (`778da35` HSAL v0.1)                                         | pnpm workspace; gateway on 127.0.0.1:4271; SQLite at `~/.hsal/hsal.db` |
| TalentOS | `/Users/christoler/talentos-connected-review/talentos` | `codex/talentos-connected-review` (worktree of `ctol3r/talent-xray`) | Next.js 16 app, own pnpm root, clean tree                              |

`talentos/` is an incubation directory inside the Talent X-Ray repo (D-012) and is its own pnpm
root by design. Per brief §4 (separate repositories), the integration package is created **inside
TalentOS** at `talentos/packages/hsal-adapter`, and `talentos/pnpm-workspace.yaml` gains its first
`packages:` glob. Nothing is added to the Talent X-Ray repo root.

### What exists in TalentOS (reusable)

- **Search project aggregate**: `search_projects` (id, companyName, roleTitle, status open|on_hold|closed, geography, seniority, compensationNote…), `hiring_managers`, `success_profiles` (JSON `SuccessProfilePayload` of traced items: mustHave / preferred / trainable …), `candidates` (with `hmFeedback: HmFeedbackEntry[]` — `{at, decision: advance|hold|pass, evidenceNote}`), `pipeline_stages` + append-only `pipeline_events`, `search_learnings` (kind/text/sampleSize/provenance).
- **Domain functions**: `src/lib/domain/analytics.ts` (`computeFunnel`, D-022: metrics from events, minimum samples), `src/lib/domain/diagnosis.ts` (`diagnosePipeline`: five symptom rules with sample gates → `possibleCauses` + `experiments` as prose), `src/lib/domain/pipeline.ts` (`DEFAULT_PIPELINE_STAGES`).
- **Conventions**: Zod 4 everywhere; server actions as the mutation boundary (D-005) wrapping `act()` → `ActionResult`; services own the Zod input schemas; `getDb()` in `src/lib/db/client.ts` (Drizzle + better-sqlite3, refuses pending migrations on an existing DB unless `TALENTOS_ALLOW_MIGRATIONS=1`); flat `MODULES` nav list in `src/components/workspace-nav.tsx`; UI primitives in `src/components/ui.tsx` (`PageHeader`, `Card`, `EmptyState`, `Tag`, `KeyValue`); unit tests in `tests/unit/**` (vitest 4, alias `@`), `verify` = format:check → typecheck → lint → build:artifact:check → test → build → check:private-build.
- **Guardrails**: fair-hiring grep over `src/` (no protected-characteristic field names); `no-explicit-any: error`; artifact build check (unaffected unless `artifact-src/` imports change).

### What exists in HSAL (reusable)

- Canonical ontology in `@hsal/protocol`: Actor, Belief (human-owned confidence), Evidence, BeliefEvidenceRelation, ModelAssessment, Capability, HSALEvent.
- Gateway routes for beliefs/evidence/relations/assessments/events with capability-token scopes; deterministic relation proposer; append-only event log; `@hsal/sdk` (`HSALClient`) used by Chrome and MCP.
- Invariant enforced in core: only the belief holder may change confidence.

### Conflicts / gaps

1. **HSAL lacks the decision-loop objects** the use case needs: DecisionCase, State (with dimensions + uncertainty), explanatory Model, Intervention, Trajectory, BeliefRevision. These are **domain-general** and are added to HSAL (`@hsal/protocol`, `@hsal/db`, `@hsal/core`, gateway, SDK). Nothing recruiting-specific enters HSAL: domain vocabulary travels as opaque tags (`kind`, `actionType`, `sourceKind`, `scopeRef`, `sourceRef`) and JSON `parameters`.
2. **Evidence `sourceType`**: brief §13 lists `talentos_*` values. HSAL keeps its generic `sourceType` enum and adds `sourceKind?: string` (domain tag) + `sourceRef?: string` + `observedAt?`. The adapter's `HSALEvidence` view exposes `sourceType: talentos_*` by reading `sourceKind`. (Decision T-2.)
3. **Cross-repo dependency**: TalentOS must use `@hsal/sdk`. HSAL packages are source-first (`main: src/index.ts`). Resolution: `@hsal/protocol` and `@hsal/sdk` gain built `dist/` (JS + d.ts) and `exports` with a `source` condition for HSAL-internal use (tsx/vitest/vite pass `--conditions source`; verified) and `default` → `dist` for external consumers. TalentOS depends on `"@hsal/sdk": "link:../../../hsal/packages/sdk"` and lists `@hsal/sdk`, `@hsal/protocol` in `serverExternalPackages` so Next loads the built ESM at runtime instead of bundling out-of-root sources. (Decision T-3.)
4. **Actor identity over HTTP**: HSAL tokens bind one actor. TalentOS acts for a human recruiter. Resolution: the `talentos` client preset is bound to actor `agent:talentos` and receives `belief:create` + `belief:revise` + `actor:ensure` scopes; belief-holder / revision actor ids are carried in the request, validated by core (must be an existing _human_ actor and the holder), and the event records `via: agent:talentos`. AI presets never receive `belief:revise`. (Decision T-4.)
5. **Existing `diagnosePipeline` / `search_learnings`**: complementary, not conflicting. `diagnosePipeline` is prose symptoms over event-derived counts; the new diagnosis produces structured competing models with evidence links stored in HSAL. `search_learnings` (kind/text) stays; a new `hsal_search_learnings` table holds the structured, HSAL-referencing `SearchLearning`. (Decision T-5.)
6. **Pipeline snapshots**: TalentOS has no snapshot type (metrics derive from events, D-022). The brief makes `PipelineSnapshot` a TalentOS-owned fact with `source: seed|ats|manual|import`; a `pipeline_snapshots` table is added. Event-derived funnels can be turned into snapshots later (`source: ats`). (Decision T-6.)
7. **Success profile shape**: TalentOS's `SuccessProfilePayload` (traced items) ≠ brief's `SuccessProfile` (criteria with ids/categories). The adapter's `DomainSource` maps traced items → criteria (`CRIT-<slug>`, category inferred). For SP104 a fixture `DomainSource` supplies the brief's exact criteria ids so evidence `criterionId`s are deterministic. (Decision T-7.)

### Missing dependencies

None to install beyond the `link:` to `@hsal/sdk`. No LLM provider is required; Path B (AI enhancement) is an optional interface with no default implementation.

---

## 1. Target architecture

```
TalentOS (Next.js app)                          packages/hsal-adapter (pure TS, no Next, no DB)
 ├ src/app/searches/[id]/diagnosis/page.tsx  ─▶  TalentOSHSALAdapter
 ├ src/lib/actions/hsal.ts (server actions)       ├ DomainSource (SearchProject, PipelineSnapshot)
 ├ src/lib/hsal/ (client env, drizzle stores,     ├ BindingStore / LearningStore interfaces
 │   DB DomainSource + SP104 fixture overlay)      ├ metrics · mapping · diagnosis rules · test ranking
 └ src/lib/db/schema.ts (+3 tables)                └ HSALClient (@hsal/sdk) ──HTTP──▶ HSAL Gateway
                                                                                       │
fixtures/sp104/  scripts/demo-sp104.mts  tests/unit/hsal-adapter/*  tests/integration/*   ▼
                                                                          HSAL core + SQLite (~/.hsal)
```

Dependency direction: TalentOS → `@hsal/sdk` → gateway → HSAL state. HSAL imports nothing from TalentOS.

---

## 2. Phases

Each phase lists **files · dependencies · behavior · tests · completion criteria · risks**.

### Phase H (prerequisite) — HSAL domain-general extensions (in `/Users/christoler/hsal`)

- Files: `packages/protocol/src/{ontology,api}.ts` (DecisionCase, State, ExplanatoryModel, Intervention, Trajectory, BeliefRevision, new scopes/events, DTOs), `packages/db/src/schema.ts` + migration `0001_decision_loop`, `packages/core/src/{cases,states,models,interventions,trajectories,beliefs}.ts`, `packages/auth/src/scopes.ts` (`talentos` preset), `apps/gateway/src/routes/{cases,states,models,interventions,trajectories,beliefs,evidence,events}.ts`, `packages/sdk/src/client.ts`, `packages/{protocol,sdk}/tsconfig.build.json` + `dist` build, `exports` conditions, tests.
- Dependencies: HSAL v0.1.
- Behavior: `POST /v1/decision-cases`, `GET /v1/decision-cases/:id`, `GET /v1/decision-cases/:id/context`, `POST /v1/states`, `GET /v1/states/:id`, `POST /v1/beliefs`, `POST /v1/beliefs/:id/revisions` (stale-write check), `GET /v1/beliefs/:id/revisions`, `POST /v1/evidence` (generic create with `sourceKind/sourceRef/observedAt/decisionCaseId`, client ids), `POST /v1/models` (upsert by id, never deletes), `GET /v1/decision-cases/:id/models`, `POST /v1/interventions` (upsert), `POST /v1/interventions/:id/select`, `POST /v1/trajectories`, `GET /v1/trajectories/:id`, `POST /v1/actors` (ensure), `POST /v1/events` (append domain event). Existing v0.1 behavior unchanged.
- Tests: core unit tests for each object + revision concurrency + holder check; gateway route tests; v0.1 suites still green.
- Done when: `pnpm verify` green in HSAL; `dist/` for protocol + sdk builds; `pnpm hsal auth issue talentos` works.
- Risks: `exports` conditions breaking HSAL-internal resolution → mitigated by `--conditions source` everywhere and tests.

### Phase 1 — Shared TypeScript contracts (adapter)

- Files: `packages/hsal-adapter/package.json`, `src/types.ts` (Zod: SearchProject, SuccessProfile, SuccessCriterion, CompensationRange, GeographyConstraint, PipelineStage, PipelineSnapshot, PipelineMetrics, SearchHSALBinding, RecruiterBeliefInput, CandidateSearchEvidence, CandidateObservation, HiringManagerFeedback, HMFeedbackReason, HSALEvidence (adapter view), SearchDiagnosisModel, DiagnosisAssumption/Prediction, ModelAssessmentSummary, BestNextTest, BeliefRevisionInput, SearchLearning, SearchLearningApplicability, SearchDiagnosisResult, ExperimentResult), `src/index.ts`; `pnpm-workspace.yaml` `packages:` glob; talentos `package.json` deps.
- Dependencies: Phase H (for `@hsal/sdk` types).
- Behavior: contracts only; HSAL types re-exported from `@hsal/protocol`, never redefined.
- Tests: `tests/unit/hsal-adapter/types.test.ts` (validation of SP104 fixture files against schemas).
- Done when: `pnpm typecheck && pnpm lint` pass with the package present.
- Risks: eslint/tsconfig picking up the package (intended).

### Phase 2 — SearchProject ↔ DecisionCase binding

- Files: `src/mapping/decision-case.ts`, `src/stores.ts` (BindingStore interface + InMemoryBindingStore), `src/adapter.ts` (`initializeSearchCase`).
- Behavior: deterministic `DC-<projectId>`, title/question/objective/scopeRef per brief §8; idempotent (existing binding returned); events `talentos.search_case.bound`.
- Tests: mapping unit test; idempotency.
- Done when: SP104 → `DC-SP104` in HSAL.

### Phase 3 — Pipeline State ingestion

- Files: `src/metrics.ts` (`computePipelineMetrics`, `largestDrop`), `src/mapping/state.ts` (`toHSALState`), `adapter.syncPipelineState`.
- Behavior: counts → dimensions `epistemicStatus: observed`; derived rates → `inferred`; uncertainty from sample sizes; `sourceRefs: [talentos:pipeline-snapshot:<id>]`; state id `S-<snapshotId>` (idempotent upsert); event `pipeline.state.ingested`.
- Tests: metrics (14.4 % / 7.6 % / 66.7 % / 25 %), mapping epistemic statuses.
- Done when: baseline state exists in HSAL as `actual`.

### Phase 4 — Recruiter belief capture

- Files: `adapter.captureRecruiterBelief`.
- Behavior: validates confidence ∈ [0,1]; ensures human actor; creates belief bound to the decision case with client id (`B-SP104-SUPPLY` for the fixture) — idempotent (existing belief returned unchanged); event `belief.created`.
- Tests: creation; re-run keeps 0.76.

### Phase 5 — Candidate / HM evidence ingestion

- Files: `src/mapping/evidence.ts`, `adapter.ingestCandidateEvidence`, `adapter.ingestHMFeedback`.
- Behavior: one HSAL Evidence per observation / per HM feedback (+ one per structured reason); `sourceKind: talentos_candidate | talentos_hm_feedback`; `epistemicStatus: observed` ("HM said X"); deterministic ids (`E-SP104-C31-1`); dedup by content hash; events `candidate.evidence.ingested`, `hm_feedback.evidence.ingested`.
- Tests: mapping counts, statuses, criterion ids preserved.

### Phase 6 — Diagnosis rules and models

- Files: `src/diagnosis/rules.ts` (`generateDeterministicModels`), `src/diagnosis/ai.ts` (`DiagnosisReasoningProvider` interface, `mergeAIModels` that may add/annotate but never remove deterministic models), `adapter.diagnoseSearch` (part 1).
- Behavior: five models `M-<project>-{SUPPLY,OUTREACH,PROFILE,COMP,PROCESS}` with assumptions, predictions, evidenceFor/Against, support low|medium|high from rules over metrics + evidence tags; stored in HSAL via `POST /v1/models` (upsert); event `diagnosis.models.generated`. Belief untouched.
- Tests: SP104 → PROFILE high, SUPPLY medium, PROCESS medium, OUTREACH low/medium, COMP low/medium; belief still 0.76.

### Phase 7 — Best Next Test ranking

- Files: `src/diagnosis/tests.ts` (candidate experiments per model pair, `TEST_SCORE_WEIGHTS` config, `scoreTest`, `rankTests`), `adapter.diagnoseSearch` (part 2).
- Behavior: experiments stored as HSAL Interventions (`actionType: calibration_test | outreach_test | …`, `experiment` block) with `status: proposed`; top-ranked returned as `recommendedNextTest`; event `intervention.proposed`.
- Tests: scoring formula; SP104 → `TEST-SP104-BLIND`.

### Phase 8 — Intervention selection

- Files: `adapter.selectIntervention`.
- Behavior: `POST /v1/interventions/:id/select` with human actor → `status: selected`; event `intervention.selected`; nothing executed.
- Tests: status transition; second select → conflict.

### Phase 9 — Post-intervention State + Trajectory

- Files: `adapter.recordPostInterventionState`, `adapter.ingestExperimentResult` (experiment evidence).
- Behavior: new state `S-PIPE-SP104-W9` (`actual`), trajectory `TR-<intervention>` with origin state, intervention, states, outcomes (before/after per dimension); events `experiment.result.ingested`, `trajectory.created`.
- Tests: trajectory exists, outcomes computed.

### Phase 10 — Belief revision

- Files: `adapter.reviseBelief`.
- Behavior: `POST /v1/beliefs/:id/revisions` with `previousConfidence` guard (409 on stale); new belief `B-SP104-PROFILE` at 0.82 created by human; events `belief.confidence_changed` (carries revisionId) — documented as the HSAL name for `belief.revised`.
- Tests: 0.76 → 0.31 only after explicit human call; stale previousConfidence rejected.

### Phase 11 — Search Learning persistence

- Files: `src/stores.ts` (LearningStore + InMemory), `adapter.createSearchLearning`, `adapter.findRelevantSearchLearnings` (deterministic filter on applicability overlap); app: `hsal_search_learnings` table + Drizzle store.
- Behavior: persists domain-facing learning with HSAL ids only; event `search_learning.created` in HSAL log.
- Tests: persistence; retrieval by roleFamily/seniority.

### Phase 12 — SP104 fixtures

- Files: `fixtures/sp104/{search-project,pipeline-w6,pipeline-w9,belief,candidates,hm-feedback,experiment-result,revision,learning}.json`, `fixtures/sp104/index.ts` (typed loader + `Sp104FixtureSource: DomainSource`).
- Tests: schema validation of every fixture.

### Phase 13 — UI

- Files: `src/app/searches/[id]/diagnosis/page.tsx`, `src/components/diagnosis-panel.tsx` (client: RUN DIAGNOSIS, SELECT TEST, RECORD RESULT, REVISE BELIEF, SAVE LEARNING), `src/lib/actions/hsal.ts`, `src/lib/hsal/{client,stores,domain-source,adapter,seed-sp104}.ts`, `src/lib/db/schema.ts` (+`hsal_bindings`, `pipeline_snapshots`, `hsal_search_learnings`), migration `0008_hsal`, `src/components/workspace-nav.tsx` (+Diagnosis), `package.json` scripts (`seed:sp104`, `demo:sp104`, `test:integration`).
- Behavior: recruiter-facing headings (WHAT'S HAPPENING? / WHAT DO YOU THINK? / WHAT ELSE COULD EXPLAIN IT? / WHAT EVIDENCE SUPPORTS EACH VIEW? / WHAT SHOULD WE TEST NEXT? / WHAT DID WE LEARN?); shows offline state when HSAL is unreachable/unpaired.
- Tests: typecheck/lint; manual browser verification of the SP104 page.

### Phase 14 — Tests and end-to-end demo

- Files: `tests/unit/hsal-adapter/*.test.ts` (12 units from brief §43), `tests/integration/hsal-sp104.test.ts` (Tests A–J against a real HSAL gateway spawned from the sibling repo with a temp DB), `vitest.integration.config.mts`, `scripts/demo-sp104.mts`, `docs/HSAL_INTEGRATION.md` (+ §47 comparison).
- Done when: `pnpm test`, `pnpm test:integration`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check` green; `pnpm demo:sp104` prints the §46 output.

---

## 3. Decisions (T-series)

| #   | Decision                                                                                                                                                                                                                                                             |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-1 | Adapter lives at `talentos/packages/hsal-adapter`; first `packages:` glob in `talentos/pnpm-workspace.yaml`.                                                                                                                                                         |
| T-2 | HSAL Evidence keeps a generic `sourceType`; domain tags travel in `sourceKind`/`sourceRef`.                                                                                                                                                                          |
| T-3 | `@hsal/protocol` + `@hsal/sdk` ship `dist/`; `exports` `source` condition for HSAL-internal, `default` for external; TalentOS links the SDK and externalizes it in Next.                                                                                             |
| T-4 | `talentos` capability preset is actor `agent:talentos` with `belief:create`, `belief:revise`, `actor:ensure`, `case:read`, `case:write`, `evidence:*`, `events:*`; human actor ids ride in requests and are validated by core. AI presets never get `belief:revise`. |
| T-5 | Existing `diagnosePipeline` and `search_learnings` remain; new structured objects are additive.                                                                                                                                                                      |
| T-6 | `pipeline_snapshots` table added to TalentOS (brief §6).                                                                                                                                                                                                             |
| T-7 | `DomainSource` abstraction: DB-backed for real projects, fixture-backed for SP104 (deterministic criterion ids).                                                                                                                                                     |
| T-8 | Model ids and intervention ids are client-supplied and upserted; HSAL never deletes a model. AI providers can only add or annotate.                                                                                                                                  |
| T-9 | HSAL event name for a confidence change stays `belief.confidence_changed` (carries `revisionId`); adapter-level domain events (`talentos.*`, `pipeline.*`, `diagnosis.*`, …) are appended to the HSAL log under `agent:talentos`.                                    |
