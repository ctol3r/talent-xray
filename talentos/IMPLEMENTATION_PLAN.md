# TalentOS — Implementation Plan

Status legend: `[x]` done · `[~]` in progress · `[ ]` open. A step is done
when its code exists **and** its tests pass — compiling is not done.

## Wave 1 — Foundation

- [x] Scaffold `talentos/` as an isolated app (own lockfile/toolchain);
      exclude from root Talent X-Ray pipeline
- [x] Architecture / product spec / data model / plan / decision log docs
- [ ] Drizzle schema for all entities (DATA_MODEL.md), generated migration,
      startup migrator
- [ ] Seed: default pipeline stages, owner user, golden fixtures A–F
      (projects + JDs; fixture A additionally carries a worked example)
- [ ] Guardrail tests: fair-hiring grep, naming grep, strict mode

## Wave 2 — Deterministic domain core

- [ ] Search-string composer (boolean/x-ray; LinkedIn, Google, GitHub,
      Scholar, generic site: targets; narrow/balanced/broad/adjacent) + tests
- [ ] Pipeline stage defaults, transition recording + tests
- [ ] Funnel analytics (counts, conversions, time-in-stage) + tests
- [ ] Next-best-action rules + tests
- [ ] Pipeline diagnosis rules + tests

## Wave 3 — AI layer

- [ ] ModelProvider interface; Anthropic impl (structured outputs via
      zodOutputFormat + messages.parse, streaming, refusal handling);
      mock impl (deterministic, watermarked)
- [ ] `runAiTask` pipeline: context assembly → generate → validate →
      fair-hiring scan → persist draft + ai_generations audit row
- [ ] Task modules with zod schemas + prompts: role intelligence, intake,
      success profile, market intelligence, sourcing strategy, channels,
      string expansion, evidence alignment, outreach, recruiter screen,
      interview plan, close plan, onboarding plan, learnings synthesis
- [ ] ResearchProvider interface + `none` impl (Phase 2 wires real providers)

## Wave 4 — Services & actions

- [ ] Services: search projects, role intel, intake, profile, market,
      strategy, channels, strings, candidates, evidence, outreach, screen,
      interviews, scorecards, pipeline, close, onboarding, learnings, tasks
- [ ] Server actions with zod-validated inputs for all of the above

## Wave 5 — UI

- [ ] App shell, nav, dashboard (today / health / next best actions)
- [ ] Searches list + create; search workspace layout with module nav
- [ ] Module pages: overview, role, intake, profile, market, strategy,
      sources, strings, candidates (+ candidate detail with evidence),
      outreach, screen, interviews, pipeline (kanban), close, analytics,
      learnings
- [ ] Provenance/certainty badges, editable AI artifacts, empty/loading/error
      states
- [ ] ⌘K command bar

## Wave 6 — Acceptance

- [ ] Playwright critical path (20 steps, mock provider)
- [ ] Golden fixture structural differentiation test
- [ ] `pnpm verify` green (format, typecheck, lint, unit, build) + e2e green
- [ ] README with setup, backup, and philosophy

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
