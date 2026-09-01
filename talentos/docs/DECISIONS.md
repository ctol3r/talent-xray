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
