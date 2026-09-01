# TalentOS — Architecture

> Working name. Everything user-visible reads the product name from
> `src/lib/product.ts`; renaming the product is a one-file change plus a
> directory rename. Nothing else in the codebase hardcodes "TalentOS".

TalentOS is a **local-first, single-user, AI-native recruiting workstation** for
Christopher Toler. It is not a multi-tenant SaaS. It shares a repository with
Talent X-Ray (the people-only search SaaS at the repo root) but is a fully
separate application: own directory, own lockfile, own toolchain, own database.
See `docs/DECISIONS.md` D-001 for why.

## 1. Design tenets

1. **Deterministic core, generative edges.** Workflow state, pipeline
   transitions, analytics, validation, and search-string composition are plain
   TypeScript — testable, predictable, never hidden inside a prompt. LLMs are
   used for synthesis: extraction, question generation, strategy, outreach,
   summarization.
2. **Every AI output is a reviewable draft.** Generated artifacts are persisted
   as structured, zod-validated JSON with provenance (`model_inference`) and
   stay editable by the recruiter. The system never auto-acts on them.
3. **Advisory, never autonomous.** No candidate is auto-rejected, auto-ranked
   into an employment decision, or auto-contacted. Evidence alignment produces
   a *review queue*, not a verdict. See §8 (Fair hiring).
4. **No fake data.** Market claims carry a certainty label
   (`verified | estimated | inferred | unknown`) that renders in the UI. When
   the model cannot know something, the schema forces it to say `unknown`.
5. **Local-first.** One SQLite file under `data/`, easy backup (copy the file),
   secrets in `.env`, nothing leaves the machine except calls to the model API
   the user configured.
6. **Provider-agnostic.** `ModelProvider` and `ResearchProvider` interfaces;
   Anthropic is the first implementation, not a load-bearing assumption.

## 2. System layers

```
┌─────────────────────────────────────────────────────────────┐
│ UI (Next.js App Router, React 19, Tailwind 4)               │
│   app shell · dashboard · search workspace · command bar    │
├─────────────────────────────────────────────────────────────┤
│ Server actions ("use server") — zod-validated boundaries    │
├──────────────────────┬──────────────────────────────────────┤
│ Services             │ AI tasks                             │
│ (application logic,  │ (context assembly → structured       │
│  CRUD, workflow)     │  generation → validation → persist   │
│                      │  as editable draft)                  │
├──────────────────────┼──────────────────────────────────────┤
│ Domain (pure TS)     │ Providers                            │
│  pipeline rules      │  ModelProvider: anthropic | mock     │
│  analytics/funnel    │  ResearchProvider: none (Phase 2)    │
│  next-best-action    │                                      │
│  search strings      │                                      │
│  fair-hiring guard   │                                      │
├──────────────────────┴──────────────────────────────────────┤
│ Data (Drizzle ORM → better-sqlite3, migrations in drizzle/) │
└─────────────────────────────────────────────────────────────┘
```

Rules of the tower:

- UI components never touch the database or providers directly; they call
  server actions.
- Every server action parses its input with zod before doing anything.
- Services own transactions and workflow invariants (e.g. a pipeline stage
  change always writes a `pipeline_events` row).
- Domain modules are pure functions with unit tests — no I/O.
- AI tasks are the only code that talks to `ModelProvider`.

## 3. The AI pipeline

Every generative feature follows one shape (`src/lib/ai/run.ts`):

```
INPUT (user action)
  → CONTEXT ASSEMBLY   deterministic: load SearchProject + related rows,
                        serialize a bounded context document
  → GENERATION         ModelProvider.generateStructured(prompt, zodSchema)
                        (Anthropic structured outputs; streaming; one
                         validation-repair retry on schema failure)
  → VALIDATION         zod parse + domain guards (fair-hiring scan,
                        certainty labels present, no invented URLs flagged)
  → PERSIST AS DRAFT   stored with provenance = model_inference,
                        model id, prompt context hash, generatedAt
  → USER EDIT/APPROVE  recruiter edits inline; edits flip provenance of the
                        touched item to user_provided
```

Key properties:

- **Schemas are the contract.** Each AI task exports a zod schema
  (`src/lib/ai/tasks/*`); the same schema types the DB JSON column, the
  provider call, and the UI editor. There is no free-text blob parsing.
- **Business state never lives in prompts.** Prompts are rendered from DB rows
  at call time; the DB is the source of truth.
- **Role knowledge is separated** from employer requirements and
  search-specific requirements (three tables), so one employer's preferences
  never contaminate what the system "knows" about an occupation.
- **The mock provider** exists so tests and the e2e critical path run without
  a key. Its output is deterministic, derived from the input context, and
  watermarked (`model: "mock"` in provenance, "MOCK" badge in the UI). It is
  never enabled by default.

## 4. Repository structure

