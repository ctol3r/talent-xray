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
pnpm install --frozen-lockfile
TALENTOS_MODEL_PROVIDER=session pnpm dev   # http://127.0.0.1:3000
```

The default model provider is now the keyless session handoff. CV–JD review
uses an explicit **Codex or Claude artifact request/response**: prepare the
request locally, use it in the chosen session, and import the JSON suggestions.
The app does not make a model API request for this comparison flow. An artifact
is an interface and structured handoff, not an embedded language model.

For other modules, the session provider writes requests to
`data/session-outbox/`; a Codex or Claude session can fulfill the schema and
write the response for the app to validate on re-run. Availability depends on
the session you use. Existing API-provider configuration is opt-in legacy
functionality; this release does not need an AI API key. If an old `.env` selects
`anthropic`, override it with `TALENTOS_MODEL_PROVIDER=session` as above.

New databases initialize on first use. Existing databases with pending
migrations stop before changing schema. Back up the SQLite database (including
any live WAL state) and the private document directory; only after owner
authorization run `pnpm db:migrate`. The implementation work does not authorize
migrating your personal database. See [connected-review release notes](docs/CONNECTED_REVIEW.md)
for the storage, rollback, and validation boundaries.

`TALENTOS_MODEL_PROVIDER=mock` enables the deterministic, watermarked mock
provider used by tests — mock output is labeled MOCK in the UI and is never
real analysis.

## Verify

```bash
pnpm verify   # format check, typecheck, lint, unit tests, build
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

This directory is a **temporary incubation location** inside the
`talent-xray` repository (own lockfile, own toolchain — see
docs/DECISIONS.md D-001 and docs/ADR-001-talentos-incubation.md; extraction
to its own repository is planned once the IR boundary is stable). The Talent
X-Ray product at the repo root is untouched; its validated query-composer
semantics are ported into `src/lib/domain/search-strings.ts`, and its two
live people-only engines power `TalentXRayCandidateDiscoveryProvider` —
candidate discovery, deliberately never the general research path (D-010).

Outreach is research-gated (D-013): drafting a sequence first researches
the _audience_ on the web through the general `ResearchProvider`
(`TALENTOS_RESEARCH_PROVIDER=session|mock|none`; unset follows the model
provider), builds one cited `AudiencePersonaIR` per talent segment, and
only then writes the sequence for that persona. Research is audience-level —
the app never researches an individual candidate — and every finding is
stored with the exact query that produced it.
