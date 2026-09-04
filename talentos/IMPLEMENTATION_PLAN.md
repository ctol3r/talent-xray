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

## W12.5 — The W12 brain ships in the Lite artifact (CLOSED 2026-09-03)

Owner instruction 2026-09-03, after `where can i start using this tool`
established that the artifact — not the local Next.js app — is the surface
actually opened. The artifact was a separate, pre-W8.5 implementation: it
derived a `role_intelligence` blob from the JD, offered a static question
list with no way to record what the manager answered, and had none of the
ten defect fixes S-1…S-10. Every downstream module read the JD directly, so
a manager's correction never reached the search plan.

Ported into `artifact/talentos-lite.html`:

- The four deterministic backstops from `src/lib/domain/intake-hygiene.ts`,
  verbatim in behaviour — origin follows the statement (S-2), withdrawn
  requirements leave the set (S-4), one requirement one source phrase
  (S-10), market comparisons cannot close from inside the company (S-3).
- `IR_RULES`, carrying all ten corpus-proven rules, interpolated into both
  the JD-derivation task and the intake reasoner. Five of the corpus
  failures were at the derivation step, which previously carried none of
  them.
- A `hiring_need` task producing the canonical IR, and an `intake_loop`
  module that records `ManagerStatement`s and reasons over them, applying
  the backstops on every turn.
- `renderContext` is IR-first (the W8.5 correction): where the IR exists it
  is emitted as the source of truth and downstream modules are told not to
  re-derive requirements from the job description.

`role_intelligence` and the old `intake` module still work and are still
reachable; nothing was removed.

Acceptance: `tests/unit/artifact-hygiene.test.ts` (15 tests) extracts the
hygiene block straight out of the HTML with `new Function` and runs the same
cases as the app's own `intake-hygiene.test.ts`, plus asserts the rule block
reaches both prompts — so the copy cannot rot silently. `pnpm verify` green
(18 files, 153 tests). Republished to the same artifact URL.

**Unmeasured, and stated as such.** A single-file page cannot run the corpus
harness against itself, so the ported brain is unproven in exactly the way
the app's own prompt rules are: only the deterministic half has a score.

## W12.6 — S-11: contradictions survive omission (CLOSED 2026-09-03)

