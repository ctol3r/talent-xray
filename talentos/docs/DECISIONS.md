# TalentOS — Decision Log

Format per entry: Decision · Alternatives · Reason · Tradeoffs.

---

## D-001 — TalentOS lives in `talentos/`, isolated from Talent X-Ray

**Decision.** Build TalentOS as a self-contained application in `talentos/`
with its own pnpm workspace root, lockfile, toolchain, and CI job. The
repo-root Talent X-Ray app (deployed, with its own doctrine in `CLAUDE.md`)
is untouched; root format/lint/typecheck exclude `talentos/`.

**Alternatives.** (a) Replace the root app with TalentOS; (b) share one
workspace/lockfile; (c) a new repository.

**Reason.** The task targets this repository, but Talent X-Ray is a live,
commercial, Cloudflare-deployed product with different rules (Supabase RLS,
Stripe, wave doctrine). TalentOS is a personal local-first tool. Isolation
keeps both verifiable independently and keeps Talent X-Ray's `pnpm verify`
green. A separate repo was not chosen because the task explicitly works here
and Talent X-Ray is the natural Phase-2 search connector.

**Tradeoffs.** Two lockfiles and two dependency trees in one repo; a future
shared package needs restructuring. Acceptable at current scale.

## D-002 — SQLite (better-sqlite3) + Drizzle, not Postgres/Supabase

**Decision.** Local SQLite file (`data/talentos.db`) via better-sqlite3,
Drizzle ORM, drizzle-kit migrations committed in `drizzle/`, auto-applied at
startup.

**Alternatives.** Local Postgres; Supabase (as the root product uses); Prisma.

**Reason.** The spec optimizes for Mac/localhost/privacy/low ops/easy backup.
SQLite is a single copyable file with zero daemons. Drizzle over Prisma:
no codegen step, SQL-transparent, first-class SQLite + trivial Postgres
dialect swap later. Auto-migrate at startup is safe for a single-user local
app and removes a whole class of "forgot to migrate" support issues.

**Tradeoffs.** No pgvector (Phase 2 semantic search will use a vector
abstraction or the Postgres path); JSON columns are text, so no partial JSON
indexing — fine at personal scale.

## D-003 — Typed JSON payloads for generated documents; tables for workflow

**Decision.** Rich AI-generated documents (intake, profile, market, strategy,
plans) are stored as JSON columns typed by the same zod schema used for
structured generation. Workflow entities (candidates, stages, events, queries,
channels, messages, scorecards, tasks) are first-class tables.

**Alternatives.** Fully normalized (a table per nested item); fully
document-shaped (one artifacts table).

**Reason.** One zod schema is the single contract for prompt → API → DB → UI
editor; normalizing every nested list would multiply tables and migrations
without an analytics payoff. Analytics-bearing entities stay relational so
funnels are computed in SQL/TS, not by unpacking blobs.

**Tradeoffs.** Cross-document queries into payloads require app-level code.
Accepted; nothing in Phase 1 needs them.

## D-004 — ModelProvider abstraction; Anthropic first; explicit mock

**Decision.** `ModelProvider` interface with `anthropic` (default, model
`claude-opus-5`, env-overridable, structured outputs + streaming) and `mock`
(deterministic, watermarked, enabled only by
`TALENTOS_MODEL_PROVIDER=mock`). No key ⇒ AI features render a
"provider not configured" state; nothing is faked.

**Alternatives.** Direct SDK calls in services; LangChain-style framework;
silent fallback to canned output when no key.

**Reason.** The spec demands vendor-agnostic architecture and forbids fake
data. A thin interface (generateStructured/generateText) is all Phase 1
needs; frameworks would hide prompts and state. The mock provider exists so
tests/e2e run without secrets, and its output is labeled as mock everywhere.

**Tradeoffs.** Mock outputs are simplistic; live-quality checks require a
real key (deliberate — see NO FAKE DATA rule).

## D-005 — Server actions (not API routes) as the mutation boundary

**Decision.** Mutations and generation triggers are Next.js server actions;
every action parses its input with zod before touching a service.

**Alternatives.** REST route handlers; tRPC.

**Reason.** Single-user local app with React UI: actions remove a
serialization layer and keep call sites typed. The engineering rule being
honored is "validate with zod at the boundary" — the boundary here is the
action.

**Tradeoffs.** No external API surface; Phase 2 integrations that need one
(browser extension) will add explicit route handlers with the same zod
discipline.

## D-006 — Product naming is a one-file abstraction

**Decision.** `src/lib/product.ts` exports the product name/tagline; all
user-visible surfaces read from it; a unit test greps `src/` for hardcoded
"TalentOS" outside that file.

**Reason.** The name is explicitly temporary. Cheap insurance now, painful
retrofit later.

**Tradeoffs.** The directory name `talentos/` and package name stay until a
real rename; the test scopes to `src/` for that reason.

## D-007 — Default model `claude-opus-5`

**Decision.** Anthropic provider defaults to `claude-opus-5`
(`TALENTOS_MODEL` overrides). Adaptive thinking left at model default;
structured outputs via `output_config.format` with zod schemas; streaming for
long generations; refusal stop-reason surfaced to the UI as a clear error.

