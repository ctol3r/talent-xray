# Wave H2 — Profile connections, second half. Report

Date: 2026-09-07. Executor: Claude. Branch `codex/talentos-connected-review`.
Design: `docs/WAVE-H-PROFILE-CONNECTIONS.md`. First half:
`docs/WAVE-H-REPORT.md`.

Status: **BUILT and gated.** Everything named as Wave H2 in the first
report has shipped, including the live adapter observation the first report
listed as outstanding. D-035 can now be written into `DECISIONS.md` covering
both halves.

## What a recruiter can do that they could not this morning

Open a candidate and get six ready-made searches for that person's other
profiles — by name and employer, LinkedIn only, by a distinctive handle,
across registries and author records, on pages that print someone's other
addresses, and across speaker rosters. Each opens on the engine's own results
page. Paste back what is worth keeping and it lands on that person with its
provenance and in the yield ledger under the template that found it.

Then send one message that tells the person what is held, asks which
addresses are actually theirs, and carries the notice the law requires.
Record their answer: confirmed addresses become the strongest tier in the
system, denied ones are deleted and blocked everywhere for good.

Two more sources of declared links are wired: Wikidata for notable people and
ORCID for researchers.

## Built

| Piece                                              | File                                                              |
| -------------------------------------------------- | ----------------------------------------------------------------- |
| Six sweep templates, budget-safe, no URL generated | `src/lib/domain/profile-sweep.ts`                                 |
| Sweep panel on the candidate page                  | `src/components/profile-sweep-panel.tsx`                          |
| Sweep runs and saves in the existing ledger        | `src/lib/services/discovery.ts`, `query-yield.ts`                 |
| The Article 14 message, and what came back         | `src/lib/services/profile-confirmations.ts`                       |
| Confirmation page and its form                     | `src/components/confirmation-request.tsx`, `.../confirm/page.tsx` |
| Wikidata and ORCID adapters                        | `src/lib/profiles/{wikidata,orcid}.ts`                            |
| Data-subject requests in Settings                  | `src/components/data-request-card.tsx`                            |
| Per-template rollup                                | `sweepYieldForProject` in `query-yield.ts`                        |

## The live observation (D-021)

All four adapters were run once against public targets and the shapes are
recorded in `docs/PROFILE-ADAPTERS-OBSERVED.md`. None is "built, not
observed" any more.

| Adapter  | Target                | Addresses returned              |
| -------- | --------------------- | ------------------------------- |
| GitHub   | `octocat`             | 1                               |
| Keybase  | `max`                 | 6, all cryptographically proven |
| ORCID    | `0000-0002-1825-0097` | 3                               |
| Wikidata | `Q42`                 | 1                               |

Nothing that must not leak did: the GitHub response carried an email, a
location, a bio and follower counts, and none reached the output.

## Decisions taken during the build

- **The registry sweep covers licensed and research people in one string.**
  Splitting them would make the recruiter guess which kind of person they are
  looking at before searching.
- **Keybase reports, it does not check on a date.** The live read showed the
  API answers with its current verdict and no original proof timestamp, so
  the label says "reported on" and the date is when Keybase told us.
- **A sweep string is never emitted over budget.** Exclusions are appended in
  a fixed order until the limit and the rest are named on screen. This is the
  Wave P pilot finding turned into a rule: Google drops the tail silently,
  including the site restriction.
- **A handle is only searched for when it is not just the person's name.**
  `jrivera-dev` is worth a search; `jordanrivera` tells you nothing the name
  search has not already found. LinkedIn slugs are never handles.
- **The confirmation message names its own Article 14 elements.** Each one is
  a fixed point with a test: who is asking, why and on what basis, what is
  held, for how long, where it came from, the right to object in its own
  paragraph, the right to a copy, and how to complain.

## Gates

All five ran on the worktree head and passed.

| Gate                          | Result                                             |
| ----------------------------- | -------------------------------------------------- |
| `pnpm verify`                 | 65 test files, 679 tests passed                    |
| `pnpm e2e`                    | 11 passed                                          |
| `pnpm e2e:artifact`           | 30 passed                                          |
| `pnpm smoke`                  | Critical path OK: 20 steps, 17 queries, 4 channels |
| `pnpm test:documents:defects` | both defects DETECTED                              |

New this wave: `tests/unit/profile-sweep.test.ts` (18),
`tests/unit/profile-confirmations.test.ts` (11), six more cases in
`declared-links.test.ts`, and a second end-to-end run covering the whole
loop from sweep to answer.

The fair-hiring grep caught two comments of mine that named a protected
characteristic while explaining that the code never reads one. Both were
rephrased. That is the guard working, and it is recorded here rather than
quietly fixed.

## Still open

- **Wave G** (the public cost model and the refusals) now has everything it
  needs from this side.
- **The owner's option (B)**, the handle-pivot URL guesser, remains unbuilt
  and remains the owner's call.
- **ORCID's terms.** The adapter ships behind `TALENTOS_PROFILES_ORCID` and
  refuses to run until set, because the Public API is offered for
  non-commercial use and a product sold to recruiters is not that. The flag
  is safe for the owner's own use; a launch needs the licence question
  answered.
- **The pilot** still needs a third job description, and Searches 2 and 3.
