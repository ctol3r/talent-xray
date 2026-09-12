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

## D-014 — Requirement authority semantics: `assertedBy` and `contested`, and nothing more

**Decision.** (W12 adversarial evaluation, 2026-09-02.) `RequirementIR`
gains two optional fields and no others:

- `assertedBy?: string` — the `speaker` of the ManagerStatement the
  requirement came from, set whenever `origin` is `manager_statement`.
- `contested?: boolean` — true while stakeholders disagree about the
  requirement and have not reconciled.

`status` is documented as describing how well a requirement is DEFINED, not
how certain every detail is: a requirement the manager has stated is
`explicit` even when its threshold is still open (the threshold belongs in
`linkedUncertaintyIds`), and disagreement is `contested`, never
`needs_clarification`.

**Evidence.** Fixture e-02 (CFO, CEO vs board chair) showed that with two
stakeholders `origin` only records that a person spoke, not which one, so
attribution survived solely as prose no downstream agent can query; and that
"clear but disputed" was being encoded as "vague". Fixture b-02 (ICU/ECMO)
showed a plainly-stated must-have demoted to `needs_clarification` because
its threshold was open. Both are in `eval/w12/REPORT.md` §3 with the
before/after scores in §6.

**Rejected, with reasons.** `decisionAuthority` — a property of a
stakeholder, not of a requirement. `challengedBy` — duplicates
`ContradictionIR`, which held both sides correctly in every stakeholder
fixture (4/4). `approvedBy` — a workflow event with no failure behind it.
Requirement facets CONSTRUCT / PROXY / SIGNAL / EVIDENCE / THRESHOLD /
FALSE_SIGNAL / COUNTEREVIDENCE as separate fields — the corpus showed
`definition`, `evidenceSpec` and `falseSignals` already carry them
(proxy identification 100 %, proxy-as-filter 0), THRESHOLD is expressible
through `linkedUncertaintyIds` and needed a rule rather than a field, and
COUNTEREVIDENCE produced no failure at all.

**Tradeoff.** Two optional fields cost nothing to existing rows and are
ignored by every consumer that does not need them; the risk is that
`contested` goes stale if a reconciliation is never recorded, which is why
the reasoner is instructed to clear it only on a statement that settles the
disagreement.

## D-015 — Withdrawn requirements are removed, not demoted; provenance and market comparisons are enforced in code

**Decision.** (W12 full-corpus evaluation, 2026-09-02.) Three rules about
`HiringIntentIR`, each stated to the intake reasoner and each backstopped
deterministically in `src/lib/domain/intake-hygiene.ts`:

1. **A withdrawn requirement leaves the requirement set.** When a hiring
   manager takes a requirement away it is removed, not demoted to
   `preferred` and not relabelled "(withdrawn)". The withdrawal survives in
   `extractedClaims` and the verbatim statement log.
2. **`statement` and `origin` move together.** A manager restating a
   job-description requirement in their own words takes both, plus
   `assertedBy`. A manager merely explaining what a JD phrase means leaves
   the statement verbatim and puts their words in `definition`.
3. **A comparison with the outside market cannot be resolved from inside
   the company.** The manager stating their own figure answers one side;
   the uncertainty stays open, and only market evidence closes it.

**Evidence.** All five `must_not_exist` violations in the full corpus were
rule 1 (g-01, j-05, x-01, e-01, i-05, across five occupations); `preferred`
legitimately raises a candidate's review priority, so a withdrawn
requirement kept that way still shapes the search. Rule 2 accounts for all
8 provenance failures and 11 of the 26 `requirement_recall` failures — one
mechanism, two metrics. Rule 3 accounts for 13 of the 23
`uncertainty_detection` failures, all of them an unknown being converted
into a fact. `eval/w12/REPORT.md` §12.1 (S-2, S-3, S-4) and §15.

**No schema change.** Rule 1 looked like a `RequirementIR` gap — a
`withdrawn` status — and is not one: the information is preserved in the
claim log, and the intake prompt already forbids re-deriving requirements
from the job description, so removal loses nothing. Adding a fifth enum
value would have been a field added on suggestion rather than on evidence,
which D-014 already refused for three other candidates.

**Tradeoff.** Rules stated to a model are not guarantees, so each is paired
with a narrow deterministic correction that can be unit-tested: the
backstops only act on unambiguous shapes (a requirement _named_ withdrawn,
a statement verbatim from a different source, a comparison uncertainty
resolved on a turn it was open). Projected onto the stored corpus they
remove 14 failures and introduce none
(`pnpm eval:w12 --run full --project-hygiene`). The two fixes with no
deterministic shape — populating false signals, and recording a manager's
own counterexample as a contradiction — remain prompt-only and unmeasured.

## D-016 — One requirement, one source phrase; and what `consequential` means

**Decision.** (W12 full-corpus evaluation, 2026-09-03.) Two rules about the
canonical IR, both stated to the JD-derivation task and the intake reasoner,
one of them backstopped deterministically:

1. **`statement` is the fragment that asserts that one requirement**, quoted
   exactly, fragments joined with an ellipsis. Two requirements never carry
   the same statement, and a multi-topic manager turn is never pasted onto
   every requirement it touched. `narrowSharedStatements()` narrows the ones
   that get through, only when one sentence clearly wins.
2. **`consequential` on an UncertaintyIR means the answer would change who we
   approach or whether they could accept** — the population, the geography,
   the reachable supply, or a material term (pay, relocation support, shift,
   start date, work authorisation). Not "would it change anything
   downstream".

Alongside them, two rules with no deterministic shape: `status: "explicit"`
requires that a person could be assessed against the requirement, from
observable evidence or a named assessment step (an open _threshold_ keeps a
requirement explicit, an open _definition_ does not); and a prestige, brand
or credential proxy is never a bare requirement — name the construct it
stands for and put the proxy in `falseSignals`.

**Evidence.** 197 of 803 requirements in the full corpus — 24.5 %, across 35
of 53 conversations — carried a `statement` byte-identical to a sibling's.
That destroys the provenance the field exists for, and it corrupted the
evaluation's own numbers: a requirement carrying a whole turn matched any
alias from that turn and absorbed the expectation belonging to the
requirement that alias actually named (h-01, j-01, x-02, b-01, i-01 were all
reported as `kind` errors the system had in fact got right). For
`consequential`, the schema previously said "would resolving it change
sourcing **or screening**", which is true of almost every question and made
the flag useless for ranking; the corpus expects a machinist role's
"what does self-starter mean" to be _not_ consequential and a funded-relocation
question to be consequential. `eval/w12/REPORT.md` §16.

**No schema shape change.** Only the `consequential` doc-comment moved, and
that narrowing is the fix. `RequirementIR` is now unchanged across two rounds
of fixes covering ten defect classes (S-1…S-10).

**Tradeoff.** `narrowSharedStatements()` re-attributes provenance
heuristically, which is a real risk, so it is deliberately timid: it acts
only on statements already known to be wrong (shared by two or more
requirements), only when exactly one sentence has the highest distinctive
overlap with the requirement's label, and the result is always a verbatim
substring of the original. An abbreviation the label does not spell out
("AP") is not matched and the statement is left as-is — a missed narrowing is
cheap, a wrong one is not.

## D-017 — The Lite artifact is a port target, not a second implementation

**Decision.** (2026-09-03.) `artifact/talentos-lite.html` carries the same
brain as the app: the canonical IR is what it derives, the intake loop is
what it runs, and the ten W12 rules and four deterministic backstops are
copied into it. Where the two cannot share code, the copy is held in place
by a test that reads the artifact's own source
(`tests/unit/artifact-hygiene.test.ts`), not by discipline.

**Why this needed deciding.** The artifact had drifted into a separate
product. It predated W8.5 and produced a `role_intelligence` blob that every
downstream module re-read the JD alongside; its intake was a generated
question list with nowhere to put the answers. All ten defect classes the
full corpus proved (S-1…S-10) were live in it, unfixed, while the app's
copies were fixed — and the artifact is the surface actually opened. A fix
that lands only in the surface nobody opens is not a fix.

**The seam.** A single-file page cannot import from `src/`, so three things
are duplicated: the backstop functions, the rule text, and the IR shape. The
first is tested against the app's own cases by extracting the block from the
HTML with `new Function`; the second is asserted present, in both prompts,
by string match; the third is not tested and is the weak point — an IR field
renamed in `src/lib/core/ir.ts` will not fail any test until someone opens
the artifact.

**What is not claimed.** The port is unmeasured. The corpus harness needs a
filesystem, a model provider and a scorer, none of which exist inside a
published page, so the ported rules carry exactly the evidence the app's
prompt rules carry — the deterministic half is scored
(`--project-hygiene`: 24 failures removed, 3 introduced), the prompt half
is not. Porting moved the fixes to where they are used; it did not prove
them.

**Tradeoff.** Two implementations is a cost we are choosing to pay while
TalentOS is incubating (ADR-001). The alternative — a build step that
inlines `src/` into the artifact — buys correctness at the price of the one
property that makes the artifact useful right now, that it is a single file
someone can open. Revisit at extraction.

## D-018 — A contradiction never leaves the record by omission (S-11)

**Decision.** (2026-09-03.) The intake reasoner returns the full
contradiction set each turn and it replaces the previous one. A prior
contradiction with no counterpart in the new set is now carried forward by
`preserveContradictions()`, with its own status and resolution intact and a
sentence appended to its note saying it was carried rather than re-asserted.
The reasoner is also told, in both the app and the artifact, that a
contradiction never leaves by omission.

**Why.** Claims and statements append. Requirements carry a label and
uncertainties an id, so a disappearance is at least nameable. A
`ContradictionIR` has neither a required id nor a label, so the one thing
that must not evaporate — two stakeholders who have not reconciled — was the
one thing that could vanish with nothing to notice it by.

**Evidence, stated plainly: none from the corpus.** Across the 53-conversation
full run there are 11 turns carrying a prior contradiction, the set never
shrank on any of them, and no prior contradiction went unmatched. The
projection with this backstop moves nothing: 24 failures removed, 3
introduced, `contradiction_detection` unchanged at 20/26 — the same numbers
as without it. This closes a shape, not a measured failure, and is recorded
that way.

**The matcher is the load-bearing part.** The obvious implementation — key a
contradiction by its two claim texts — would have been worse than the bug.
The reasoner routinely shortens or rewords a claim on the turn it resolves
the contradiction (a-03 turn 2, h-02 turn 2, both real), so an exact key
reads the resolved entry as a different contradiction and leaves a stale
open duplicate beside it. `sameClaim()` therefore matches on equality,
containment of a substantial substring, or 0.6 token overlap, and
`sameContradiction()` accepts the two sides in either order. That the
projection introduces nothing across those 11 turns is the evidence that the
matcher does not duplicate.

**Tradeoff.** A carried contradiction the reasoner deliberately merged into
another will reappear as a duplicate; the note says it was carried, so a
recruiter can delete it. A silently lost disagreement leaves no trace at
all. Given the choice, the visible duplicate is the better failure.

## D-019 — The artifact becomes a build product (supersedes D-017's seam)

**Decision.** (2026-09-04.) `artifact/talentos-lite.html` is no longer
hand-written. It is generated by `scripts/build-artifact.mts` from
TypeScript sources under `talentos/artifact-src/`, bundled with esbuild into
one inline `<script>` and inlined into `artifact-src/template.html` together
with `artifact-src/styles.css`. `pnpm build:artifact` writes the file;
`pnpm build:artifact:check` rebuilds in memory and fails if the committed
file differs, and runs inside `pnpm verify`. The published path and the
artifact URL are unchanged.

**Why.** D-017 accepted a hand-port with a named seam: the artifact carried
its own copy of the IR field names and its own composer, and
`tests/unit/artifact-hygiene.test.ts` held the port in place by slicing the
HTML between two comment markers and `new Function`-evaluating it. That test
could only ever cover the block between the markers, and the shape strings
it could not reach were the ones most likely to rot. The bundle imports
`@/lib/core/ir`, `@/lib/core/payloads`, `@/lib/domain/search-strings`,
`@/lib/domain/intake-hygiene` and `@/lib/domain/fair-hiring` directly, so a
renamed field is now a type error at build time rather than a surprise when
someone opens the page. The marker test is deleted; ten test files import
the same modules the artifact runs.

**Determinism is the point of the version stamp.** The build hashes the
unversioned bundle, the stylesheet and the template, and defines
`__TALENTOS_ARTIFACT_VERSION__` as `<pkg version>+<10 hex>`. Two builds of
the same tree produce the same bytes, which is what makes `--check`
meaningful and what lets `tests/unit/artifact-build.test.ts` assert the
committed file equals a fresh render.

**Cost, stated plainly.** The page is now ~990 KB unminified, against ~150 KB
hand-written. That is well inside the platform's 16 MB limit and buys
readable stack traces in the published page; minification is available and
not taken. A contributor can no longer edit the published HTML directly —
`--check` will reject it — and must edit `artifact-src/` and rebuild.

**What did not change.** Vanilla DOM rendering, no framework, one inline
script, no external script host, the `sample`/`db` runtime contract, the
localStorage key `talentos-lite-v1` and every stored document path.

## D-020 — Navigation is derived, and Guided never hides a phase

**Decision.** (2026-09-04, W14.) The artifact's modules are grouped into five
phases — Define · Research · Plan · Execute · Learn — and a phase's status
is computed from the module states already derived in `core/dependencies.ts`.
A phase is `complete` only when every REQUIRED entry is `current` or `aging`;
`blocked` is a real result and is never completion. Guided mode hides
advanced entries (the pre-IR role read, the Golden Test); it does **not**
hide a phase, and it does not prevent jumping ahead. A phase the earlier
work has not fed is marked EARLY and says which output it is waiting on.

**Why.** The rail was a flat list of twelve modules in dependency order,
which is the shape of the graph rather than the shape of the work. Grouping
them is navigation; deriving the group's state from the modules keeps it
honest — there is no phase record to go stale, and no second source of truth
about whether something is done.

**Why Guided does not lock.** A locked step is a lie about who is in charge:
a recruiter who wants to look at the channel map before the success profile
exists has a reason, and the honest response is to show it with its state
("Not started. Generate Success Profile first for best results"), not to
refuse. Hiding _advanced_ entries is different — those are alternates and
diagnostics, not steps.

**Next best action.** One action, derived by a fixed precedence in
`core/next-best-action.ts`: a failure, then a safety flag, then a blocked
action item (a person waiting), then the first missing required output in
phase order, then the intake loop's own question, then staleness, then
research currency, then execution. It is a pure function over the same
inputs the rail reads — no model call — and it returns a step routed
through the same confirmation rules as any other suggested step. It may
never propose sending outreach, advancing a stage, or approving anything;
a test enforces that.

## D-021 — "Connected" and "wired" are different states, and the page says which

**Decision.** (2026-09-04, W14.) The artifact resolves the `mcp` capability
and asks the viewer's own connectors what is true — not connected, lapsed
auth, connected but missing the tools, connected — and reports that per
connector in the Research screen. Separately it reports whether THIS BUILD
has observed a real request/response pair for the tools it would call.
Bigdata.com, the NPI Registry and PubMed/bioRxiv/Consensus are declared
with their real server names and tool names, and all three are `wired:
false`: the page will not call them.

**Why the distinction is load-bearing.** "Not wired" alone was true but
useless — it told a recruiter nothing about whether the thing could ever
work for them. "Connected" alone would be worse than useless: it implies
the page can use it. A page that calls a connector tool with a guessed
argument shape produces either an error or, far worse, a result it
misreads — and a misread result becomes a cited source. The capability
contract is explicit that argument names and result encoding are not part
of it, and must be observed.

**Status, stated plainly.** The observation could not be made in this
session: the Bigdata.com tool call was refused by the environment's
permission classifier before it reached the connector. So the bridge ships
complete — capability resolution, per-connector status, one branch per
documented error code with the fix it actually has — and `retrieve()`
returns nothing. When a request/response pair can be observed, `wired`
becomes true for that adapter and only then.

**What is deliberately NOT declared.** The artifact does not declare
`capabilities.mcp`. Declaring it is a viewer-consented grant that bars
public sharing of the page, and it should not be spent on connectors the
build cannot call. The page therefore reports "no connector access in this
view", which is the truth until the manifest is declared.

## D-022 — Every metric is computed from recorded events, and an empty funnel is not a zero

**Decision.** (2026-09-04, W15.) Pipeline events are append-only records of
something a person already did: recorded outreach, a recorded reply, a stage
they moved someone to, an exit with a reason. There is no update and no
delete. Every metric in the four groups — Funnel, Responsiveness, Quality of
submission, Velocity — is computed from those events and nothing else, and
each one carries its formula, its numerator where it has one, and its
denominator.

**Why an empty pipeline reports nothing.** A conversion rate of "0%" from
zero contacts is a lie that reads like a measurement, and it is the specific
failure the brief names. Every rate declares a minimum sample (ten contacts
before a reply rate means anything; three interviews before an
interview-to-offer rate does) and reports `not_enough_data` with the count
it has and the count it needs until then. A duration reports the median with
its sample size as the denominator, so "3.5 days" can never be read without
"across four candidates". "Days open" with no recorded open date says so
explicitly — _it is not zero_.

**Why the funnel counts "reached", not "is at".** A candidate who is now at
Offer also reached Contacted and Replied. Counting current position would
make every rate depend on how far the search has got rather than on how many
people converted, and it would shrink the denominator of every earlier stage
as the search progressed.

**Nothing advances anyone.** Recording a stage asks for confirmation and
says why: it is a decision about a person's application, and TalentOS does
not make those. The exit reason is prompted for, because the reason is the
only part a later search can learn from.

**No breakdown by any candidate attribute, ever.** The metric registry is
fixed. There is no grouping parameter, so there is nothing to point at a
protected characteristic — a deliberate-defect check asserts the computed
registry contains no such term, alongside the checks that no rate exceeds
its own population and that an empty pipeline yields no measured zero.

**A comparison needs both sides.** `compareMetric` refuses to report a
direction unless both periods are measured and both meet their minimum
sample, and it states both sample sizes when it does. "Improved" without
that is a claim, not a measurement.

## D-023 — A claim about a person is evidence only if its quote is in a source a human supplied

**Decision.** (2026-09-04, W16.) Every candidate evidence item carries a
`quote` — a verbatim span — and a `sourceId` naming which attached source it
came from. `verifyEvidence()` checks that span against the source's text
deterministically. A quote that is not found there is downgraded to
`unknown`, marked NOT IN ANY SOURCE, struck through, and accompanied by
"do not use it". A claim with no quote, or no source, cannot be `strong`.

**Why this and not a prompt rule.** "Never invent facts about this person"
has been in the prompt since W6 and the W12 corpus measured zero fabricated
figures — but that was about market numbers. A fabricated _quote attributed
to a named individual_ is a different and worse failure: it reads as
verbatim, it is the most persuasive thing in a dossier, and a recruiter
would repeat it to a hiring manager. Prompt rules are unmeasurable
mid-flight; a substring check is not. This is the same reasoning as the W12
deterministic backstops: state the rule to the model AND enforce the part
that can be enforced.

**A link is not a source.** The page never fetches anything, so a URL's
contents are unknown to it. An item quoting a link is capped at `partial`
with "open it and check the claim yourself" — the honest state, and one the
model cannot argue with.

**Uncovered criteria are named.** A dossier lists the success-profile
criteria the assessment never mentioned, with "absence here is absence of an
answer, not absence of the skill". Silence on a criterion previously looked
identical to a considered "missing".

## D-024 — The artifact scores its own prompts, and the generating model never sees the expectations

**Decision.** (2026-09-04, W18.) The artifact imports the W12 deterministic
checkers and four corpus conversations directly from `eval/w12/` — not a
port — and the Golden Test can run them through the page's own prompts on
the viewer's Claude. Scoring happens afterwards, in code.

**Why this is better evidence than the runs already in the repo.** Every run
in `eval/w12/results/` was hand-fulfilled through the session provider: the
same person who could read the expectations wrote the generations. The
REPORT says so and discounts 25 checks for exactly that reason. Here the
model receives the fixture's project facts, JD and scripted statements and
nothing else; the expectations stay in the page. That is the independence
the extraction condition asked for — arriving from an unexpected direction,
because the artifact's `sample` capability makes a model call the page
controls end to end.

**What it still is not.** Four conversations out of 53, on whatever model
tier the viewer's Claude serves, with the LLM judge still not running. The
report carries a caveat naming all three, a metric never exercised is
reported as "not exercised" rather than as a pass, a run where nothing
executed is FAIL rather than a vacuous PASS, and any zero-target violation
is FAIL whatever else passed. It does not replace the API-key run; it makes
the artifact's brain measurable at all, which it was not.

## D-025 — Minify whitespace and syntax, keep identifiers

**Decision.** (2026-09-04, W19.) The artifact build enables esbuild's
`minifyWhitespace` and `minifySyntax` with `minifyIdentifiers: false` and
`keepNames: true`. The page went from 1.20 MB to 904 KB — 25 % — while
gaining the corpus fixtures and checkers.

**Why not the other half.** D-019 left the bundle unminified so a stack
trace in the published page names the function that threw. Mangling
identifiers is where most of the remaining bytes are and is also the only
part that costs that. At 904 KB against a 16 MB limit there is no pressure
worth trading a readable trace for.

## D-026 — Candidate search runs on the Talent X-Ray engines by link-out, and the page never reads a result

**Decision.** (2026-09-04, W20.) The artifact "conducts the search" the only
way it honestly can: every runnable Google-dialect query — the compiler's
own rows, and an editable box the recruiter can change — opens the live
engine's results page in a new tab (`cse.google.com/cse?cx=…#gsc.q=…`, the
reference console's own fallback link). Nothing on the page reads, fetches,
stores or ranks a result. The recruiter adds the people they choose under
Candidates, as before.

**Why link-out and not results in the page.** The artifact runtime has no
network: `fetch`, XHR and third-party scripts are blocked by the platform's
CSP, and its capability roster (`sample`, `db`, `artifact`, `downloads`,
`mcp`, `room`) contains nothing that reaches the Custom Search JSON API.
The Next.js app already runs the same engines server-side with a
bring-your-own key (D-010, W8), so the two surfaces now do the same thing at
the two fidelities they can: the app shows results it fetched with your key;
the artifact opens the engine with your query. Neither ever fetches a result
_page_.

