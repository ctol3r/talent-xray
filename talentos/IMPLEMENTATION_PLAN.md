# TalentOS — Implementation Plan

Status legend: `[x]` done · `[~]` in progress · `[ ]` open. A step is done
when its code exists **and** its tests pass — compiling is not done.

## Wave 1 — Foundation

- [x] Scaffold `talentos/` as an isolated app (own lockfile/toolchain);
      exclude from root Talent X-Ray pipeline
- [x] Architecture / product spec / data model / plan / decision log docs
- [x] Drizzle schema for all entities (DATA_MODEL.md), generated migration,
      startup migrator
- [x] Seed: default pipeline stages, owner user, golden fixtures A–F
      (projects + JDs; fixture A additionally carries a worked example)
- [x] Guardrail tests: fair-hiring grep, naming grep, strict mode

## Wave 2 — Deterministic domain core

- [x] Search-string composer (boolean/x-ray; LinkedIn, Google, GitHub,
      Scholar, generic site: targets; narrow/balanced/broad/adjacent) + tests
- [x] Pipeline stage defaults, transition recording + tests
- [x] Funnel analytics (counts, conversions, time-in-stage) + tests
- [x] Next-best-action rules + tests
- [x] Pipeline diagnosis rules + tests

## Wave 3 — AI layer

- [x] ModelProvider interface; Anthropic impl (structured outputs via
      zodOutputFormat + messages.parse, streaming, refusal handling);
      mock impl (deterministic, watermarked)
- [x] `runAiTask` pipeline: context assembly → generate → validate →
      fair-hiring scan → persist draft + ai_generations audit row
- [x] Task modules with zod schemas + prompts: role intelligence, intake,
      success profile, market intelligence, sourcing strategy, channels,
      string expansion, evidence alignment, outreach, recruiter screen,
      interview plan, close plan, onboarding plan, learnings synthesis
- [x] ResearchProvider interface + `none` impl (Phase 2 wires real providers)

## Wave 4 — Services & actions

- [x] Services: search projects, role intel, intake, profile, market,
      strategy, channels, strings, candidates, evidence, outreach, screen,
      interviews, scorecards, pipeline, close, onboarding, learnings, tasks
- [x] Server actions with zod-validated inputs for all of the above

## Wave 5 — UI

- [x] App shell, nav, dashboard (today / health / next best actions)
- [x] Searches list + create; search workspace layout with module nav
- [x] Module pages: overview, role, intake, profile, market, strategy,
      sources, strings, candidates (+ candidate detail with evidence),
      outreach, screen, interviews, pipeline (kanban), close, analytics,
      learnings
- [x] Provenance/certainty badges, editable AI artifacts, empty/loading/error
      states
- [x] ⌘K command bar

## Wave 6 — Acceptance

- [x] Playwright critical path (20 steps, mock provider)
- [x] Golden fixture structural differentiation test
- [x] `pnpm verify` green (format, typecheck, lint, unit, build) + e2e green
- [x] README with setup, backup, and philosophy

## Phase 2 (not this build — tracked, not started)

Automated web research providers (incl. Talent X-Ray engine connector),
candidate discovery connectors, Gmail draft/send with explicit user action,
calendar, resume file parsing (PDF/DOCX), CSV import, semantic search,
browser importer, contextual chat copilot with project context, live-model
golden differentiation harness (`pnpm golden`).

## Standing rules while implementing

- After every wave: run unit tests + typecheck, fix, update this file.
- No TODO placeholders in core paths; a module ships working or not at all.
- New feature ideas go to Phase 2 list, not into the current wave.

## W7 — Crew orchestration (CLOSED 2026-09-01)

Per-search agent crews: `crew_jobs` queue (migration 0001), dependency
graph, critic + one revision pass, Crew tab, candidate-agent kickoff,
`pnpm crew:work`. Acceptance: tests/unit/crew.test.ts (6 tests — full mock
crew run, dependency gating, revision path, persistence, candidate chain,
restart semantics); full verify green (57 unit tests, build).

## W8 — Discovery execution (CLOSED 2026-09-01)

Live people-only discovery: `google-cse` ResearchProvider backed by the
two Talent X-Ray engines (BYO key), Discover tab running composed strings
with per-result explicit save (URL or candidate). Result pages never
fetched; nothing persists without a save. Acceptance:
tests/unit/discovery.test.ts (6 tests); full verify green (63 unit tests,
build).

## W9 — Two-sided guidance (CLOSED 2026-09-01)

HM thread + candidate thread join the pipeline: HM brief artifact
(generated, editable, provenance-tracked), evidence-anchored HM feedback
capture (appended verbatim, never auto-moves stage), candidate-facing
packets (process guide / interview prep / offer explainer — drafts the
recruiter shares manually), and Next Best Action v2 tagging every action
with its thread plus four new guidance rules. Migration 0002 (hm_briefs,
candidate_packets, candidates.hm_feedback). Acceptance:
tests/unit/guidance.test.ts (4 tests) + W9 thread tests in
next-best-action.test.ts; full verify green (71 unit tests, build).

