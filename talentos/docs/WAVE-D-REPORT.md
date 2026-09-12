# Wave D — Bring-your-own-data imports

Status: **CLOSED** 2026-09-06 — every gate below ran green on the worktree head.
Executor: Claude (2026-09-06). Plan: `docs/ACTION-PLAN-2026-09-05.md`,
decision record D-031. No migration.

## What shipped

- `src/lib/imports/csv.ts` — hand-written RFC 4180 parser (BOM, CRLF,
  quotes, escapes, embedded newlines, ragged rows, limits).
- `src/lib/imports/json.ts` — array / `{results|data|items}` flattened one
  level into the same header mapping.
- `src/lib/imports/contracts.ts` — limits (5 MiB, 2000 rows, 100 columns,
  2000 chars/cell, 5 URLs/row), `IMPORT_SOURCES`, `CANONICAL_FIELDS`, the
  canonical `importedRowSchema` with **no CV field**.
- `src/lib/imports/mappers.ts` — allow-list mappers for hireEZ, LinkedIn
  Recruiter, generic ATS and Heartbeat.ai; `detectSource`;
  `headerMapping` with per-header overrides; `mapRows`; Heartbeat NPI →
  official-registry link-out only.
- `src/lib/imports/scan.ts` — blocked headers dropped and named before
  mapping; kept cells scanned as warnings; `rowKeysAreClean` for commit.
- `src/lib/imports/preview.ts` — pure preview: scan → map → in-file and
  existing-candidate identity checks → per-row decision
  (`create | create_flagged | skip`).
- `src/lib/domain/identity.ts` — verbatim port of the artifact matcher plus
  `same_name_same_location`; no merge instruction exists in the type.
- `src/lib/domain/fair-hiring.ts` — `BLOCKED_IMPORT_HEADER_PATTERNS` (the
  only module allowed to spell them).
- `src/lib/core/enums.ts` — `"imported"` source-evidence provenance.
- `src/lib/services/candidates.ts` — `createCandidate` accepts `addedVia`,
  `sourceLabel`, partial `profile`.
- `src/lib/services/imports.ts` — `previewImport` (writes nothing),
  `commitImport` (one candidate per row with `import:<source>`, registry
  link-out, opt-in contact evidence as `imported`/`unverified`,
  identity-review task for lookalikes, server-side key re-check).
- `src/lib/actions/imports.ts`, `src/components/import-wizard.tsx`,
  `src/app/searches/[id]/candidates/import/page.tsx`; "Import candidates"
  link on the candidates page; source label and vendor-data age on the
  candidate page.
- Docs: `DATA_MODEL.md`, `docs/BACKLOG.md` (Wave D follow-ups),
  `docs/DECISIONS.md` D-031.

## Acceptance tests added

- `tests/fixtures/import-fixtures.ts` — one blocked column per vendor
  fixture, a duplicate pair, quoted commas, CRLF, BOM, ragged rows, JSON.
- `tests/unit/imports-csv.test.ts`, `imports-mapping.test.ts`,
  `identity.test.ts`, `imports-service.test.ts`.
- `tests/unit/fair-hiring.test.ts` unchanged — passes only because mappers
  are allow-lists.
- `tests/e2e/import.spec.ts` — hireEZ fixture with a blocked column and a
  duplicate: "1 column dropped", mapping table, skip row, untick one,
  commit → "2 candidates created · 1 flagged for identity review",
  candidate page shows `hireEZ export · import:hireez`, tasks page shows
  the identity review.
- `scripts/critical-path.mts` — import step (preview + commit of a 2-row
  in-memory CSV, no document version created).

## Gates (recorded as actually run)

| Gate              | Command                                                                                                                        | Result                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| verify            | `pnpm verify`                                                                                                                  | green — 52 files, 535 tests; build and private-build check passed |
| smoke             | `TALENTOS_DATABASE_PATH=./data/smoke.db TALENTOS_MODEL_PROVIDER=mock TALENTOS_DISCOVERY_PROVIDER=mock pnpm smoke` (fresh file) | green — 20 steps incl. the import step                            |
| e2e               | `pnpm e2e`                                                                                                                     | green — 7 specs (adds import)                                     |
| e2e:artifact      | `pnpm e2e:artifact`                                                                                                            | green — 30 passed                                                 |
| documents:defects | `pnpm test:documents:defects`                                                                                                  | green — both guards detected when removed                         |
| root verify       | not required — nothing outside `talentos/` changed                                                                             | n/a                                                               |

Exact-head CI: still blocked by the account-wide GitHub Actions lock; the
local gates above are the gates.

Notes from the run: source detection tied on shared aliases (hireEZ and
LinkedIn Recruiter both recognise "current title"), so vendor signature
headers now count double and the generic mapper wins when no signature is
present; an override is claimed before auto-mapping so it cannot be
shadowed; the blocked-key check runs on the raw payload before zod strips
unknown keys. The smoke step first counted the JD's document version — the
helper now counts CV versions only.

## Honest limits

Vendor header names are guesses; the override UI and the generic mapper
are the mitigation, and no real hireEZ, LinkedIn Recruiter or Heartbeat
export has been seen by this code. Cell warnings can false-positive on the
`age` pattern in titles; they are warnings only.

## Out of scope → BACKLOG

Filed under "Imports" in `docs/BACKLOG.md`: audit table + undo, mapping
presets, XLSX, vendor-specific ATS mappers, cross-project identity, merge
UI, decay reminders, vendor match scores.
