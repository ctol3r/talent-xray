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
- **W12 full-corpus system defects S-1…S-5** (`eval/w12/REPORT.md` §12.1),
  deliberately deferred so the fixes are not authored against a corpus whose
  expectations the fixer has read. All five are prompt-level; none touches
  the schema. In value order: **S-1** populate `falseSignals` (worst metric
  at 54.8 %); **S-2** when a hiring manager re-asserts a JD requirement in
  their own words, the statement becomes their words and `origin` becomes
  `manager_statement` (fixes 19 failures across two metrics); **S-3** a
  market- or comparison-uncertainty is not resolved by the company stating
  its own number; **S-4** a withdrawn requirement is removed from the
  requirement set, never demoted to `preferred`; **S-5** a manager's example
  that refutes their own stated rule is recorded as a `ContradictionIR`, not
  patched into the requirement.
- **Corpus gap — no protected-trait case for sex or gender.** The text
  scanner had no gender pattern until W12 and the corpus would not have
  caught it; add a conversation where a manager genders the role.
