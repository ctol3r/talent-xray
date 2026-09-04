# TalentOS — Backlog

Ideas and known gaps land here instead of creeping into the current work
(anti-drift rule). Source is noted per item.

## Search String Lab — findings from the CAIS golden-test judge review (2026-09-01)

The qualitative judge review of the first live CAIS golden run (Claude
session provider) graded the overall output B and named the search strings
as the weakest deliverable. Concrete follow-ups for the composer and the
string-expansion task:

- **Google's ~32-word query limit**: long templated booleans exceed it and
  silently truncate. The composer should count words per engine and split or
  trim, with a per-platform budget.
- **Cross-surface dedupe**: near-duplicate variants repeat verbatim across
  platforms; dedupe by normalized query text before persisting.
- **Profession-aware platform pruning**: portfolio x-rays (Behance/Dribbble)
  are zero-yield for ML researchers; the platform matrix should be filtered
  by the role's channel ecosystem, not emitted wholesale.
- **Strategy coverage check**: emit at least one query per channel the
  sourcing strategy names, and flag channels with no query.
- **String-level QA**: a validation pass (parenthesis balance, quote
  balance, word count, operator sanity) with visible warnings in the lab.

## Other

- **Session provider in the UI**: surface pending outbox requests as a
  visible queue state ("waiting for a Claude session") instead of an error
  toast, with a copyable fulfillment instruction. (Provider exists — D-008;
  UI affordance is the gap.)
- **TalentOS-Lite artifact**: a claude.ai artifact companion using the
  `sample` runtime capability (Claude calls billed to the owner's
  subscription, no API key) with `db` persistence — candidate for a
  lightweight on-the-go surface; the local app stays the system of record.
- **Composer OR-group de-duplication**: `composeQueries` concatenates
  titles + alternate titles (and must-have + any-of) without de-duplicating,
  so overlapping model output yields `("A" OR "B" OR "A" …)`. The IR path
  (`composeDiscoveryQueries`) de-duplicates before calling the composer;
  the String Lab path (`generateSearchStrings`) does not yet. Fixing it
  inside the composer touches the validated reference port (root CLAUDE.md:
  do not redesign), so do it as a pre-composer normalization shared by both
  callers. Found by the W8.5 golden-path walkthrough, 2026-09-02.
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
