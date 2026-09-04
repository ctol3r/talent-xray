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

## W14 — TalentOS Universal, Phase 2: the shape of the work (CLOSED 2026-09-04)

Owner instruction 2026-09-04 ("a", then "b"): take Phase 2 of the five-phase
program, then start Phase 3's connector work.

### Five phases, derived (D-020)

`core/phases.ts` groups every module into **Define · Research · Plan ·
Execute · Learn** and computes each phase's status from the module states
`core/dependencies.ts` already derives. Nothing about a phase is stored.
Two screens join the rail: **Research** (the panel that used to sit at the
bottom of the brief now has the phase to itself) and **Actions**.

A phase is complete only when every required entry is `current` or `aging`.
A later phase is marked EARLY with the output it is waiting on, and is still
reachable — Guided mode hides advanced entries, never a phase.

### The persistent header

Sticky above the module: role and company, the content-addressed brief
version, the live research status, the selected industry pack, the mode
switch, the five phases with their state and counts, the question the
current phase answers, and **one next best action** with the reason it was
chosen and a button that routes it.

`core/next-best-action.ts` is a pure function over the same inputs the rail
reads. Precedence: failure → safety flag → blocked action → first missing
required output in phase order → the intake loop's own question → staleness
→ research currency → outstanding intake answers → candidate review →
queue → defect checks → "nothing is waiting". It never proposes sending
outreach, advancing a stage, or approving anything.

### Industry packs

`core/industry-packs.ts` ships Universal plus healthcare, AI/ML research,
sales, skilled trades and finance. A pack carries intake themes, what counts
as evidence in that field, field-specific cautions, the platform tags worth
compiling for and the research source kinds that bear on its claims. It is
selected on the brief (a consequential field, so switching it re-versions
the search), rendered into the prompt context, and read by the query
compiler. `suggestPack()` only ever suggests; the recruiter selects.

**A latent defect the packs exposed.** The model returns
`relevantPlatforms` as platform NAMES while platform selection is by TAG, so
a returned "Google (Scholar/arXiv x-ray)" never matched the "research" tag
and those platforms were unreachable for every search since W10.
`tagsFromPlatformNames()` maps names, ids and bare tag words onto tags.

### Action queue and initiatives

A module's envelope DRAFTS action items; they appear under "Drafted by your
modules" and reach the queue only when a human adds them. In the queue an
action has an owner and a status; marking one blocked asks what it is
waiting on, and completing one asks what actually happened. Initiatives
group actions and count progress from them. `Initiative` is a new stored
document alongside actions; nothing existing changed shape.

### Phase 3, started and honestly incomplete (D-021)

`core/connectors.ts` resolves the `mcp` capability, asks `listTools()` what
the viewer actually has, and reports per connector: no connector access /
not connected / reconnect needed / tools missing / **connected but not
wired** / ready. Every documented error code has a branch naming the fix it
actually has. The three adapters now declare their real server and tool
names.

All three remain `wired: false` and retrieve nothing. **The reason is
stated rather than worked around:** wiring a tool call requires observing a
real request/response pair, and the Bigdata.com call in this session was
refused by the environment's permission classifier before it reached the
connector. The artifact also does not declare `capabilities.mcp` — that is
a viewer-consented grant which bars public sharing, and it should not be
spent on connectors the build cannot yet call.

### Acceptance — what was actually run

- `pnpm test` — 30 files, 299 tests. New: `artifact-phases` (12),
  `artifact-industry-packs` (10), `artifact-next-best-action` (18),
  `artifact-connectors` (11).
- `pnpm e2e:artifact` — 17 Playwright tests against the committed HTML,
  including the header's chips and phase strip, the next-best-action
  button, Guided vs Expert (and that the choice survives a reload), and the
  action queue: a drafted action reaching the queue only when a human adds
  it, and completion demanding a note.
- `pnpm verify` — green, including the artifact build-drift check.