## W8.5 — Architectural correction: IR boundary (owner stop-order 2026-09-02)

Owner review halted W8 feature expansion at the current safe checkpoint;
W7 and the Talent X-Ray integration are kept. No W9 continuation or new
product surfaces until this correction's acceptance tests pass.

- [x] Docs first: ARCHITECTURE.md §§4–5, DATA_MODEL.md, PRODUCT_SPEC.md,
      DECISIONS.md D-010/D-011/D-012, docs/ADR-001-talentos-incubation.md
- [x] Provider split: `ResearchProvider` (general information environment,
      honest `none` default) vs `CandidateDiscoveryProvider` (people
      search); Talent X-Ray CSEs become `TalentXRayCandidateDiscoveryProvider`
      — never the general research path; vendor-neutral registries
- [x] Discovery evidence model: `candidate_source_evidence` (migration 0003) — snippet/title/query/provider/providerRank/verificationStatus/
      provenance; snippets never written to `candidates.resumeText`;
      best-effort backfill moves previously masqueraded snippets over
- [x] Synthetic relevance removed: `providerRank` (1-based position)
      preserved; `research_sources.relevance` dropped
- [x] Canonical IR (`src/lib/core/ir.ts` + `hiring_intelligence` table):
      ManagerStatement, HiringNeedIR, HiringIntentIR, RequirementIR,
      SuccessIR, EvidenceIR, TalentPopulationIR, SearchPlanIR,
      UncertaintyIR, ContradictionIR; rendered first in every agent context
      as the source of truth
- [x] Adaptive intake: IntakeReasoner loop (statement → claims →
      requirement updates → ambiguity/contradiction/consequential
      uncertainty → highest-information next question → verbatim capture →
      HiringIntentIR revision)
- [x] Crew: specialists consume the shared IR via context; critic tests
      unsupported inference, contradiction with source state, missing
      provenance, requirement-definition violations, uncertainty disguised
      as fact
- [x] Acceptance: `tests/unit/ir-pipeline.test.ts` — CAIS golden path
      JD → HiringNeedIR → HiringIntentIR → (research boundary) → adaptive
      intake → clarified RequirementIRs ("research taste" becomes an
      explicit, defined requirement) → SuccessIR → EvidenceIR →
      TalentPopulationIR → SearchPlanIR → composed discovery queries →
      TalentXRayCandidateDiscoveryProvider (stubbed fetch) → explicit save
      with unverified source evidence; plus updated
      tests/unit/discovery.test.ts

## W10 — Virtual crew in the Lite artifact (CLOSED 2026-09-01)

TalentOS Lite gains the crew treatment: "Run crew on this search"
generates every module in dependency order with a critic review per
artifact and one revision pass when the critic finds concrete defects
(critic verdicts + findings rendered on each module); per-candidate
"Run agents" chains evidence → outreach. Runs on the viewer's Claude
account; intake answers stay human. Republished to the same artifact URL;
script syntax + headless boot verified.

## W11 — Audience personas + research-gated outreach (D-013)

Owner request 2026-09-02. Acceptance: `tests/unit/research-personas.test.ts`
(session research file handoff round trip; research gate refuses personas
with no findings; mock research → personas cite only provided findings;
outreach auto-derives personas and cites the persona), existing outreach
paths (crew, smoke, e2e) green under the mock research provider, and a live
session run where a Claude session performs real web searches for the CAIS
audience and the outreach draft cites them.

- [x] Docs: D-013, ARCHITECTURE §§4–5, DATA_MODEL, PRODUCT_SPEC, .env
- [x] `ResearchProvider` implementations: `session` (file handoff) and
      `mock` (watermarked); `none` default; defaults follow the model provider
- [x] `AudiencePersonaIR` in `core/ir.ts`; `personas` on the canonical
      document; `derive_personas` task with a research-grounding rule
- [x] `services/research.ts`: deterministic audience queries from the IR,
      findings persisted to `research_sources` with query + provider
- [x] `derivePersonas` with the research gate; `generateOutreach` consumes
      the persona + findings and derives personas when missing
- [x] Outreach tab: personas card with research citations + "Research
      audience & build personas"; candidate outreach card shows the persona
- [x] Tests + full verify; live session demonstration recorded

## W12 — Hiring Intelligence Adversarial Evaluation

Owner request 2026-09-02: "We are testing the brain now." Evaluation,
reasoning and hardening only — no new product surface, no extraction.
Spec: `W12_EVAL_SPEC.md`. Acceptance: the corpus meets its coverage
contract (`tests/unit/w12-corpus.test.ts`), the deterministic checks are
regression-tested (`tests/unit/w12-checks.test.ts`), a baseline is recorded
BEFORE any fix, every fix is named by a failure-taxonomy entry, the same
subset is re-run after, and `eval/w12/REPORT.md` states coverage and the
extraction recommendation.