```
talentos/
├── ARCHITECTURE.md, PRODUCT_SPEC.md, DATA_MODEL.md, IMPLEMENTATION_PLAN.md
├── docs/DECISIONS.md          # decision log
├── package.json               # own toolchain; pnpm workspace root
├── drizzle/                   # generated SQL migrations (committed)
├── drizzle.config.ts
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── page.tsx           # dashboard
│   │   ├── searches/          # list, new, and [id]/ workspace
│   │   │   └── [id]/          #   one route per module (intake, profile,
│   │   │                      #   market, strategy, sources, strings,
│   │   │                      #   candidates, outreach, screen, interviews,
│   │   │                      #   pipeline, close, analytics, learnings)
│   │   ├── candidates/        # global candidate list
│   │   ├── tasks/             # task list
│   │   └── settings/          # provider status, data controls
│   ├── components/            # ui primitives + module components
│   ├── lib/
│   │   ├── product.ts         # PRODUCT_NAME — the rename point
│   │   ├── db/                # schema.ts, client, migrate, seed
│   │   ├── domain/            # pure logic + its tests' subjects
│   │   ├── ai/                # provider.ts, anthropic.ts, mock.ts, run.ts,
│   │   │   └── tasks/         # one file per generative capability
│   │   ├── research/          # ResearchProvider interface (Phase 2 impls)
│   │   ├── services/          # application services
│   │   └── actions/           # server actions (zod at the boundary)
│   └── …
└── tests/
    ├── unit/                  # vitest — domain, schemas, guardrails
    └── e2e/                   # playwright — critical path (mock provider)
```

## 5. Data layer

- **SQLite via better-sqlite3 + Drizzle ORM.** Schema in
  `src/lib/db/schema.ts`; migrations generated by drizzle-kit into `drizzle/`
  and committed; applied automatically at startup (safe: additive, local,
  single user) and by `pnpm db:migrate`.
- Rich nested documents (an intake session's questions, a success profile's
  criteria) are JSON columns **typed by the same zod schemas the AI layer
  uses** — one contract end to end. Entities that participate in workflow
  (candidates, stages, events, messages, queries) are first-class tables so
  analytics stay SQL-computable.
- Migration path to Postgres: Drizzle schema is the abstraction point; the
  JSON columns and uuid/text keys port directly.

## 6. Naming abstraction

`src/lib/product.ts` exports `PRODUCT_NAME`, `PRODUCT_TAGLINE`, and
`DEFAULT_DB_FILENAME`. UI chrome, page metadata, README hero, and seed data
read from it. A grep test (`tests/unit/naming.test.ts`) fails if "TalentOS"
appears hardcoded in `src/` outside `product.ts`.

## 7. Provenance model

Every important claim in the system carries a `provenance` value:

| Value               | Meaning                                    |
| ------------------- | ------------------------------------------ |
| `user_provided`     | Typed or edited by the recruiter           |
| `hiring_manager`    | Captured from HM intake answers            |
| `source_verified`   | Backed by a stored `research_sources` URL  |
| `model_inference`   | Generated by a model, not yet corroborated |

Market/factual claims additionally carry `certainty`:
`verified | estimated | inferred | unknown`. Both render as badges.

## 8. Fair hiring — enforcement, not policy

- `src/lib/domain/fair-hiring.ts` holds the blocked-trait lexicon (race,
  ethnicity, religion, age, gender identity, disability, national origin,
  sexual orientation, health, pregnancy, family status, political affiliation,
  veteran status).
- **Schema-level:** no table has a column for any protected characteristic;
  `tests/unit/fair-hiring.test.ts` greps the schema and source for blocked
  field names and fails the build on a match (same mechanism as Talent X-Ray's
  LEGAL.md guardrail 4).
- **Prompt-level:** every AI task's system prompt includes the non-inference
  directive; evidence-alignment output schemas only admit job-related evidence
  categories.
- **Output-level:** `scanTextForProtectedTraits()` runs over generated
  evidence/screen/scorecard content; hits mark the artifact for mandatory
  recruiter review with a warning banner.
- **Workflow-level:** there is no code path that changes a candidate's
  disposition without a recruiter action; scorecard ratings require written
  evidence text before they can be saved.

## 9. Email & outreach

Phase 1 generates drafts only; the recruiter copies them out. Outreach state
(`drafted → sent → replied …`) is tracked manually. Nothing sends
automatically — there is no code path from generation to delivery. Gmail
integration (Phase 2) will require an explicit per-message user action.

## 10. Testing strategy

- **Vitest (unit):** domain logic (strings composer, analytics, NBA rules,
  diagnosis), zod schemas (fixtures parse; malformed input fails), guardrails
  (fair-hiring grep, naming grep, no-`any` is enforced by lint).
- **Playwright (e2e):** the 20-step critical path from PRODUCT_SPEC §Critical
  end-to-end test, run against `TALENTOS_MODEL_PROVIDER=mock`.
- **Golden fixtures:** six radically different seeded SearchProjects (CAIS
  researcher, physician, enterprise AE, CNC machinist, CFO, ICU nurse).
  Structural differentiation asserts run in CI; live-model differentiation
  (`pnpm golden`, Phase 1.5) runs only when a real key is present and is
  skipped otherwise — never faked.

## 11. What this architecture refuses to do

- No scraping or fetching of candidate profile pages (links out only).
- No autonomous ranking presented as a hiring decision.
- No protected-characteristic fields, inference, or filters.
- No silent AI edits — every generated artifact is labeled and editable.
- No hardcoded API keys; server-side env only.
- No hidden queries — composed search strings are always visible and editable.
