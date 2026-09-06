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
