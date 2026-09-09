# Seed fixtures: probes cleared, demo people given names — 2026-09-08

Two things in the workstation database looked like product defects and were
not. Both are recorded here because the database is `.gitignore`d, so a change
to it leaves no other trace.

## Confirmed against the audit before anything was touched

`docs/audit/GROUND-TRUTH.md` §9 settles which rows are seed and which are real,
and its answers were checked against the database rather than taken on trust:

- **Six of seven candidates are fixtures.** Ids `C31`, `C44`, `C52`, `C54`,
  `C61`, `C73`, all on project `SP104`, all written in the same millisecond
  range by `SEED_CANDIDATES` in `src/lib/hsal/seed-sp104.ts`. Their employers
  are invented and their profile JSON is a stub.
- **The seventh is a real person** — the account owner's own record on the CAIS
  Founding Recruiter pilot, with a real profile address and a real CV.
  **Untouched.**
- **The two open tasks are not seed data**, which is the one place the summary
  needs care. §9 is explicit: "pane-staleness probe 1788897351568" and
  "catch-up probe 1788897420273" appear in no source file and were created ad
  hoc through the running app during UI testing on 2026-09-08. The numeric
  suffixes are `Date.now()` values matching their `created_at`. So they are
  test litter rather than fixtures — cleared either way, but for the other
  reason.

## What changed

- **The two probe rows were deleted** from `tasks`. Nothing referenced them:
  both had no job, no candidate, no kind and no due date.
- **The six fixture candidates were given names** — in
  `src/lib/hsal/seed-sp104.ts` so a fresh seed produces them, and in the
  existing rows so this install matches. A shortlist of "Candidate C31" reads
  as a product that could not find anybody, and it makes every screen that
  renders a name impossible to judge. The hiring manager in the same fixture
  was already `Dana Whitfield`; the candidates were the outlier.
- **The ids did not change.** `C31`…`C73` are load-bearing: HSAL evidence ids
  are built from them (`E-SP104-C31-1`), `fixtures/sp104/*.json` keys on them,
  and the adapter tests assert them. The id stays the tell that a row is a
  fixture; only the name is a name.

A backup was taken first: `data/talentos.backup-before-seed-names-*.db`.
Confirmed after: seven candidate rows, six renamed, the owner's record
unchanged, zero task rows.
