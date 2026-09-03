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
- **The artifact's IR shape is duplicated and untested** (D-017). The four
  backstops and the rule text are held in place by
  `tests/unit/artifact-hygiene.test.ts`, but the IR field names in
  `artifact/talentos-lite.html` are not: rename a field in
  `src/lib/core/ir.ts` and nothing fails until someone opens the artifact.
  Cheapest fix is a test that reads the zod schema's field names and asserts
  each appears in the artifact's shape strings.
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