- [x] Spec + plan entry (docs first)
- [x] Corpus: ≥ 50 conversations, ≥ 10 occupations, all 20 categories,
      special fixtures A–J, stakeholder disagreement
- [x] Harness: schema, deterministic checks, judge task, resumable runner,
      report; `pnpm eval:w12`
- [x] Baseline run (stratified subset under the session provider), scores
      recorded before fixes
- [x] Failure taxonomy
- [x] Targeted fixes (prompt / service merge / smallest proven schema
      correction), each tied to a taxonomy entry
- [x] After-fix run on the same subset; regression tests pinned
- [x] Authority-semantics and requirement-facet verdicts, from evidence
- [x] Extraction-readiness recommendation
- [x] **Full-corpus run** — all 53 conversations, 251 hand-fulfilled
      generations, instrument corrections re-scored, taxonomy and
      extraction recommendation revised (`REPORT.md` §10–§14)
- [x] **S-1…S-5 fixed** (owner instruction) — five reasoner rules, three
      with deterministic backstops in `src/lib/domain/intake-hygiene.ts`;
      10 regression tests; `--project-hygiene` scores the code half against
      the stored corpus (`REPORT.md` §15)
- [x] **S-6…S-9 fixed, S-8 reclassified, S-10 found and fixed** (owner
      instruction) — see `REPORT.md` §16

Outcome (`eval/w12/REPORT.md`): all four hard targets met at baseline —
provenance 100 %, silent mutation 0, protected-trait violations 0,
fabrication 0. Four defects found (status conflation, missing authority
semantics, paraphrased false signals, compensation in personas); three
fixed by prompt rules and one by the smallest proven schema addition
(`assertedBy`, `contested`). AuthorityIR beyond those two fields, and every
proposed requirement facet, were tested and REJECTED as unearned by the
evidence.

Full corpus (`REPORT.md` §10–§14): 53/53 conversations, 13 occupations,
20/20 categories, 251 generations. Hard targets — silent mutation 0 ✓,
fabrication 0 ✓, provenance 99.4 % ✗ (8 failures), protected traits 1 ✗
(a conservative scanner firing on the age of a _field_, not a person; not
narrowed to make it pass). The ten-fixture subset overstated the system on
nine of fourteen reported metrics: `false_signal_recall` 54.8 %,
`proxy_identified` 68.2 %, `unknown_preserved` 71.4 %,
`contradiction_detection` 76.9 %. Nine system defect classes (S-1…S-9) and
**no further schema change earned** — the withdrawn-requirement case looked
like a schema gap and is a behaviour rule. Two instrument defects fixed and
regression-tested; a third (no sex/gender text-scan pattern) found by
inspection and fixed. S-1…S-5 are deliberately left unfixed: applying them
and re-running would mean hand-authoring 251 generations with knowledge of
every check, which is the corpus-optimisation this wave forbade.
S-1…S-5 were then fixed on the owner's instruction (`REPORT.md` §15): five
rules in the intake reasoner, three of them backed by deterministic
corrections in `src/lib/domain/intake-hygiene.ts` (origin follows the
statement; market comparisons cannot be closed from inside the company;
withdrawn requirements are removed rather than demoted), with 10 regression
tests. The code half is scored against the stored corpus by
`pnpm eval:w12 --run full --project-hygiene`: **14 failures removed, 0
introduced**, provenance 99.4 % → 99.9 % and must_not_exist 86.5 % → 94.6 %.
The prompt half is the larger half and cannot be scored without an API key,
so `false_signal_recall` and `contradiction_detection` remain unproven. No
schema field was added, which is the same verdict the corpus reached
independently. Extraction: still not yet — the schema question is well
settled, but fixes that have not been measured are not evidence.

S-6…S-9 followed (`REPORT.md` §16), and investigating them changed the
taxonomy. **S-8 is not a system defect**: four of its five failures are
correct definition updates recording a manager's new instruction, and both
narrowings of the re-plan-signal check trade those false positives for false
negatives on real re-plans, so the check was measured and left alone.
**S-10 was found and is the largest single defect in the corpus**: 197 of 803
requirements (24.5 %, 35 of 53 conversations) carried a `statement`
byte-identical to a sibling's, destroying per-requirement provenance and
corrupting the evaluation's own attribution. Fixed by rule plus
`narrowSharedStatements()`. Two instrument corrections (most-specific match,
hyphens as spaces) raised the stored run's scores with no system change —
requirement_recall 88.7 → 90.5 %, false_signal_recall 54.8 → 61.3 %.
Projection with all backstops: **24 failures removed, 0→3 introduced**, the
three being wording literalism now visible because attribution is correct.
No schema shape changed across S-1…S-10; `RequirementIR` has held through
two rounds of fixes.
