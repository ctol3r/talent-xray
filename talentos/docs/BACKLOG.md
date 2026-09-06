# TalentOS — Backlog

Ideas and known gaps land here instead of creeping into the current work
(anti-drift rule). Source is noted per item.

## Search String Lab — findings from the CAIS golden-test judge review (2026-09-01)

CLOSED by Wave A (2026-09-05, `docs/WAVE-A-REPORT.md`): per-engine word
budget with split-not-truncate, cross-surface dedupe by normalized text,
profession-aware platform pruning from the strategy's channels, channel
coverage check, and string-level QA warnings — all in
`src/lib/domain/query-normalization.ts`, shared by both composer callers.
Remaining follow-ups from that wave:

- **`countTerms` lives twice** — `src/lib/domain/query-normalization.ts`
  and `artifact-src/core/query-compiler.ts` — kept in parity by a unit
  fixture, not by a shared module. Consolidate when the artifact's
  compiler and the app's normalization are next touched together.
- **Operator dialects** (`NOT` vs `-`) for non-Google platforms: the app
  has no such platform yet; the artifact compiler already models them.
- **Per-channel candidate attribution** (which channel a saved candidate
  came from) — the yield ledger attributes to strings and engines only;
  D-022's minimum-sample rule still applies before any channel is judged.
- **Browser-companion captures carry no query** by construction, so they
  never appear in the yield ledger. Acceptable; noted so nobody "fixes" it.
- **Yield rollups by industry or geography** — only the normalized role
  title is rolled up today.

## Calibration loop — follow-ups from Wave B (2026-09-05)

- **Model-assisted term extraction** through the session provider: hook
  point is before `deriveTermDecisions`, gated by
  `TALENTOS_CALIBRATION_MODEL_TERMS=1`, grounded by requiring every
  returned term to be a substring of a supplied accepted quote.
- **Feed calibration signals into `renderProjectContext`** so the
  expansion model sees them; needs a corpus run to score before it ships.
- **First-class `corrected` decision value** in `document_reviews`; today
  inferred from the `Corrected by connection <id>` note convention.
- **Use `evidenceSpec` / `falseSignals`** from the IR as additional match
  vocabulary once the W12 corpus can judge precision.
- **Weight signals by pipeline stage or HM decision** (an accepted anchor
  on a hired candidate should count for more).

## Other

- **Session provider in the UI**: surface pending outbox requests as a
  visible queue state ("waiting for a Claude session") instead of an error
  toast, with a copyable fulfillment instruction. (Provider exists — D-008;
  UI affordance is the gap.)
- **TalentOS-Lite artifact**: a claude.ai artifact companion using the
  `sample` runtime capability (Claude calls billed to the owner's
  subscription, no API key) with `db` persistence — candidate for a
  lightweight on-the-go surface; the local app stays the system of record.
- **Composer OR-group de-duplication** — CLOSED by Wave A:
  `normalizeStringLabInput` de-duplicates within and across vocabulary
  tiers before either caller reaches the composer.
