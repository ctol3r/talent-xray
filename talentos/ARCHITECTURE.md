# TalentOS — Architecture

> Working name. Everything user-visible reads the product name from
> `src/lib/product.ts`; renaming the product is a one-file change plus a
> directory rename. Nothing else in the codebase hardcodes "TalentOS".

TalentOS is a **local-first, single-user, AI-native recruiting workstation** for
Christopher Toler. It is not a multi-tenant SaaS. It shares a repository with
Talent X-Ray (the people-only search SaaS at the repo root) but is a fully
separate application: own directory, own lockfile, own toolchain, own database.
See `docs/DECISIONS.md` D-001 and `docs/ADR-001-talentos-incubation.md` —
`/talentos` is a **temporary incubation location**; TalentOS is logically
independent and will be extracted to its own repository once the canonical IR
and provider boundaries are stable. Talent X-Ray then integrates exclusively
through `CandidateDiscoveryProvider`.

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
   a _review queue_, not a verdict. See §9 (Fair hiring).
4. **No fake data.** Market claims carry a certainty label
   (`verified | estimated | inferred | unknown`) that renders in the UI; model
   output can never claim `verified`. When the model cannot know something,
   the schema forces it to say `unknown`. Search-result snippets are
   `unverified` source evidence, never resume content; provider result
   positions are preserved as ranks, never dressed up as relevance scores.
5. **Local-first.** One SQLite file under `data/`, easy backup (copy the file),
   secrets in `.env`, nothing leaves the machine except calls to the model API
   the user configured.
6. **Provider-agnostic.** Three interfaces, each vendor-neutral:
   `ModelProvider` (generation), `ResearchProvider` (general/public
   information), `CandidateDiscoveryProvider` (people search). Anthropic and
   the Talent X-Ray engines are first implementations, not load-bearing
   assumptions.
7. **One interpretation of the search.** The JD and hiring-manager statements
   are interpreted once into a canonical, typed hiring-intelligence model
   (§4). Agents consume that IR; they do not each re-read the raw JD and
   invent their own version of the requirements.

## 2. System layers

```
┌──────────────────────────────────────────────────────────────┐
│ UI (Next.js App Router, React 19, Tailwind 4)                │
│   app shell · dashboard · search workspace · command bar     │
├──────────────────────────────────────────────────────────────┤
│ Server actions ("use server") — zod-validated boundaries     │
├──────────────────────┬───────────────────────────────────────┤
│ Services             │ AI tasks                              │
│ (application logic,  │ (context assembly → structured        │
│  CRUD, workflow,     │  generation → validation → persist    │
│  IntakeReasoner)     │  as editable draft)                   │
├──────────────────────┼───────────────────────────────────────┤
│ Domain (pure TS)     │ Providers                             │
│  pipeline rules      │  ModelProvider: anthropic|session|mock│
│  analytics/funnel    │  ResearchProvider: none|session|mock   │
│  next-best-action    │    (general web; D-013 research gate) │
│  search strings      │  CandidateDiscoveryProvider:          │
│  fair-hiring guard   │    talent-xray (two live CSEs)        │
│  canonical IR types  │                                       │
├──────────────────────┴───────────────────────────────────────┤
│ Data (Drizzle ORM → better-sqlite3, migrations in drizzle/)  │
└──────────────────────────────────────────────────────────────┘
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
  → CONTEXT ASSEMBLY   deterministic: load SearchProject + related rows +
                        canonical IR, serialize a bounded context document
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

## 4. Canonical hiring intelligence (IR) and adaptive intake

`src/lib/core/ir.ts` defines the typed objects every agent reasons over;
one `hiring_intelligence` row per search stores the composed document:

| Object               | What it is                                                                                                                                                                                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ManagerStatement`   | One verbatim utterance from the hiring manager (or the JD author), append-only, service-owned — the model never rewrites the log.                                                                                                                                                          |
| `HiringNeedIR`       | Why the role exists: business problem, triggering event, cost of vacancy, role summary, extracted claims with provenance, explicit unknowns.                                                                                                                                               |
| `RequirementIR`      | One requirement made explicit: short label, the verbatim source statement, a concrete definition for THIS search, kind (must-have/preferred/trainable/disqualifier), origin, observable evidence spec, false signals, status (explicit/needs_clarification/assumed), linked uncertainties. |
| `UncertaintyIR`      | One open unknown: what it is about, kind (ambiguity/missing/conflicting/assumption), the consequence for the search if unresolved, whether it is consequential, status + resolution.                                                                                                       |
| `ContradictionIR`    | Two claims that cannot both hold, each with provenance, plus status/resolution.                                                                                                                                                                                                            |
| `HiringIntentIR`     | The living interpretation: need + requirements + uncertainties + contradictions + the statement log + a revision counter. Updated by the intake loop, never regenerated from scratch once statements exist.                                                                                |
| `SuccessIR`          | What success in the seat observably looks like, linked to requirement ids.                                                                                                                                                                                                                 |
| `EvidenceIR`         | Per requirement: what observable evidence would satisfy it, where that evidence lives publicly, what strong vs weak looks like.                                                                                                                                                            |
| `TalentPopulationIR` | Who plausibly clears the bar: segments with where-they-are surfaces and honest supply estimates (`abundant/adequate/scarce/unknown`).                                                                                                                                                      |
| `SearchPlanIR`       | How to find them: per-segment query plans (concepts + synonym groups + platforms + breadth, linked to requirement ids) that the deterministic composer turns into concrete strings.                                                                                                        |
| `AudiencePersonaIR`  | One persona per talent segment for outreach: who they are, what they value, likely concerns, where they read, tone, proof points the seat offers, things not to say — each grounded in cited research findings. Audience-level only; never an individual.                                  |