Owner instruction 2026-09-03, from reading the intake-loop walkthrough: the
contradiction set is replaced wholesale each turn, so one the reasoner stops
emitting is gone. Fixed in both implementations —
`preserveContradictions()` in `src/lib/domain/intake-hygiene.ts` and its port
in the artifact, plus a rule in both reasoner prompts ("A CONTRADICTION NEVER
LEAVES BY OMISSION"). Eleven regression tests across the two test files,
including the case that makes the naive fix wrong: a contradiction whose
claims were reworded on the turn it was resolved must not be duplicated.

Acceptance: `pnpm verify` green (18 files, 164 tests);
`pnpm eval:w12 --run full --project-hygiene` unchanged at 24 removed / 3
introduced, `contradiction_detection` 20/26.

**No corpus evidence, stated as such** (`REPORT.md` §17): 11 turns carry a
prior contradiction, the set never shrank on any of them. This closes a
shape. The measurement's own first answer was wrong and is written up,
because the exact-text key it implied would have made the record worse.

## W13 — TalentOS Universal, Phase 1: truthful state (CLOSED 2026-09-04)

Owner instruction 2026-09-04 (the "TalentOS Universal" brief, §1–22). The
brief describes a five-phase program; its own sequencing rule is that
Phase 1 is finished and validated before any partially connected downstream
work, and that is what this wave is. Phases 2–5 are specified and not
started; the continuation note is at the end of this section.

The product is renamed **TalentOS**. "Universal" is the name of the default
industry pack (`selectedIndustryPack: "universal"`), not a second product.

### The build (D-019)

`artifact/talentos-lite.html` is generated from `talentos/artifact-src/`
(TypeScript, strict, no `any`) by `scripts/build-artifact.mts`. The bundle
imports the app's own zod schemas, composer and hygiene, so the artifact and
the app can no longer disagree about a field name. `pnpm verify` now runs
`build:artifact:check`, which fails if the committed HTML is not what the
sources produce.

### The four P0 defects

**P0-A — a frozen provider payload crashed the HM Intake.** The old renderer
did `if (!q.id) q.id = uid()` on the object the provider returned; under
strict mode on a non-extensible object that threw `Cannot add property id`,
and the module rendered "Render failed — use Edit JSON below". Fixed at the
boundary, not in the renderer: `normalizeGenerated(task, raw)` deep-copies,
zod-parses, then assigns ids with the app's own `ensureIds`. Answers are
recorded by `withIntakeAnswer`, which returns a new payload.
`downgradeVerified` is pure. Nothing in the artifact mutates a value it did
not create. The regression test feeds a deeply frozen payload through
render, answer, store and reload.

**P0-B — there was no module state.** A module was "done" if a truthy
payload existed, and a failure lived in the DOM until the next render. Now
every module has exactly one state, derived on read and never stored:
`not_started · researching · generating · current · aging · stale · blocked ·
failed · needs_review`, each with a reason, the generation time, the input
version it consumed, the research snapshot it used, and a recovery action.
`SearchContext` is content-addressed over 29 consequential fields, so
changing one produces a new `searchVersion`, a human-readable diff
("Workplace model changed from on-site required to hybrid preferred. Market
Intel, Strategy, Search Strings, and 7 candidate assessments are now
stale.") and staleness that propagates down the dependency graph. Failures
persist as `lastError` on the record and survive navigation and reload.

**P0-C — three different call counts, all literals.** The crew panel said
`CREW_ORDER.length * 2`, the Golden Test said "About 9 Claude calls", the
overview counted a module that was never an artifact key. All three are gone:
`planExecution(scope)` returns the steps, the module list, a min–max model-call
range (revision passes are optional, so it is a range), research ops and a
one-line summary, and `ProgressTracker` reports elapsed, completed, skipped,
retries, failures and whether a failed run is resumable.

**P0-D — over-budget queries were offered as runnable.** They now compile
against `PLATFORM_CONSTRAINTS`: Google's 32 counted terms (OR/AND/NOT and
brackets are free), LinkedIn's 1,000 characters with `NOT` instead of a
leading minus and no `site:`. An over-budget OR group is split into numbered
parts that each fit; when no split can fit, the query is shown NOT RUNNABLE
with the reason and no Copy button. Each breadth variant carries an
explanation of what it tests. The validated composer is wrapped, not
redesigned (CLAUDE.md).

### Research Gate (owner decision, 2026-09-04)

This runtime has capabilities `sample, db, artifact, downloads, mcp, room`
and **no web access**, so the honest design fails closed on _currency_, not
on generation. Without a usable `ResearchSnapshot` a module is `blocked`; the
user may still generate it after an explicit acknowledgement, and the output
is labelled MODEL KNOWLEDGE ONLY with every claim `self_attested`. Freshness
is per source kind, not one TTL — job openings age in 7 days and go stale at
21; an occupational taxonomy has a year and three years — and each window
records why it is what it is. A provider failure is `failed` and an empty
result is `blocked`; neither is ever an empty success. The adapter registry
selects sources by industry, role and location (Bigdata.com, NPI Registry,
PubMed/bioRxiv/Consensus); all three report themselves **unwired** in this
build and return nothing, because wiring them needs an observed
request/response and viewer consent (Phase 3).

### Output envelope and the eight next steps

Substantive modules return an `OutputEnvelope`: headline, executive summary,
claims split by kind and evidence state, implications, action items, pivot
proposals, the module content, and **exactly eight next steps labelled A–H**.
The count is validated at runtime, not asserted in prose: eight labels once
each, every step actionable and pointing at something that exists, filler
rejected, at most two recommended, and the outward or decisive actions
(outreach, stage change, pivot approval, stakeholder update, recorded
decision) flagged as requiring a human confirmation. A failing envelope gets
one repair pass; if it still fails, the record is kept with its validation
issues visible rather than presented as clean. Metrics carry a formula and a
denominator, and 0/0 is `not_enough_data`, never zero.

### Acceptance — what was actually run

- `pnpm test` — 26 files, 248 tests, green. New: `artifact-payloads`,
  `artifact-context`, `artifact-research`, `artifact-envelope`,
  `artifact-query-compiler`, `artifact-execution`, `artifact-defect-checks`,
  `artifact-store`, `artifact-build`.
- `pnpm e2e:artifact` — 10 Playwright tests against the **committed** HTML,
  served from a routed origin with a stub `window.claude` that returns
  deeply frozen objects and can fail on demand.
- `pnpm build:artifact:check`, `pnpm typecheck`, `pnpm lint`,
  `pnpm format:check`, `pnpm build` — all green in `pnpm verify`.
- The eleven deliberate-defect checks run in the page with no model call and
  in vitest, and the Golden Test reports which checks executed and which did
  not.

`tests/unit/artifact-hygiene.test.ts` is deleted: it sliced the HTML between
comment markers, which a build product does not have. The same behaviour is
covered by importing the modules directly.

### Continuation note — Phases 2 to 5, not started

1. **Phase 2, five-phase IA and modes.** Group the modules into Define ·
   Research · Plan · Execute · Learn behind a persistent header whose "next
   best action" is derived from `moduleStates()` and the action queue, with
   Guided and Expert modes. The state machine it needs already exists
   (`core/dependencies.ts`); this is navigation, not new truth.
2. **Phase 3, connectors.** Wire `bigdataAdapter`, `npiAdapter` and
   `publicationsAdapter` through the `mcp` capability. Each needs a real
   request/response observed in session before it is written, per-viewer
   consent, and a rule that a connector-backed artifact is never published
   publicly. `availability()` already returns the honest unavailable state,
   so nothing lies while this is pending.
3. **Phase 4, pipeline and metrics.** Pipeline events, the four metric
   groups with formulas and denominators (`metricResultSchema` and
   `rateMetric` are in place), the HM command centre, the decision log and
   the pivot engine over `pivotProposalSchema`.
4. **Phase 5, candidate evidence dossiers.** Per-criterion evidence with
   source links, the conservative identity resolution already implemented in
   `core/identity.ts`, and outreach that a human still sends.

Nothing in Phases 2–5 has a half-built counterpart in the tree: the
contracts they need are complete and tested, and the surfaces they need are
absent rather than stubbed.