- **Audience research query phrasing**: `audienceQueries` concatenates the
  industry string with fixed phrases, which can repeat words ("AI safety
  research research team"). Searches still worked in the W11 live run; a
  small normalization (drop duplicated adjacent words, fall back to the role
  when the industry is unset) would read better. Keep them deterministic.
- **Persona re-derivation under the session provider**: `derivePersonas`
  renders the canonical IR — including any stored personas — into the
  prompt, so re-deriving after personas exist yields a new request hash.
  Either omit `personas` from the `derive_personas` context or clear them
  before re-deriving; `generateOutreach` already avoids re-derivation.
- **TalentOS-Lite outreach has no research gate**: the artifact's outreach
  draft (W10) is not routed through D-013's persona/research gate; bring
  it in line or label its drafts "not research-backed".
- **Crew outreach critic pass**: the W7 critic is not wired for the
  `outreach` job (persists as sequence rows); with personas now in the IR,
  a critic check that every audience claim cites a stored finding is a
  natural addition.
- **W12 S-1…S-5 are fixed but unmeasured** (`eval/w12/REPORT.md` §15). The
  deterministic half is scored — 14 failures removed, 0 introduced, via
  `pnpm eval:w12 --run full --project-hygiene` — but the prompt half is the
  larger half and needs a fresh corpus run against an API key to score at
  all. `false_signal_recall` (S-1) and `contradiction_detection` (S-5) are
  prompt-only and have no evidence behind them yet. Run the corpus with a
  key and an independent judge before treating any of these as done.
- **W12 S-6…S-10 are fixed but the prompt half is unmeasured**
  (`eval/w12/REPORT.md` §16), same caveat as S-1…S-5. `proxy_identified`
  (72.7 %) and `contradiction_detection` (76.9 %) do not move under the
  deterministic backstops at all.
- **`replan_signal` cannot separate a definition edit that changes who
  qualifies from one that does not** (`REPORT.md` §16.1). Both narrowings
  tested trade false positives for false negatives on real re-plans, so the
  coarse check stands. If the judge is ever run, this is a dimension worth
  giving it.
- **Some residual `false_signal_recall` / `evidence_signal_recall` gap is
  instrument literalism** (`REPORT.md` §16.5): the corpus asks for tokens
  (`retention`, `years`) where the system wrote the same thing in other words
  (`tenure of their line across seasons`). Do not widen the aliases to fit
  the implementation; if the judge runs, let it score these semantically.
- **Corpus gap — no protected-trait case for sex or gender.** The text
  scanner had no gender pattern until W12 and the corpus would not have
  caught it; add a conversation where a manager genders the role.
- ~~**The artifact's IR shape is duplicated and untested** (D-017).~~ Closed
  by W13/D-019: the artifact is built from `talentos/artifact-src/`, which
  imports `src/lib/core/ir.ts` and `src/lib/core/payloads.ts` directly, so a
  renamed field is a build error. The marker-slicing test that stood in for
  this is deleted.
- **The artifact's ported brain has never been scored.** The corpus harness
  needs a filesystem and a scorer, so a published page cannot run it. If a
  key ever arrives, run the corpus against the artifact's prompts as well as
  the app's — they have diverged before and will again.
- **`ContradictionIR` has no stable identity.** `preserveContradictions()`
  (D-018) matches on claim-text similarity because the schema gives it
  nothing better — `id` is optional and the reasoner does not reliably emit
  it. A required id, assigned when a contradiction is first recorded, would
  make carry-forward exact instead of heuristic. Not taken now because no
  corpus failure demands it and W12 earned no schema change; revisit if a
  real run shows the matcher mis-pairing.

## Added by W13 (TalentOS Universal, Phase 1)

- **Three research connectors are declared and unwired.** `bigdataAdapter`,
  `npiAdapter` and `publicationsAdapter` in
  `talentos/artifact-src/core/research.ts` know where they apply (industry,
  role family, geography) and return `unavailable` with a reason. Wiring
  them through the `mcp` capability is Phase 3 and needs a real
  request/response observed in session first, per-viewer consent, and a rule
  that a connector-backed artifact is never published publicly.
- **The artifact is ~990 KB unminified.** esbuild `minifyWhitespace` and
  `minifySyntax` are available and not enabled (D-019). Readable traces in
  the published page were judged worth more than the bytes; revisit if the
  page grows toward the 16 MB limit or if load time becomes visible.
- **`ProgressTracker` reports `resumable` but nothing resumes yet.** A crew
  run that fails halfway records which steps completed; the UI offers a
  fresh run, not a resume. The state to do it properly is already there.
- **Metrics exist as a contract with no producer.** `metricResultSchema` and
  `rateMetric` are implemented and tested; no module emits metrics until the
  pipeline events of Phase 4 exist. `OutputEnvelope.metrics` is always empty
  today, which is honest but worth remembering.
- **The envelope's repair pass is one attempt.** A module whose next steps
  fail validation twice is stored with its issues visible and marked
  `needs_review`. Whether a second repair is worth the call is unmeasured.

## Added by W14 (Phase 2, and the honest half of Phase 3)

- **The three connectors are declared but not wired.** `core/connectors.ts`
  reports each one's real state for the viewer; `retrieve()` returns
  nothing. Wiring needs one observed request/response pair per tool — the
  attempt in the W14 session was refused by the environment's permission
  classifier. When that observation can be made, set `wired: true` for that
  adapter only, and declare `capabilities.mcp` with the minimal manifest at
  the same time.
- **Declaring `capabilities.mcp` bars public sharing of the artifact.** That
  is a product decision the owner has not been asked to make, and it should
  be made when the first connector actually works, not before.
- **`watchTool` is unused.** The bridge only ever calls `listTools()`. When
  a connector is wired, displayed connector data should use `watchTool` so
  it replays, refreshes and coalesces — `callTool` is for actions.
- **Phase status ignores advanced entries entirely.** The Golden Test and
  the legacy role read never count towards Learn or Define. That is
  deliberate (they are diagnostics and alternates), but it means the Learn
  phase reads "Complete" with nothing in it.
- **The action queue has no target dates in the UI.** `ActionItem.targetDate`
  is stored and rendered when present, but nothing sets it yet.
- **Actions cannot be filed under an initiative from the UI.** The grouping
  reads `initiativeId`; nothing assigns it yet, so every action lands in
  "Unfiled" until that control exists.

## Added by W15 (Phase 4: pipeline and metrics)

- **`compareMetric` has no caller.** Comparing two periods needs a stored
  measurement per period; today metrics are computed live from all events.
  Snapshotting the metric set weekly would make "improved" reportable under
  its own rules.
- **The pivot engine has no producer.** `pivotProposalSchema` and the
  approve/reject action types exist and are confirmed-gated; nothing emits a
  pivot proposal yet. The trigger would naturally be a funnel metric below a
  threshold with enough sample.
- **No HM command centre or decision log.** Both are Phase 4 in the original
  brief and are not built. The decision log's raw material — confirmed
  actions, recorded exits with reasons, context revisions — is already
  stored.
- **Events cannot be corrected.** Append-only is right for an audit trail,
  but a mis-recorded stage currently has no compensating entry. A
  `correction` event type referencing the event it corrects would keep the
  trail honest without allowing a rewrite.
- **Time-to-reply uses the recorded times, not the real ones.** A recruiter
  who records a week of outreach on Friday gets a median that measures their
  admin habit. The metric says it is computed from recorded times; a
  separate "when did this actually happen" field would be better.

## Added by W16–W19

- **The corpus benchmark has never been run.** W18 built the runner and the
  scoring; nobody has clicked it. Its first real run belongs in a session
  where the result can be read and recorded — and it will cost roughly
  4 fixtures × (1 + turns) model calls on the viewer's account.
- **Four fixtures is a sample, not the corpus.** Widening it is a one-line
  change to `FIXTURE_IDS`, bounded by bundle size and run time. The bundle
  currently carries three corpus files; adding all twelve would be ~another
  200 KB before minification.
- **W18 measures the artifact's prompts, not the app's.** They have diverged
  before. A corresponding in-app scorer would need no new checkers, only a
  runner.
- **Evidence quotes are matched on normalized substring.** A model that
  paraphrases inside quotation marks is caught; one that quotes a real span
  and mis-attributes what it means is not. The check is about provenance,
  not interpretation, and should not be sold as more.
- **`compareMetric`, the pivot engine and the HM command centre still have
  no producer** (carried from W15).
- **`ANTHROPIC_API_KEY` is unset in the remote environment**, so the
  extraction-condition corpus run cannot be executed from a Claude Code web
  session as configured. It needs either a key in the environment or a local
  run.

## Added by W20

- **The engine link-out cannot be observed from here.** The URL format is
  the reference console's own and the two `cx` values are the live engines,
  but no test in this repo opens `cse.google.com`. The first real run is the
  owner's, in a browser; if Google changes the hosted-page hash format, the
  app's JSON-API provider is unaffected and the artifact's link needs one
  constant changed.
- **Results stay in the other tab.** Adding a person from the engine's
  results page is still copy-paste into the Add-candidate form. A
  "paste a result URL" quick-add that pre-fills the profile link is a small
  addition; anything that reads the result page is not allowed.
- **The wheel's short labels truncate at 26 characters.** Real step titles
  are sentences; the full title is in the hub on hover/focus and in the
  button's accessible name. A two-line label would fit more.
- **The deck's front card is session-only.** Deliberately (D-027); a
  per-viewer preference could keep it without making it a fact about anyone.
- **Parallel pages shows one text source at a time.** A candidate with both
  pasted text and notes gets a selector; ribbons never cross sources.
- **The deck could host outreach drafts.** The owner's concept was a
  template gallery; the same component would fan a candidate's outreach
  steps if that proves more useful than the candidate view.
- **The viewer may refuse new tabs.** On the owner's first real click the
  engine link opened nothing: a sandboxed frame can decline `window.open`
  and an `<a target="_blank">` then fails silently. Every outbound link now
  goes through one handler that tries to open the tab and, if refused, shows
  the URL to copy with the right-click route spelled out. What the viewer
  actually allows is still undocumented (2026-09-04); a tab that opens but
  arrives sandboxed would show a blank engine page, and the same copy-the-
  link route is the answer there too.

## Owner ideas of 2026-09-05 — what was built, what was not, and why

Five ideas arrived in one message: a compensation range, Athens/Roam-style
bi-directional links and a knowledge graph, recommended sources for both
exposure and candidate sourcing, a Chrome extension, and an autonomous
"agentic CRM companion" that recognises profiles, bios, emails and phone
numbers while the recruiter browses and gathers them as it goes. Each was
assessed against root CLAUDE.md, LEGAL.md and the decision records by five
independent review passes before anything landed; a Codex session then built
the doctrine-compliant shape of each on this branch the same afternoon
(compensation in `4a23c86`; the other four uncommitted at the time of
writing). What follows is the residue — the part of each wish doctrine does
not allow, what the built version still owes, and the questions only the
owner can answer. Source: owner request 2026-09-05.

- **Compensation band (built: Market page, `docs/COMPENSATION.md`).** Lands
  as an evidence workbench: keyless request, findings import as unreviewed,
  deterministic median-of-bounds band labelled provisional. Since the first
  cut it also binds the pasted response to the request's context hash, scans
  source text for protected-trait references before saving, survives an
  unreadable saved record, and counts a publisher once across scheme/`www.`.
  Still owed: store the research request alongside the saved record (rule 2
  and D-013 store the query, not just the findings); an `origin` field so an
  imported source carries a visible "imported · unverified" badge rather than
  only an unticked box; an e2e for the stale-context path (unit-tested only);
  a decision record. Dropped by doctrine: a figure the product authors from
  its own knowledge or a model estimate, percentile or market-position claims
  (no licensed pay data, no research backend — D-010 `none`), any use of a
  candidate's salary history, automatic propagation into the JD, personas or
  offers. Owner questions: is the band for the search brief only, or meant to
  become the posted good-faith range (that decides the pay-transparency
  posture: CO, CA, NY, WA, IL and EU Directive 2023/970)? Base pay only, or a
  separately labelled total-compensation band for OTE roles?
- **Knowledge graph (built: `/graph`, a derived projection plus recruiter
  links in `settings`).** Nodes and edges are read from existing rows and
  payload id references at render time; manual links are a labelled,
  actor-stamped, 500-cap JSON blob per search — no migration, no graph
  database. Dropped by doctrine: Roam/Athens free-form `[[pages]]`, `#tags`
  and blocks (a free-form-adjacent structure that LEGAL.md guardrail 4's grep
  cannot see), a graph store as system of record (D-002/D-003, CLAUDE_HANDOFF
  step 4), unlinked-reference mining of CV text (D-013), fetch-to-expand
  nodes (rule 1), edges for unsaved results (rule 2), centrality or degree
  sizing of candidate nodes (drifts from navigation toward automated ranking —
  D-027; EU AI Act Annex III treats recruitment as high-risk). Still owed:
  manual links are not yet included in `exportCandidate`/`deleteCandidate`,
  so the DSAR path (guardrail 5) under-reports them — add them in the same
  change as any further link feature; a corrupt blob throws and blanks the
  page (same class of defect the compensation service just fixed). Owner
  question: cross-search edges (shared company rows, shared saved URLs) or
  not, given the product has no cross-search person identity by design?
- **Source recommendations (built: Sources page — keyless request with a
  context hash, preview, protected-trait scan, explicit save into
  `source_channels`).** Exposure and sourcing are one `purpose` label per
  venue (sourcing / exposure / both). "Best" is priority + why-relevant + cost
  - cited evidence; certainty stays `inferred` (or `unknown` with no evidence)
    until a recruiter verifies. Dropped by doctrine: any synthetic score (D-010
    rule 2), confirming a venue by fetching it, posting or syndicating the role,
    and audience targeting keyed to a protected characteristic — including a
    "diversity venue" toggle. Still owed: `purpose` and evidence live inside the
    channel `note` as tagged JSON; a real column needs the owner's explicit
    migration instruction; per-channel performance needs candidate→channel
    attribution plus D-022 minimum samples. Owner question, legal in nature:
    may exposure recommendations name affinity-group venues at all? The text
    scanner cannot decide that; the prompt currently forbids protected-trait
    targeting and says nothing about affinity venues.
- **Chrome extension (built: `browser-extension/` — Manifest V3, `activeTab`
  only, no host permissions, no content script, no background worker; it
  opens the local `/capture` page with the tab URL and title in a URL
  fragment).** A bookmarklet does the same for any browser; a paste form is
  the fallback. Dropped by doctrine: the cross-device half of "travels with
  you" (it would need internet exposure of a no-auth server; that case is the
  Lite artifact's), any reading of page content, background capture, site
  automation, candidate data in extension storage. Still owed: Safari needs a
  separately signed wrapper; Firefox is untested; store publication needs a
  privacy policy and review (sideloading needs none). Grey area for the
  owner: the **tab title** is captured as an editable label. LEGAL.md §1
  names "just the title tag" as content we never request; nothing is
  requested here (the tab is already open), but on linkedin.com the title
  encodes name · headline · company, so a saved label is a small piece of
  profile text. Keep it (editable, one per click, reviewed before save) or
  drop to URL-only — the owner's call.
- **Agentic CRM companion (not built as asked; the companion above is the
  compliant subset).** Dropped, with the rule that drops it: reading visited
  pages (rule 1; LEGAL.md guardrail 1; LinkedIn User Agreement §8.2 names
  "browser plugins and add-ons" that copy profile data), extracting emails and
  phone numbers (guardrail 3 admits only name-pattern hypotheses labelled
  unverified), persisting extracted fields (rule 2; DATA_MODEL "deliberately
  absent"), auto-linking or merging people (`identity.ts` never merges),
  auto-connect or auto-message (ARCHITECTURE §11; CLAUDE_HANDOFF out of
  scope), model recognition inside the extension (no API key; D-008 rejected
  that path because it bypasses schema validation, the fair-hiring scan and
  the audit log). Legal landscape on file: GDPR Art. 14 notice when data is
  not collected from the subject; CCPA/CPRA covering applicants since 2023;
  hiQ v. LinkedIn (no CFAA liability, but the contract claim survived and the
  case ended in an injunction); Meta v. BrandTotal (an extension reading pages
  inside logged-in sessions); FTC data-broker orders on aggregating "public"
  data into dossiers. Survives: one click per page, the URL (and reviewed
  title), recruiter-typed notes, suggested matches from data already held,
  render-only unverified contact hypotheses. Owner question: does "makes
  connections as you go" mean (a) links between records the product already
  holds, or (b) sending LinkedIn connection requests? Only (a) exists or can.

Common residue across the four new surfaces: none has a DECISIONS.md entry
or an IMPLEMENTATION_PLAN.md wave section yet; the fair-hiring age pattern
was widened in the same batch (`candidates over 10 …` now matches), which
will refuse imports on ordinary JD phrasing about years of experience —
decide whether to narrow it to age-bearing phrases; and CLAUDE_HANDOFF.md
step 4 still says the next work is chosen from pilot evidence. These were
owner-directed, which is the exception the anti-drift rule allows, but the
3×5 pilot has not run and nothing here should be read as its result.

## Added by the hireEZ-alternatives read (2026-09-05)

Source: `docs/COMPETITIVE-HIREEZ-ALTERNATIVES-2026-09-05.md`. Not built;
appended per the anti-drift rule.

- **Rediscovery first.** Before any external discovery run, rank the
  recruiter's own saved candidates against the new search's canonical
  requirements using the existing anchor machinery, and show that list
  ahead of the engine link-outs. Gem sells this as "AI Rediscovery"; on a
  local SQLite it is a query over tables that already exist.
- **TalentOS as a local MCP server.** Expose the search context, the
  requirement set and "validate and import suggestions" as tools a Claude
  session can call, replacing the outbox copy-paste of D-008 without giving
  the app a model key (the session still holds the model). SeekOut MCP does
  the inverse (vendor data into the assistant); here the assistant comes to
  the recruiter's local data. Generalises the "session provider in the UI"
  item above.
- **Determinism metric.** Re-run a stored string N minutes later and record
  result overlap in the yield ledger (`search_query_runs` already has the
  shape). Published figure to set against the 14 % shortlist self-overlap
  reported for AI screeners.
- **Wording, not code:** replace "explainable" with "verifiable" in product
  copy (every vendor on the list now prints a reason beside a score; none
  lets you check it against the source); Wave E labels read
  "registry-matched · CMS NPPES", never "verified" (Findem + Glider own that
  word for assessment-time identity checks).
- **Browser companion guardrail** before the uncommitted Codex work lands:
  capture only on explicit recruiter save, per-site opt-in, and a plain
  warning that LinkedIn suspends accounts for extension-driven sourcing
  (Juicebox is the documented case).