**Alternatives.** Smaller/cheaper models by default.

**Reason.** Recruiting strategy quality is the product; current guidance is
Opus-class as default and cost decisions belong to the owner via env, not
hardcoded downgrades.

**Tradeoffs.** Higher per-call cost; acceptable for a single power user, and
overridable per environment.

## D-008 — Session provider: Claude-as-model with no API key

**Decision.** Third `ProviderKind` `"session"`: generations are written as
request files (`system`, `user`, JSON schema, response path) to
`TALENTOS_SESSION_OUTBOX` and the call throws
`SessionFulfillmentPendingError`; a Claude session (Claude Code / claude.ai,
covered by the owner's Claude subscription) writes the output JSON to the
response path; the caller re-runs and the normal pipeline (zod validation,
fair-hiring scan, audit, persist) proceeds unchanged. Requests are keyed by a
prompt hash, so unchanged inputs reuse an existing response and changed
inputs produce a fresh request. `pnpm golden:session` drives the CAIS golden
benchmark end to end through this provider.

**Alternatives.** (a) Require an Anthropic API key (rejected as the only
path: the owner asked for a key-free mode; API mode remains available).
(b) A claude.ai Artifact build of TalentOS using artifact runtime
capabilities (candidate for a companion surface, not a replacement — the
local app owns the database, imports, and analytics).
(c) Driving the services directly from a Claude session without a contract
(rejected: outputs would bypass schema validation, the fair-hiring scan, and
the audit log).

**Reason.** Zero marginal cost under a Claude subscription; the exact same
prompts, schemas, validation, and persistence as API mode, so quality checks
compare like for like; and the pending-request state is honest — nothing is
generated until a real model fulfills it.

**Tradeoffs.** Not real-time in the UI (a generation waits until a session
fulfills it); the fulfilling model is whatever the session runs (recorded as
`claude-session` in generation meta); stale responses are reused if inputs
are byte-identical — delete the response file to force regeneration.

## D-009 — Crew orchestration as a DB-backed job queue (W7)

**Decision.** Per-search agent crews are a `crew_jobs` queue: dependency-
ordered specialist generation jobs plus a critic pass per artifact and at
most one revision pass (critique injected into the generation context).
Jobs reuse the existing generate\* services untouched, so every agent
output flows through zod validation, the fair-hiring scan, the audit log,
and lands as an editable draft. With the session provider a job parks on a
request file (awaiting_model/critiquing/revising) until a Claude session
fulfills it; `pnpm crew:work` drives the queue headlessly and the Crew tab
drives it from the UI.

**Alternatives.** (a) In-memory orchestration inside one server action
(rejected: not resumable, invisible, dies with the request). (b) External
workflow engine (rejected: local-first, zero-ops constraint). (c) Unlimited
generator↔critic loops (rejected: unbounded cost; one revision pass keeps
the human in the loop as the real reviewer).

**Tradeoffs.** Sequential dependency chain favors context quality over
wall-clock; the critic doubles per-artifact model calls; outreach has no
critic pass yet (persists as rows, not a single artifact).

## D-010 — Research and candidate discovery are separate provider boundaries

**Decision.** Two vendor-neutral interfaces, corrected from the first W8 cut
(owner review, 2026-09-02):

- `ResearchProvider` (`src/lib/research/provider.ts`) searches the
  **general/public information environment**: profession research, company
  research, market intelligence, associations, conferences, compensation,
  regulations, job boards, current facts. Default implementation is the
  honest `none` provider — no general-research backend is configured yet,
  and nothing is faked.
- `CandidateDiscoveryProvider` (`src/lib/research/discovery-provider.ts`)
  searches **specifically for potential people/candidates**: profiles,
  portfolios, publications, registries, rosters. The Talent X-Ray Google
  CSE integration is `TalentXRayCandidateDiscoveryProvider`
  (`src/lib/research/talent-xray.ts`) — the first implementation, never the
  general research path.

Three correctness rules land with the split:

1. A discovery-result snippet is **evidence about a source, not a resume**.
   Saving a result as a candidate writes a `candidate_source_evidence` row
   (sourceUrl, sourceType, title, snippet, retrievedAt, query, provider,
   providerRank, verificationStatus, provenance) — never
   `candidates.resumeText`. Snippets are `unverified` until a recruiter
   verifies them against the source.
2. **No synthetic relevance.** Result position is preserved as
   `providerRank` (1-based). The old `1 - index * 0.05` score fabricated a
   relevance the provider never asserted; it is removed, along with
   `research_sources.relevance`. If TalentOS later scores candidate
   relevance, that will be a separate, transparent evaluation against
   `SearchPlanIR`/`EvidenceIR` — never a disguised rank.
3. The engines' people-only construction is a property of the
   **discovery** provider; general research must not inherit it.

**Alternatives.** One provider interface with a "mode" flag (rejected: the
type system should make "use the people engine for market research" hard to
write, not a runtime footgun); mapping rank to a normalized score (rejected:
fabricated precision).

**Tradeoffs.** General research is honestly unavailable until a real
`ResearchProvider` (Exa/Tavily/Serper/full-web CSE) is wired; agents record
that gap as uncertainty instead of pretending.

## D-011 — Canonical hiring-intelligence IR; agents consume it, not the raw JD

**Decision.** One canonical, typed intelligence model per search
(`src/lib/core/ir.ts`, stored in `hiring_intelligence`):
`ManagerStatement`, `HiringNeedIR`, `HiringIntentIR`, `RequirementIR`,
`SuccessIR`, `EvidenceIR`, `TalentPopulationIR`, `SearchPlanIR`,
`UncertaintyIR`, `ContradictionIR`. The JD is raw input, interpreted
**once** into the IR; downstream agents (crew specialists included) receive
the IR as the source of truth in their rendered context and are instructed
not to re-derive requirements from the JD independently. Vague
hiring-manager phrases ("research taste") must become explicit
`RequirementIR` objects — label, verbatim statement, concrete definition,
evidence spec, status — or an open `UncertaintyIR`, never an unexplained
string.

Adaptive intake (`IntakeReasoner`, `src/lib/services/intelligence.ts`) runs
the loop: ManagerStatement → extract claims → update requirements →
identify ambiguity / contradiction / consequential uncertainty → select the
highest-information next question → capture the answer verbatim → update
`HiringIntentIR`. The full generated question bank (D-003 intake sessions)
remains available; live intake prioritizes reducing consequential
uncertainty over asking every question. Statements are append-only and
service-owned — the model never rewrites the statement log. The loop is
two-phase so it is resumable under the session provider (found in the first
live run, 2026-09-02): the statement is persisted verbatim first (no
`reasonedAt`), then reasoned over; a re-run with the same text reuses the
stored statement, so the reasoner's prompt hash — and the parked session
request — stay stable. Recording a different statement while one is still
un-reasoned is refused rather than silently stacked.

The crew critic tests every artifact against the IR for: unsupported
inference, contradiction with source state, missing provenance, violation
of requirement definitions, and uncertainty disguised as fact.

**Alternatives.** Keep per-artifact reinterpretation of the JD (rejected:
agents drifted into independent readings of the same phrase); normalize the
IR into many tables (rejected per D-003: one zod-typed document per search
is the contract).

**Tradeoffs.** One more generation step (JD → IR) before the crew runs;
existing artifacts (role intelligence, success profile) overlap with the IR
until they are re-pointed at it — recorded as migration debt, not hidden.

## D-012 — `/talentos` is a temporary incubation location

See `docs/ADR-001-talentos-incubation.md`: TalentOS is logically
independent, will be extracted to its own repository once the IR and
provider boundaries are stable, and Talent X-Ray will then integrate
exclusively through `CandidateDiscoveryProvider`.

## D-013 — Research before outreach: session research provider, audience personas, research gate

**Decision.** (Owner request, 2026-09-02: "persona creation of targeted
audiences" and "make sure it researches the web before generating
anything".)

1. `ResearchProvider` (D-010, general information environment) gets its
   first two implementations. **`session`** mirrors the session model
   provider (D-008): a research request file (`query`, `limit`,
   `respondTo`) is written to the outbox and `ResearchPendingError` is
   thrown; a Claude session performs the web search and writes findings
   (url, title, snippet, retrievedAt) to the response path; the caller
   re-runs. **`mock`** is a watermarked, deterministic fixture for tests
   only. `none` stays the default when nothing is configured; when the model
   provider is `session` or `mock` and the research provider is unset, it
   defaults to the matching kind (same handoff channel, same test posture).
   The people-only engines remain rejected here.
2. **`AudiencePersonaIR`** joins the canonical IR: one persona per
   `TalentPopulationIR` segment — who they are, what they value, their
   likely concerns, where they read, tone guidance, proof points the seat
   offers, things not to say — each grounded in cited research findings
   (`research_sources` rows) plus the IR. Personas are audience-level; the
   system never researches an individual candidate (privacy and fair-hiring
   posture: personalization still comes only from recorded, job-related
   evidence).
3. **Research gate.** Personas cannot be generated without research
   findings for the search (`ResearchRequiredError`); `derivePersonas` runs
   the audience research first and fails honestly when no research
   provider is configured. Outreach generation consumes the persona for the
   candidate's segment and the cited findings, and derives personas (hence
   research) automatically when missing — so nothing outreach-shaped is
   generated without the web having been researched first. Research queries
   are deterministic from the IR (segment, surfaces, priority vocabulary,
   company, mission) and are stored with every finding; result pages are
   never fetched by the app.

**Alternatives.** (a) Let the model "use its knowledge" of the audience
(rejected: unverifiable, exactly the fake-data failure mode). (b) Research
the individual candidate before outreach (rejected: profile-page fetching
is forbidden and person-level research is a privacy and fair-hiring
hazard). (c) A soft gate that warns instead of blocking (rejected: the
owner asked for a guarantee, not a suggestion).

**Tradeoffs.** Outreach now depends on a research provider; with `none`
configured it stops with a clear message instead of drafting. The session
research provider is only as fresh as the fulfilling session's search; the
mock research provider is never real research and is watermarked.