**The rule that matters:** vague hiring-manager language ("research taste",
"strong communicator", "scrappy") must become an explicit `RequirementIR`
with a definition and evidence spec — or an open, consequential
`UncertaintyIR` driving the next intake question. It never survives as an
unexplained string that each downstream agent interprets its own way.

**IntakeReasoner** (`src/lib/services/intelligence.ts`) is the adaptive
intake loop:

```
ManagerStatement (verbatim, persisted BEFORE reasoning — resumable)
  → extract claims                (provenance: manager_statement)
  → update RequirementIRs         (clarify, add, re-classify)
  → identify ambiguity            (UncertaintyIR: ambiguity)
  → identify contradiction        (ContradictionIR vs JD/earlier statements)
  → identify consequential uncertainty
  → select highest-information next question
  → capture answer                (next ManagerStatement)
  → update HiringIntentIR         (revision += 1)
```

The full generated intake bank (module 03) still exists; live intake
prioritizes the question that reduces the most consequential open
uncertainty rather than walking the bank top to bottom.

Rendered context places the IR first, marked as the canonical source of
truth; the JD is included below it as reference material. The crew critic
(§ crew) reviews every artifact against the IR for: unsupported inference,
contradiction with source state, missing provenance, violation of
requirement definitions, and uncertainty disguised as fact.

## 5. Research vs candidate discovery

Two deliberately separate boundaries (`src/lib/research/`, D-010):

- **`ResearchProvider`** (`provider.ts`) — the general/public information
  environment: profession research, company research, market intelligence,
  associations, conferences, compensation, regulations, job boards, current
  facts. Implementations (D-013): `session` — a file-handoff mirror of the
  session model provider where a Claude session performs the web search and
  writes findings back; `mock` — watermarked fixtures for tests; `none` —
  the honest default when nothing is configured (agents record the gap as
  uncertainty instead of faking findings). Findings land in
  `research_sources` with the query that produced them.
- **Research gate (D-013).** Audience personas are generated only from
  research findings, and outreach drafts are generated only from a
  research-backed persona — `derivePersonas` runs the audience research
  first and `generateOutreach` derives personas when missing, so nothing
  outreach-shaped exists without the web having been researched. Research
  is audience-level (segments, surfaces, company, mission); the system
  never researches an individual candidate.
- **`CandidateDiscoveryProvider`** (`discovery-provider.ts`) — people search
  only: profiles, portfolios, publications, registries, rosters.
  `TalentXRayCandidateDiscoveryProvider` (`talent-xray.ts`) is the first
  implementation, backed by the two live people-only Google Programmable
  Search engines. It is **not** a research provider; the type system keeps
  market research from being answered by a people index.

Shared rules for both: never fetch/crawl/scrape a result page; results are
transient until a user explicitly saves one; result position is preserved
as `providerRank` — no synthetic relevance scores. A discovery result saved
as a candidate produces a `candidate_source_evidence` row (snippet marked
`unverified`), never `resumeText`.

## 6. Repository structure

```
talentos/
├── ARCHITECTURE.md, PRODUCT_SPEC.md, DATA_MODEL.md, IMPLEMENTATION_PLAN.md
├── docs/DECISIONS.md          # decision log
├── docs/ADR-001-talentos-incubation.md
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
│   │   │                      #   pipeline, close, analytics, learnings,
│   │   │                      #   crew, discover, guide)
│   │   ├── candidates/        # global candidate list
│   │   ├── tasks/             # task list
│   │   └── settings/          # provider status, data controls
│   ├── components/            # ui primitives + module components
│   ├── lib/
│   │   ├── product.ts         # PRODUCT_NAME — the rename point
│   │   ├── core/              # enums, payload schemas, ir.ts (canonical IR)
│   │   ├── db/                # schema.ts, client, migrate, seed
│   │   ├── domain/            # pure logic + its tests' subjects
│   │   ├── ai/                # provider.ts, anthropic.ts, session.ts,
│   │   │   └── tasks/         #   mock, run.ts; one file per capability
│   │   ├── research/          # provider.ts (ResearchProvider, general),
│   │   │                      # discovery-provider.ts (people search),
│   │   │                      # talent-xray.ts (first discovery impl)
│   │   ├── services/          # application services (incl. intelligence.ts)
│   │   └── actions/           # server actions (zod at the boundary)
│   └── …
├── artifact-src/              # SOURCE of the published single-file artifact
│   ├── core/                  #   payloads, search-context, dependencies,
│   │                          #   research, envelope, query-compiler,
│   │                          #   execution-plan, identity, store,
│   │                          #   defect-checks
│   ├── ai/                    #   prompts, context rendering, task runner
│   ├── app/                   #   in-page state
│   ├── ui/                    #   vanilla-DOM shell and module renderers
│   ├── styles.css, template.html, main.ts
├── artifact/talentos-lite.html  # GENERATED — do not hand-edit (D-019)
├── scripts/build-artifact.mts   # esbuild bundle + inline; --check in verify
└── tests/
    ├── unit/                  # vitest — domain, schemas, guardrails,
    │                          #   and the artifact's own modules
    ├── e2e/                   # playwright — critical path (mock provider)
    └── e2e-artifact/          # playwright — the committed artifact HTML
```

