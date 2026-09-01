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

## W10 — Virtual crew in the Lite artifact (CLOSED 2026-09-01)

TalentOS Lite gains the crew treatment: "Run crew on this search"
generates every module in dependency order with a critic review per
artifact and one revision pass when the critic finds concrete defects
(critic verdicts + findings rendered on each module); per-candidate
"Run agents" chains evidence → outreach. Runs on the viewer's Claude
account; intake answers stay human. Republished to the same artifact URL;
script syntax + headless boot verified.
