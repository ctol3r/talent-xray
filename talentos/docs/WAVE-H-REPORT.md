# Wave H — Profile connections (first half). Report

Date: 2026-09-07. Executor: Claude. Branch `codex/talentos-connected-review`.
Design and the owner decision: `docs/WAVE-H-PROFILE-CONNECTIONS.md`.
Predecessors: D-029 (yield ledger), D-031 (imports, identity matcher),
D-032 (registry match), D-034 (link-out discovery).

Status: **the spine is built and gated. Wave H2 is OPEN** and named at the
bottom. The decision record D-035 is drafted in the design document and is
written into `DECISIONS.md` when the owner accepts.

## What a recruiter can do now that they could not yesterday

Open a candidate and see every public address held for that person, grouped
by what kind of surface it is, each one saying where it came from, who
asserted it belongs to this person, when any structured source was read,
when it was kept, and the recruiter's own note on why they believe it is the
same person. Paste ten addresses at once. Read the links a person listed on
their own GitHub profile, or proved on Keybase, and keep any of them with one
click. Nothing opens a page, at any point.

## Built

| Piece                                                                      | File                                            |
| -------------------------------------------------------------------------- | ----------------------------------------------- |
| Surface families, defaults, warning copy                                   | `src/lib/domain/surface-families.ts`            |
| Tiers, the one label producer, the Article 14 clock                        | `src/lib/domain/profile-links.ts`               |
| The one guard, add / remove / move, suppression, model and matcher filters | `src/lib/services/profile-links.ts`             |
| Declared-link contract and the two adapters                                | `src/lib/profiles/{declared,github,keybase}.ts` |
| Reading and keeping a declared address                                     | `src/lib/services/declared-links.ts`            |
| Server actions                                                             | `src/lib/actions/profile-links.ts`              |
| The card                                                                   | `src/components/profile-connections.tsx`        |
| Migration 0009                                                             | `drizzle/0009_profile_connections.sql`          |

Write paths routed through the one guard: paste, the candidate form
(`createCandidate`), `addCandidateSource`, Discover's save-as-candidate,
browser-companion capture, the Wave D import commit, and `acceptDeclaredLink`.

## Decisions taken during the build, and why

- **An unknown host is `unrecognised`, not personal-life.** The design's
  first draft treated every host outside the 102-pattern corpus as
  personal-life, which would have refused a developer's own domain, a
  professor's lab page, a hospital physician finder and a law-firm bio behind
  a written-reason gate. Those are the most valuable links a sourcer finds.
  `unrecognised` saves freely, is never an identity signal, and is never
  shown to a model.
- **A declared `unrecognised` address may be kept in one click.** A personal
  site the person listed on their own GitHub is exactly what this feature is
  for. Personal-life and document surfaces still cannot be kept from a
  suggestion at all, whatever the opt-in says: paste is the only path to
  those, because paste is a human typing an address they chose.
- **A cross-candidate duplicate is written, not refused.** Refusing it would
  have made the review task unreachable from the only write path and would
  have inverted Wave D's rule that a lookalike is flagged for a human. The
  answer to a duplicate is `Move to…`, which transfers the row intact with
  its provenance and dates so the losing record can be emptied and deleted
  without losing any link's history. Nothing merges.
- **The service nulls `origin_source_id` on delete, explicitly.** drizzle-kit
  emits no `ON DELETE` clause on `ALTER TABLE ADD COLUMN`, so the set-null in
  the snapshot does not exist in the SQL. A unit test covers the delete of a
  row that has children; without the explicit nulling it throws.
- **The row shows the address, not the platform's field name.** A link
  labelled "[Mock] linkedin" hides the thing being kept. The label is shown
  beside it as context.
- **A refusal shows one sentence, the full warning appears once.** The first
  draft printed the entire regulator paragraph twice on one screen.

## Gates

Three existing e2e specs asserted copy that this wave replaced, and each was
corrected rather than weakened: the import spec now asserts the imported
badge and the vendor name instead of the old `label · addedVia` line; the
registry spec asserts the registry badge in both places it now correctly
appears, and that clearing a match removes it from both; the new spec scopes
its task assertion because `/tasks` lists every search's tasks.

All five ran on the worktree head on 2026-09-07 and passed.

| Gate                                                       | Result                                             |
| ---------------------------------------------------------- | -------------------------------------------------- |
| `pnpm verify`                                              | 63 test files, 645 tests passed                    |
| `pnpm e2e`                                                 | 10 passed                                          |
| `pnpm e2e:artifact`                                        | 30 passed                                          |
| `pnpm smoke` (fresh `./data/smoke.db`, all mock providers) | Critical path OK: 20 steps, 17 queries, 4 channels |
| `pnpm test:documents:defects`                              | both defects DETECTED                              |

Before this wave the suite was 59 files / 589 tests with 9 e2e specs; it adds
4 unit files (56 tests) and 1 e2e spec.

New test files: `tests/unit/surface-families.test.ts` (10),
`tests/unit/profile-links.test.ts` (17),
`tests/unit/profile-links-service.test.ts` (16),
`tests/unit/declared-links.test.ts` (13),
`tests/e2e/profile-connections.spec.ts` (1 run, six steps).

The fair-hiring grep and `tests/unit/fair-hiring.test.ts` are unchanged and
green: every warning constant is written around `BLOCKED_FIELD_PATTERNS` and
a test scans each one with `scanTextForProtectedTraits`.

Exact-head CI remains blocked by the account payment lock; the gates above
ran locally on the worktree head.

## The personal database needs one command from the owner

Migration 0009 is generated but has NOT been applied to `./data/talentos.db`
(no migration runs without an explicit instruction). Until it is applied the
app refuses to open that database and says so. To adopt it:

```bash
cd /Users/christoler/talentos-connected-review/talentos && TALENTOS_ALLOW_MIGRATIONS=1 pnpm db:migrate
```

## Wave H2, still open

Per-candidate profile sweep strings and their ledger rows; the Article 14
confirmation draft, "I sent this" and the answer form; the Wikidata and ORCID
adapters; the Settings data-subject-request card; `sweepYieldForProject`. The
sweep templates must be run live on three real names before H2 closes, as
D-034 was validated, rather than tested only for grammar.

Not observed yet, and therefore not claimed: a live read from GitHub or
Keybase with the flag on. Both adapters are "built, not observed" (D-021)
until one real response shape is pasted into `docs/`.