## W15 — TalentOS Universal, Phase 4: the metric contract gets a producer (CLOSED 2026-09-04)

Owner instruction 2026-09-04 ("c"). W13 shipped `MetricResult` and
`rateMetric` with no module emitting a metric; `OutputEnvelope.metrics` was
always empty, which was honest and useless. This wave gives them a source.

### Pipeline events (D-022)

`core/pipeline.ts`: eight stages (sourced → hired) and three exits
(rejected, withdrew, on hold). An event is append-only and human-recorded —
`stage_change`, `outreach_recorded`, `reply_recorded`, `exit`, `note` — with
no update and no delete in the store. A candidate's funnel position is the
FURTHEST stage they reached, so an earlier stage's denominator does not
shrink as the search progresses; their CURRENT position is their exit if
they have one.

The Pipeline screen (Execute phase) is a board of who is where plus the
metrics. Recording a stage asks for confirmation and says why; recording an
exit prompts for the reason.

### The four groups

| Group                 | Answers                                                                                                                          |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Funnel                | Where the search loses people — seven stage-to-stage conversions                                                                 |
| Responsiveness        | Whether the approach lands — reply rate, interested share, median time to reply                                                  |
| Quality of submission | Whether the hiring manager agrees — submitted→interviewing, interviewing→offer, offer→hired, share of exits that were rejections |
| Velocity              | How long it really takes — median sourced→contacted, sourced→submitted, days open                                                |

Every rate states its formula and denominator and declares a minimum sample;
below it, it reports `not_enough_data` with what it has and what it needs.
Durations carry their sample size as the denominator. "Days open" with no
recorded open date says so rather than reporting zero.

### Acceptance — what was actually run

- `pnpm test` — 31 files, 317 tests. New `artifact-pipeline` (16) covers
  furthest-vs-current position, reached counts, the four groups' shape,
  minimum samples, the empty-pipeline case, the missing open date, the
  absence of any attribute breakdown, and that no rate exceeds its
  population. Defect check 12 asserts the same three properties inside the
  page's Golden Test.
- `pnpm e2e:artifact` — 20 tests, including that declining the stage
  confirmation records nothing, that accepting it drives the funnel, and
  that an unmeasurable metric says how much data it needs.
- `pnpm verify` — green, including the artifact build-drift check.

### Not in this wave

The HM command centre, the decision log and the pivot engine were listed
under Phase 4 in the W13 continuation note and are NOT here — this wave is
pipeline events and metrics, which is what was asked for. `pivotProposalSchema`
still has no producer, and `compareMetric` has no caller: there is no stored
period to compare against yet.

## W16–W19 — Phase 5, resume, in-page scoring, minification (CLOSED 2026-09-04)

Owner instruction 2026-09-04: the remaining options from the W15 report,
requested as **d, e, f, g, h**. Four are built; **E could not be run and is
recorded as blocked rather than approximated.**

### W16 (D) — Candidate evidence dossiers (D-023)

`core/evidence.ts`. A candidate's sources are only what a human supplied:
the pasted text, the links they added, their notes. Every evidence item now
carries a verbatim `quote` and the `sourceId` it came from, and
`verifyEvidence()` checks the quote against that source's text.

| Situation                       | Result                                                                 |
| ------------------------------- | ---------------------------------------------------------------------- |
| Quote found in the named source | Stays as claimed; QUOTE FOUND IN SOURCE                                |
| Quote not found                 | Downgraded to `unknown`, struck through, "do not use it"               |
| Source is a link                | Capped at `partial` — the page never fetched it                        |
| No source named                 | `unknown`; "a model inference about a real person. It is not evidence" |
| No quote given                  | Capped at `partial`; nothing can be checked                            |

The dossier also names the success-profile criteria nobody assessed
("absence here is absence of an answer, not absence of the skill"), and the
prompt now tells the model that a quote is checked automatically, so
paraphrasing into the field is worse than leaving it empty. Defect check 13
injects a fabricated quote and asserts it is caught.