**Why the engine gets the compiler's row unchanged.** The reference
composer sends a plain boolean and adds a `site:` group only to narrow the
already-restricted corpus — exactly what the x-ray rows do. So the open-web
row is the engine's native query, the LinkedIn/GitHub/Scholar rows are its
narrowings, and LinkedIn's native boolean (AND/NOT) is never offered because
Google reads those as words. The editable box is re-checked against the same
32-word limit on every keystroke: an empty or over-budget query has no link,
and says why, rather than a link that silently truncates.

**What changed in the next best action.** With current queries and no
candidates, the derived next step is now "run a compiled query on Talent
X-Ray, then add who you find" rather than "add the first candidate" — the
product's own answer to where candidates come from.

## D-027 — The wheel and the deck are views of existing state, not new sources of it

**Decision.** (2026-09-04, W20.) Two of the three owner-supplied concepts
are rendered as pure views over contracts that already exist:

- **The next-steps wheel** is the eight lettered steps A–H of the freshest
  envelope (the current module's if it has one), drawn as a ring around a
  hub that shows the derived next best action. Exactly eight slots because
  the envelope contract is exactly eight (§9). A segment click goes through
  `performAction`, so confirmation rules, module routing and "nothing sends"
  are unchanged. With no envelope the ring is empty and says so; it never
  invents steps to fill the slots.
- **The candidate deck** is every candidate record as a fanned card, front
  card first and then the order they were added in. A card shows only what
  the record holds — title, company, geography, a link that is labelled
  NOT FETCHED, the recorded pipeline position, and the dossier's
  quote-verified count. There is no score and the deck says "nothing here
  ranks anyone". The front card is the recruiter's choice, kept only for the
  session; it is not persisted because it is not a fact about anyone.

**Why views and not features.** The brief's anti-drift rule is that a
feature not named in the wave goes to the backlog. These were named — by
picture — and the honest translation of a picture of a radial menu is "the
things you can do next, arranged radially", which TalentOS already has as a
validated list. Building a second source of next steps for the wheel, or a
ranking for the deck to order by, would have been the duplicate half-system
the program forbids.

## D-028 — Parallel pages: a ribbon exists exactly where the evidence check passed

**Decision.** (2026-09-04, W20.) The third concept — a source document on
one side, a structured output on the other, and bands connecting passages
to the items they produced — is the dossier's provenance made visible. The
pasted source is laid beside the dossier; each quote that `verifyEvidence`
found in that source is marked in the text, and an SVG ribbon joins the mark
to its claim. A claim with no ribbon says why, in the check's own words
(quote not in any source; source is a link; no quote given).

**Why the locator is a second implementation of the same normalization.**
`quoteAppearsIn` compares normalized strings (case, curly quotes, whitespace
runs). To mark the quote in the _original_ text the same transform is
re-done character by character with a map back to raw offsets
(`normalizeWithMap`), and a unit test asserts the two produce the same
normalized string on the awkward inputs. A verified quote that could not be
located is reported as such rather than drawn approximately; overlapping
spans keep the earlier one rather than drawing two ribbons from one passage.

**What it is not.** It is a view of the recruiter's own text and the check
already made. It does not fetch anything, it does not run a model, and it
does not turn an unsupported claim into a supported one by drawing a line.

## D-029 — Normalize around the composer, ledger the yield, never cache the rollup

**Decision.** (2026-09-05, Wave A.) Every caller of the validated composer
goes through one pre/post-normalization path
(`src/lib/domain/query-normalization.ts`, `prepareQueries`): vocabulary
de-duplication within and across tiers, profession-aware platform pruning
from the strategy's named channels, a 32-term budget on Google surfaces
resolved by re-composing with a sliced OR group, cross-surface
de-duplication by normalized text, and deterministic QA warnings. The
composer itself is untouched. Transformations that change what is
persisted are recorded on the row (`search_queries.qa_meta`); checks that
merely describe a string (parens, quotes, operators, budget) and channel
coverage are recomputed at render, so a recruiter edit is checked without a
write path and a warning never hides a string.

Discovery runs are recorded in `search_query_runs` — query text, engine,
and a result COUNT — and explicit saves carry the stored string's id only
when the text ran verbatim. An edited run is recorded but never credits the
stored string. Rollups (per string, per search, per normalized role title)
are live GROUP BYs, not a cached blob in `settings`.

**Alternatives.** (a) Trim over-budget strings at 32 words — rejected, it
silently changes the search. (b) Put the QA fixes inside `composeQueries`
— rejected by the root doctrine (do not redesign the validated composer).
(c) A `settings`-keyed cached rollup — rejected: single-user tables make a
GROUP BY cheaper than a cache-invalidation bug. (d) A taxonomy for role
families — rejected: `normalizeRoleTitle` collides only titles whose
tokens match after stripping seniority words, so a rollup is never shown
across roles a recruiter would not consider the same.

**Reason.** The CAIS judge graded the strings the weakest deliverable for
exactly these defects; hireEZ's opaque "AI match" is the competitor
complaint TalentOS answers with strings you can read, count and audit.
The ledger gives the pilot its own yield metric without persisting a
single result (product rule 2).

**Tradeoffs.** `countTerms` exists twice (app and artifact), held in
parity by a test. The mock discovery provider
(`TALENTOS_DISCOVERY_PROVIDER=mock`) exists only so the ledger can be
driven through the UI in e2e; it is watermarked and never configured by
default.

## D-030 — Review decisions calibrate the strings, deterministically, with a reason per term

**Decision.** (2026-09-05, Wave B.) The recruiter's accept / dismiss /
correct decisions on exact CV passages — across every candidate reviewed
for a search — reshape the String Lab vocabulary before composition
(`src/lib/domain/calibration.ts`, `deriveTermDecisions`), and every touched
term carries a reason the String Lab renders verbatim ("2 accepted anchors
across 2 candidates, 0 dismissed (R: Publication record)"). No model call.
The composer is untouched; calibration runs ahead of the D-029
normalization. Decisions are persisted per row on
`search_queries.calibration`, filtered to the terms in that row, and the
requirement ids they cite land on `search_queries.linked_requirement_ids`.
`composeDiscoveryQueries` gains a persisting caller
(`generatePlannedQueries`, "Compose from search plan") so the IR's own
`linkedRequirementIds` reach rows too.

**Thresholds** (named constants, tested): promote any-of → must-have on
≥2 accepted anchors across ≥2 candidates with no dismissal or
contradiction, only when a linked requirement is must-have and the ANDed
list is under the expansion prompt's cap of 3; demote must-have → any-of
on ≥2 dismissals with zero accepted; remove an any-of/credential only on
≥2 accepted **contradictory** anchors; flag on ≥2 dismissals (visible
only); add a term from an accepted quote only when the quote is ≤4 words,
≥3 characters, on a must-have or preferred requirement, at most 6 per
generation; add an exclusion only from an accepted `relevant` quote on a
`disqualifier` requirement. Titles are never touched.

**Alternatives.** (a) Feed decisions into the expansion prompt — deferred:
prompt changes need a corpus run to score, and the visible-reasons
differentiator comes from the deterministic path. (b) A side table for
decisions — rejected: single-user, read-only for display, and the
per-row JSON self-filters so a recruiter edit that removes a term removes
its reason. (c) Let a dismissal remove a term — rejected: "this passage
was not evidence" is not "this term is noise".

**Fair hiring.** Every candidate term and every reason passes
`scanTextForProtectedTraits` plus a contact/URL check; a hit is a visible
`blocked` decision and the term is never added. A short accepted quote
could still be a proper name; the ≤4-word rule and the visible, editable
reason are the mitigations, and the panel copy says so.

**Tradeoffs.** `loadCalibrationSignals` walks `reviewWorkspace` per
candidate (the same loop `review-shortlist.ts` already runs) — fine at desk
scale. Corrections are inferred from the note convention
`Corrected by connection <id>`; a first-class decision value is filed in
the backlog.

## D-031 — Vendor exports become ordinary candidates with a label; contact data is dropped unless kept, and then unverified

**Decision.** (2026-09-06, Wave D.) A hireEZ, LinkedIn Recruiter, ATS or
Heartbeat.ai export (CSV or JSON) is imported through a dry-run preview
and an explicit commit (`src/lib/imports/*`, `services/imports.ts`). Rows
become candidates through `createCandidate` with `candidate_sources.added_via
= "import:<source>"` and a human label. Mappers are allow-lists of header
aliases; headers matching `BLOCKED_FIELD_PATTERNS` or the new
`BLOCKED_IMPORT_HEADER_PATTERNS` are dropped before mapping and reported by
name; kept cells are scanned for protected-trait phrases as warnings. The
canonical row has no CV field, so nothing from a file can become
`resume_text` or a document version. Identity is resolved with the
conservative matcher ported to `domain/identity.ts`: a shared profile URL
defaults the row to skip, any other match creates a separate record plus
an `identity_review` task, and nothing is ever merged. Vendor email and
phone columns are dropped by default; on opt-in each value becomes one
`candidate_source_evidence` row with `provenance = "imported"`,
`verification_status = "unverified"` and the import date as
`retrieved_at`, so the existing human-only verification flip and the
"unverified" rendering apply. A Heartbeat NPI column becomes a link-out to
the official registry page labelled unverified (Wave E's prefill bridge).

**Alternatives.** (a) A CSV dependency — rejected: the format is small
and the private-build check is sensitive to lockfile churn. (b) Store
vendor contact data on the candidate — rejected: it is third-party data
with a documented ~30 % bounce profile and no vendor guarantee; evidence
rows carry provenance, a date and a verification state, candidate columns
do not. (c) Auto-merge on a shared URL — rejected by spec §12; the matcher
returns no merge instruction at all.

**Reason.** The competitive brief's stack: keep the data vendor, put
TalentOS on top. hireEZ's number-one complaint is contact accuracy; the
import says where the data came from and when, and never calls it
verified.

**Tradeoffs.** Vendor header names are best-effort guesses, so the preview
shows the detected mapping with per-header override and a generic mapper.
The server re-validates rows and re-scans keys on commit; the client never
decides safety. No import audit table or undo yet (backlog).

## D-032 — Registry-matched identity: a public record, picked by hand, labelled for what it is

**Decision.** (2026-09-06, Wave E.) The candidate page can query the public
CMS NPPES NPI Registry (`src/lib/registries/nppes.ts`) by name and state,
or by an NPI the Wave D import already linked, and show the records in the
registry's own order with the conservative identity matcher's strength
attached. The recruiter picks one; `confirmRegistryMatch` upserts a single
row per candidate and registry in `candidate_registry_matches` (migration 0007) holding an allow-listed snapshot — NPI, name, credential,
taxonomies, and the practice LOCATION city, state and office telephone —
plus a plain link-out to the official record. The surface label is
"registry-matched · CMS NPPES" with the explainer: identity and licence
taxonomy as recorded by CMS on the date shown; not how to reach them, not
whether they are currently licensed in a given state, not whether they
will respond; an NPI is not proof of licensure. The word "verified" is not
used (it is Findem's and Glider's word for assessment-time identity
checks, and the registry itself does not guarantee licensure).

**Boundaries.** Opt-in only (`TALENTOS_REGISTRY_NPPES=1`; "mock" for
tests); nothing calls out otherwise and the card links to the registry's
own search page instead. The client mirrors the one outbound-HTTP
precedent (D-010's discovery provider): injectable fetch, `configured`
flag, no call when off. The mapper picks fields explicitly and never
spreads the raw record, so mailing addresses, enumeration dates, other
identifiers and any demographic field the API returns cannot be persisted;
a fixture carrying all of them asserts none leak. A search never writes.
The artifact-side `npiAdapter` stays `wired:false` (D-021) until a live
request/response is observed and recorded.

**Alternatives.** (a) Sync taxonomy into `profile.licenses` on confirm —
deferred until profile strings carry provenance. (b) Auto-match on a name
hit — rejected by spec §12. (c) State boards, GMC/NMC, ABMS — link-outs
only: HTML forms, no public JSON, terms that restrict automation.

**Reason.** Heartbeat and hireEZ sell reachability and admit it decays;
nobody in the set sells verification of identity. A public registry record
the recruiter chose, with its date, is the one claim TalentOS can make
that they cannot.

**Tradeoffs.** Name splitting is naive for compound surnames — every
field is editable. NPPES sometimes answers HTTP 200 with an `Errors`
array; both paths are handled. Rate limits are unknown; one request per
click, limit ≤ 20.

## D-033 — Google has closed the Custom Search JSON API; discovery needs a new provider before Wave G

**Decision.** (2026-09-07, Wave P.) Recorded as a fact, not yet as a
choice of replacement. Google's Custom Search JSON API overview states the
API "is closed to new customers" and that existing customers "have until
January 1, 2027 to transition". The owner's account has no grandfathered
project: a 2026 project with the API enabled and a correctly restricted key,
and a 2024 project with the API enabled and an unrestricted key, both
answer `403 This project does not have the access to Custom Search JSON
API` on both engines (`a157d37906e1141cc`, `918bc00e18d0c46e5`). Verified
in the owner's Console on 2026-09-07 (`docs/PILOT-2026-09-06.md`,
"Discovery finding").

**What stands.** The composer (`composeQueries`), Wave A normalization,
the yield ledger, and the link-out boundary (D-010, D-026) are provider-
independent: they produce strings and record what a run returned. The
`talent-xray` discovery provider (`TALENTOS_DISCOVERY_PROVIDER`) is the
only piece that speaks to Google. BYOK as an economic model survives only
if the replacement provider also sells per-query keys to individuals.

**What is now false in the record.** The action plan's assumption that a
pilot recruiter can obtain a key in ten minutes (`docs/PILOT-RUNBOOK.md`,
Part A1) and the BYOK cost figures quoted from Google's price list. Wave G
("cost model and what we will not do") cannot be written against Google
pricing.

**Candidates for the replacement, unassessed.** (a) Vertex AI Search —
Google's named successor; 50-domain cap per data store matches the
two-engine split, but query syntax, `site:` semantics and per-query
pricing for individuals are unverified. (b) A general web-search API with
domain filtering (Brave, Bing successor, SerpAPI-style resellers) — the
composer's boolean output would need a compatibility check per provider.
(c) Link-out only: compose the string, open it in the recruiter's own
browser on a public search engine, record nothing but the string and the
owner's explicit saves. (c) already satisfies every hard product rule and
needs no key; it loses the yield ledger's automatic counts.

**Alternatives rejected today.** Mocking discovery for the pilot (the
runbook forbids it; a pilot on fixtures is not a pilot). Scraping any
search results page (D-010; the product rules).

**Reason.** The finding was made by probing, not by reading a changelog;
it changes the pilot's close condition and the shape of Waves F and G, so
it needs a numbered record the next wave prompt can cite.

**Tradeoffs.** Nothing is built on the finding yet. The date is what makes
it urgent: any pilot recruiter who already has access loses it in sixteen
weeks.

## D-034 — Discovery is link-out to the engines' own hosted results page; the app records a count and explicit saves

**Decision.** (2026-09-07, after D-033.) Candidate discovery opens the
composed string on the Programmable Search Engine's hosted results page,
`https://cse.google.com/cse?cx=<engine>&q=<string>`, in a new tab
(`buildHostedEngineUrl`, `src/lib/research/talent-xray.ts`). The app never
reads that page. The recruiter records what they saw — the result count
shown at the top of the page, and the profile URLs they chose to keep, one
per line with an optional `| Name` to create a candidate — and
`recordLinkOutRun` (`src/lib/services/discovery.ts`) writes exactly the
rows the JSON API path wrote: one `search_query_runs` row with the count,
one `research_sources` row per kept URL labelled `talent-xray:<engine>`,
and `candidate_source_evidence` (unverified, provenance `search_result`)
when a candidate is created. Yield (D-029) rolls up identically; an edited
string is recorded and never credited (Wave A). No key, no cost, no new
terms. Tested live in the owner's browser on both engines on 2026-09-07
(`docs/DISCOVERY-PROVIDERS-2026-09-07.md`).

**Why this page.** Google's 2026-01-20 announcement keeps the Search
Element free for engines that use "Sites to search" with 50 or fewer
domains; both Talent X-Ray engines are such engines with "Search the
entire web" off. Only the JSON API and "entire web" end on 2027-01-01.
The composer's string goes through verbatim — quotes, `OR` groups,
`-` exclusions, `site:` with a path — and the 102-pattern corpus stays,
because the engine applies it, not the query.

**Boundaries.** The JSON API provider stays in the code for grandfathered
customers and for the mock in tests; the Discover page shows "Run search"
only when one is configured and never gates the page on it. A result
count is a number, not a result (D-029). A pasted URL is an explicit save
(product rule 2). The hosted page is ad-supported on the free tier;
LEGAL.md Q3 already tracks that nothing may suppress or restyle those
ads, and nothing here touches the page.

**Alternatives.** Vertex AI Search — blocked by Google Cloud Service
Specific Terms §21 ("web domains that it owns or is authorized to
utilize") and it drops exclusions and `site:` paths. SerpAPI — takes the
string verbatim by scraping Google result pages, which the product rules
forbid the app to do and which paying a third party does not change.
Brave — the only first-party index with boolean operators and a domain
allow-list ("goggles"); needs a compile step for parentheses and `site:`
paths and a recall test; kept as the API candidate for when automatic
yield counts are worth $5 per thousand queries. Bing — no longer a search
API. Public engines by link-out — lose the corpus. Details and sources in
`docs/DISCOVERY-PROVIDERS-2026-09-07.md`.

**Reason.** It is the only option that satisfies all five criteria today
(composer unchanged, corpus kept, link-out only, free to an individual,
no forbidding clause), and it needs a link and a form rather than a
provider.

**Tradeoffs.** The app cannot count results or dedupe across strings by
itself; the recruiter types the count and pastes the URLs, so yield
numbers are self-reported. Saves lose the engine's snippet and rank
(no `providerRank`, no snippet), which is a loss of evidence context, not
of evidence: the recruiter opened the page. The hosted page's own future
past 2027 is not named in Google's announcement; the Element it is built
on is described as retained.

**Follow-ups.** Profile connections (the owner's ask of 2026-09-07 for
every public profile a person has) are designed separately and recorded
as D-035 when the design is accepted. Wave G's cost model must be written
against this decision, not Google's JSON API pricing.

## D-035 — Profile connections are provenance-labelled addresses, kept one at a time, confirmed by the person or by a named platform, never merged

**Decision.** (2026-09-07, Waves H and H2, after D-034.) A candidate's
profile connections are rows in `candidate_sources`, each carrying a
closed-enum `provenance` (`recruiter_added`, `imported`,
`candidate_provided`, `platform_declared`, `platform_reciprocal`,
`registry_match`), the party that asserted the address (`assertedBy`), the
platform's own timestamp when it has one (`assertedAt`), the date any
structured API was read (`retrievedAt`), the date and channel of the
person's confirmation (`confirmedAt`, `confirmedVia`), the row it was read
from (`originSourceId`), and the recruiter's own note on why they believe it
is the same person (`whyNote`). One function, `profileLinkLabel`, renders
every label. Every non-registry, non-confirmed badge begins with
"unverified"; "confirmed by the person (recorded by you)" renders only with
a date; the bare word "verified" appears only inside `registry-matched · CMS
NPPES`, which names its registry (D-032, product rule 7).

**Surfaces.** A URL's family is computed at read time against the two
engines' own 102 patterns and never stored, so a corpus correction relabels
every row at once. Professional, scholarly/registry, review and
`unrecognised` are on; contact-aggregator, broadcast, personal-life and
document are off per search until a written reason (20–400 characters,
scanned for protected characteristics) is stored on the project.
`unrecognised` — a host outside the corpus — is saveable but never an
identity signal and never shown to a model, because a developer's own domain
and a faculty page are the most valuable links a sourcer finds and refusing
them would be absurd.

**How addresses arrive.** Paste (many lines at once), browser-companion
capture, Discover's `| +Name` attach, one of six per-candidate sweep
searches opened on the hosted engine page, the person's own answer to a
confirmation message, and — behind an opt-in flag, one person per click —
the links a person listed on GitHub or ORCID, proved on Keybase, or that a
volunteer recorded on Wikidata. Every one of those paths calls
`enforcePolicyForSave` first.

**Boundaries.** No page is fetched, crawled, scraped, unfurled or
favicon-ed. No result list, page title, bio, image URL or follower count is
stored; a schema test pins the column set. No profile URL is generated from
a name or a LinkedIn slug. A denied address is deleted and suppressed, and
the suppression outlives the record it was about. `findIdentityMatches` is
unchanged; URLs are filtered by family before they reach it; a shared
matchable address opens a review task and nothing merges — the answer to a
duplicate is moving the row intact to the right record. Only professional
and scholarly/registry addresses reach any model, as bare URLs. Nothing
ranks, scores or counts links as a signal. The app sends nothing: the
confirmation message is copied by hand and "sent" is a recruiter's
statement, recorded with a date.

**Alternatives.** A machine-merged unified profile, as every vendor in the
research ships — rejected: the matcher suggests, a human decides. A separate
`profile_links` table — rejected: it would split identity URLs, export,
deletion and the companion's saved list. A stored surface-family column —
rejected for the relabelling reason above. Treating unknown hosts as
personal-life — rejected after the design review: it would have gated the
best links behind a written reason. Refusing a cross-candidate duplicate —
rejected: it makes the review task unreachable and inverts Wave D's rule.
Handle-pivot URL guesses — designed, costed and left unbuilt as the owner's
call, because the legal research argues against generating addresses.

**Reason.** The owner asked for as many profile connections as possible. Of
28 candidate sources checked against their own documentation, 16 survived
verification and only four hand back several of a person's addresses in one
call, each covering a different kind of person; the rest are closed by their
own terms. So the count this product can reach honestly is lower than an
aggregator's for clinical and sales roles and comparable for software and
research. What none of the vendor documentation read in this research
describes is source, date and confirmer per link, a refusal to merge without
a human, and the person's own answer. Those are what this builds.

**Tradeoffs.** Fewer links per person than an index where no API exists. The
strongest tier depends on people replying, which nobody has measured. Yield
and sweep counts are typed by the recruiter. A corpus correction can move an
old row into an off family. LinkedIn User Agreement §8.2 and GitHub AUP §7
remain open lawyer questions, recorded rather than assumed away; URL-only
capture is the conservative reading, not a resolution. ORCID's Public API is
non-commercial by its terms, so that adapter stays off until the owner
answers the licence question. Whether recruiters prefer accountability to
count is the trial that has not been run, and no comparative sentence is
written anywhere until it is (rule 9).

## D-036 — A session handoff is a waiting state, never an error; every research request in a run is written in one pass

**Decision.** (2026-09-07.) `act()` (`src/lib/actions/helpers.ts`) maps
`SessionFulfillmentPendingError` and `ResearchPendingError` to a distinct
result kind, `"pending"`, carrying the request and response paths.
`GenerateButton` renders that as a neutral waiting panel naming the file to
hand to a Claude session, with the instruction on a copy button; the red
error block is reserved for actual failures. `pnpm outbox` lists every
unanswered request with what it asks for and where the answer goes, and
prints one request in full when given its name. `researchAudience`
(`src/lib/services/research.ts`) now attempts every unanswered query even
after one goes pending, so a run writes all of its request files in one
pass and throws a single `ResearchPendingError` naming the count.

**Alternatives rejected.** Leaving the red block and improving its wording —
rejected: the colour is the message, and the owner had already concluded
from it that evidence alignment and outreach were broken features. Blocking
the button until the outbox is empty — rejected: the request cannot exist
until the button is pressed, because its hash covers the prompts. Auto-
fulfilling from inside the app — rejected: that is an API call, which is the
thing this install does not have. Batching research into one request file —
rejected: the hash is per query, and a shared file would lose the
idempotent reuse that makes re-runs free.

**Reason.** The owner asked why evidence alignment and outreach did not
work. They did work. Running both against candidate
`cb31644a-6741-4844-8d92-aa72ba3024b0` produced `SessionFulfillmentPendingError`
and `ResearchPendingError` — the handoff, not a fault. Outreach compounded
it: research, then personas, then the sequence, each a round trip, and the
research stage threw on its first unanswered query so the remaining ones
were never written. Answering one file and re-running met the next one.
Four queries meant four cycles. After this change, one.

**Tradeoffs.** The waiting state is still a wall for anyone who does not
have a Claude session to hand; it explains the wall rather than removing it.
Answering a research request changes the context of the generations
downstream of it, so their hashes change and they ask again — correct, and
still surprising the first time. `pnpm outbox` reads request files written
by this app only; it is not a general queue.

## D-037 — The command menu opens on "/" and holds every page, search and person

**Decision.** (2026-09-07.) `CommandBar` (`src/components/command-bar.tsx`)
opens on a bare `/` as well as Cmd+K. `/` is ignored while the caret is in
an input, textarea, select or contenteditable, so typing a slash into a
Boolean string or a note still types a slash. The menu lists, grouped and in
a fixed order: every module of the search you are in, the app's own places,
every other search, and every person on file with the search they belong to.
People reach the menu through the shell (`src/app/layout.tsx` →
`AppShell` → `CommandBar`). Every search module also carries a collapsed
`ConnectedStrip` (`src/components/connected-strip.tsx`) listing the search's
own records, each linking into the graph.

**Alternatives rejected.** A second, inline "/" menu inside text fields, in
the Roam sense of inserting a block — rejected: this app has no block
editor, so there is nothing for an inserted command to attach to. Adding the
missing routes to the sidebar — rejected: that is more navigation, and the
owner asked for less. A separate backlinks page — rejected: a page nobody
opens is not a connection.

**Reason.** The owner asked for a "/" command dropdown and, separately, for
every page to connect to all pages, and, separately again, for the platform
to be simplified. Those are the same request. Twenty-six pages reachable
only through nested navigation is the complexity; a menu that reaches any of
them in two keystrokes is the simplification, and it costs no screen space.

**Tradeoffs.** People are loaded into the shell on every page render. That
is a local SQLite read of names and ids and is fine at this size; it would
need a bounded query or a fetch-on-open at a few thousand people. The strip
runs `knowledgeGraph()` for every module page, which is the same projection
the graph page already builds — measured as acceptable locally, and the
first thing to make lazy if a page feels slow.

## D-038 — The graph is a settled force layout, computed deterministically

**Decision.** (2026-09-07.) `settleGraph`
(`src/lib/core/graph-layout.ts`) places records under pairwise repulsion,
springs along edges and a weak pull to the centre, from initial positions
hashed from each record id, over a fixed 600 iterations. No randomness and
no animation frame loop, so the same graph draws the same picture every
time. The picture adds zoom, pan, drag-to-pin, node size by number of
connections, and neighbourhood highlighting on hover. A dragged record stays
exactly where it was dropped.

**Alternatives rejected.** A force-graph library — rejected: a dependency
for eighty lines of arithmetic, and the artifact build inlines everything.
An animated simulation — rejected: it looks alive and cannot be asserted on;
a settled layout can. Keeping the ring layout and adding colour — rejected:
the ring drew every graph the same shape, so a hub with twenty leaves and a
chain of twenty were indistinguishable, which is the thing the owner was
looking at when they called it basic.

**Reason.** The graph existed but expressed nothing about structure. Putting
the selection in the middle and everything else on evenly spaced rings is a
list drawn as a circle. Under a force layout a hub sits in the middle of its
own spokes because it is a hub, and that is asserted in
`tests/unit/graph-layout.test.ts` rather than eyeballed.

**Tradeoffs.** The simulation is O(n²) per iteration, run 600 times; fine to
about sixty records, which is the cap the picture already applies, and it
would need spatial partitioning above that. A chain curls into a horseshoe
rather than a straight line, which is normal for this family of layout and
was mistaken for a bug once already. Pinning is per session and is not
stored.

## D-039 — A tag is a word in a sentence, not a row in a table; the page is everywhere it was written

**Decision.** (2026-09-07.) A tag exists because somebody wrote `[[a phrase]]`
or `#a-word` in prose. `src/lib/core/tags.ts` parses the three forms
(`#word`, `[[phrase]]`, `#[[phrase]]`) to one slug; `src/lib/services/tags.ts`
scans six named free-text columns — a search's notes and business objective,
a person's notes, a learning, a profile address's why-note, and a channel's
reason and note — and `/tags/[slug]` lists every mention grouped by kind,
with the sentence each was written in and the tags written alongside it.
Typing `@`, `#` or `[[` in a tag-aware textarea recalls the tags that exist
and offers a new one as the last row. `#` and `[[ ]]` inside a URL or inline
code are not tags. A word matching the fair-hiring patterns never becomes a
page, whoever types it: the text saves verbatim, no link is made, and no page
exists. The model can propose tags from a person's own material
(`candidate-tags` task), each carrying the words that justify it; keeping one
appends it to the notes, so an accepted suggestion is a word in a sentence
like any other.

**Alternatives rejected.** A `tags` table with a join to candidates and
searches — rejected: it needs a migration, and it makes the tag an object
that can disagree with the text that produced it. Auto-applying model tags —
rejected: a tag nobody chose is a label, and the evidence is what the
recruiter is actually judging. A separate tags field on the candidate —
rejected: a tag without the sentence around it cannot be checked. Silently
rewriting a blocked word — rejected: the recruiter's text is theirs; the
product declines to make a page, it does not edit prose.

**Reason.** The owner asked for Roam and Athens semantics by name, and for
tags to connect jobs and candidates. Both fall out of one mechanism: the
same word written on a search and on a person puts them on one page. There
is no matcher, no join table and nothing to keep in sync — which also answers
the question left open on 2026-09-07 about whether a derived tag can be
removed by hand. It is a word. Delete it.

**Tradeoffs.** The index is a full scan of six columns on every render. At a
local database's size that is cheaper than a cache and cannot go stale; it
would need an index at tens of thousands of records. Two people can write the
same idea two ways and get two pages, which is why the suggestion prompt
insists on reusing an existing word and why the recall menu shows use counts.
A tag written in a column outside the six is not seen; adding a column is a
deliberate act, not a sweep.

## D-040 — People search over public, licensed APIs: query live, link out, store nothing

**Decision.** (2026-09-07.) `src/lib/research/open-index/` searches for
people through four official APIs, each read for terms before its adapter was
written: **Wikidata** (CC0, keyless, `haswbstatement:P31=Q5` to constrain to
humans, second call for labels), **OpenAlex** (topic and institution resolved
to ids first, then authors sorted by works count), **Crossref** (authors out
of works, one row per person, keyed on ORCID where there is one), and
**GitHub** (`type:user` mandatory, off unless the owner enables it). Sources
are off until `TALENTOS_OPEN_INDEX` names them, one at a time, because each
carries its own licence question. The spec is derived from the canonical
intelligence the search already holds, shown with its provenance, and is
editable; every request URL is rendered before it is called. Nothing is
stored: keeping a row is the existing explicit `saveDiscoveryResult`, so an
open-index save lands in the same yield ledger, labelled unverified, as a
link-out save.

**Refused after verification, with the reason.** **ORCID** — the Public API
terms limit use to non-commercial purposes and bind anonymous callers; this
also answers the licence question left open in Wave H2, in the negative.
**Semantic Scholar** — a second, live licence at `api.semanticscholar.org/
license/` declares it governs all API use and prohibits "embedding or
installing the API into products for Licensee's own commercial gain".
**DBLP** — matches author names only, so it cannot answer a sourcing
question, and its hosts now answer the API with a proof-of-work interstitial.

**Alternatives rejected.** Caching any of it into a local index — rejected:
OpenAlex's terms of service (15 Aug 2026) bar redistribution and assert
database ownership, so the product's own rule against bulk-persisting results
is what makes the source usable. Sending the whole spec to each source in one
query — rejected after measuring: six ANDed words returned nobody from
Wikidata where three returned 267, and GitHub's combined query returned zero
where each half returned hundreds. Each source now asks two or three short
questions and merges. Filtering OpenAlex on an institution alone — rejected:
it returns a staff list, and did, returning particle physicists for a search
about interpretability. Using whatever topic the API resolves — rejected:
"research engineer" resolved to "Tribology and Lubrication Engineering", so a
topic is used only when its own name repeats a real word from the term.

**Reason.** The owner asked for sourcing that is not a Google engine and not
an excuse. This is the part that is genuinely winnable under the product's
rules: not raw coverage, which an index built by crawling will always win,
but people who can be found by what they have actually done, each traceable
to a named public record under a licence that permits this use. For research,
clinical-academic and open-source populations it finds people a hosted
engine's page-level search does not.

**Tradeoffs.** Coverage is the population each source covers and no more:
nobody who has not published, committed or been written about is here, which
excludes most commercial roles. Crossref cannot tell two authors with one
name apart without an ORCID and says so on the row. GitHub location is
self-typed and often a joke. Wikidata's CC0 waives copyright, not anyone's
data-protection rights, so a person found here carries the same notice duty
as any other (D-035). Crossref's CORS behaviour is observed, not documented,
so every adapter sits behind an interface that can move server-side. Nothing
here has been trialled against an aggregator, so no comparative claim is
written anywhere (rule 9).

## D-041 — Twenty-one tabs become four phases; nothing is removed

**Decision.** (2026-09-07.) `WorkspaceNav` groups the search modules into
four phases — Understand, Find, Engage, Decide — and shows only the current
phase's modules, with a line saying what the phase is for. No route changed
and no module was deleted. Crew leaves the nav because watching background
work is an instrument, not a step in a search; it is still reachable by name
from the command menu. Every end-to-end spec goes through one helper
(`tests/e2e/helpers/nav.ts`) that selects the phase and then the module, so
the grouping lives in one place.

**Alternatives rejected.** Deleting `/crew`, `/diagnosis` and `/guide` — the
earlier suggestion, and wrong on two of the three: diagnosis answers why a
search is stuck and guide answers what to do next, which are recruiter
questions, not developer ones. Keeping one row and adding separators —
rejected: cosmetic. Hiding modules until a phase is "complete" — rejected: it
decides for the recruiter what order the work happens in, and real searches
do not go in order.

**Reason.** The owner said the platform is over-elaborate, and then said they
did not follow the proposal to retire three pages. They were right not to:
the problem was never which three pages to delete. It is that twenty-one flat
tabs on every page are a list of everything the software can do rather than a
shape for the work, and nothing in that row tells you where you are. Four
phases with five modules each is the same software with a shape. It works
because the "/" menu (D-037) already reaches anything from anywhere, so the
nav no longer has to.

**Tradeoffs.** A module in another phase is one extra click for someone who
knew the old row by heart. The phase a module belongs to is a judgement —
Knowledge graph sits under Find because that is when it is used, though it
describes the whole search. Overview is the fallback phase, so an unmatched
route lands on Understand rather than erroring.

## D-042 — Neo4j is optional, and what it buys is a graph that spans every search

**Decision.** (2026-09-07.) `src/lib/graph/` holds a Neo4j store: driver,
schema, sync and queries. It is off unless `NEO4J_URI` and `NEO4J_PASSWORD`
are set, and nothing in the product needs it — the graph is still derived
from SQLite and every traversal still runs in process. What Neo4j adds is
reach: `pnpm graph:sync` pushes every search into one graph, so "every search
and person carrying this word" becomes a single query. Nodes carry `:Entity`
with a unique id plus their own label; MERGE runs against the static label
because Neo4j's own documentation warns that matching on a dynamic label
plans badly. Relationship types come from a fixed allow-list, because a
relationship type is part of the query rather than a parameter. Verified
against `neo4j:2026.07.1` on the owner's machine: 15 searches, 277 nodes, 277
edges, and the cross-search tag query returns both the job and the person.

**Alternatives rejected.** Making Neo4j required — rejected: it is a 1.1 GB
container behind a product whose selling point is local-first, and the
derived graph has no durability requirement because it rebuilds from SQLite
in one pass. Moving the traversals into Cypher and deleting the TypeScript —
rejected for the same reason: the in-process versions are tested, dependency-
free and faster than a network round trip at this size. `neo4j-driver` —
rejected for `neo4j-driver-lite`, same version and API without the RxJS
dependency for a reactive API this never uses. Leaving the driver's lossless
integers on — rejected: they serialise as `{"low":n,"high":0}` and fail
silently across a server-component boundary.

**Reason.** The owner asked for it, and the honest case for it is narrower
than the ask but real: the tag design (D-039) already points outside a single
search, and a per-search projection cannot answer a question about all of
them. That is the crossover, and it is not a node count.

**Tradeoffs.** A second store to keep in step, kept in step by rebuilding
rather than by writing to both. Hop bounds cannot be parameters in Cypher, so
`withinQuery` clamps an integer and interpolates it. `shortestPath` refuses a
pattern whose ends can be the same node, so every such query carries
`WHERE m <> start` — found by running it, not by reading about it. Community
Edition is GPLv3: running it is unconditionally permitted commercially, but
bundling it into a distributed artifact would be a different question.

## D-043 — Everything is a page; @ recalls people, jj recalls jobs

**Decision.** (2026-09-07.) A tag, a person and a job are all pages, written
the same way: `[[a name]]`. The three recall triggers differ only in what the
menu offers — `#` and `[[` offer every page, `@` offers people, `jj` offers
jobs. A person or job always comes back in bracket form; a single-word tag
keeps its hash. `listPages` is the one list all of them read.
`/tags/<slug>` resolves: a slug matching a record shows that record's page
with a link into it, and an unmatched name is a page nobody has filled in
yet, not an error. `jj` is two letters so it can be typed mid-sentence
without a modifier, and it only fires at a word boundary so "hajj" is a word.

**Alternatives rejected.** A separate syntax per kind (`@person`, `+job`) —
rejected: it makes a note know what kind of thing it is naming, and Roam's
insight is that it does not have to. `@` writing an `@name` reference —
rejected: an email address in prose would become a link.

**Reason.** The owner asked for exactly these hotkeys. One syntax with three
filters is what makes daily notes work: writing `[[Christopher Toler]]` in
today's note puts today on his page, without deciding in advance whether the
note is about a person, a job or an idea.

**Brackets close themselves.** Typing the second `[` inserts `]]` and leaves
the caret between the pairs, so `[[` reads as a command to make a page rather
than as two characters of punctuation — Roam's behaviour, and the reason it
feels like one. Typing `]` steps over a bracket already there instead of
doubling it; backspacing out of an empty `[[]]` removes all four, so an
abandoned reference never litters a note; and choosing a page consumes the
waiting `]]` rather than leaving `[[name]]]]`. `#` opens the same every-page
menu and creates a page the same way: a single new word is written `#word`,
a new phrase `[[a phrase]]`, because a hash cannot carry a space.

**Tradeoffs.** Two records with the same name collide on one slug; the first
match wins and the page shows it. A tag whose name later matches a new
person's silently becomes that person's page. Auto-closing is driven by key
events, so a paste or a programmatic insert does not trigger it — correct for
a paste, and the reason a browser test has to press keys rather than type.

## D-044 — Daily notes are half written and half read

**Decision.** (2026-09-07.) `/daily/<YYYY-MM-DD>` is a page per day. The top
half is one free-text note stored under a `daily:<date>` settings key — no
migration, the same pattern as the graph's manual links. The bottom half is
not written by anyone: `dayEvents` reads back what the records say happened
that day — a job opened, a person added, a stage moved, an address kept, a
learning recorded. A calendar marks the days with something on them.

**Alternatives rejected.** A notes table — rejected: a migration for one
string per day. An empty journal page — rejected: a day is never actually
empty, the work left a trail, and a blank box on a busy day is a lie about
what happened.

**Reason.** The owner asked for Roam's daily notes off the calendar, based on
candidates and jobs. Reading the trail is what makes it based on them rather
than a diary that happens to live in the same app.

**Tradeoffs.** Day boundaries use the machine's timezone against timestamps
stored in UTC, so work near midnight can land on the neighbouring day. The
event list scans five tables per day; fine locally, and the first thing to
index if a day ever feels slow.

## D-045 — Hover previews and sliding panes

**Decision.** (2026-09-07.) Hovering a page reference shows a card after
320ms with what the page is, how many things point at it and the first
mentions; results are cached per slug and the card never opens where hovering
does not exist. Shift-clicking a reference opens it as a read-only pane
beside the work instead of navigating, and panes live in the URL
(`?panes=a,b,c`) so a trail is shareable and survives a reload. A pane links
to the real page for editing.

**Rebuilt on 2026-09-07, after the owner named the references.** The first
version was a fixed rail of at most four read-only cards, which is a sidebar,
not a stack. It is now the pattern from Andy Matuschak's notes and azlen's:
unlimited panes, horizontally scrolled, each `position: sticky` at
`left: index × 40px` with a rising z-index, so panes you have walked past pin
to the left edge and collapse to a spine with the title running vertically —
still visible, still clickable. Opening from pane _i_ truncates everything
beyond _i_ before appending, and the origin wins over an already-open page
further along: from `a`, opening `c` gives `a → c`, not `a → b → c`, because
keeping `b` would leave a pane on the trail the trail no longer goes through.
The rail is sized to its content rather than the viewport, so two open panes
leave the work behind them visible.

**Alternatives rejected.** A preview on every link — rejected: the card is
for page references, where "is this worth opening" is the actual question. A
button beside each reference to open a pane — rejected: references sit inside
sentences and a button per reference makes prose unreadable. Pane state in
memory — rejected: the back button and a reload would both lose the trail.
A cap of four — rejected on the owner's word and on reflection: a cap turns a
trail into a queue, and the spine collapse is what makes an uncapped stack
readable in the first place.

**Reason.** Asked for directly, and both earn their place: a densely linked
note is unreadable if every link is a gamble, and a trail of thought is the
thing a single-pane app destroys every time you click.

**Tradeoffs.** A pane is read-only; its header links to the real page, which
is where editing happens. Each pane fetches its own content, so a long trail
is a request per pane, cached by the browser. On a narrow window a few panes
cover the work behind them, which is what the spines are for.

## D-046 — The end-to-end check writes to its own database

**Decision.** (2026-09-07.) `pnpm smoke` sets
`TALENTOS_DATABASE_PATH=./data/smoke.db` itself rather than relying on the
caller to remember, and `pnpm purge:search` deletes a search and everything
under it after taking a timestamped backup.

**Reason.** The check's own documentation said to point it at another
database, and running it without that put five "Smoke — …" searches and
fifteen invented people into the owner's real work, where they sat in the
sidebar next to real searches. A check that can damage the thing it checks is
misconfigured by default. Removed with `purge:search`: 5 searches, 540 rows.

**Tradeoffs.** `purge:search` is real deletion. It backs up first and prints
where, but a backup nobody knows about is not a safety net, so the path is
the first line of its output.

## D-047 — The daily briefing explains itself, because the product's job is to make a good recruiter

**Decision.** (2026-09-07.) `/daily/<date>` opens with three panels above the
note. **Progress**: what moved, counted by kind, with one sentence comparing
today to yesterday — and an honest sentence when nothing moved rather than a
row of zeroes. **Reminders**: follow-ups and tasks past their date, plus the
one deadline that is a legal duty rather than a preference — a person whose
details are held who has not been told (D-035) — sorted by how late, because
the thing you are furthest behind on is the thing to do first. **What to do
next**: the deterministic rules engine run across every open search, each move
carrying `why` and `good` from `src/lib/domain/coaching.ts`, behind a "Why
this is the next thing" disclosure. A craft note rotates daily.

Three caps on the suggestions, each for a way the list goes wrong: two per
search so one neglected search cannot fill the day; two per kind of move,
because a workspace holding six barely-started searches otherwise offers
"extract role intelligence" six times and buries the search with people in
it; eight overall, because a list nobody finishes is a list nobody starts.
Within a priority, searches with people, strings and sent outreach rank above
searches nobody has begun.

**Alternatives rejected.** Generating the briefing with a model — rejected:
it would need a key, it would say something slightly different every morning,
and none of it can be traced to a row. Everything here is derived and can be
pointed at. Reminders as a stored queue — rejected: a queue drifts from the
records that produced it. Coaching text held per rule inside the rules engine
— rejected: the engine decides what to do, and mixing why into it makes both
harder to change.

**Reason.** The owner's stated purpose for the product is that it "should
guide anyone to the extent anyone can source and recruit efficiently and
successfully". A list of tasks does not do that; it tells an expert what they
already know and tells a beginner nothing. A list of tasks that each explain
the craft reason — that an unanswered intake question becomes a sourcing
assumption you discover when the third shortlist is rejected — teaches
someone how to decide tomorrow. That is the difference between a tool and a
guide, and it is the reason the `why`/`good` pair is required rather than
decorative; a test asserts every entry has both.

**Tradeoffs.** The coaching text is opinionated and written by one hand;
some of it will be wrong for some markets, and it is plain prose in one file
precisely so it can be argued with. The briefing rebuilds a snapshot per open
search on every render, which is fine locally and is the first thing to cache
if the page ever feels slow. The craft note rotates by date hash, so it is
not adaptive — it does not know what you already read.

## D-048 — The product has a voice, and rules that stop it costing anything

**Decision.** (2026-09-07.) `src/lib/domain/voice.ts` defines the character —
quiet, dry, a nerd about the craft, sells by being right about a specific
detail rather than by enthusiasm — as five rules in priority order: candid
before charming; specific before general; dry and rarely; never at anyone's
expense; silent when it is serious. `SERIOUS_SURFACES` names where the voice
goes flat: a person's data, the duty to tell someone their details are held,
a refusal, an error, anything a candidate could read, and licence text.
`BANNED_WORDS` lists what would make this sound like every other product.
`EMPTY_STATES` carries the copy. `tests/unit/voice.test.ts` holds the line:
the product's own copy is scanned, the serious modules are scanned, and every
empty state must say something concrete rather than only apologise.

**Alternatives rejected.** Personality as a tone note in a style guide —
rejected: nobody reads it and it decays into an exclamation mark in an error
message within a month. Humour everywhere — rejected: a product that is funny
on every screen has a personality disorder, not a personality. A cheerful
voice — rejected outright: the entire value of this product is that it does
not overclaim, and cheerfulness is overclaiming with better manners.

**Reason.** The owner asked for candid, friendly and witty — "a quiet
salesman type that's a nerd who happens to be a talent genius". That
character is unusually well matched to the product's constraints: someone
understated who knows a specific true thing is exactly who should deliver a
system whose selling point is showing its working. The risk is that a
personality erodes the honesty, so the rules are code and the code is tested.

**Tradeoffs.** The copy is written by one hand and some of it will land
badly; it lives in one file so it can be argued with in one place. The banned
word list is blunt — a legitimate use of "seamless" would be refused, which
is a price worth paying.

## D-049 — A search is a job: unique title, then location

**Decision.** (2026-09-07.) The workspace calls them jobs, not searches, in
every user-facing label — the sidebar, the list page, the command menu
groups, the "create" action. A job's title is typed by the recruiter and must
be unique across the workspace, case- and punctuation-insensitively; the
refusal names the job already using it rather than saying "already exists".
A job is always shown with its location, and a job with no location says
"Location not set" rather than a dash. The URL stays `/searches/…`.

**Alternatives rejected.** Generating the title from company and role —
rejected: "Founding Recruiter" at two companies is two jobs, and only a
person can write "Senior Engineer (Payments, the one Priya asked for)".
Allowing duplicates — rejected: the title is how a job appears in a list, in
the recall menu and inside `[[a title]]` in a note, so two identical ones
make all three ambiguous. Renaming the routes — rejected for now: it would
touch every link and every test for a word the user never sees, and the
label is what they read.

**Reason.** Asked for directly, and the reasoning holds: a recruiter has
jobs, not searches. Location earns the second line because it separates two
jobs faster than industry or seniority does.

**Tradeoffs.** The URL and the code still say "search", so the vocabulary is
split between what the user reads and what a developer types — recorded here
rather than left to be discovered. Existing duplicate titles are not
retro-fixed; the rule binds the next create or rename.

## D-050 — A job's offer is fields, not a sentence

**Decision.** (2026-09-07, with an explicit instruction from the owner to add
the columns; migration `0010_job_offer_fields.sql`, generated, reviewed and
run against a backed-up database.) `search_projects` gains `fte`,
`salary_min`, `salary_max`, `salary_currency`, `salary_period`, `openings`,
`priority`, `sponsorship` and `target_start_date`.
`src/lib/domain/job-fields.ts` holds the choices; every field with a fixed
set of answers is a dropdown, and every list ends at "Not decided yet".
The new-job form is grouped — what the job is, where it is, the offer, how it
is being run — because eighteen fields in one column is a wall. Stored values
always render through `labelFor`, so a record never shows a raw enum, and an
unrecognised stored value is shown rather than hidden, because it is still
somebody's data.

**Alternatives rejected.** Free text, as it was — rejected: a job typed
"Permanent, full-time" and another "perm FT" cannot be compared, and
comparing is most of what a list of jobs is for. One `compensationNote`
string — rejected: a band cannot be filtered, and a part-time role stays a
sentence somebody has to read. Required fields — rejected: a form that
forces a choice before the recruiter knows one collects guesses, which is
why the salary group says so out loud.

**Reason.** Asked for directly. The deeper reason is that these are the
fields a recruiter compares jobs on, and until now none of them was
comparable.

**What is deliberately absent.** Nothing here describes a person.
`sponsorship` is an attribute of the employer's offer — it decides which
markets a job can be sourced in at all — and a test asserts that no option
in any list matches the fair-hiring patterns.

**What it broke, and what that says.** Turning `industry` from a text input
into a dropdown broke four end-to-end specs that were typing into it, and
renaming the create button broke thirteen more. Both were caught by the
gates and both were the tests being right. Worth recording because it is the
argument for having them: a vocabulary change is not a cosmetic change, and
nothing else in the process would have found every caller.

**Tradeoffs.** A fixed industry list will not fit every job; the specific
words belong in the job description, which is what a model reads anyway. Jobs
created before this have empty values and read "Not decided yet", which is
true. The migration is additive and nullable, so nothing existing changed.

## D-051 — HSAL reaches the daily briefing; a person's data still does not

**Decision.** (2026-09-07.) `src/lib/services/hsal-briefing.ts` reads the
beliefs bound to each open job's decision case and surfaces the ones nobody
has revisited in a fortnight, as a panel on the daily page. The wording is a
nudge, never a correction: it says how sure you were and how long ago, and a
test asserts it contains neither "should" nor "wrong", because in HSAL the
confidence belongs to the human and only the human moves it.

Every way HSAL can be absent — unconfigured, unreachable, nothing bound, a
case that errors — returns an empty list and throws nothing. Tests cover
each. HSAL adds; it is never a dependency of anything.

**Still refused: identity beliefs.** The richest fit — a belief per candidate
that these profile URLs are one person — stays unbuilt, and not for want of
effort. HSAL is append-only and has no redaction or deletion path, while
`LEGAL.md` §5 promises any person can have what is held about them deleted
and `deleteCandidate` honours that today. The moment a candidate's URLs exist
as HSAL evidence, deleting the candidate stops deleting everything. That is a
precondition, not a backlog item: no candidate data goes to HSAL until HSAL
can delete.

**Reason.** HSAL was already in the product but only on one page, and nothing
ever brought a recruiter back to it — a belief recorded at 76% sat at 76%
while the job produced ten candidates and two rejections. Beliefs in the
daily loop is the integration that changes behaviour, and it is the one nudge
in this product about the recruiter's thinking rather than their admin.

**Tradeoffs.** One HTTP call per bound job when HSAL is up, on a page loaded
daily; failures are swallowed per case. A fortnight is a judgement — short
enough that a belief cannot quietly rot, long enough not to nag about last
week. Closed jobs are skipped, so their beliefs become history rather than
prompts.

## D-052 — Contact is generated, labelled, and never stored

**Decision.** (2026-09-07.) The candidate page carries a contact finder.
Searches for a page the person published that happens to carry an address
come first, because finding one is a fact; the eight generated patterns come
second, because they are guesses. Every generated address renders with
"unverified" beside it (product rule 3) and the panel says why nothing is
kept. `src/lib/domain/contact-patterns.ts` imports no database module and a
test asserts it — the clipboard is the boundary.

**Why nothing is stored, and why that is not caution.** The Article 14 notice
this product drafts tells the person, in its own words, "I hold no email
address or phone number for you", and `profile-confirmations.test.ts` asserts
the draft contains no address at all. Persisting a generated address would
turn a sentence this product sends to the person it is about into a lie. So
the finder generates, shows, and lets the recruiter copy one into their own
mail client.

**One deliberate departure from the reference console.** Its pattern function
stripped every character outside `a-z`, which deleted accents rather than
folding them: "Ana María López" produced `ana.lpez@`. That is a wrong
address, and wrong for exactly the names an English speaker is least likely
to check. `foldName` normalises to NFD, drops combining marks, drops
apostrophes (almost no employer keeps them in a local part) and keeps hyphens
(plenty do). The eight patterns and their ordering are unchanged — that
ordering is the validated part.

**Alternatives rejected.** Storing a chosen address on the candidate —
rejected on the notice above. Calling a contact-data vendor — rejected:
product rule 1, and the surface-family rules already class those hosts as
contact aggregators that must never bind two records together. Showing the
patterns without the searches — rejected: it would make the guess the
product's main answer to a question that often has a real one.

**Tradeoffs.** Eight guesses is eight chances to be wrong, so the copy says
to verify one rather than send to all of them. Nothing is recorded, so the
product cannot tell you which pattern worked last time at that employer —
a real loss, and the price of the sentence in the notice.

## D-053 — The dev server and the checks stop fighting over one build directory

**Decision.** (2026-09-07.) `pnpm dev` sets `TALENTOS_DIST_DIR=.next-dev` and
`next.config.ts` reads it, so the development server and `next build` no
longer write the same directory. `pnpm e2e` first runs
`scripts/free-port.mts 3999`, which stops any server left listening there.

**Reason.** Both were real faults that looked like other faults. Running the
checks with a dev server open corrupted whichever build lost the race, which
the owner saw as changes that would not appear — twice, and the second time
they said so plainly. Separately, an interrupted browser-test run leaves its
own `next start` behind, and every later run then fails with "already used",
which reads like a broken suite and is not one. Neither is worth a human's
attention more than once.

**Tradeoffs.** `free-port.mts` sends a signal to a process it did not start,
which is why it is scoped to one port on this machine, refuses anything
outside 1024–65535, and prints the pid it stopped. `.next-dev` is a second
build directory on disk and is gitignored.

## D-054 — Two things were built and left where nobody could find them

**Decision.** (2026-09-07.) Both are now on screen.

**The graph store.** D-042 paired Neo4j and verified 277 records in it, but
the only way to reach any of it was `pnpm graph:sync` on a command line, and
the graph page still rendered the per-job projection. `/graph` is now a page:
the whole workspace in one picture, read from the store, with the record and
link counts, the connection state, and a "Rebuild from records" button so the
command line is not the only door. The per-job page links to it when the
store is paired, and says what the difference is. Unpaired, the page says so
and prints the command to start it rather than showing an empty canvas.

**Two orphaned routes.** Grouping the nav into four phases (D-041) silently
dropped `/review-shortlist` and `/crew` — they still worked, nothing linked
to them. `/review-shortlist` is where the card deck and the evidence ribbons
live, which is exactly the functionality the owner asked after.
Review shortlist is back in the Engage phase; Crew is in the command menu
only, which is what D-041 said and never did.

**The check that stops it recurring.** `tests/unit/workspace-nav.test.ts`
reads the route directories on disk and fails if one is in neither the nav
nor a short, explicit hidden-on-purpose list. Adding to that list is a
decision; forgetting a route is not, and nothing else would have caught it —
every page still rendered, every test still passed, and the feature was gone.

**Reason.** A page you can only reach by typing its URL is a page nobody
uses, and a store you can only reach from a terminal is a store nobody has.
Both were reported by the owner as things that had disappeared, which is
exactly what they had done.

**Tradeoffs.** The whole graph draws at most 120 records; beyond that a force
layout is a hairball and the per-job view is the better tool. Rebuilding is a
full re-projection of every job rather than a delta, which is fine at this
size and is the first thing to make incremental.

## D-055 — The preview is on every link worth previewing

**Decision.** (2026-09-07.) `PreviewLink` takes a target — `tag:<slug>`,
`candidate:<id>` or `job:<id>` — and `/api/preview` answers all three: a job
with its role, place, seniority, band, headcount and status; a person with
their title, employer, stage and next action; a tag with where it was
written. It is now on the sidebar job list, the jobs table, the people table,
the connected strip, the daily events and the briefing rows.

**Reason.** The first version only wrapped written page references, so two
links on a page of seventy-four previewed and the rest did nothing. The owner
asked where the live preview was, which is the correct question to ask of a
feature you have to hunt for. It is 43 of 74 on that same page now; the
remainder are navigation, which should not preview.

**Tradeoffs.** One request per new target hovered, cached per session. A
person's card shows their own record, which is the recruiter's data and
already on screen elsewhere; nothing in it is a protected characteristic.

## D-056 — A pane can be any part of the product, and panes move between slots

**Decision.** (2026-09-07.) A pane is identified by a typed string —
`page:<slug>`, `job:<id>`, `calendar:<date>`, `tasks`, `people` — parsed by
`src/lib/core/panes.ts` and rendered from one `/api/pane` shape, so the pane
component draws rows rather than branching per kind. `⇥ Open beside` sits in
the header of the pages that can become one. A pane is moved between slots by
dragging its **spine**, not its header: a pane you can only drag by its
header is unmovable the moment another covers it.

A bare slug with no prefix is read as a page, because every stack written
before panes were typed looks like that, and a URL somebody saved must still
open what it opened.

**Alternatives rejected.** A pane kind per component with its own fetch —
rejected: five renderers drift, and the stack is easier to reason about when
every pane is sections of rows. Reordering by dropping on a gap indicator —
rejected: dropping onto the pane you want to displace is what people try
first.

**Reason.** Panes were only ever pages, which made the stack a reading tool.
The owner asked for the calendar, the tasks and every section to be one, and
for panes to move between areas. A trail of thought is not only made of
pages.

**Tradeoffs.** `movePane` carries the off-by-one that makes hand-rolled
reorders feel wrong — dropping a pane to its right must account for the gap
it leaves — and a test would fail if it were done the obvious way. Panes stay
read-only; the header links to the real page.

## D-057 — A job shows its activity the way a repository does

**Decision.** (2026-09-07.) Two readings, on the job page and on each row of
the jobs list. A **strip** of one cell per day over twelve weeks, shaded
against that job's own busiest day. A **bar** showing the pipeline's shape,
with a legend. Both are derived in `src/lib/services/job-activity.ts` from
rows that already exist — a person added, a stage moved, an address kept, a
learning recorded, a note edited.

**Why relative shading.** An absolute scale renders every small search
entirely blank. A job whose peak is three events a day and one whose peak is
forty should both read as busy on their busiest day; the comparison that
matters is with the job's own past, not with someone else's job.

**Why the percentages are forced to 100.** A proportional bar with a
one-pixel gap at the end reads as a rendering fault rather than as data. The
rounding remainder goes on the largest slice, where it is least visible.

**Alternatives rejected.** A single health score — rejected: it hides which
of five things is wrong and invites arguing with the number instead of
looking at the pipeline. Absolute shading — rejected above. Drawing an empty
bar for a job with nobody in it — rejected: it says so in words instead.

**Reason.** Asked for directly. The strip's most useful output is a gap: a
fortnight of blank cells is a job nobody is running, and no summary number
says that as fast.

**Tradeoffs.** Every jobs-list row computes its own strip, which is a handful
of queries per row — fine locally, and the first thing to batch if the list
grows. "Activity" counts events, so a day spent thinking about a job and
recording nothing looks idle, which is true of the records and not of the
day.

## D-058 — A match percentage, built to be argued with

**Decision.** (2026-09-07, at the owner's explicit request for a match
percentage and a scorecard per job.) `src/lib/domain/match-score.ts` derives
a number from the evidence alignment already stored for a candidate, weighted
by each criterion's kind from the canonical requirements: a must-have counts
three, preferred one and a half, trainable three quarters. Strong earns full
credit, partial half, contradictory none. A disqualifier inverts, because
contradicting one is a point in the person's favour.

**Two numbers, never one.** `match` is how the evidence went on what could be
assessed. `coverage` is how much of the job could be assessed at all. A
candidate with three strong criteria and thirteen unexamined ones scores 100%,
and that number is true and useless — so `unknown` and `missing` are removed
from the denominator rather than counted as failures, listed by name, and
`coverage` is shown beside the number every time it appears, including in the
list chip. Absence of evidence is not evidence of absence, and a score that
forgets that is the mechanism by which these tools do harm.

**Nothing decides.** No threshold rejects, no ranking is persisted, the
scorecard renders beside the number so the parts are always visible, and a
recruiter who disagrees changes the criterion's status rather than the score.
A supported disqualifier is surfaced above everything else with the sentence
that it is a judgement for the recruiter, not for the number.

**The concern, stated once.** A single number about a person is the most
dangerous output this product has: it invites ranking, it hides which
criterion is weak, and it is the thing every vendor on the competitive list
ships and cannot show the working for. The owner asked for it directly. It is
built, and it is built so that it cannot be read without its parts — which is
the only version of this feature that belongs in a product whose claim is
that it shows its working.

**Alternatives rejected.** A model-generated score — rejected: it could not
be traced to a criterion and would differ between runs on the same evidence.
Counting `unknown` as zero — rejected on the reasoning above. A single
composite that folds coverage into match — rejected: it hides exactly the
thing a recruiter needs to see, which is how little is known.

**Tradeoffs.** The weights are a judgement, in one file, meant to be argued
with. A criterion the alignment carries but the requirements do not is
treated as preferred — the middle weight, so it neither dominates nor
disappears. The score is computed on read rather than stored, so it always
reflects the current alignment and never a stale copy.

## D-059 — A sourcing query language, and it is the same one everywhere

**2026-09-07.**

One string compiles two ways: into the search-operator syntax the twenty
sourcing angles need, and into a score over the people the workspace already
holds. `src/lib/sourcing/query-language.ts` — eighteen filters (`skill:`,
`title:`, `org:`, `loc:`, `seniority:`, `industry:`, `has:`, `artifact:`,
`filetype:`, `site:`, `intitle:`/`inurl:`/`intext:`, `after:`/`before:`,
`lang:`, `name:`, `source:`), quoted phrases, `-` exclusions and `OR` groups.

**Prose is first-class, not a fallback.** "technical recruiters in the Bay
Area" fills the same fields `skill:` and `loc:` do. Two rules make that work
and both were defects first:

- **Capabilities are matched as phrases, not word by word.** Matching a term at
  a time found neither half of "technical recruiter", so the occupation
  dropped out of the brief entirely and the search returned the wrong kind of
  human. Aliases are also tried in both numbers, because sourcers type
  "recruiters", not "recruiter".
- **A word that only carried meaning inside a phrase is not also a keyword.**
  "in the Bay Area" resolved the location and then scored "Bay" and "Area"
  separately, printing `mentions Bay` as a reason somebody was shortlisted.

**An unknown filter becomes a keyword, never an error.** A recruiter mid-flow
should not be stopped by a typo. A filetype that cannot be read is named, not
silently ignored.

The same language runs the global search at `/search` (D-062), so a filter
narrows a job list the way it narrows a shortlist.

## D-060 — Twenty sourcing angles, and the ones that cannot run are shown anyway

**2026-09-07.**

`src/lib/sourcing/angles.ts` holds what a sourcer knows: that CVs hide behind
`filetype:pdf ("curriculum vitae" OR resume) -template`, that speaker
programmes and award lists are pre-filtered talent pools, that a staff
directory is the closest thing to a public org chart. Twenty angles, each
carrying the reason it finds people who are not looking, and each rendered from
the brief rather than from a hardcoded sector vocabulary — `INDUSTRY_HINTS`
only fires when the brief names an industry.

**Three states, because there genuinely are three.**

- `runs` — a connector the app calls itself.
- `handoff` — the query is composed in full and the recruiter opens it. The
  app never reads the result page; that is the standing rule
  (`docs/PILOT-RUNBOOK.md` §2), not a gap.
- `dormant` — nothing configured. The angle is still rendered, greyed, with the
  exact query it would run and the sentence that turns it on. **Nothing dormant
  is executed.** Showing them is the point: it tells you what a connector is
  worth before you pay for it.

**Routing is by syntax, not by subject.** The first version routed a team-page
angle to Wikidata because both are "about people", and the page said so — while
Wikidata cannot parse `inurl:/team` and would have returned nothing behind a
row claiming a result. Only a connector that speaks search operators can carry
an angle. The structured APIs answer the same brief through their own fielded
requests, listed separately with the exact URL each would be asked.

**What was deliberately not ported.** The reference implementation this came
from also crawls, fetches and classifies result pages. That is forbidden here
by a standing decision, so the extraction half is absent by construction and
evidence arrives from four lawful places instead: structured public APIs,
documents the recruiter supplies, imports they own, and addresses they save.

## D-061 — Three ranking rules, each one a test

**2026-09-07.**

`src/lib/sourcing/rank.ts` scores a person against a brief and says why, in the
ontology's own words. Three rules govern it, all three learned by getting them
wrong first, and each has a test that fails loudly if it is softened.

1. **Adjacency supports; it never substitutes.** Somebody with no direct
   evidence is capped at 0.6 however many neighbouring capabilities they touch,
   so "works next to robotics" can never outrank "does robotics".
2. **Hiring for X is never evidence of doing X.** A derived claim counts as
   support and says so: _"indirect mention, not evidence of doing it"_.
3. **A wrong location costs; an unknown one does not.** Somebody publicly based
   elsewhere is still shown — relocation and stale pages are both common — but
   scored at 0.55×. Somebody whose base was never published is not penalised.

Two further rules were added because the benchmark found them (D-063):

4. **A capability after a sourcing verb names the domain, not a requirement.**
   "a recruiter who has hired robotics engineers" asks for the recruiter.
   Qualifiers earn credit and never create a gap.
5. **A relevance floor.** Somebody whose evidence touches none of the brief's
   capabilities is not a weak result, they are not a result. It is off on a
   dossier the recruiter opened deliberately — the floor is a results-list
   concern.

Dimensions the brief did not ask about are not scored, then the rest are
renormalised, so a brief with no location filter is not penalised for having no
location evidence.

## D-062 — One search across everything

**2026-09-07.**

`/search` runs the sourcing query language over jobs, people, tags and tasks at
once. Every hit is scored, names what matched, and links to the record. The
reading of the query is shown above the results and anything the language could
not honour is reported rather than dropped.

It exists because the workspace had four places to look something up and no
place to look everything up, and because the query language was already written
for sourcing — a second, weaker matcher for the same job would have been the
thing that drifted.

## D-063 — The ranker is measured, not asserted

**2026-09-07.**

`pnpm benchmark` scores five deliberately unlike searches — technical,
scientific, recruiting, commercial, finance — over 22 invented people.
`tests/unit/sourcing-benchmark.test.ts` holds the floor, so a ranking change
that costs precision fails the build.

**It found two real defects on its first run**, neither visible by reading the
code:

- The headline recruiting query returned the engineers instead of the people
  who recruit them (P@5 0.20). Fixed structurally with the qualifier rule, not
  by tuning weights.
- Every person on file came back for every query, burying the ones who
  answered. Fixed with the relevance floor.

After both: mean P@R 1.00, mean recall 1.00, a relevant top hit on 5/5 queries,
and zero distractors ranked above a relevant person.

**P@R, not P@5, is the headline.** With three relevant people in the corpus,
P@5 cannot exceed 0.60 however perfect the ranking is; reporting P@5 alone
would print a ceiling as a defect.

**What the numbers do not say.** They describe 22 people. They say the ranker
orders the evidence it is given correctly and say nothing about coverage.
`docs/SOURCING-EVALUATION.md` states that plainly, along with the two other
honest limits — 33 capabilities in the ontology, 44 places in the gazetteer.

## D-064 — Says who?

**2026-09-07.**

`/sourcing/person/[id]` reads the dossier down the left, the evidence on the
right, and draws a ribbon from every claim to the sources behind it. Hover to
trace; click to pin and dim the rest; click either side to run the connection
the other way and scroll its counterpart into view.

**The ribbons are drawn from the fact the score was computed from.**
`EvidenceLink.satisfies` records which requirement each source answered while
ranking, so a claim with nothing behind it cannot be rendered — which is the
whole point of the view. A second, looser mapping made for display would have
been able to draw a ribbon to a source that did not support the claim.

Alongside it, **Find Similar** answers "this person is right, get me ten more"
from four evidence signals a sourcer would recognise — same work, named on the
same page, same employer, same market — so every suggestion arrives with its
reason instead of an embedding's silence.

## D-065 — Two records that look like one person are held, not merged

**2026-09-07.**

`src/lib/sourcing/resolve.ts` scores identity and refuses to decide in the
middle. Above 0.72 the evidence says one person; below 0.55 they are two;
between is `/sourcing/review`, with every signal and its weight shown so a
recruiter can disagree.

**Only name-independent evidence can carry an identical name over the line.**
Corroboration is read off a structured flag, never off the text of a label — a
shared _name variant_ is the name again, and a shared city is not evidence at
all, because two strangers can both be in London. A shared registry identifier
settles identity alone; an account or a mailbox needs company.

**A shared distinctive token beats a Jaccard score.** "Edinburgh Robotics
Group" and "University of Edinburgh" score 0.25 and look unrelated, when the
shared token is the whole point. A shared "University" is not a signal; a
shared "Edinburgh" is.

A wrongly merged profile invents a career nobody had, which is worse than two
duplicates. The default is always to keep them apart and ask.

## D-066 — Old evidence counts less; undated evidence counts as unknown

**2026-09-07.**

Three different answers, and conflating them is the bug this exists to stop.
Fresh evidence counts fully. **Stale** evidence counts less but never nothing,
because a 2019 CV is still evidence the person did the thing. **Undated**
evidence is unknown, not old — most team pages and directory rows carry no date
at all, and scoring them as ancient would rank the whole open web below one
dated CV.

`freshness()` in `src/lib/sourcing/rank.ts`: full credit inside 18 months,
decaying linearly to a floor of 0.45 at six years, and 0.85 for anything
undated. It multiplies capability evidence, so a recent claim outranks the same
claim made in 2009 without either disappearing.

## D-067 — Three ways two records become one person

**2026-09-07.**

Identity resolution was pairwise, spelling-first and one-size-fits-all. Three
changes, each closing a case it could not previously see.

**Shared collaborators.** Two people do not accumulate the same collaborators
by coincidence. One shared name is weak — a common surname on a long author
list — but three is a working relationship, and none of it depends on how the
person's own name is spelled, which is exactly what an initialised byline
needs. Collaborators are blocked on the initials key, not the full spelling,
because comparing "Amara Okonkwo" to "A. Okonkwo" as strings finds nothing and
the signal would have been dead on arrival.

**The bar rises with how common the name is.** "Michael Smith" and a rare name
should not share a threshold. Rather than ship a name-frequency table — wrong
for most of the world, and it would rot — commonness is read off the records in
front of us: if four already abbreviate to "m smith", the fifth needs more than
a name to join them. Self-correcting, needs no data anyone maintains, and
strictest exactly where the risk is. Capped at +0.16, and both names in a pair
must clear their own bar, because merging a rare name into a common one is
still merging into a common one.

**Transitive closure, offered rather than applied.** Pairwise scoring never
asks whether A and C are the same once it has put A with B and B with C, so one
person can stay split forever on a spelling neither half shares. Closing the
graph fixes that — and closure also compounds mistakes, so a cluster held
together only by inference is shown on `/sourcing/review` with the pairs that
were never directly established, and never merged silently.

One guard came out of this: the "only one name token in common" penalty is now
skipped when name similarity is already high. It was double-charging "S. Chen"
against "Sarah Chen" — taking back the credit the similarity measure had just
given for recognising an initial.

## D-068 — The structured sources answer the query, on a button press

**2026-09-07.**

`/sourcing` with "also ask the structured sources" ticked runs the same brief
against Wikidata, OpenAlex, Crossref and GitHub, maps what comes back into
people, and ranks them beside the workspace under exactly the same rules. It is
off by default and adds `live=1` to the URL: a call is made because somebody
pressed a button, never because a page rendered.

**Nothing is stored.** Rows are ranked and discarded; one becomes a record only
when a human saves it (product rule 2). Each row links out to what the source
itself published, in a new tab with `rel="noopener"` (rule 5), and is badged
"not saved" so it cannot be mistaken for a record.

**A row that does not name a person becomes nothing.** `looksLikePersonName`
rejects "Our Team", "Field Robotics Summit", "Q7259" and the rest of the page
furniture a title field carries, and the count of what was discarded is shown
rather than hidden — a search that invents candidates nobody can contact or
corroborate is worse than a search that finds none. Every source's result is
reported individually, including its error, because a partial answer with a
named gap is more use than silence.

**A one-line description is a real assertion and a thin one.** It earns less
than a CV through its confidence, not by pretending the source never said it. A
capability named after a qualifying verb — "hiring for robotics" — is marked
derived, so it counts as support and never as evidence of doing the work.

## D-069 — The ontology has a contract, and it caught three real defects

**2026-09-07.**

An alias is matched as a whole phrase against normalised free text, longest
first, so a bad one is not a small mistake: a single generic word puts an
unrelated profession on a shortlist, and an alias claimed by two concepts makes
which one wins an accident of string length.

`src/lib/sourcing/ontology-validate.ts` is the contract —
snake_case keys, aliases lowercase and unique across every concept, no alias
that is a bare generic word, no alias that normalises to single letters, every
adjacency edge pointing at a concept that exists with a weight in 0.40–0.95 and
a reason of at least thirty characters that does not begin "related to".
`tests/unit/sourcing-ontology.test.ts` runs it over the whole ontology, so a
new concept cannot be added without meeting it.

Writing it found three defects that had shipped in the first import, none of
them visible by reading:

- **`c++` normalises to the single character `c`.** Any standalone "c" — a
  middle initial, "vitamin c" — read as software engineering.
- **`m&a` normalises to `m a`.** "John M A Smith" read as corporate finance.
- **`cv` meant computer vision** in a product where CV means curriculum vitae
  and the angle library is full of the latter.

Plus a duplicate — "thermal runaway" was claimed by both thermal engineering and
battery systems, so which one a match credited was arbitrary. It is a battery
phenomenon; battery systems keeps it.

## D-070 — The sourcing engine runs in the browser, unchanged

**2026-09-07.**

The whole engine — query language, ontology, twenty angles, ranker, dossier,
Find Similar — is pure TypeScript with no database and no network, so it
bundles into the single-file artifact as-is. `artifact-src/ui/sourcing.ts`
mounts it over the artifact's own records. Same brief, read the same way,
whether it runs on a laptop or in a shared page — rather than a diminished copy
that drifts from the real one.

One refactor made that possible: `structuredSources` and `toOpenIndexSpec`
moved out of `plan.ts` into `structured-sources.ts`, because they were the only
part of the planner that knew the open-index adapters exist and so dragged
`fetch` and `process.env` into everything downstream. `buildPlan` now takes the
structured rows from whoever has them, and returns an empty list to a caller
that does not — a browser gets a plan, not a crash.

Dormant angles behave identically in both builds, which is the check that the
port is real: the browser cannot run an operator search, so it shows what it
cannot run with the query it would have run, exactly as the server build does.

## D-071 — The ontology went from 33 capabilities to 408, and it was refuted before it was merged

**2026-09-07.**

The ontology was the biggest limit on the sourcing engine: 33 capabilities,
enough for five fields and little else. It is now 408 capabilities, 4,434
aliases and 1,638 adjacency edges — each edge still carrying the stated reason
a recruiter reads beside a candidate.

**Generated, then refuted, then merged mechanically.** Twelve agents drafted a
profession family each; twelve more were pointed at what the first twelve wrote
and told to find aliases that would match ordinary prose, adjacency claims a
practitioner would dispute, plural aliases the matcher would double-inflect, and
invented occupations. 499 problems came back and were applied.
`scripts/merge-ontology.mts` then dropped a further 76 entries for colliding
with an alias another concept already owned, and every survivor had to pass the
contract in `ontology-validate.ts` (D-069). Nothing was hand-edited into place.

**The proof it was worth doing is the benchmark, not the count.** Three new
fields — employment law, critical care nursing, quantity surveying — were added
to the benchmark AFTER the expansion, with people and distractors written to be
hard. All three scored 1.00 at P@R on the first run, with no tuning. The five
original fields did not move. Eight fields, mean P@R 1.00, recall 1.00, a
relevant top hit on 8/8, zero distractors above a relevant person.

**One real defect surfaced immediately, because the ontology got big enough to
show it.** A candidate whose stated skill was "C++" was rendered as "evidenced
capability: Employment Law". "C++" normalises to the single character `c`, and
the fallback alias match tested plain substring containment in both directions,
so it matched every alias containing a "c" — here, "civil litigation". The
fallback is now word-bounded and length-guarded, longest alias wins, and a
stated skill that survives normalisation only as initials keeps its own
spelling so it can only ever match itself.

## D-072 — The gazetteer is 390 places, and it refuses the ones that are also words

**2026-09-07.**

44 places became 390, with 422 metro-folding rules. Same method: five regional
drafting agents, five refuters, a merge script, and the same contract.

**The whole job was refusing things.** A place name that is also an ordinary
English word matches prose and puts people in the wrong country, which is worse
than not knowing the place at all. So the gazetteer ships `reading berkshire`
and not `reading`; `bath somerset` and not `bath`; `cork ireland` and not
`cork`; `derby uk` and not `derby`. Three more are subtler and were caught by
the refuters rather than by me:

- **`wales` is a whole-phrase substring of `new south wales`.** Shipping it bare
  would put every Sydney engineer in Wales — the exact wrong-hemisphere failure
  the location dimension exists to prevent.
- **`england` sits inside `new england`**, and **`york` inside `new york`**.
  All three ship only in qualified form.

Ambiguity across continents is handled the same way: `birmingham uk`, not
`birmingham`; `newcastle upon tyne`, not `newcastle`; `dublin ireland`, because
bare Dublin is also a town inside the San Francisco Bay Area.

**Folding must reach the metro in one hop.** `normalizeLocation` applies the map
once, so a rule pointing at another rule's source stops short of the market it
meant. Twenty-one chained folds were collapsed, and one genuine cycle —
`seattle ⇄ puget sound` — was canonicalised on the metro name. The merge script
now refuses to write a fold whose target is itself a source, and a test asserts
no chain exists.

And folding is not widening: Reading does not fold into London. It is a
different labour market, and shipping it would silently broaden every London
search.

## D-073 — A pane stays open until you close it

**2026-09-07.**

Panes lived only in the URL (`?panes=a,b,c`), which made a trail shareable and
reload-proof but meant clicking any ordinary link — a link that naturally
carries no `panes` parameter — silently closed everything. That is backwards:
a pane you opened _beside_ your work is the one thing that should still be
there when you go and look at something else.

The stack is now also kept in `sessionStorage` and put back whenever a page
arrives without one. Three rules keep it honest:

- **A URL that names its panes wins**, and seeds the memory rather than being
  overruled by it. A shared trail arrives as the sender left it, and the back
  button still works.
- **Closing clears the memory.** An X stays X'd, and so does "close all";
  navigating afterwards must not resurrect what you dismissed.
- **Session, not local.** A trail of thought belongs to this sitting and this
  tab. Two tabs keep separate trails, and tomorrow starts empty rather than
  reopening a path you had already finished walking.

Every storage access is wrapped: a private window or blocked site data can make
`sessionStorage` throw on access rather than return null, and panes failing to
persist must never take the page down with them. When storage is unavailable
the URL still carries the stack for the page you are on, which is exactly the
old behaviour.

One implementation note worth keeping: `restore` is called from the rail, not
from `usePanes`, because every open pane calls that hook and they would
otherwise all try to restore the same stack at once. The pane list is memoised on the
raw query string so the effect does not re-run — and re-write storage — on
every render.

## D-074 — Every page is a pane, and shift-click is how

**2026-09-07.**

Panes were five kinds — a page, the tasks, the calendar, a job, the people
list. Everything else in the workspace could only be visited, which made "open
it beside your work" a property of a handful of pages rather than of the
product. Seven more kinds join them: the dashboard, the job list, the tag
index, the whole graph, the settings, a search, a sourcing brief.

**`paneForRoute` is what makes it true without a per-page decision.** Any
address in the workspace maps to the pane that stands for it, and one listener
on the document — capture phase, so it covers every link there is — turns a
shift-click into an open. A list of links that had to be taught individually
would mean "every page is a pane" was only ever true of the pages somebody
remembered.

Three links it deliberately leaves alone: anything off this origin, anything
with a `target` (a result link opens in a new tab, and that is the rule), and a
route with no pane of its own.

**Targets are canonicalised on the way in.** `pane-alpha` and `page:pane-alpha`
are one thing, and a stack that held both would show it twice and close it once.

## D-075 — The graph is a shape, not a box, and you can watch it settle

**2026-09-07.**

Three things made the knowledge graph read as a rectangle, and none of them was
the data.

**It was clamped to the viewport on every step.** Each axis was clamped
separately, so every record that drifted out came to rest exactly on a straight
edge and a dense graph grew four flat sides and four corners that nothing in
the links put there. The step now only catches a runaway, far outside the
frame, and the settled layout is _fitted_ once on the way out — scaled about
the middle, only ever shrinking, so a small graph is not blown up until two
records look as far apart as two hundred.

**It sat in its own dark slab with a border.** The frame was doing more to make
it look square than the layout was. It is drawn on the page's own ground now,
which is the same rule the rest of the workspace follows: the menu is the only
constant surface.

**It arrived fully formed.** A layout that appears finished is correct and
tells you nothing — the motion is how you read which records pulled which into
place. So the physics is a state you advance: `createSimulation`,
`advanceSimulation`, `snapshotSimulation`. The component steps it two ticks an
animation frame and stops when it cools, so nothing drifts while you are trying
to read it; dragging a record, changing a filter or selecting something else
warms it back up, carrying the arrangement you were looking at rather than
scattering from the hash again.

`settleGraph` still runs the whole thing in one call, so the server render and
the deterministic tests are unchanged. And the anchor and the fit are a VIEW
transform applied to a copy: feeding them back into the physics would make the
simulation chase its own camera and drift for as long as you watched it.

Somebody who has asked for less motion gets the whole simulation in one frame —
the same picture, without the animation.

**The graph pane shows the graph, not a list of its records.** A pane is 380px
wide, so it carries the sixty most connected records and says so — a slice,
named as one. It is the same component the full page uses, settling and
draggable at the size a pane gives it, because a list of a graph's nodes is
precisely the thing you opened the graph to avoid reading.

## D-076 — The dashboard opens on what you wrote and what you owe

**2026-09-07.**

Today's note and the task list are on the dashboard, not a click away. The note
is the same one the daily page holds rather than a second scratchpad, because
somewhere else for things to get lost is not a feature; `[[`, `@` and `jj`
recall pages, people and jobs there exactly as they do on the daily page. The
tasks are the real list — add, complete, reorder — rather than the count of
them that used to sit in the corner.

A note you have to navigate to is a note you write on the days you were going
to write anyway.

## D-077 — Every angle opens in ordinary Google

**2026-09-07.**

The composed boolean queries could only be opened in the two people-only
engines, which made "dormant" mean far more than it should. A dormant angle is
one no connector will **run** for you; it was never one you could not search.
The query is already written, and the negatives in it — `-"job description"`,
`-site:indeed.com`, `-template` and the rest — are exactly what make it behave
on the open web, because the angle library was written for the open web in the
first place.

So every angle now carries **Open in Google** alongside the two engines, in
every state including dormant. No key, no connector, no configuration.

`buildWebSearchUrl` sets three parameters a sourcer would set by hand:

- **`nfpr=1`** — stop Google "correcting" the query and searching for something
  else, which is fatal to a hand-built boolean string.
- **`filter=0`** — stop it collapsing near-duplicates, which on a
  site-restricted search silently hides most of the people you were looking for.
- **`udm=14`** — plain web results rather than the assembled page. Undocumented
  and widely used; if it stops working the link still works, because an unknown
  parameter is ignored.

The dormant card's copy changed with it: what a connector buys is **running**
the angle for you and reading the results back in, not the ability to search at
all. That is a smaller and more honest claim than the one it was making.

Nothing about the boundary moved. The app hands over a URL; the recruiter opens
it, in a new tab with the opener severed. No page is fetched, and the same links
are in the browser-only build, where the artifact's sandbox-safe link-out
already covers them.

## D-078 — The evidence ribbons draw the connection the page is actually for

**2026-09-07.**

The source-review page had a ribbon layer that drew nothing, and had for as
long as it existed. Three reasons, each of which made it invisible on its own.

**It joined the wrong two things.** A ribbon was drawn from a CV passage to a
JD passage carrying the same link id — which only ever happens when the same
sentence is marked in both documents. The connection the page exists to show is
_requirement ↔ the passage that supports it_, and that one was never drawn. It
is now: from the requirement in the rail, into the CV, and on to the JD where
there is one. The overlay moved up from `.review-pages` to `.review-workspace`
so it can reach the rail at all.

**It dropped any connection whose passage was off-screen.** A document is many
screens long, so on arrival every passage is off-screen and nothing was ever
drawn — the layer was empty exactly when you first looked at it. An end is now
clamped to its pane's edge and drawn thin, pointing at where the passage is,
and goes solid when you scroll to it. Selecting a requirement already scrolls
its passage into view, so clicking one lights its ribbon.

**It was hidden below 900px and only listened for some scrolls.** The
breakpoint now matches the component's own (`RIBBON_MIN_WIDTH`, 760 — below
that the workspace is one column and the ribbons would cross nothing), and
scroll is watched on the document in the capture phase, because every pane here
scrolls independently and anything narrower left a ribbon pointing at where its
end used to be.

Three weights, so a page of connections stays readable: the selected one at
full strength, the rest present but quiet, an off-screen end fainter still. A
page of equally loud ribbons is a page you cannot read, and the point is to
follow one claim at a time.

## D-079 — The page is a pane, and the menu is the only constant

**2026-09-07.**

The workspace was a full-bleed page with panes floating over it. Now the menu
is the one constant surface and everything else — the page you are on included
— is a bounded thing sitting on the canvas with its own edge.

Two consequences, and both are the point.

**A pane sits beside the work, not on top of it.** The page reserves the rail's
width, so opening something next to what you are doing does not cover what you
are doing. A pane that covers the thing you opened it next to is not a pane, it
is a dialog. `railWidth` is the single source of truth for that number, used by
the rail to size itself and by the page to reserve the room — two components
each guessing it independently is exactly how they end up disagreeing.

**Past the point where the rail would squeeze the page, it stops growing and
scrolls inside itself.** That is what the collapsing spines were always for. The
page never drops below 420px however many panes are open.

One regression this caused, and it is worth recording because it is the kind
that only a browser finds: with the rail sized to exactly one pane, the "close
all" control came to rest on top of that pane's own ✕, so closing one pane
closed the lot. Anything sharing a row has to be in the sum.

And a behaviour that changed rather than broke: once the rail is fuller than it
is wide, an earlier pane is covered and its spine is the only part still on
screen — so that is where you drop onto it. The spec now drags to the spine,
which is what a person could actually do.

## D-080 — Tags read off the evidence, with no model and no key

**2026-09-07.**

A tag here is not a record — the word written in the text IS the tag. So
auto-tagging cannot mean writing rows into a table. It means reading a person's
evidence and proposing words, each carrying the sentence and the source that
produced it, for a recruiter to accept or ignore.

`suggestTagsFromEvidence` reads every claim held about a person — a team page,
a registry row, a paper, a saved address, an imported record — and proposes
four kinds of word: the **capability** the ontology recognises, the **place**
the gazetteer recognises, the **employer** the page names, and the **shape of
the evidence** itself (`published`, `patent-holder`, `open-source`,
`in-a-public-register`). That last kind matters because "who here has a patent"
is a different question from "who here does materials science", and the
ontology cannot answer the first one.

**Deterministic on purpose, and that is the point rather than a limitation.**
It runs on every person the moment their evidence lands, with no key, no queue
and no cost — which is the difference between a feature that is on and a
feature that is available. And every tag can say why it is there in the page's
own words: a model's tag can only be trusted, this one can be checked.

Three refusals are load-bearing:

- **The fair-hiring gate runs on the slug before anything is offered.** An
  auto-tagger that reads pages is exactly where a protected characteristic
  would otherwise walk in unnoticed.
- **A capability the source only mentions in passing is not a tag.** "Hiring
  for robotics" is support, not evidence of doing it; tagging it would put the
  word on the person as though they did the work.
- **A tag that cannot name its source is not offered at all.**

What it cannot do is name something the ontology has never heard of — a
company's own vocabulary, a named internal system, a niche method. That is the
gap the model path fills, and it now sits below this one on the page rather
than instead of it.

## D-081 — Reading people out of a page, measured against a corpus built to be hard

**2026-09-07.**

The extraction layer is the biggest quality lever in the product — the ranker
has been better than its inputs since the ontology grew — and it is the one
component autonomous crawling would need that can be built and proven _without_
reversing the no-fetch rule. It works on text somebody supplies: a pasted page,
an uploaded document, an import, the browser companion.

**The corpus came first.** Ten agents wrote realistic pages for ten surface
families — team and leadership pages, faculty and lab pages, conference
programmes, CVs, personal sites, directories and registers, publications and
patents, repositories, government records, award lists and contact pages — each
with the extraction a competent human would agree is correct, and adversarial
traps for the seven ways every naive reader fails. Ten more agents were pointed
at what the first ten wrote and told to refute it.

They found 109 problems, including **19 real people or organisations** and
**8 pieces of protected-characteristic vocabulary** that had slipped into
supposedly invented fixtures. Anything flagged on correctness was thrown away
rather than guessed at — a wrong fixture bakes a mistake into the tests and
every later change is measured against it — which left 19 pages (59 people) and
18 traps.

**The whole difficulty is refusal.** A page is full of headings, product names,
department labels and organisation names, all shaped exactly like a personal
name. The first draft scored:

|             | recall  | precision | invented on traps |
| ----------- | ------- | --------- | ----------------- |
| first draft | 53%     | 49%       | 42                |
| now         | **75%** | **86%**   | **6**             |

Four rules did most of it, and only one is a word list:

- **A name shape is not a person.** Something on the page has to treat it as
  somebody: an address, a role word, a sentence written about them, an
  employer, or a count of what they did. A heading has none of those. This is
  the rule that generalises past vocabulary, and it took inventions from 32 to
  11 on its own.
- **The page's own organisation is never one of its people**, and on a
  conference programme or an award list it is not anybody's employer either.
  Lending it is what makes every speaker work for the conference.
- **The name is wherever the page put it** — bare, before a dash with the role
  after, _after_ a dash with a code-host handle before, behind a "Chair:"
  label, in a `Name / Role` column, in a space-aligned tender annex field, or
  trailing a fellowship post-nominal.
- **A heading shouts, questions and pluralises**, and a name does not:
  ALL-CAPS, a trailing `?`, a plural common noun, a capitalised conjunction in
  the middle.

`pnpm extraction` prints the score; `tests/unit/sourcing-page-people.test.ts`
holds it as a floor. And the numbers are worth exactly what they say: 37
invented pages written to be hard, not a sample of the web. They say the reader
handles the shapes it has been shown.

## D-082 — Pages may be read, through one gate, and are still not kept

**2026-09-08.** Reverses the standing rule in `docs/PILOT-RUNBOOK.md` §2 and
`docs/DECISIONS.md` D-010: _never fetch, crawl or scrape a result page._ The
owner dismissed it. What follows is what replaced it, and what it does not
permit.

**The rule was two rules, and only one was reversed.** "Never fetch" and
"never bulk-persist search results" were written in the same breath and are
not the same promise. Fetching is now permitted. Keeping the page is not. A
page is read, turned into claims that name the address they came from, and
dropped — no page store, no fetch cache holding a body, no table keyed by a
URL with the text in it. That is the shape `evidence.ts` was already built
for, so nothing downstream changed to accommodate it.

**Off by default, and it takes two switches.** `TALENTOS_FETCH=on` is one.
`TALENTOS_FETCH_CONTACT`, a URL a site owner can open to find out who is
asking and how to stop it, is the other, and reading stays off without it. A
fetcher nobody can complain to is one nobody can ask to stop; making the
contact part of the switch rather than part of the etiquette is the difference
between meaning that and saying it.

**The gate is in front of the transport, not beside it.** `src/lib/fetch/`
splits into a pure half — address rules, robots.txt, the source registry, the
politeness reducer, the gate itself — and one file that Node has to run.
Everything decidable without a packet is decided without one, in this order:
the switch, the address, the registry, the run's budget, the host's turn, and
then robots.txt, which is last because it is the only one that needed a
request of its own.

Six refusals are load-bearing, and each is a way a URL that looks like the open
web turns out not to be:

- **`https` only, port 443 only, no address literals, no credentials in the
  address.** A literal is refused outright rather than checked, because Node
  skips the resolver hook entirely for one — the check that guards a resolved
  address never runs on `https://127.0.0.1/`.
- **Every resolved address is classified before the connection.** Loopback,
  private, link-local (which is where cloud metadata lives), carrier-internal,
  documentation and benchmarking blocks, in both families, including the
  transition prefixes: `::ffff:127.0.0.1` is this machine written differently,
  and `64:ff9b::10.0.0.1` is a private address wearing a v6 hat.
- **`node:https.request`, not `fetch`.** This is not taste. The global `fetch`
  accepts a `lookup` option and silently ignores it, so the address a name
  resolves to is never checked and a public-looking host that answers with
  `127.0.0.1` is fetched happily. `https.request` honours it, which is where
  the address rules are actually enforced.
- **A redirect is a new address and gets a new decision** — registry, robots
  and all — rather than inheriting permission from where it came from.
- **A sign-in wall, a paywall, a consent interstitial or a bot check stops the
  read.** Detected in order to stop, never in order to get past: these arrive
  with a 200 as often as with a 403, so the status is not the signal and the
  shape of the body is. Nothing here solves a challenge.
- **`X-Robots-Tag` and the page's own robots meta are honoured after the
  fact.** They cannot gate a request, so they gate the use: a page asking not
  to be held or quoted is read and dropped, and nothing from it is offered.

**robots.txt is a matcher and a fetcher, and the two halves are separable.**
The matcher is a pure function of the file's text, which is what let it be
tested as a 28-row table rather than against a server. Three of those rows are
the ones every naive implementation gets wrong: a group naming this fetcher is
never unioned with the `*` group; a named group with no rules still suppresses
the `*` fallback, because `User-agent: x` / `Disallow:` is how a site exempts
one crawler from a site-wide block; and pattern length is measured after
canonicalisation, or `Disallow: /café/x` loses to `Allow: /caf%C3%A9/` for a
reason that is an encoding artefact rather than a decision.

**One product token, not a list.** The RFC combines every group matching the
crawler, so declaring both a specific token and a general one means a
permissive rule written for the specific one gets the general one's
restrictions unioned on top — the opposite of what whoever wrote the file
intended. Declaring exactly one removes the question. It is letters and
hyphens only, because a token carrying a version or a slash is a token nobody
can write in a robots file, and a fetcher nobody can address is a fetcher
nobody can exclude.

**The two robots failures point in opposite directions and both are
deliberate.** A 404 means the host published no rules, so nothing is
disallowed. A 500 or a timeout means we do not know what it published, so
nothing is read. Conflating them is the commonest robots bug in either
direction.

**"Not your turn yet" is a delay, not an answer.** The reader waits for a
host's turn rather than refusing to take it, bounded by the run's wall clock.
A published floor may only ever be lengthened: a `Retry-After` shorter than
the backoff step does not shorten it, and a malformed one is never shorter
than no header at all — otherwise a broken header buys a faster retry than an
absent one.

**What was deliberately not built.** A conditional-GET cache, which the plan
asked for. With no stored extraction, a 304 does not save work — it means
"nothing changed" against nothing, so the run skips the page and loses the
result. Either the extraction is stored, which breaks the rule that survived,
or the cache is useless. It is useless, so it is absent.

**Eight defects an adversarial review found after it was written, because
none of them were visible from the code that contained them.** Recorded rather
than quietly fixed, because each is a shape worth recognising again:

- **A body we were not going to read was drained rather than destroyed.** On a
  redirect, a 429 or a 5xx the response was resumed after the wall-clock timer
  had already been cleared — so a host that answered `302` and then kept
  writing was read forever, off the clock and off the byte cap. Measured at 43
  GiB in ten seconds before the fix, 0.6 MiB after.
- **The run's budget was checked after the robots.txt request.** The check sat
  below an early return that fires whenever a host is due immediately, which is
  always true the first time a host is seen — so the budget was skipped for
  exactly the requests that reach a new host. The gate now runs twice per
  address: once for everything decidable without a packet, and again once the
  host's own rules are in hand.
- **A robots.txt redirect skipped the registry.** The page loop re-decided
  every hop and the robots loop did not, so a `Location` could walk the one
  request that establishes what is permitted onto a host the registry refuses.
- **A published `Crawl-delay` did not cover the first page.** It was recorded
  as a number without moving the schedule, so the request the delay most
  obviously covers — the one straight after the file it was written in — went
  out at the default gap.
- **Only one trailing dot was stripped from a host.** `web.archive.org..`
  resolves normally and matched nothing in the registry.
- **`User-agent: * baiduspider` was dropped rather than read as the `*`
  group**, so a site-wide `Disallow: /` written that way became no rules at all.
- **A `Crawl-delay` or `Sitemap` line between two `User-agent` lines merged the
  groups**, turning a block written for one crawler into one that also named us.
- **The matcher's cost was bounded only by the file size.** It is now bounded
  per pattern, and a rule past the cap is treated by direction rather than
  dropped: a refusal is truncated, which only makes it match more, and a
  permission is dropped, which only makes it permit less. Both err toward
  reading less.

**Two things this does not answer, and they are the owner's.** Several of the
richest surfaces forbid automated access in terms nobody has read; the
registry is where that gets decided per host, and it currently says so in
every note (D-083). And the Article 14 question changes shape with volume: it
is answerable for a handful of explicitly-saved records and is a different
problem at crawl volume. Nothing here crawls — it reads addresses a search
returned, at most twenty-five in a run — but the moment that changes, the
answer has to exist before the crawl does.

## D-083 — An unlisted host is governed by its own robots.txt, not by a list

**2026-09-08.** `docs/AUTONOMOUS-SOURCING-2026-09-07.md` asked the fetcher for
"a hard refusal on any host the registry has not cleared". Read literally that
is a fetcher that reads nothing: an empty registry fetches nothing and a full
one is a list nobody can finish, because the long tail of personal sites, lab
pages and orphan rosters is where sourcing lives and it has no entries by
definition.

So the refusal moved rather than being dropped. A host nobody has listed is
`open`: governed by its own `robots.txt`, one request at a time, and capped at
eight requests in a run — enough to read the pages a search actually returned,
not enough to walk a site. The registry carries the hosts where that is not
good enough, and every row narrows.

**Two axes, because they answer different questions.** **Posture** is what the
fetcher may do — `refused`, `handoff`, `open`, `cleared`. **Basis** is how that
is known — `read`, `documented-elsewhere`, `assumed`. Collapsing them is
exactly how a guess becomes a permission, so only a basis of `read` may reach
the one posture wider than the default, and a test enforces it.

**Nobody has read any host's terms, and the table says so.** Every `assumed`
row begins "Assumed, not read:" in its own note text, not in a column a page
might not render. A test refuses a row that shares a note with another, one
that says "as above", and one that carries a read date without a read. The
counts on the settings page are derived from the table rather than written by
hand, because a hand-written count in a document about honesty is the first
thing to go stale.

**The most restrictive match wins, not the most specific.** A permissive row
on a subdomain must not lift a refusal written on the domain above it.

**The copies are refused, not just the walls.** Archives, caches, reader
front-ends and translation proxies serve somebody else's page under their own
name — reading one is a way of not asking the original, and a claim read there
could not name where it came from. Refusing them is what stops the registry
from being trivially walked around.

## D-083 — The hill chart, one per job

**2026-09-08.**

A search is not a list of tasks that get ticked. It is a handful of separate
problems, each of which is first unknown and then merely unfinished, and the
difference between those two states is the only thing worth reporting. A
shortlist you have not built because you do not know where these people are is
nothing like a shortlist you have not built because you have the names and have
not written the messages. A task list calls both "not done". A percentage calls
both 40%.

So: Shape Up's hill, per job, with no setup. Uphill is figuring it out, the
crest is the moment the unknowns are gone, downhill is execution. Seven scopes
every search has to resolve — what the job is, what it pays, where these people
are, reaching them, a pipeline that stands up, the manager and I agree, getting
to a signature — each chosen so it can go over its own hill without the others.
A scope that cannot move independently is not a scope, it is a stage, and the
pipeline board is already the place for those.

**Three refusals hold it up, and the first is the whole point.**

- **Nothing moves a dot but a person.** Not candidate counts, not stage counts,
  not elapsed time. A position is a judgement about how much somebody still does
  not know, and there is no measurement of that. A hill chart the software fills
  in is percent-complete wearing a picture — which is the thing this repo banned
  in the first place, and the reason the ban was worth keeping until there was
  something better to put in its place.
- **The trail is the evidence, not the dot.** One dot is an opinion; a fortnight
  of them is a fact about the work. Every move is kept with its date and its
  author, and a snapshot that repeats the last one is dropped, because two
  identical snapshots a minute apart make a stuck scope look busy.
- **A dot that has not moved is a raised hand, not a failing grade.** Still after
  a week, stuck after a fortnight, and the sentence it produces asks what could
  be solved to get it over the hill — about the work, never about the person.
  A scope nobody has started is reported as not started instead, because those
  are different situations and calling every untouched scope stuck on day eight
  buries the one that matters.

Backsliding outranks everything else the trail can say: a scope that crossed the
crest and came back means the uphill work was done in somebody's head rather
than their hands, and the unknown was there all along. The chapter's own remedy
for a dot that will not move is in the UI too — split it in two, both halves
starting where the original was, the original keeping its id so its trail is not
orphaned.

Stored under a `hill:<job id>` settings key, the way daily notes already are, so
every job has a chart the moment it exists and no migration runs to make that
true. The rules live in `artifact-src/core/hill.ts` and import nothing, so the
same chart draws in the browser-only artifact.

## D-084 — The reader sizes the workspace, not the constants

**2026-09-08.**

Four numbers were decided in a constant and are now the reader's: how wide a
pane is, whether the menu is there, how wide any one pane is, and whether
anything sits along the bottom.

**Panes were 380px, which is a column of text and not much else.** A table, a
scorecard or a document read badly in one, so panes were for looking things up
rather than for working in. A pane you can work in has to be closer to a page,
so the default now scales with the window between 380 and 620 — and any pane can
be dragged wider from its right edge, because the default is a guess about a
window and not about what you are reading in it. The right edge and not the
left: the left edge is the spine, which is already the handle you drag to move
the pane, and one edge cannot mean two things.

**The menu closes to its icons rather than to nothing.** A menu that vanishes
takes navigation with it and leaves you hunting for the way back. Closed here
means the labels go and the icons stay: 160px returned to the page, everywhere
still one click away, and every link keeps its accessible name. It is a
preference rather than part of a trail, so it is in `localStorage` and survives
the tab; pane widths are in `sessionStorage` beside the panes themselves, so a
pane you widened to read one table is not still wide next week.

**And there is a dock along the bottom, in the manner of Obsidian's.** The rail
is for the trail of thought — where you went, in order. The dock is for the
thing you keep referring back to while you work above it: today's note, the task
list, the person you are writing about. Those are different jobs, and putting
the second in the rail is what made the rail long enough to lose the first. One
pane, not a stack — a stack down there is a second rail, and two rails is a
window with nothing left in the middle of it. `⤓` sends a pane down, `⤒` brings
it back, and it is in the URL beside the stack so a shared trail includes it.

**All four numbers now live in one store, read by all four surfaces.** They have
to: the page reserves room from the same arithmetic the rail sizes itself with,
and a layout where two components disagree about a width is a layout with a gap
or an overlap in it. One consequence worth recording — the rail's floor stays
the _default_ pane width rather than the widest pane open, so a pane dragged out
to a thousand pixels scrolls inside the rail instead of pushing the page off the
screen. Widening one pane is a request about that pane, not about the window.

Two things this turned up that were already wrong. The graph's label had claimed
you could drag its background to pan for as long as it had existed, and you
could not — `pan` was state only the Reset button ever wrote, so a graph you had
zoomed into could not be moved, which is the one thing zoom makes necessary. It
drags now, takes arrow keys, and zooms about the pointer rather than the origin
so the cluster you are reading stays under the cursor. And the menu's new toggle
was first labelled "Close the menu", which collided with every pane's "Close
<title>" — one ambiguous accessible name for two very different actions, caught
by a pane spec clicking the wrong thing. It is "Hide the menu".

## D-085 — A list is read through one attribute at a time

**2026-09-08.**

A flat table of every job or every person answers one question — what is there
— and no others. The questions actually asked are shaped differently: which of
these are critical, what is open in Berlin, how much of this is part-time,
which of my people are stuck at the same stage. Every one of those is the same
list read through one attribute, so the reading belongs in the software rather
than a page per question.

Jobs group by any of eighteen attributes and people by any of ten, sorted
inside each group, both in the URL so a reading can be sent to somebody and the
back button undoes it. The mechanics are in `artifact-src/core/facets.ts` and
know nothing about jobs or people; the list of attributes is next to the
vocabularies that define them.

**Three of the decisions are refusals to make a list look tidier than the data.**

- **Nothing is dropped for having no value.** A job with no industry set is a
  job. Blanks group together and sort last, so they read as the remainder
  rather than the headline, and the count of them is on the bar.
- **A row with several values appears under each.** Somebody tagged both
  `ai-safety` and `remote` is in both groups, so the sizes add up to more than
  the list — said out loud on the bar rather than left for somebody to notice
  while they are counting.
- **An ordered vocabulary keeps its order.** Critical before high before
  normal, however few criticals there are. Sorting those by size would put the
  busiest first, which is backwards for the one attribute where the order is
  the meaning. Open sets — company, place — have no order of their own, so
  those go biggest-first, which is where "what is this list mostly made of"
  lives.

**Priority is the default sort, and for a person it is the job's.** A person
has no priority in this product and a derived one would be a score nobody set,
so the sort is labelled "Priority (the job's)" and falls through to whether
something is due. An unset priority sorts last rather than in the middle: a job
nobody has prioritised is not a normal-priority job, it is one nobody has said
anything about.

**`tests/unit/facets.test.ts` checks the list against the columns.** Every
column on both tables is either something you can group by or is named as
deliberately not, with a reason — because "group by any attribute" quietly
becomes "group by the ones somebody remembered" the first time a field is
added. It caught two of my own contradictions on the first run: `recruiterNotes`
and `searchProjectId` were both grouped by and listed as excluded, so one of
the two statements about each was false.

## D-086 — A company is a mark, and a task is a checkbox

**2026-09-08.**

**Every company draws a mark rather than fetching one.** Initials on a colour
hashed from the name, so a list of twenty jobs is scannable by employer without
adding a column — immediately, with no network, no waiting, and no server,
which is also what makes it work in the artifact. Hue alone varies at fixed
saturation and lightness, so no row reads as more important because its company
drew a brighter colour, and the initials carry the meaning in any case: a mark
you can only tell apart by colour is one several readers cannot tell apart.

The real favicon sits on top of that and is **off unless the owner turns it on**
(`TALENTOS_FAVICONS=on`). Two reasons, and the second is the real one. It is
taken from the company's own `/favicon.ico` and never from a favicon service,
because a service would mean handing somebody else the list of every employer
this workspace looks at. And even from the company's own site, the request
tells that company's server that somebody loaded their icon — in a recruiting
tool, the list of employers you are looking at is not a neutral fact. Nothing
is lost while it is off, because the drawn mark is what the list is scanned by
and it is already there.

**A ticked task stays where it is, struck through.** It was a "Done" button
that removed the row, which is two mistakes in one control: no way back from a
mis-click, and the list lost the only evidence that anything had been got
through today. A checkbox goes both ways, reopening clears the completion time,
and done tasks stay in place for a fortnight before being counted rather than
listed — a to-do list that only grows is one nobody opens.

Writing the test for that found a bug older than any of it: `TaskList` seeded
its state from props once, so a task added by the form directly beside it did
not appear until the page was reloaded. The list now holds the props' signature
alongside its own copy, and shows the server's list whenever the two differ.

## D-087 — Three things stay put, and nothing else does

**2026-09-08.**

Sticking everything would leave a page whose top third never moves. Three
things earn it, and each answers a question you only have once you have
scrolled past the answer:

- **The title bar** — where am I, and what can I do here. Only the title and
  the actions stick; the description scrolls away underneath them, because the
  sentence that says what a page is for is one you read once, and a sticky
  block carrying both would cost three lines of every screen for the life of
  the page.
- **The column headings** — what this column means, twenty rows down.
- **The group heading** — which group you are in. Scrolling through a long
  group and not being able to say which one it is defeats the point of having
  grouped at all.

The three offsets live together in `globals.css` because they stack, and three
components each guessing the two above them is exactly how one ends up half a
row too high. `--sticky-title` is sized for the bar at its **tallest** — with
buttons in it — so a page without buttons leaves a few pixels of gap that
nobody notices, rather than one pixel too few, which clips the headings behind
the bar.

Two things this cost, and both were found by looking rather than by reasoning.
A sticky element only sticks inside its own parent's box, so the first version
— a bar wrapped in a short `div` — scrolled away after eighty pixels and looked
exactly like a bar that was never sticky. `PageHeader` returns a fragment now,
so its parent is the page. And the first set of offsets overlapped the column
headings by seven pixels, which the browser showed and the code could not: the
e2e asserts the stack has no overlap and no meaningful gap, measured, rather
than asserting a class name is present.

## D-088 — Every measure runs on the job's own clock

**2026-09-08.**

A fortnight of silence on a search the manager wants filled in two weeks is a
crisis. The same fortnight on a two-year search is a Tuesday. Every measure in
this product with the word "recent" or "stalled" in it was quietly assuming one
pace for both, which makes it wrong for almost every job: it nags on the slow
ones and says nothing on the fast ones, which is the worst of both.

So nothing measures in absolute days. `artifact-src/core/clock.ts` works out
the window from **the job's opening to the start date agreed at intake** — the
one time expectation the product actually captures — and everything else is a
fraction of it. The half-life for activity is a tenth of the window, floored at
two days and capped at sixty; the hill's still-and-stuck thresholds are scaled
by the same ratio, so a scope sits still for a day on a two-week search and a
month on a two-year one before anybody is told.

**A job with no agreed date is not guessed at.** It falls back to the fortnight
every threshold used before this existed — so nothing changed underneath anybody
— and every surface that shows a number says how many jobs are resting on that
assumption. A default nobody agreed to is not a fact about the job, and the fix
is a conversation with the manager rather than a setting.

**Priority sorts by what somebody said first, and by the clock second.** The
stated priority is a human's explicit call and nothing derived overrules it; the
agreed date is what makes two jobs at the same priority orderable at all,
because a critical role wanted in a fortnight and a critical role wanted next
year are not the same amount of critical today. A job with no agreed date sorts
as though halfway through its window — not first, because nobody said it was
urgent, and not last, because nobody said it was not.

The proportionality is also what makes one axis honest: because the half-life
grows with the window, a job worked at the pace its own window requires
accumulates roughly the same decayed total whatever that window is. Two jobs on
very different clocks can therefore sit on the same scale and mean the same
thing by their position.

## D-089 — Movement is a distribution, and it is not progress

**2026-09-08.**

A curve at the top of the jobs page: one mark per open job along an axis from
quiet to busy, and the shape they make. Most of them bunched at the quiet end
is a different week from most of them at the busy end, and neither is visible
in a list of twenty rows.

**It is not progress and must never be labelled as it.** The hill (D-083) is a
claim about what is still unknown, which nothing can measure — which is why
nothing but a person may move a dot on it. This is a claim about what has been
recorded, which is a count of rows that exist: tasks ticked, people moved
through the funnel, people added, each worth less the older it is on that job's
own clock. The two are compatible precisely because they are different claims.
A job can be busy and going nowhere, and this will say busy, because busy is
all it knows. The vocabulary is kept narrow to stop it drifting: movement,
quiet, busy — never healthy, never on track, never a percentage.

Three refusals worth recording:

- **A backwards move counts.** Somebody moving a person back a stage took a
  conversation and a decision. A measure that only rewards good news is one
  people learn to game.
- **Below four jobs there is no curve, only marks.** A curve through two points
  is a picture of two jobs pretending to be a distribution.
- **The middle job, not the mean.** One frantic job moves a mean; the question
  the line answers is where the typical job sits.

One defect a test found and reasoning had not: Silverman's rule of thumb picks
a wide bandwidth for a desk split cleanly into busy and quiet jobs, because a
split desk has a large standard deviation and the rule reads that as "spread
out" — and the wide bandwidth then smooths the two humps into one. The gap
between them is the single most useful thing the picture can show. The
bandwidth is now capped at one step of the axis, which is the finest structure
the axis can carry.

## D-090 — Notes are an outline, and every heading has a picture

**2026-09-08.**

**The note is a tree.** Bullets inside bullets to whatever depth somebody
types; click a bullet and the note zooms into that branch, with a breadcrumb
back out; click the words and the bullet turns into an arrow while the caret is
in there, so which block you are editing is visible from across the room. Enter
makes the next block, Tab indents, Shift-Tab outdents and brings the blocks
below along, Backspace on an empty block removes it and keeps its children.

It is still **one text field**, parsed as a tree and written back — no table, no
migration, no import, and a note written before any of this opens as the flat
outline it is. A block's id is its path; a zoom carries the block's first words
beside the path, so a line typed above it re-anchors by text instead of landing
on the wrong block. It gives up rather than showing a different block, which is
the failure worth designing against.

Two defects the browser found that the unit tests could not:

- **An empty bullet was not a block**, so every line you made vanished the
  moment it was saved: the render wrote `- ` and the next parse threw it away.
- **Block text was trimmed on parse**, so a trailing space could never be typed.
  That silently broke `@`, `[[` and `jj`, all of which need a word boundary in
  front of them — and it looked like the triggers being broken rather than the
  parser.

**Every heading carries an emoji, and a test keeps it that way.** 126 of 171
had none. A page of headings that all look the same is one you read line by
line; one where each has its own mark is one you navigate by shape.
`tests/unit/headings.test.ts` scans the source rather than trusting the sweep,
because the next heading somebody adds is the one that would not have had one.
It also refuses the placeholder mark the sweep used when it could not think of
anything, so no heading is left with a picture nobody chose.

**And every link answers the pointer** — underline and a brighter colour
together, as one rule in `globals.css` rather than a class a hundred call sites
have to remember. Both signals, not either: colour alone is invisible to some
readers and an underline alone is easy to miss in a dense row. `data-plain`
opts out for the few links that are a whole surface rather than a piece of
text, where underlining the label of a block you are already highlighting reads
as a mistake.

## D-091 — A slash is a command, and the first one is a to-do

**2026-09-08.**

Typing `/` in a note block opens a short menu at the cursor. It is the same
idea as the `[[`, `@` and `jj` triggers already in the editor — a character
that means "I want something" rather than a character — and it is separate from
them because those three are **recall** and this is **action**, and putting an
action behind a recall trigger is how a menu ends up with twenty rows in it.
Recall wins when both could fire: a `/` inside `[[` is somebody typing a path.

**The menu opens at the caret, not under the box.** There is no browser API for
where a caret is — a textarea's contents are not in the DOM, so there is no
node to measure — so `src/lib/core/caret.ts` builds a mirror div out of the
textarea's own computed styles and measures a marker in it. Worth the trouble
for one reason: in a block that has wrapped to four lines, "under the box" and
"at the cursor" are not the same place, and a menu you have to look away to
read is one you stop using.

**The first command is the to-do, because it is the one that goes somewhere.**
A block that becomes a task appears on the task list and on the dashboard
instead of staying a line in a note nobody reads again.

The design decision worth recording: **a to-do block does not hold its own
state.** It holds the id of a row in `tasks`, written into the text as `^<id>`
and never shown, and the tick is that row's. Two copies of "is this done" would
disagree the first time somebody ticked it on the other page, and a to-do that
disagrees with itself is worse than a plain line of text. The editor closes as
soon as the command runs, because the editor shows real text and the real text
now has a uuid in it.

Five commands and no more. A slash menu listing everything the software can do
is a second navigation, and you are in the middle of a sentence.

## D-092 — Notes are a place, and the graph follows you

**2026-09-08.**

**The note is the first thing on the dashboard**, across the whole width rather
than in a column beside five other cards — the first question a day asks is
what you are writing down. It is the same editor as everywhere else: the
dashboard's quick note was a plain box, which made it a second kind of note,
and a second kind of note is somewhere for things to get lost.

**Notes are their own section.** `/notes` is today's note with everything
written before it underneath; `/daily` stays the calendar. They answer
different questions — "what did I write about that" and "what happened on
Tuesday" — and the calendar only ever answered the second. Notes are a pane
kind too, so today's outline can sit beside whatever you are doing.

**And there is one graph pane that follows you.** It stays open in whatever
slot you put it and re-centres on whatever the current page is about: the job,
the person, the tag. Two hops, because one is a star and three is the mush the
whole graph already was at that size. On a page that is not about one record —
the task list, settings — it falls back to the busiest part of the graph, which
is the honest answer to "what is near here" when the answer is "nothing in
particular". Only the graph follows: every other pane is about the thing you
opened it on, and one that changed under you as you navigated would be a pane
you could not put anything in.

**The sticky title bar sits against the top of the window**, with nothing above
it. A strip of canvas over a bar that is holding your place reads as a bar that
has come loose.

## D-093 — The workspace on a phone, and a slash that asks

**2026-09-08.**

**Three surfaces that each hold ground do not fit on a phone.** 208px of menu
plus a page that refused to go below 420 was giving the page 167px of a 518px
window — measured, not estimated. Below 768px the menu and the pane rail stop
holding ground and lie over the page: the page has the whole width, a pane is
the window rather than a column beside nothing, and wide tables scroll inside
their own box.

That last one cost something and the audit caught it: `overflow-x: auto` makes
a scroll container, and a scroll container is what a sticky column heading
sticks to — so the headings I had just made sticky stopped sticking on a phone.
They are `static` below the breakpoint now. Turning a broken thing off is
better than leaving it looking like it works.

The menu starts shut on a phone whatever the desktop preference says, and
tapping a link closes it, because it was covering where you were going. Fields
are 16px there: iOS zooms the page whenever a focused field is smaller and —
correctly, since there is no `maximum-scale` — stays zoomed after the blur. And
the command bar, which the product tells the reader twice is how you reach
anything, could only be opened by ⌘K or `/`; a phone has neither, so there is a
button, and the two keyboard hints are hidden where they would be a lie.

**`/ask` is the second command in the slash menu.** The answer lands as child
blocks under the question, never mixed into the line you wrote, signed with
what answered it and the date; it comes back with what it is not sure about as
its own lines; and it declines to assert a fact about a named person, saying
what you would have to look up instead. With the session provider — the default
here — nothing returns at once and the note says which file is waiting, which
is the existing outbox flow rather than a second one.

## D-094 — Legibility is arithmetic, so a test does it

**2026-09-08.**

"No white text on a white background" is exactly the class of mistake that
survives a manual sweep and reappears in the next component somebody writes. So
the palette is checked by computing real WCAG ratios in
`tests/unit/contrast.test.ts`, and the check found four things:

- **`--color-ink-faint` failed on every ground it was used on** — 3.31 on
  canvas, 3.11 on panel, 2.87 on panel2 — across 239 uses, all of them 10–13px
  text. "Faint" has to mean quieter than the words beside it, not fainter than
  a reader can see. Lifted to `#7d8694`: 5.29 / 4.97 / 4.60.
- **A card painted `#f5faf7` and never said what colour its text was**, so the
  dark theme's near-white ink was written on near-white paper. Literally the
  failure the owner named. The card is deliberately paper in a dark room, so it
  declares its ink — 13.19:1 — and everything in it inherits that.
- **`text-white` on `bg-accent` is 2.68:1** and fails; every other primary
  button in the product uses `text-canvas`, which is 7.27:1.
- **`text-teal-800` on the dark pages** resolved to a dark teal on a dark
  ground. The theme is a closed set of tokens and the test now refuses any
  Tailwind palette colour, because nothing in the token system would have
  caught that one.

A `--color-line` token was added for chart line-work, which WCAG holds to 3:1
rather than 4.5: `edge2` at 1.55 is right for a 1px border between two panels
and invisible for a hill curve.

**And every control has its focus ring back.** Ten of them removed the
browser's and put nothing in its place, which makes a product unusable by
keyboard without making anything look different — which is why it survives
review. One zero-specificity rule in `globals.css` covers everything; the three
that keep `outline-none` all draw their own, and the graph's was white, which
is invisible on its green and amber records. `prefers-reduced-motion` now means
arriving at the end state immediately rather than losing it — the convention
the graph already used, applied everywhere.

## D-095 — A day is the reader's day, not Greenwich's

**2026-09-08.**

`todayKey()` computed a **local** calendar date. The query that read "what
happened on that day" asked for `<date>T00:00:00Z` to `<date+1>T00:00:00Z`,
which is the same 24 hours only in Greenwich. In California the daily page
dropped everything after 5pm and carried in yesterday's evening instead — the
page whose entire job is to show you what you did was missing the afternoon
you did it in, and nothing on screen said so.

The same mismatch was in two more places: the activity strip bucketed events
by their UTC date and labelled the columns with a local `today`, so the oldest
column was always short; and the daily calendar's filled squares were computed
from `iso.slice(0, 10)`, so a dot could point at a day whose own page was
empty.

`artifact-src/core/day.ts` now holds the only two conversions that exist, and
everything that buckets by day goes through one of them:

- `dayOf(iso)` — which local day did this instant fall on?
- `dayBounds(day)` — which instants bound this local day?

The tests are invariants rather than fixed strings, because a fixed string is
only right in whatever zone the machine happens to be in, which is the
assumption that caused this. The one that matters: `todayKey(now)` and
`dayOf(now)` must agree, and every instant must fall inside the bounds of the
day it reports. On a daylight-saving weekend one day is 23 hours and the next
is 25, and one day's `to` is the same expression as the next day's `from`, so
the windows still meet exactly and no hour belongs to no page.

## D-096 — The guard was pointed at the wrong writer

**2026-09-08.**

`runAiTask` has always scanned generated payloads for protected-characteristic
language and returned the hits as warnings. `saveArtifactJsonAction` — the
boundary a **person** types into, and in an install with no model key the only
way a payload is ever written by hand — did not. So the fair-hiring guard
covered the model's output and not the recruiter's, which is the wrong way
round: the model is the one under a mandatory non-inference directive.

It now runs the same scan, on what it saved rather than on the raw text it was
handed. Scanning `raw` would flag words the schema strips out, and telling
somebody their brief says something it does not say is how a warning learns to
be ignored.

**A hit is a flag and never a block.** Legitimate mentions exist — a benefits
line about parental leave — the recruiter is the one who can tell, and a rule
that silently refuses to save somebody's work is a rule people route around.
The save goes through, the editor stays open with an amber note listing what
was found and where, and the button says "Save again" rather than "Save", so
nothing about the state is ambiguous.

The same boundary was also skipping `ensureIds`, which `runAiTask` runs on
every payload before it is persisted. A recruiter who added a competency to a
success profile added one with no id, and the next thing to reference it by id
could not. Both now go through one `checked()` helper, and a test asserts no
handler has a private path to the database that skips it.

## D-097 — A job can be closed, and closing is not deleting

**2026-09-08.**

`search_projects.status` has existed since the first migration and the whole
product reads it — the dashboard's counts, its next-best-actions, the desk's
movement curve are all computed over open jobs only. There was no way to
change it. So every job a desk ever opened stayed open forever, and the first
number a recruiter looks at was wrong by however long they had been using it.

Three states, on the job's own header, one click each and reversible:

- **Open** — counted everywhere.
- **On hold** — out of the counts, still on the list. Not a slower kind of
  closed: it means the job is coming back, so it should not read as finished.
- **Closed** — out of the counts, every record kept and readable.

No delete. A filled job is the most useful record on a desk: it is the one
where the whole trail is complete — the strings that worked, the people who
answered, the reason the hiring manager said yes.

Two consequences worth naming. "No open jobs" is now two different facts, so
the dashboard tells them apart: a desk that has not started gets "start a
job", and a desk that has finished everything gets told its work is on file
and where. And the status was being rendered straight out of the column on
four surfaces at once — `on_hold` is not a status, it is how a status is
spelled in a database — which happened because `open` looks like English and
nobody looked at the other two. A source test now refuses it.

## D-098 — Nothing silently loses work, and nothing silently fails

**2026-09-08.**

Four things in this tranche are the same defect wearing different clothes: the
software did something, it did not work, and it said nothing.

**Notes were the one place work could simply be lost.** You typed, you clicked
a job in the sidebar, and the paragraph was gone with no warning and nothing to
undo. Every other surface writes on submit, but a note has no submit — you stop
typing because you are done thinking, not because you have finished a form. All
three note surfaces now autosave through one hook, with three details that make
it trustworthy rather than merely automatic: it says so, with the time it last
succeeded, because an autosave nobody can see is indistinguishable from no save
at all; it queues rather than races, because two writes of the same key landing
out of order would restore a paragraph the reader had just deleted; and it
holds the door, so closing the tab asks and navigating inside the app flushes.
The Save buttons stay — "did that save?" is a question people would rather
answer by pressing something than by trusting a subtitle.

**The hill chart threw its failures away.** It awaited the action and ignored
the result, which on a chart whose dots move optimistically means a dot that
slid, stayed where you put it, and was back at the foot of the hill next time
the page loaded. A chart that lies about where the work is is worse than no
chart. It now says so and drops the optimistic position.

**A to-do ticked in a note was fire-and-forget.** The box moved, the task row
might not have, and the note and the task list would disagree — which is the
exact disagreement the anchor written into the block exists to prevent, and you
would not find out until tomorrow. The box now goes back if the row refuses,
but only if that block is still the same to-do showing what was just set:
quietly rewriting somebody's note to undo a click they have forgotten is worse
than the wrong box.

**And the hill's scope actions were hover-only.** Selection was set by
`onMouseEnter`, so on a phone the scopes could be read and never changed. The
name is a button now — the mouse still reveals the actions by moving over the
row, everybody else presses the name, and a keyboard can reach it. While in
there: `drop` is the one button on that chart that destroys something, so it
takes two presses, and the confirmation says what is lost and that "off the
hill" keeps the trail.

The jobs page had no empty state at all — with no jobs it rendered a table of
headings with nothing under it, which looks like a page that failed to load,
above twenty controls for slicing nothing.

## D-099 — A pane holds the page, not a description of it

**2026-09-08.**

A pane used to hold a summary. `/api/pane` read the database and assembled
rows of label-and-detail — 639 lines of it, one hand-written branch per kind —
and the pane rendered those rows. The doc comment on it said the quiet part
out loud: _"A pane is for reading beside your work; the header always links to
the real page, which is where things get edited."_

That is two implementations of every page in the product. One of them grows
when somebody adds a feature and the other does not, so the pane was always a
snapshot of what each page looked like on the day its branch was written. You
could see today's note beside a job and not write in it. You could see the
task list and not tick anything. The owner's correction was one sentence: all
panes should be as functional as the other pages.

**So a pane loads the page.** A same-origin frame at the address that pane
stands for, and everything on it works because it _is_ the page — the forms,
the server actions, the outliner, the hill, the graph. There is nothing to
keep in step because there is one of each. `/api/pane` is deleted.

The mapping needed no invention: `paneForRoute` already turned any address in
the workspace into the pane that stands for it, so `routeForPane` is its
inverse, and a test asserts they round-trip for every kind — the property that
matters, because getting it wrong now shows the wrong page rather than the
wrong title.

Four things had to be true for this to be worth doing rather than merely
possible.

**The page has to arrive without the workspace around it.** A sidebar, a rail
and a command bar inside a 500px frame is a workspace inside a workspace. The
root layout reads `Sec-Fetch-Dest`, which is the browser's own answer to "what
is this request for" and says `iframe` exactly when we need to know — decided
on the server, so the bare page is what arrives rather than what it becomes a
frame later, and kept across every link clicked inside the pane because a root
layout is not re-rendered by client navigation. `AppShell` asks again from the
browser for anything that does not send the header.

**A pane has to know what it is called.** It reads the page's own `<title>`,
reported upward on arrival and after each navigation inside the pane — the
only source that stays right when the reader follows a link in there, which a
table of pane titles never could. A job's overview had no title of its own and
reported the product name, so the job layout has one now, which also fixes the
browser tab.

**The trail has to survive.** Shift-click still opens beside, from inside a
pane too: the handler is mounted in the framed page, notices it is framed, and
asks the rail that owns the frame. The rail works out which pane asked by
matching the window that sent the message, so opening from pane three still
replaces four and five rather than adding a sixth. A plain click now browses
_within_ the pane, which is new and right — a pane is a page, and pages have
links.

**And a test has to be able to tell "loaded" from "working".** The frame marks
itself when its page says hello, which is after hydration, which is when the
things a test clicks are actually live. Without it the pane specs were flaky
exactly as often as the machine was busy.

The one pane that changes with where you are standing rather than with what
you opened is the graph, so `/graph` takes a `focus` and the pane passes it
the record the current page is about.

**And the page behind catches up.** Work done in a pane is real work — a task
ticked, a note written, a stage moved — and the window behind was rendered
before any of it happened, so the dashboard could sit there showing a task you
had just closed in the pane beside it. Returning focus to the page is the
moment you look at it again, and the only moment a refresh cannot interrupt
anything: you are, by definition, no longer typing in the pane. It only
happens while a pane is open.

## D-100 — What this page connects to, on every page

**2026-09-08.**

Two things existed and had each gone half-missing.

The **connected strip** — the records a page touches, by name, one click away
— was on a job's modules and nowhere else. Look at a person, a tag, the notes
or the dashboard and it vanished, which is precisely when "what else is this
attached to" is the question. And the **knowledge graph** was a pane you had
to open, which makes it a picture you have to remember to want.

They are the same question — _what is near here_ — so they are one panel now,
at the foot of every page: the shape on the left, the names on the right. Both
halves matter. A graph tells you eleven things are near; a list tells you
which eleven, and the reason to write a word on two records is to be able to
read both of them back.

"Near here" means three different things, so it is computed three ways:

- **Inside a job**, the job's own records, within two links of whatever the
  page is about — a person's page centres on the person, not on the job.
- **On a tag**, everything carrying that word across every job, plus the words
  written beside it. That is the connection a per-job graph cannot hold.
- **On a page that shows a note** — home, the notes, a day — the words written
  in _that note_, and every record carrying them. What is relevant on a page
  showing a note is what the note is about.
- **Everywhere else**, the desk: open jobs, the people on them, the words
  written across them.

None of it needs Neo4j. The whole-graph page uses that when it is configured;
this had to work on a laptop with nothing running, because a panel that is
empty most of the time teaches people to ignore it.

It is a route rather than a server component because the panel lives in the
shell and the shell does not know which page it is wrapping. That is not the
duplication D-099 deleted: no page owns the question "what is near here",
which is exactly why the answer used to exist on one layout and nowhere else.

**A note on the tests.** Half a dozen specs broke, all the same way: they
asserted `getByRole("link", { name: "Ada Example" })` on a page that now names
Ada twice. Every one of them was a loose assertion that happened to work — the
fix is scoping them to the table or card they were always about.

## D-101 — Records wear their kind

**2026-09-08.**

Headings have carried a mark for a while and a test enforces it. The records
under them did not, which is the wrong way round: you read a heading once and
then scan fifty rows, and it is the rows that have to be told apart. A list of
names, a list of tags and a list of documents all look identical when they are
all plain text.

`artifact-src/core/marks.ts` is one mark per kind, and a test refuses two
kinds sharing one — the value of a mark is entirely in its consistency, and by
the time a second kind borrows a picture the reader has learned to trust it.
The aliases are deliberate and are asserted to agree: `page`/`tag`,
`job`/`search`, `person`/`candidate` are one thing under the name each part of
the code happens to use.

## D-102 — Home is what you are writing and who you are asking

**2026-09-08.**

The front page was a dashboard: counts, next-best-actions, a list of open
jobs. All of it is still there, one click away, at `/dashboard` — but a
dashboard is a report on work already recorded, and the first two things a
recruiter does in a morning are write something down and ask somebody a
question.

So home is those two, side by side. The note is today's note — the same one
the daily page and every pane hold, not a second scratchpad.

**The expert, and the team.** You talk to one conversation. Behind it are
eight specialists — intake, sourcing, outreach, screening, market, close, fair
hiring, and a generalist — and the question goes to whichever it is about.

_The routing is arithmetic._ A model choosing its own specialist would be a
second model call before the first, and wrong in ways nobody could see. It
scores the words in the question against each specialist's own vocabulary and
shows which words decided it, so a wrong route is a visible wrong route you
correct by naming a specialist yourself rather than by rephrasing until the
machine agrees. Nothing matching anything is the generalist, which is an
answer rather than a fallback: most questions somebody types are not about one
specialism.

Three things it deliberately is not.

**It does not know your records.** The model cannot see them, so anything it
said about a named candidate would be invented. Questions that need one come
back with `declined` set and a line saying what to go and look up. That is
what makes the rest of it worth reading — it is the craft, not your own
database read back to you in a confident voice. The reply is scanned for
protected-characteristic language like every other generated payload, and
flagged in the transcript.

**It does not hide the wait.** With no model key every question is a file a
Claude session fulfils, so a waiting turn names the specialist that is waiting
and the exact request path, and asking the same question again collects the
answer. That last part has a sharp edge: the handoff is keyed on a hash of the
prompt, and the prompt carries the conversation so far — so re-asking must not
append a second copy of the question, or the history changes, the hash
changes, a _new_ request file is written, and the answered one sits there
unread. The second ask has to be the same ask, byte for byte. It is, and the
loop was walked end to end to prove it.

**It does not stream.** There is nothing to stream from.

## D-103 — The page has edges of its own

**2026-09-08.**

Every surface in this workspace could be resized — the menu, each pane, the
dock — except the one you spend the day reading. Both edges of the page drag
now, independently, and either one double-clicked (or `Home` from the
keyboard) puts both back.

The usual reason to want it is measure: a paragraph across 1600px is a line
nobody's eye tracks. The other is to see more of what is behind on one side
without moving anything else.

Bounded rather than free. `MIN_PAGE_WIDTH` is enforced where the insets are
applied, so no combination of drags can squeeze the page to nothing — the
handles are 8px wide and a workspace with no work in it has no obvious way
back. On a phone there are no handles at all: the page is already the window,
and a gutter there is a page you cannot read.

While in there: `useViewportWidth` treated a window reporting **zero** width
as a phone, and collapsed the entire layout. A window with no width is not a
narrow window — it is a window nobody is looking at: a hidden tab, a detached
frame, a thumbnail capture. It now keeps the last real measurement.

## D-104 — Every company wears its own mark, and none of them are guessed

**2026-09-08.**

Favicons are **on** by default now, at the owner's instruction. They were off
because loading one tells that company's server somebody looked, and in a
recruiting tool the list of employers a workspace is looking at is not a
neutral fact. That is still true; the owner has weighed it for their own desk.

But the switch was never the real reason no logo ever appeared. `companies.url`
has existed since the first migration and **nothing in the product could write
it**, so even switched on there was no address to load an icon from. A
`/companies` page fixes that: every company anybody has named — from a job's
`companyName`, from a person's `currentCompany`, from the table itself — with
one field each, and the ones with no address listed first, because that is the
work the page exists for.

**Nothing guesses a domain from a name.** "Meridian Software" resolved to
whoever owns meridian.com would put a stranger's logo beside a live job, and a
wrong logo is worse than none: wrong silently, confidently, on the surface a
recruiter scans fastest. And nothing uses a favicon service — that would be one
request naming every employer on the desk to a third party, which is the exact
cost the original decision was avoiding, paid in full and to somebody else. The
icon comes from the company's own address or there is no icon, and the drawn
initials were always the real answer anyway.

The mark now appears wherever a company does: the jobs table, the people list,
a job's header and its facts, a person's page, and the sidebar's open jobs.

## D-105 — The expert answers in the artifact, and waits in the app

**2026-09-08.**

The owner asked the expert a question and got a file path back. The reasonable
next question was: _I thought TalentOS was going to be an artifact in Claude —
what is this?_

Both halves are real and they differ in exactly one way. The artifact runs
inside Claude and borrows the viewer's own Claude through the `sample`
capability: no API key, no server, no file. The Next app has no viewer to
borrow from and no key (D-025), so it writes the request to the outbox for a
Claude session to fulfil, which is the mechanism working rather than failing —
but in a _chat_ that reads as broken, because a chat is the one surface where
waiting an hour is not a design.

So the expert is in the artifact now too, where it simply answers. Same eight
specialists, same routing, same refusal to say anything about a named person.
The transcript is in `localStorage` rather than the search store: it belongs to
the desk rather than to any one search, and it is a conversation rather than a
versioned draft.

**And the routing had a real bug, which the owner's own first question found.**
"I'm recruiting for an ML Research Scientist — Computational Biophysics" went to
the **market** specialist, because the matcher used `includes` and "comp" is a
substring of "computational". The same fault had "hm" matching inside "rhythm"
and "rate" inside "corporate": the short stems are the useful ones and they are
exactly the ones that hide inside longer words. Matching is now anchored to the
start of a word — still a prefix, because "sourcing" has to answer to "source"
— and "comp" is gone from the vocabulary, with every word it should have matched
spelled out instead. That question now routes to the generalist, which is the
right answer: it is not a pay question, it is somebody opening a search.

## D-106 — One pixel up, everywhere, and the blocks got their width back

**2026-09-08.**

The product was drawn at 10–13px. That is a dense workspace read by somebody
who is in it all day — and a pixel too small for anybody reading it for the
first time, or in the afternoon, or on a laptop that is not the one it was
designed on.

Every size moved up by one: 830 arbitrary sizes across 99 files, the artifact's
own stylesheet, and Tailwind's named steps so `text-sm` and `text-[15px]` do
not drift apart. One pixel rather than a percentage because the ladder keeps
every rung it had — no two sizes that were distinguishable collapsed into one,
and nothing reflowed except by getting slightly bigger.

Two things had to move with it. The **sticky offsets** are measured numbers, so
they were re-measured at a real 1280px viewport: the title bar is 54px now and
a table's column headings 27px. And the **16px floor on phone inputs** — iOS
zooms a focused field smaller than that and, with no maximum-scale, stays
zoomed after the blur — is now 17px. The comment says the rule is the floor
rather than the number, because the next person to move the scale will read it.

**And the blocks.** Clicking into a block halved its width: the editor's
wrapper was `relative` and nothing else, so inside a flex row it shrank to its
content while the read-only view beside it had `flex-1`. `w-full` on the
textarea inside a wrapper that has already shrunk is a full-width box in a
narrow column. The wrapper is a flex child now, the box grows to fit what is in
it — a one-row field holding four wrapped lines is a field you edit through a
letterbox — and the read view carries the same padding, border width and
leading, so clicking into a block and out again does not twitch the whole list.

## D-107 — The journal is a scroll, and the notes get the room

**2026-09-08.**

The owner's diagnosis was the useful part: _too text heavy, the text is too
small, I get disoriented easily._ Three separate faults, and the third is the
one that matters.

**The calendar was a page per day with arrows between them.** The day you want
is nearly always a screen or two up, and clicking ← four times to reach
Thursday is four chances to lose your place. `/daily` is one scroll now: every
day, newest first, writable where it sits, unrolling as you reach the bottom.

Empty days are in it. They cost one line each and they are what makes a gap
visible — a list of only the days somebody wrote on closes the gap between last
Tuesday and this one, and the gap is information.

The date sticks to the top of the window while its day is under the cursor.
In a scroll of a hundred days that is the whole difference between orientation
and vertigo, and it is the direct answer to the complaint.

**The note is now set for reading rather than for scanning.** The outline sets
its own size — 15px on a 28px line — and every block inherits it, so a note is
never the size of a table cell, and a caller that wants it larger says so once
on the container. On the front page the note takes the wider half of the split
and opens with room in it: a box that grows from one line makes you type into
the bottom of the window.

## D-108 — The lines between parallel pages

**2026-09-08.**

The owner has asked three times to _see_ the connections between what is open
side by side, and I had been reading it as the sliding panes, which is only
half of it. The reference — azlen's `parallel-pages` — is two documents with
translucent bands drawn between them, joining a passage on the left to the
passage it refers to on the right.

So the panes draw them now. Wherever the same record is named in two open
surfaces — the same tag, the same person, the same job — a band runs from one
to the other across the gap.

It needed no new markup. `PreviewLink` already puts
`data-preview-target="tag:ai-safety"` on every reference the product renders,
so the join is **exact rather than a string match**: two people called Alex do
not draw a line. A pane holds a real page in a same-origin frame (D-099), so a
frame's references join the same way once its own position is added.

Two decisions worth keeping.

**A reference scrolled out of view pins to the edge it went past rather than
being dropped.** Dropping them left the picture empty in the ordinary case,
because the two things being compared are rarely at the same height; a line
running off the top of a pane is how you learn to scroll it.

**One band per record per surface.** Every mention of a tag in a long note
drawing its own band is a wash rather than a reading.

Building it found a real inconsistency of my own: the connected-here panel
(D-100) named a job `tag:search:<id>` while the rest of the product calls it
`job:<id>`, and handed every requirement and document a `tag:` target for a tag
that does not exist. A record with two names is a record that never joins to
itself — and it was also asking the preview API for cards it could never
return. Three kinds have an identity and a card; everything else is now a plain
link rather than a wrong one.

**Still owed.** The `concept-search` reference — type a description of a thing
and get back the vocabulary for it, ranked and coloured, live as you type — is
a genuinely good fit for the one problem this product exists to solve, and is
not built. It is the next thing.

## D-109 — A month on one screen: the days away from you are squeezed

**2026-09-08.**

The `scroll-squish-text` reference is a focus-and-context view: a band around
the reading position at full size, and everything above and below compressed
vertically until the words stop being readable and only the _shape_ remains —
the length of each passage, and where the marks are in it. The whole document
stays on screen while you read one part of it.

The journal is the surface that wants this. A scroll answers "where is the
thing I wrote" with "keep scrolling", which is the complaint it was built to
fix and only half fixed. Now the days away from the reading line squeeze down
to a sixth of their height: a month fits on a screen, you steer by shape and by
the colour of the tags in each day, and the band you scroll into opens back up.

The height is what shrinks, not just the drawing. The wrapper's height is the
content's height times the scale and the content is scaled from its top edge —
a transform alone would leave the gaps behind and change nothing about how far
there is to scroll, which is the whole point.

Three rules keep it from being a gimmick:

- **The day you are writing in never squeezes.** A field that compresses under
  the caret is unusable, so a section holding the focus is held open whatever
  the arithmetic says.
- **`prefers-reduced-motion` turns it off entirely.** This is motion tied to
  scrolling, which is the kind that makes some people ill. The scroll works
  without it and simply stays long.
- **It is a preference**, remembered, because it is a strong effect and some
  people will want the plain scroll.

The fall is a cosine rather than a line: the first hundred pixels past the band
cost less than the hundred after them, and a linear fall reads as a rendering
fault. The floor is 0.16 — below that a day is a line nobody can aim at.

**`talking-cursors` is not built and I could not read it.** The file has no
audio track and the frames show two cursors on an empty dotted canvas whose
fill darkens now and then; whatever they say is not in the video. It is also
the one reference that assumes more than one person, and this is a single-user
local workstation. Worth a sentence from the owner about what it does before
anything is built.

**Narrowed, 2026-09-08.** The owner's correction after seeing it: _only connect
parallel keywords._ It joined every kind of record, and jobs and people are
named on every page in this product — the connected-here panel at the foot of
each one names them all — so most bands were saying that the job list mentions
the job. True, and worth nothing.

A keyword is the one connection somebody **made**. `[[a word]]` written on a
job and on a person is a claim that those two things are related; a job's own
name appearing on the page about that job is not. So the bands are tags only,
and there are few enough of them to read.

With several at once, one colour is the same as no colour, so each keyword
carries its own hue — from the hash the company marks already use, so a word is
the same colour every time it is drawn.

**A switch, 2026-09-08.** On the rail the bands are drawn across, remembered
across sessions, because it is about how somebody likes to read rather than
about the page they are on.

Adding it found a real fault in the drawing, and in the squeeze beside it. Both
throttle their measuring through `requestAnimationFrame` and both cancelled a
pending frame on cleanup **without clearing the id**. A leftover id makes every
later `schedule()` return early: the component stays mounted, looks alive, and
never measures again. An effect cleanup runs on every dependency change rather
than only on unmount — so the first time anybody flipped the switch, the bands
stopped being drawn for the rest of that page's life. It only showed up because
a toggle is the one gesture that forces a cleanup with a frame in flight.

## D-110 — The logo, not the initials

**2026-09-08.**

The owner, plainly: _favicons should be the url tab logo from company home
websites — not initials._ Two things were stopping that, and only one of them
was the one I had fixed.

**A tab's logo is rarely at `/favicon.ico`.** That path is the twenty-year-old
default; a modern site declares its icon with `<link rel="icon">` pointing at a
PNG or an SVG wherever it likes. Reading that link means fetching the home
page, which is behind the policy gate (D-082) and off in this install — so the
browser walks the handful of paths sites actually serve instead, on the bare
host and on `www.`, stopping at the first that loads. One request when the
first works, and a logo instead of initials for most of the rest.

**And the initials were competing with the logo rather than standing in for
it.** They were drawn underneath and stayed there, so a transparent PNG showed
a logo on a coloured tile with letters behind it. The moment an icon loads the
square goes transparent and the letters go: initials are the fallback, not the
thing.

Still no favicon service, for the reason that has not changed: one request
naming every employer on the desk to a third party is a worse trade than the
one it saves.

**And still nothing guesses.** The companies page now _offers_ the likely
address — the name, stripped of legal suffixes, joined, dot com — in the empty
field with a button to accept it. It saves the typing and it is wrong often
enough to prove the point: "Center for AI Safety" suggests centeraisafety.com
and the real one is safe.ai. A product that wrote that down by itself would put
a stranger's logo beside a live job, silently and confidently, on the surface a
recruiter scans fastest. A person presses the button or corrects it first.

## D-111 — Two switches, one lane, and a probe that would not pretend

**2026-09-08.**

Three moves, smallest first, under one standing rule from the owner: a
permission basis may narrow or gain documentation, and may never widen. Two
landed. The third could not, and saying so is the whole of it.

**The contact URL was undocumented, which is why it was unset.** Reading pages
takes two switches (D-082) and `.env.example` mentioned neither. Worse,
`whyDisabled` answers with the first one missing — right for a refused read,
which needs one sentence, and wrong for a settings page, because with neither
set the message never mentions `TALENTOS_FETCH_CONTACT` at all. Somebody
setting `TALENTOS_FETCH=on` learns about the second half only after the first
is done, which is how a contact URL becomes an afterthought instead of what it
is: the address a site owner opens to find out who is asking and how to make
it stop.

So `readingSwitches` reports both, always, each with its own state and its own
reason for existing, and the card renders them side by side. Underneath, at
every setting, two lists: what turning both on **would** do, and what it would
**not** do — no crawl, no getting past a wall, no host the registry refuses, no
storage before a save, and no widening of a registry row. The question in front
of an unflipped switch is not "is it on".

Reading stays **off**, and the contact URL stays blank, because it has to be a
page that exists and that the owner has read. Inventing one would produce
exactly the thing the switch is for — a fetcher nobody can complain to — while
looking configured.

**The GitHub lane is on, and its limits were measured rather than quoted.**
Against `api.github.com` on 2026-09-08: `/rate_limit` reports 60 and costs
nothing (60 of 60 before and after itself); `/users/octocat` leaves 59;
`/users/octocat/social_accounts` leaves 58. So the keyless limit is 60 an hour
per IP and **a person costs two requests — thirty people an hour, not sixty**.
A token raises it to 5,000, which is 2,500 people. The settings page now says
that arithmetic instead of implying the headline number.

Three things were wrong with how the limit was handled.

_The counter is not the only limit._ A **primary** limit is 403 or 429 with
`x-ratelimit-remaining: 0`. A **secondary** limit — GitHub deciding a caller is
going too fast — is 403 or 429 with `retry-after` and the counter still
positive. Reading only the counter turned the second into an unexplained 403
and discarded the one useful fact in it. Both are read now, `retry-after` in
either of its forms, and nothing is ever retried: a retry is what turns being
asked to slow down into being blocked.

_Being told twice costs a request._ The last response's counter and reset are
held for the process, so a click made after the limit was hit is refused before
anything is sent. It is a courtesy rather than a boundary — the headers stay
the authority — and it is exactly the request a rate-limited caller must not
make. Requests are also spaced a second apart, which is what GitHub asks for
and what the two-request shape of a person made trivial to get wrong.

_And a refused second request was being read as an answer._ If the social
accounts call failed, the code returned the profile's website and silently
dropped every social account the person had added — a wrong answer that looks
like a complete one, and precisely the shape a limit reached half-way through a
person produces. It now reports the refusal.

None of this changes what the lane is: one person, one click, that platform's
own public JSON API, the addresses that person listed themselves. Never in
bulk, never for outreach, nothing stored until a specific address is kept. And
it does **not** reopen the open-index GitHub source, which stays off for the
Acceptable Use Policy §7 question that has not been answered.

**The operator probe did not run, and nothing was moved to pretend it had.**
`pnpm probe:search` needs `TALENTOS_BRAVE_SEARCH_KEY`, refuses to run on
fixtures by design, and there is no such key on this machine. All eight rows in
`OPERATOR_SUPPORT` therefore still say `unverified`, and the settings page
still says eight. It now names the key and the command, so the reader knows
what unblocks it rather than only that something is missing.

**And a probe could not have moved a registry row in any case.** The two live
next to each other on the settings page and they are different kinds of fact. A
probe observes an index answering a query. A basis records what a host's terms
permit. No number of successful requests is a reading of anybody's terms, so a
green probe is not evidence about a single host in that table.

What the registry did get is a **pin**: every host with the posture and basis
it holds today, and a test that fails if any row loosens or disappears. The
existing rule — only a basis of `read` may widen — was enforced for exactly one
case, `cleared`, and the two widenings easy to make by accident both passed.
Loosening `refused` to `handoff` passed. So did **deleting a row**, which is
the sharpest of all: an unlisted host is `open` by design (D-083), so removing
a refusal does not leave a gap, it opens a door. Both fail now, by name. The
constraint was a sentence in a comment; it is a test.

Every basis is still `assumed` or `documented-elsewhere`. Nobody has read
anybody's terms, and this changed nothing about that.

## D-112 — The queue is a page, and an answer can be pasted into it

**2026-09-08.**

Generation in this install is a file handoff (D-008): the app writes a request
to `data/session-outbox/` and waits for a Claude session to write the response
beside it. D-036 made that wait render as a waiting state rather than a red
error, which fixed the misreading — the owner had concluded that evidence
alignment and outreach were broken features — but not the underlying problem.
The queue itself was still only visible from a terminal, through `pnpm outbox`.
Every waiting panel in the product ended by naming a command the person
looking at it could not run without leaving the product.

**So the outbox is a page.** `/outbox` reads the same directory the CLI reads.
One row per request: what it asks for, what it belongs to, when it was
written, how long it has been waiting, and whether it has been answered. A
copy button puts the whole request on the clipboard; a paste field takes the
answer.

**The filesystem stays the only source of truth.** No table mirrors the
directory, nothing is cached, and nothing is indexed. A response written by a
session in a terminal and one pasted into the page are the same file in the
same place, which is the only reason the two can be used interchangeably —
and a mirror would be a second version of the queue to fall out of date.

**A paste is validated before anything is written**, against the same zod
schema the app will read the response back with. This matters more than it
looks: `createSessionProvider` parses the response file and *casts* it, so an
answer missing a field has always been able to become a failure somewhere else
entirely, with nothing pointing back at the file. That was survivable while
the only way to answer was a session writing the file itself. It is not
survivable once a person can paste into a box. `src/lib/ai/schemas.ts` indexes
every task's own schema by the name it already declares — one contract,
indexed, not a second one — and a test asserts it covers every `schemaName` in
the source, so a task added without being registered fails the build rather
than silently losing the check.

**A rejection names the field.** "Invalid response" sends somebody back to a
hundred-kilobyte prompt with nothing to look for. Nothing is written on a
rejection, and the write itself is a rename over a temporary file in the same
directory, so there is no moment at which a half-written response exists for
the provider to read.

**An answer to the home conversation lands without the question being asked
again.** The chat records the request path on its waiting turn, so a pasted
answer is collected by calling `askExpert` with the same question — the
identical call the ask box makes. It collects rather than re-asks because the
handoff is keyed on a hash of the prompts: an answered request reads its
response file instead of writing a new one. Reproducing the original routing
matters for the same reason, and is why the specialist is named explicitly
when the router would now pick a different one — a different specialist is a
different system prompt, which is a different hash, which would write a second
request and leave the answered one unread.

**Alternatives rejected.** A table mirroring the outbox — rejected: two
sources of truth for a directory that is already authoritative, and the CLI
would write to one of them. Re-running arbitrary generations from this page —
rejected: a request file does not carry the job's id, only the job's title in
its prompt, and re-running a job's generation from a page that inferred the
job from a string is a worse failure than saying where to press the button.
Validating against the `outputJsonSchema` carried in the request file —
rejected: it is derived from the zod schema, so checking against it checks a
copy; the schema the app actually parses with is the one worth checking.
Hiding answered requests — rejected: the second question anybody asks a queue
is whether something ever got answered.

**Still true after this.** Only the home conversation is collected here.
Everything else is written to the file and picked up by the button that asked
for it, which is now one press rather than a terminal round trip, and the row
says so. The page has no artifact path: the browser-only build has no
filesystem and no outbox, and generation there is a different arrangement
entirely — this is one of the places where local and artifact genuinely
diverge rather than one being a subset of the other.
