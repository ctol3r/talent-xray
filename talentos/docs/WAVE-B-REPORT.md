# Wave B — Decision-to-query calibration loop

Status: **CLOSED** 2026-09-05 — every gate below ran green on the worktree head.
Executor: Claude (2026-09-05). Plan: `docs/ACTION-PLAN-2026-09-05.md`,
decision record D-030. No migration: the columns were reserved in 0006.

## What shipped

- `src/lib/domain/calibration.ts` — pure: `summarizeOutcomes` (latest
  decision per link; the `Corrected by connection <id>` convention counts
  as corrected), `buildSignals` (per-requirement counts with `kind` joined
  from the live IR), `termMatches`, `shortQuoteTerm` (≤4 words, ≥3 chars,
  no contact data or URL), `deriveTermDecisions` (promote / support /
  demote / remove / flag / add any-of / add exclusion / block, named
  thresholds), `decisionsForQuery`. Dismissal never negates; removal needs
  accepted contradictory evidence; titles untouched; every term and reason
  passes the fair-hiring scan.
- `src/lib/services/calibration.ts` — `loadCalibrationSignals` (walks
  `reviewWorkspace` per candidate), `requirementLabels`.
- `generateSearchStrings` applies calibration before the D-029
  normalization and persists `calibration` (decisions filtered to the row)
  and `linkedRequirementIds` per row; the action note reports promotions,
  additions, demotions, removals, exclusions and blocks.
- `composeDiscoveryQueries(db, projectId, calibration?)` and the new
  persisting caller `generatePlannedQueries` ("Compose from search plan",
  shown when a SearchPlanIR exists) — plan `linkedRequirementIds` reach
  rows; a normalized-text collision merges linkage onto the surviving row.
- String Lab: `CalibrationPanel` (reviewed connections, per-requirement
  counts, decisions grouped by action with reasons, stale notice when
  decisions changed since generation) and per-row `TermProvenance`
  (requirement chips + `term · Recruiter · action · reason`).
- `src/lib/core/payloads.ts`: `termDecisionSchema`,
  `queryCalibrationSchema` replace the Wave A placeholder.
- Docs: `DATA_MODEL.md`, `docs/BACKLOG.md` (Wave B follow-ups),
  `docs/DECISIONS.md` D-030, `docs/COMPETITIVE-2026-09-05.md` (calibration
  row: built).

## Acceptance tests added

- `tests/unit/calibration.test.ts` — 17 tests: outcomes and corrections,
  kind join, term matching, quote-term rules, identity with no reviews,
  promotion needs two candidates, must-have cap, demotion, removal only on
  contradictory, added any-of with exact reason text, disqualifier →
  exclusion, protected-trait and contact quotes blocked, trainable stays
  supported, per-row filtering, persisted calibration passes the
  fair-hiring scan, planned queries persist with linkage and merge on
  collision.
- `tests/e2e/helpers/review-fixture.ts` — shared fixture extracted verbatim
  from `document-review.spec.ts` (`openReviewFixture`,
  `saveAndAcceptRelationship`, `selectPassage`).
- `tests/e2e/calibration-loop.spec.ts` — accept a `relevant` connection →
  Generate → panel shows 1 reviewed connection, the accepted quote appears
  as a term with a Recruiter provenance line → dismiss → stale notice →
  regenerate → notice gone, earlier rows marked stale, new rows carry no decision.
- `tests/e2e/document-review.spec.ts` — unchanged behaviour on the shared
  helper.

## Gates (recorded as actually run)

| Gate              | Command                                                                                                                        | Result                                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| verify            | `pnpm verify`                                                                                                                  | green — 48 files, 510 tests; build and private-build check passed                                                    |
| smoke             | `TALENTOS_DATABASE_PATH=./data/smoke.db TALENTOS_MODEL_PROVIDER=mock TALENTOS_DISCOVERY_PROVIDER=mock pnpm smoke` (fresh file) | green — 20 steps, 17 queries, 4 channels                                                                             |
| e2e               | `pnpm e2e`                                                                                                                     | green — 6 specs (critical-path, discovery-yield, calibration-loop, document-review, browser-companion, compensation) |
| e2e:artifact      | `pnpm e2e:artifact`                                                                                                            | green — 30 passed                                                                                                    |
| documents:defects | `pnpm test:documents:defects`                                                                                                  | green — both guards detected when removed                                                                            |
| root verify       | not required — nothing outside `talentos/` changed                                                                             | n/a                                                                                                                  |

Exact-head CI: still blocked by the account-wide GitHub Actions lock; the
local gates above are the gates.

Notes from the run: staleness first compared reviewed-link counts, which
misses a decision flipped on the same link (accept → dismiss); it now
compares a fingerprint of the decisions (`signalsFingerprint`, stored as
`calibration.signalsHash`). Regenerate adds rows and never deletes earlier
ones, so provenance lines on rows generated under earlier decisions are
marked stale per row rather than hidden; the e2e asserts that.

## Out of scope → BACKLOG

Filed under "Calibration loop" in `docs/BACKLOG.md`: model-assisted term
extraction, feeding signals into the expansion prompt, a first-class
`corrected` decision value, `evidenceSpec`/`falseSignals` as vocabulary,
stage/HM weighting.