**The artifact is a second front end over the same contracts.** It renders
with vanilla DOM into one inline `<script>` and talks only to the viewer's
own Claude (`sample`) and the artifact document store (`db`, with a
localStorage fallback). It imports `src/lib/core/ir.ts`,
`src/lib/core/payloads.ts` and the pure modules under `src/lib/domain/`
directly, so the two surfaces cannot drift on a field name; `pnpm verify`
fails if the committed HTML is not what `artifact-src/` produces.

## 7. Data layer

- **SQLite via better-sqlite3 + Drizzle ORM.** Schema in
  `src/lib/db/schema.ts`; migrations generated by drizzle-kit into `drizzle/`
  and committed; applied automatically at startup (safe: additive, local,
  single user) and by `pnpm db:migrate`.
- Rich nested documents (an intake session's questions, a success profile's
  criteria, the canonical IR) are JSON columns **typed by the same zod
  schemas the AI layer uses** — one contract end to end. Entities that
  participate in workflow (candidates, stages, events, messages, queries)
  are first-class tables so analytics stay SQL-computable.
- Migration path to Postgres: Drizzle schema is the abstraction point; the
  JSON columns and uuid/text keys port directly.

## 8. Naming abstraction

`src/lib/product.ts` exports `PRODUCT_NAME`, `PRODUCT_TAGLINE`, and
`DEFAULT_DB_FILENAME`. UI chrome, page metadata, README hero, and seed data
read from it. A grep test (`tests/unit/naming.test.ts`) fails if "TalentOS"
appears hardcoded in `src/` outside `product.ts`.

## 9. Provenance model

Every important claim in the system carries a `provenance` value:

| Value             | Meaning                                    |
| ----------------- | ------------------------------------------ |
| `user_provided`   | Typed or edited by the recruiter           |
| `hiring_manager`  | Captured from HM intake answers            |
| `source_verified` | Backed by a stored `research_sources` URL  |
| `model_inference` | Generated by a model, not yet corroborated |

Market/factual claims additionally carry `certainty`:
`verified | estimated | inferred | unknown` — and model output is
schema-restricted to the last three; only a human can mark `verified`.
Candidate source evidence carries `verificationStatus`
(`unverified | recruiter_verified`): a search-result snippet starts
`unverified` on every surface that renders it. All of these render as
badges.

## 10. Fair hiring — enforcement, not policy

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

## 11. Email & outreach

Phase 1 generates drafts only; the recruiter copies them out. Outreach state
(`drafted → sent → replied …`) is tracked manually. Nothing sends
automatically — there is no code path from generation to delivery. Gmail
integration (Phase 2) will require an explicit per-message user action.

## 12. Testing strategy

- **Vitest (unit):** domain logic (strings composer, analytics, NBA rules,
  diagnosis), zod schemas (fixtures parse; malformed input fails), guardrails
  (fair-hiring grep, naming grep, no-`any` is enforced by lint), the IR
  golden path (`tests/unit/ir-pipeline.test.ts`).
- **Playwright (e2e):** the 20-step critical path from PRODUCT_SPEC §Critical
  end-to-end test, run against `TALENTOS_MODEL_PROVIDER=mock`.
- **Golden fixtures:** six radically different seeded SearchProjects (CAIS
  researcher, physician, enterprise AE, CNC machinist, CFO, ICU nurse).
  Structural differentiation asserts run in CI; live-model differentiation
  (`pnpm golden`, Phase 1.5) runs only when a real key is present and is
  skipped otherwise — never faked.

## 13. What this architecture refuses to do

- No scraping or fetching of candidate profile pages (links out only).
- No autonomous ranking presented as a hiring decision.
- No protected-characteristic fields, inference, or filters.
- No silent AI edits — every generated artifact is labeled and editable.
- No hardcoded API keys; server-side env only.
- No hidden queries — composed search strings are always visible and editable.
- No people-only search engine answering general research questions.
- No search-result snippet stored as resume content, and no provider rank
  dressed up as a relevance score.