### W17 (G) — A crew run covers only what still needs work

`crewRemaining()` drops modules already `current` for the current input
version; anything failed, stale, blocked, aging or needing review is in the
run. The button reads "Resume crew — N modules left", names what it is
skipping, and disables itself when there is nothing to do. The call estimate
comes from a plan built over the remaining modules, so a resumed run
advertises its real cost.

### W18 (H) — The artifact scores its own prompts (D-024)

`core/corpus.ts` imports `checkTurn`, `mergeTallies` and `ZERO_TARGET_METRICS`
from `eval/w12/checks.ts` and four conversations from the corpus — imported,
not ported, so the page and the harness cannot disagree about what a failure
is. The Golden Test can run those fixtures through the artifact's own
prompts on the viewer's Claude and score them deterministically.

**The generating model never sees the expectations.** They stay in the page
and are applied afterwards. That is the independence every run in
`eval/w12/results/` lacked, and it arrives from an unexpected direction: the
`sample` capability makes the model call one the page controls end to end.

The report cannot flatter itself: nothing executed is FAIL, any zero-target
violation is FAIL, an incomplete run is PARTIAL, a metric never exercised
reads "not exercised", and the caveat naming the sample size, the missing
judge and the 53-conversation corpus travels with every number.

### W19 (F) — Minified whitespace and syntax (D-025)

1.20 MB → **904 KB**, while gaining the corpus. Identifiers are kept and
`keepNames` is on, so a stack trace in the published page still names the
function that threw.

### E — NOT RUN, and why

The remaining option was "run the full W12 corpus against an API key so the
generations are independent of whoever reads the expectations, and with the
judge on a different model". **There is no Anthropic credential in this
environment** (`ANTHROPIC_API_KEY` and `ANTHROPIC_AUTH_TOKEN` are both
unset), so the run cannot happen here.

It was not approximated. Re-running the corpus through the session provider
would mean the same person who can read the expectations writing 251
generations again — the exact corpus-optimisation W12 was built to avoid,
and the thing `REPORT.md` already discounts 25 checks for. W18 is not a
substitute either: four conversations on a viewer's model tier is a sample,
not the corpus, and the judge still does not run.

**The extraction condition is unchanged**: full corpus, API key, judge on a
different model, holding `false_signal_recall` above 85 %, provenance at
100 %, and `RequirementIR` unchanged.

### Acceptance — what was actually run

- `pnpm test` — 33 files, 349 tests. New: `artifact-evidence` (14),
  `artifact-corpus` (12), plus crew-resume cases in `artifact-execution`.
- `pnpm e2e:artifact` — 25 tests against the committed HTML, including a
  fabricated quote being struck through in the real page, a link shown as a
  source that was never fetched, and the corpus panel stating what its
  numbers would and would not mean.
- `pnpm verify` — green, including the artifact build-drift check.

### Hotfix, same day — "+ New search" rendered blank

Found by the owner on first use, minutes after the W16–W19 publish. The
New-search screen's heading template had two root elements
(`<div class="mod-head">…</div><p class="mod-desc">…</p>`). Under W13's
`el()` that silently dropped the paragraph; under W14's guard it throws, so
the first-run path — the one thing a new user does — went blank. The guard
was right; the coverage was not: no test had ever created a search.

Fixed by splitting the template. Two additions so this class cannot ship
again: `tests/unit/artifact-templates.test.ts` statically scans every
`el(\`…\`)`template in`artifact-src/ui/`(nested`${…}` respected) and
fails on any with more than one root — run against the pre-fix file it
reports exactly the one defect; and an e2e that presses "+ New search",
creates a search, and checks it is current, persisted across a reload, and
raised no page error.

Lesson worth keeping: a guard that throws in the viewer's browser is the
last line, not the first. The static scan is where it should have been.
