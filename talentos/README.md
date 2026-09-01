# TalentOS

> Working name — the product name lives in [`src/lib/product.ts`](src/lib/product.ts)
> and nothing else in `src/` may hardcode it (enforced by a test).

A **local-first, single-user, AI-native recruiting workstation** for
Christopher Toler: an elite recruiter, sourcer, talent-intelligence analyst,
interview designer, and closing strategist in one workspace — covering the
lifecycle from hiring-manager intake through sourcing, screening, interviews,
pipeline, offer, and onboarding.

This is **not** an ATS that records what you did. Every module answers _what
should I do next, why, on what evidence, and how_. And it is **not** a
template library: intakes, strategies, channels, screens, and interview plans
are derived per-role by the model — a physician search and an ML-research
search share almost nothing (proven by the golden-fixture tests).

Read the docs first:

| Doc                                              | What it covers                                                                 |
| ------------------------------------------------ | ------------------------------------------------------------------------------ |
| [ARCHITECTURE.md](ARCHITECTURE.md)               | Layers, AI pipeline, provenance model, fair-hiring enforcement, repo structure |
| [PRODUCT_SPEC.md](PRODUCT_SPEC.md)               | The 22 modules, module contracts, golden fixtures, acceptance test             |
| [DATA_MODEL.md](DATA_MODEL.md)                   | Every table and payload schema                                                 |
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | Wave status                                                                    |
| [docs/DECISIONS.md](docs/DECISIONS.md)           | Why SQLite, why this repo, why these abstractions                              |

## Run it

```bash
cd talentos
pnpm install
cp .env.example .env       # add ANTHROPIC_API_KEY for real generation
pnpm db:migrate            # creates data/talentos.db and applies migrations
pnpm db:seed               # seeds the six golden-fixture searches (once)
pnpm dev                   # http://localhost:3000
```

Without an API key the app runs fully — AI features show an honest
"provider not configured" state instead of generating. `TALENTOS_MODEL`
overrides the default model (`claude-opus-5`).

No API key at all? `TALENTOS_MODEL_PROVIDER=session` makes a Claude session
the model: each generation writes a request file (prompt + JSON schema) to
`data/session-outbox/`, a Claude Code / claude.ai session writes the output
JSON back, and the normal pipeline (zod validation, fair-hiring scan, audit,
persist) resumes on re-run. Model usage is covered by your Claude
subscription — see docs/DECISIONS.md D-008. The CAIS golden benchmark runs
key-free this way via `pnpm golden:session` (API-key edition:
`pnpm golden:cais`).

`TALENTOS_MODEL_PROVIDER=mock` enables the deterministic, watermarked mock
provider used by tests — mock output is labeled MOCK in the UI and is never
real analysis.

## Verify

```bash
pnpm verify   # format check, typecheck, lint, unit tests (51), build
pnpm smoke    # headless 20-step critical path through the real services (mock provider)
pnpm e2e      # the same critical path driven through the real UI (Playwright)
```

`pnpm e2e` needs a prior `pnpm build`; point `PLAYWRIGHT_CHROMIUM_EXE` at a
system Chromium if Playwright's own download isn't available.

## Load-bearing properties

- **Deterministic core, generative edges.** Pipeline state, analytics,
  next-best-action, diagnosis, and boolean/x-ray composition are plain tested
  TypeScript. The model does synthesis: extraction, questions, strategy,
  outreach, plans — always into zod schemas, always as editable drafts with
  provenance badges.
- **No fake data.** Market claims carry `verified/estimated/inferred/unknown`
  labels; model-suggested venues are `inferred` until a human verifies them;
  diagnosis withholds conclusions below sample-size thresholds.
- **Fair hiring is enforced, not promised.** No schema field for protected
  characteristics (a grep test fails the build), a non-inference directive in
  every prompt, output scanning that flags trait references for mandatory
  review, and advisory-only candidate ordering that a recruiter can always
  override.
- **Local-first.** One SQLite file under `data/` — back up by copying it.
  Per-candidate JSON export and permanent deletion built in. Profile URLs
  link out; pages are never fetched or scraped.

## Relationship to Talent X-Ray

This directory is a self-contained app inside the `talent-xray` repository
(own lockfile, own toolchain — see docs/DECISIONS.md D-001). The Talent X-Ray
product at the repo root is untouched; its validated query-composer semantics
are ported into `src/lib/domain/search-strings.ts`, and its search engines
are a natural Phase-2 `ResearchProvider`.
