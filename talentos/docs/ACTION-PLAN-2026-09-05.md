<!-- Action plan derived from COMPETITIVE-2026-09-05.md. Owner decisions 2026-09-05. Executor: Claude. -->

# TalentOS action plan — beating Metaview, hireEZ and Heartbeat.ai

## Context

The competitive brief (`talentos/docs/COMPETITIVE-2026-09-05.md`, worktree
`/Users/christoler/talentos-connected-review`) concluded that TalentOS cannot win on
index size or scraped contact data and should not try. It wins as the **calibrated
intelligence and workflow layer on top of whatever data the recruiter already has**:
zero fabricated evidence, calibration from search one without an interview bot, a
search you can always read and edit, two-sided guidance for hiring manager and
candidate, and no seats/credits/renewal escalation.

Owner decisions (2026-09-05): full seven-item program, waved; Claude executes every
wave from this session onward; pilot corpus = candidates found through TalentOS
discovery, JDs pasted by the owner (no JD-discovery engine, no rule changes);
healthcare is "sometimes", so registry match stays but after imports and guidance.

Facts that shape sequencing:

- No personal TalentOS database exists yet (`talentos/data/` holds only `e2e.db`,
  `~/.local/share/talentos/documents` is empty). A fresh DB applies every committed
  migration silently, so the "personal migration authorization" gate has nothing to
  protect _today_. It bites the moment the pilot creates a real DB — so schema waves
  (A, D, E) run **before** the pilot DB is created, or each later migration needs an
  explicit owner backup + `pnpm db:migrate` step.
- Discovery needs the owner's Google Custom Search JSON API key in
  `TALENTOS_GOOGLE_CSE_KEY` (BYOK). Model steps run via the session provider (D-008,
  no API key). Both are owner prerequisites, not code.
- Codex left uncommitted work in the worktree (compensation, browser companion,
  knowledge graph, capture). Every wave starts by committing or stashing that work
  on its own commit so wave diffs stay reviewable.
- Exact-head CI is blocked by the account lock; local gates are the gates.

## Ground rules for every wave (from CLAUDE.md / DECISIONS.md, restated once)

- Composer `composeQueries` (`src/lib/domain/search-strings.ts`) is untouchable;
  all changes go in a shared pre-composer normalization step.
- Link out only; only explicit saves persist; nothing sends; no model API key;
  no protected-characteristic fields (`tests/unit/fair-hiring.test.ts` greps file
  content under `src/`, so raw vendor/registry field names like the NPPES sex
  field must never appear in code or comments).
- A wave is OPEN or CLOSED. CLOSED = the named acceptance tests were run and passed:
  `pnpm verify`, `pnpm smoke`, `pnpm e2e`, `pnpm e2e:artifact`,
  `pnpm test:documents:defects`, plus the wave's own new tests.
- Out-of-wave ideas → `talentos/docs/BACKLOG.md`.
- Each wave ends with a `docs/WAVE-<letter>-REPORT.md` recording what ran.

## Wave order

| Wave | Name                                                                                 | Attacks                                        | Migration                      |
| ---- | ------------------------------------------------------------------------------------ | ---------------------------------------------- | ------------------------------ |
| A    | String Lab QA + yield ledger                                                         | hireEZ opaque match, own B grade               | 0006                           |
| B    | Decision-to-query calibration loop — **CLOSED 2026-09-05** (`docs/WAVE-B-REPORT.md`) | Metaview's moat                                | 0006 (shared)                  |
| D    | Bring-your-own-data imports — **CLOSED 2026-09-06** (`docs/WAVE-D-REPORT.md`)        | turns hireEZ/Heartbeat/LinkedIn into suppliers | none                           |
| E    | Registry-verified identity (NPPES) — **CLOSED 2026-09-06** (`docs/WAVE-E-REPORT.md`) | Heartbeat/hireEZ on the verification axis      | 0007                           |
| P    | Pilot corpus through TalentOS (3 searches × 5 candidates)                            | proves every claim above                       | none — creates the personal DB |
| F    | Two-sided guidance v2                                                                | uncontested by all three                       | none                           |
| G    | Transparency: pricing model + "what we will not do"                                  | every competitor complaint page                | none                           |

Only two migrations exist in the program (0006 in Wave A, 0007 in Wave E) and both
land **before** Wave P creates the personal DB, so the owner never runs a manual
migration inside this program. Wave P is the first wave that touches real data.
Wave D is migration-free by design (existing free-text `added_via`, TS-only enum
extension, JSON profile, `tasks` rows). Wave F is migration-free (`settings` key).

---

## Wave A — String Lab QA + yield ledger (migration 0006)

**Goal.** Every string in the String Lab shows a word count, QA warnings, part labels
when split, and a yield line. No OR-group or cross-surface duplicates are persisted.
Platforms outside the strategy's channel ecosystem are pruned with a visible note; every
named channel is checked for coverage. Every discovery run and every explicit save is
attributed to the stored query that produced it, rolled up per search and per normalized
role title.

**Decisions.**

- Transformations that change what is persisted (OR-group dedupe, budget split, cross-
  surface dedupe, platform pruning) run once in a shared module and are recorded in a
  `qa_meta` JSON column. String-level checks (parens, quotes, operators, word budget) and
  channel coverage are pure functions recomputed at render, so recruiter edits through
  `QueryEditor` are checked without a write path. Warnings never hide a string.
- Ledger = new `search_query_runs` table + nullable `query_id` on `research_sources` and
  `candidate_source_evidence`. A run records the text actually sent (edited flag), engine,
  result _count_, time. A save is credited to the stored string only when the run text was
  verbatim. Rollups are live GROUP BYs, not cached in `settings`.
- Migration 0006 also carries Wave B's reserved columns (`calibration`,
  `linked_requirement_ids`) so Wave B is migration-free.
- A `mock` discovery provider (`TALENTOS_DISCOVERY_PROVIDER=mock`, watermarked `[Mock]`
  results on `https://example.invalid/...`) is the only way to drive the ledger through
  the UI in e2e without a key. Mirrors the mock model-provider precedent.

**Create.** `src/lib/domain/query-normalization.ts` (pure), `src/lib/domain/role-title.ts`,
`src/lib/services/query-yield.ts`, `src/lib/research/mock-discovery.ts`,
`src/components/query-qa.tsx`, `drizzle/0006_*` via `pnpm db:generate`,
`tests/unit/query-normalization.test.ts`, `tests/unit/query-yield.test.ts`,
`tests/e2e/discovery-yield.spec.ts`.

**Modify.** `src/lib/db/schema.ts`; `src/lib/services/generation.ts` (`generateSearchStrings`
216-270); `src/lib/services/intelligence.ts` (move `dedupeTerms` out, `composeDiscoveryQueries`);
`src/lib/services/discovery.ts` (+`queryId`, `edited`); `src/lib/actions/discovery.ts`
(`runDiscoveryAction` records the run); `src/lib/research/discovery-provider.ts` (register mock);
`src/components/discovery-panel.tsx` (thread `queryId`, edited hint, yield card);
`src/app/searches/[id]/strings/page.tsx`, `.../discover/page.tsx`; `playwright.config.ts`
(`TALENTOS_DISCOVERY_PROVIDER: "mock"`); `tests/e2e/critical-path.spec.ts`;
`scripts/critical-path.mts`; `DATA_MODEL.md`, `docs/BACKLOG.md` (close lines 12-25, 36-43),
`docs/DECISIONS.md` (one record).

**Schema (drizzle, generated — do not hand-write SQL).**

```ts
// search_queries +
qaMeta: json QueryQaMeta|null; calibration: json|null (Wave B); linkedRequirementIds: json string[]|null (Wave B)
// new
search_query_runs(id, search_project_id FK, query_id FK set null, query_text, edited bool, engine, result_count int, ran_at)
// research_sources +, candidate_source_evidence +
query_id FK search_queries
```

Wave prompt must say: generate 0006 with `pnpm db:generate`, commit sql + snapshot + journal;
migrate only disposable DBs. Column names checked against `BLOCKED_FIELD_PATTERNS`.

**Key functions** (`query-normalization.ts`): `dedupeTerms` (moved, same behaviour),
`normalizeStringLabInput`, `countTerms` (parity with `artifact-src/core/query-compiler.ts`),
`termBudgetFor(platform)` (32 for Google platforms, null for LinkedIn native), `qaQuery`,
`normalizeQueryKey`, `platformsForChannels` (always keep LinkedIn x-ray, LinkedIn native,
open web; keep GitHub/Scholar/portfolio only when a channel of that kind/name exists; empty
channels ⇒ keep all six with a note), `fitToBudget` (chunk the largest OR list, never
`mustHave`, re-call `composeQueries` with the slice and that platform; if nothing fits keep
original with `over_budget`, never truncate), `dedupeAcrossSurfaces` (first occurrence
wins), `channelCoverage`, and the single orchestrator `prepareQueries({input, extras,
channels})` used by BOTH callers. `role-title.ts`: `normalizeRoleTitle` = NFKD, lowercase,
drop seniority/stop tokens, sort, join; no taxonomy. `query-yield.ts`: `recordQueryRun`,
`queryYieldForProject` (byQuery, totals, zeroYield), `roleTitleYield` (null when no other
search shares the normalized title).

**UI.** String Lab: `CoveragePanel`, `RoleYieldPanel`, per-row `27/32 words` tag (warn when
over), `part 1/2`, `QaBadges`, `YieldLine` ("ran 3× · 2 saved · 1 candidate" / "never run"),
"Surfaces skipped for this profession: …". Discovery: dropdown labels append `· 2 saved`;
panel tracks `selectedId` and `edited`; "edited from stored string, saves will not credit
it" hint; "Yield for this search" card + zero-yield list.

**Acceptance (run to close).** `tests/unit/query-normalization.test.ts` (dedupe across tiers;
countTerms parity on 5 fixtures; qaQuery flags parens/quotes/trailing OR/`()`/over-budget
on Google only; fitToBudget splits a 40-term anyOf into ≤32 parts keeping mustHave+site
group, AND-only over-budget kept untruncated; dedupeAcrossSurfaces; platformsForChannels
with mock ML channels keeps GitHub+Scholar, prunes portfolio; channelCoverage;
normalizeRoleTitle collisions). `tests/unit/query-yield.test.ts` (run+save credit; edited
save changes totals only; roleTitleYield null vs rollup; generateSearchStrings persists no
duplicate normalized keys and every Google row ≤32 or flagged). `critical-path.spec.ts`
step 10: `/\d+\/32 words/` and "Channel coverage" visible. `discovery-yield.spec.ts`:
generate → discover → run (3 `[Mock]`) → save → reload shows `· 1 saved`; edit → run →
save → per-query stays 1, totals 2. Then the five gates.

**BACKLOG.** consolidate countTerms copies (parity test for now); NOT/`-` dialects; per-
channel candidate attribution; browser-companion captures have no query by construction;
industry/geography rollups. **Cut line:** ship ledger + unit + String Lab e2e; if time runs
out, mock discovery + `discovery-yield.spec.ts` go to BACKLOG and the wave stays OPEN.

---

## Wave B — Decision-to-query calibration loop (no migration; columns reserved in 0006)

**Goal.** Accept/dismiss/correct decisions on exact CV passages, across all candidates of a
search, deterministically reshape the String Lab vocabulary before composition, and every
affected term shows why it is there ("3 accepted anchors, 0 dismissed, R-4 Publication
record"). `composeDiscoveryQueries` gets a real persisting caller so `linkedRequirementIds`
land on rows. No model call.

**Decisions.** Deterministic only (model-assisted term extraction → BACKLOG with hook
`extractCalibrationTerms`). Per-row `calibration` JSON filtered to terms present in that
string; page summary recomputed live so stale reasons vanish on edit. **Dismissal never
negates**: demotion moves AND→OR; removal needs accepted-contradictory evidence; exclusions
only from accepted evidence on `disqualifier` requirements. Fair-hiring gate
(`scanTextForProtectedTraits`) + PII regex (`@`, 7+ digit runs, `http`) on every candidate
term and reason → visible `blocked` decision, term never added. Titles never touched.

**Create.** `src/lib/domain/calibration.ts` (pure), `src/lib/services/calibration.ts`,
`src/components/calibration-panel.tsx`, `tests/unit/calibration.test.ts`,
`tests/e2e/helpers/review-fixture.ts` (extracted from `document-review.spec.ts:20-160`),
`tests/e2e/calibration-loop.spec.ts`.

**Modify.** `generation.ts` (apply calibration, persist `calibration` +
`linkedRequirementIds`); `intelligence.ts` (`composeDiscoveryQueries(db, projectId,
signals?)`, new `generatePlannedQueries`); `src/lib/actions/generate.ts`
(`composePlannedQueriesAction`); `strings/page.tsx` (CalibrationPanel, per-term provenance
lines, requirement chips, "Compose from search plan" button shown when a SearchPlanIR
exists); `document-review.spec.ts` (use helper, unchanged behaviour); `DECISIONS.md`,
`BACKLOG.md`, `DATA_MODEL.md`, `COMPETITIVE-2026-09-05.md` (calibration row: built).

**Types.** `TermDecision {term, action: promoted_to_must_have|supported|added_any_of|
demoted_to_any_of|flagged|removed|added_exclusion|blocked, reason, requirementIds,
accepted, dismissed, contradictory, corrected, candidates, provenance:"recruiter"}`;
`QueryCalibration {generatedAt, reviewedLinks, decisions}`.

**Domain functions.** `CORRECTION_NOTE = /^Corrected by connection (\S+)$/`;
`summarizeOutcomes(links, reviews, comparisons)` → latest decision per link, correction
detected from the note; `buildSignals(outcomes, requirements)` joins `kind` from live
`hiring_intelligence` IR (snapshot lacks it); `termMatches` (word-bounded);
`shortQuoteTerm` (≤4 words, ≥3 chars, no PII); `deriveTermDecisions(input, signals)`;
`decisionsForQuery(query, decisions)`. Thresholds (named constants): promote when in
anyOf, A≥2 across ≥2 candidates, D+C=0, a linked must_have, mustHave<3; supported A≥1,
D+C=0; demote must_have when A=0, D+C≥2; remove anyOf/credential when A=0, C≥2; flag
D≥2, A=0; add_any_of from accepted quote on must_have/preferred, ≤6 per generation;
add_exclusion from accepted `relevant` on disqualifier; trainable ⇒ supported/flagged only.

**Service.** `loadCalibrationSignals(db, projectId)` = candidates → `reviewWorkspace` each
→ summarize → build; `requirementLabels`. `generatePlannedQueries` persists
`composeDiscoveryQueries` rows (provenance model_inference, purpose `${segmentLabel} — …`,
`linkedRequirementIds` = plan ids ∪ decision ids, qaMeta, calibration), merging
`linkedRequirementIds` onto a surviving row on normalized-key collision instead of
skipping silently.

**Acceptance (run to close).** `tests/unit/calibration.test.ts` (disposable DB via the
document-review fixture: outcomes + correction classification; kind join; promotion needs
two candidates; demotion; added_any_of reason text; disqualifier → exclusion; "veteran
status"/email quote → blocked and absent; identity with no reviews; mustHave cap;
generateSearchStrings persists calibration + linkedRequirementIds with an empty
`scanPayloadForProtectedTraits`; generatePlannedQueries on the IR golden path).
`tests/e2e/calibration-loop.spec.ts` (mock provider): review fixture → accept a `relevant`
link → Strings → Generate → panel shows "1 reviewed connection"/"1 accepted", a row contains
the quote term with "1 accepted anchor" and the requirement chip; dismiss → reload → stale
notice → regenerate → term gone. `document-review.spec.ts` unchanged after extraction (run
`pnpm e2e` after the extraction commit, before any calibration code). Then the five gates.

**BACKLOG.** model-assisted term extraction; feeding signals into `renderProjectContext`
(needs a corpus run to score); first-class `corrected` decision value; `evidenceSpec`/
`falseSignals` as match vocabulary; stage/HM-decision weighting.
**Risk.** a short accepted quote could be a proper name — PII regex + ≤4-word rule + every
added term visible and editable; say so in DECISIONS and panel copy.

---

## Wave D — Bring-your-own-data imports (no migration)

**Goal.** Upload a CSV/JSON export from hireEZ, LinkedIn Recruiter, a generic ATS or a
Heartbeat file-upload result; see a dry-run preview (counts, dropped protected columns,
identity flags, contact-data policy); tick rows; commit. Rows become ordinary candidates
through `createCandidate` with a visible source label. Nothing auto-merges; nothing enters
`resume_text`. Positioning: "keep your data vendor; put TalentOS on top".

**Decisions.**

- Hand-written RFC 4180 parser (~80 lines), no dependency (lockfile churn,
  `check:private-build`).
- Mappers are **allow-lists only** (header aliases per canonical field). They never
  enumerate what they drop. Extra import-header block patterns (age, sex, dob,
  nationality, photo) live ONLY in `src/lib/domain/fair-hiring.ts` as
  `BLOCKED_IMPORT_HEADER_PATTERNS`, because `tests/unit/fair-hiring.test.ts` greps file
  content under `src/`. Fixtures with blocked headers live under `tests/fixtures/`.
- Vendor header names are unverified guesses → preview shows detected header→field mapping
  with per-header override, so an unfamiliar export still imports.
- **Contact data policy: default drop.** Opt-in checkbox stores each email/phone as a
  `candidate_source_evidence` row (`sourceType "vendor_contact"`, `provenance "imported"`,
  `verificationStatus "unverified"`, `retrievedAt` = import time) so the existing human-only
  verification flip and warn-tag rendering apply. Never a candidate column. Copy states it
  is third-party data that decays.
- Identity: port `artifact-src/core/identity.ts` verbatim to `src/lib/domain/identity.ts`
  (+ additive strength `same_name_same_location`). `same_urls` → default `skip`; other
  strengths → `create_flagged` + a `tasks` row (`kind: "identity_review"`) surfaced by the
  existing `open_tasks` NBA rule; no merge instruction exists in the type.
- Heartbeat `NPI` column → a `candidate_sources` row `sourceType "registry"`, label "NPI
  record (from export, unverified)", URL on `npiregistry.cms.hhs.gov/provider-view/<npi>`
  (link-out, no verification claim; Wave E's prefill bridge).

**Create.** `src/lib/imports/{csv,contracts,mappers,json,scan,preview}.ts`,
`src/lib/services/imports.ts` (`previewImport`, `commitImportInput`, `commitImport` in one
transaction, server re-validates and re-scans), `src/lib/actions/imports.ts`
(`previewImportAction(FormData)`, `commitImportAction`), `src/components/import-wizard.tsx`
(3 steps), `src/app/searches/[id]/candidates/import/page.tsx`, `src/lib/domain/identity.ts`,
`tests/fixtures/import-fixtures.ts`, `tests/unit/{imports-csv,imports-mapping,identity,
imports-service}.test.ts`, `tests/e2e/import.spec.ts`.
Limits in `contracts.ts`: 5 MiB, 2000 rows, 100 columns, 2000 chars/cell, 5 URLs/row.
Canonical row: name, currentTitle?, currentCompany?, geography?, profileUrls[], licenses[],
certifications[], skills[], registryUrl?, contact[{kind,value}] — **no resumeText field**.

**Modify.** `fair-hiring.ts` (+`BLOCKED_IMPORT_HEADER_PATTERNS`); `enums.ts`
(`SOURCE_EVIDENCE_PROVENANCES` + `"imported"`, text column ⇒ no migration);
`services/candidates.ts` (`createCandidateInput` + `addedVia` default "manual",
`sourceLabel?`, `profile?` partial merged over `emptyCandidateProfile()`); candidates list
page ("Import candidates" link); candidate page (source label suffix, vendor-evidence age
line); `scripts/critical-path.mts` (2-row in-memory import step); `BACKLOG.md`,
`IMPLEMENTATION_PLAN.md`, `DECISIONS.md` (D-029 import provenance + contact policy).

**Commit writes per selected row.** `createCandidate({…, addedVia:"import:<source>",
sourceLabel, profile:{licenses,certifications,skills}, recruiterNotes:"Imported from <label>
file <filename> on <date>.", stage:"identified"})`; registry source row; optional vendor
contact evidence; identity-review task for flagged rows; nothing for `skip`.

**Acceptance (run to close).** `imports-csv.test.ts` (BOM, CRLF, quoted comma, escaped quote,
embedded newline, ragged warn, row/column limits, cell truncation). `imports-mapping.test.ts`
(auto-detect per fixture; first+last name; blocked header in `droppedColumns` and its values
absent from `JSON.stringify(rows)`; cell warning on seeded phrase; NPI → official domain only;
override re-maps). `identity.test.ts` (artifact cases verbatim + new strength + no merge
field). `imports-service.test.ts` (disposable DB: preview writes nothing; commit creates N with
`added_via = "import:hireez"`; URL match → skip; same-name/different-org → +1 candidate +1
identity_review task; contact off ⇒ no evidence rows, on ⇒ imported/unverified rows;
`document_versions` unchanged; `resume_text` null; blocked key rejected server-side).
`fair-hiring.test.ts` unchanged. `import.spec.ts`: import hireEZ fixture (blocked column +
duplicate) → "1 column dropped" + mapping table → untick one → commit → "3 candidates created ·
1 flagged for identity review" → candidate Sources shows `import:hireez` → `/tasks` shows
"Identity review". Then the five gates.

**BACKLOG.** `import_batches` audit + undo; mapping presets; XLSX; Greenhouse/Lever/Bullhorn
mappers; cross-project identity; merge UI; vendor-evidence decay reminders (>90 days);
vendor match scores (dropped by D-010).

---

## Wave E — Registry-verified identity, NPPES first (migration 0007)

**Goal.** From a candidate page, query the public CMS NPPES v2.1 JSON API (no key) by name
(+state), see records ranked by identity-match strength, pick one by hand, persist an
allow-listed snapshot, show "registry-matched · NPPES". Opt-in via
`TALENTOS_REGISTRY_NPPES=1`; nothing calls out otherwise. Verified identity and licence
taxonomy, not reachability.

**Decisions.** Mirror `src/lib/research/talent-xray.ts` exactly: `FetchLike` injection,
`configured` flag, unconfigured `search()` throws and never calls fetch, URL builder tested.
`mapNppesResults` picks fields explicitly (number, first/last name, credential,
taxonomies[].desc/state/license/primary, first LOCATION address city/state/telephone) and
never spreads `basic` or `addresses` — the NPPES sex field name must not appear anywhere
under `src/`. `nppesRecordSchema` in `src/lib/core/payloads.ts`. Results in API order, no
synthetic score. Match is a human click; upsert unique per candidate+registry. Artifact
`npiAdapter` stays `wired:false` (D-021) until a live request/response is observed.

**Create.** `src/lib/registries/nppes.ts` (`buildNppesSearchUrl`, `buildNppesLookupUrl`,
`mapNppesResults`, `createNppesClient(fetchImpl)` with modes off|live|mock),
`src/lib/registries/index.ts` (`registryStatus`, `REGISTRY_LINK_OUTS`),
`src/lib/services/registries.ts` (`searchNppesForCandidate` in-memory only,
`confirmRegistryMatch`, `clearRegistryMatch`, `getRegistryMatch`, `prefillFromCandidate`
— splits name via identity `normName`, state from geography, and if a `candidate_sources`
URL is an NPI provider-view link, prefill `lookup(npi)`), `src/lib/actions/registries.ts`,
`src/components/registry-match.tsx` (off state = explanation + NPPES link-out; live/mock =
form, results with Tag ok/warn + "This is them"; matched = ok tag, fields table, "Open NPI
record" link-out, "Clear match"), `tests/fixtures/nppes-fixtures.ts` (payload with extra
`basic` keys incl. the sex field and mailing address; `Errors` payload),
`tests/unit/{nppes,registry-matches}.test.ts`, `tests/e2e/registry.spec.ts`,
`drizzle/0007_registry_matches.sql` + snapshot via `pnpm db:generate --name registry_matches`.

**Schema.**

```ts
candidate_registry_matches(id, candidate_id FK cascade, registry "nppes", registry_id,
  matched_fields json NppesRecord, match_strength, matched_at, matched_by default "local-owner",
  created_at, UNIQUE(candidate_id, registry))
```

Wave prompt sentence: "You are authorized to generate one migration for
`candidate_registry_matches` and to run it only against disposable databases via
`TALENTOS_ALLOW_MIGRATIONS=1`." (`tests/unit/document-migration.test.ts` filters idx<4, unaffected.)

**Modify.** `services/candidates.ts` (`deleteCandidate` list, `exportCandidate` adds
`registryMatches`); candidate page (card above Sources; tag beside title when matched);
`.env.example`; `playwright.config.ts` (`TALENTOS_REGISTRY_NPPES: "mock"`); `DECISIONS.md`
(D-030 label copy), `IMPLEMENTATION_PLAN.md`, `BACKLOG.md`.

**Label copy (D-030).** "Registry-matched · NPPES — identity and licence taxonomy as
recorded by CMS on <date>. It says who this person is and what they are enumerated as; it
does not say how to reach them, whether they are currently licensed in a given state, or
whether they will respond."

**Acceptance (run to close).** `nppes.test.ts` (URL origin/path/params, limit clamp;
unconfigured ⇒ `configured:false`, rejects /off/, fetch count 0; live with fixture ⇒ records;
**allow-list**: `Object.keys(record)` equals documented set and `JSON.stringify(records)`
contains none of the extra-field values; `Errors` ⇒ throws; malformed ⇒ `[]`; service returns
API order with strengths and no numeric score). `registry-matches.test.ts` (confirm persists
`matched_by = "local-owner"`; second confirm replaces; clear; deleteCandidate cascades; export
includes; search never writes). `registry.spec.ts` (mock): candidate "Priya Patel" / "Austin,
TX" → card prefilled TX → Search → MOCK row → "This is them" → tag + link on
`npiregistry.cms.hhs.gov` → reload persists → Clear. **Manual close-out:** one live request
with the flag on against a known public NPI; paste the observed response shape into
`docs/`; only then is the adapter "observed" (D-021). Then the five gates.

**BACKLOG.** State boards (Nursys, FSMB, state sites: HTML forms, terms restrict automation)
→ link-out entries; GMC/NMC/ABMS → link-out; ORCID (JSON, no key) and Companies House as a
later registry wave; sync taxonomy into `profile.licenses` on confirm; NPI-2 orgs; match
freshness re-check.

---

## Wave P — Pilot corpus through TalentOS (3 searches × 5 candidates) (no code by default)

**Goal.** Produce the measured evidence every competitive claim depends on, using TalentOS
itself: candidates found through discovery, JDs pasted by the owner, reviews done in the
CV↔JD screen, strings calibrated by Wave B, yield recorded by Wave A. Creates the personal
DB for the first time.

**Owner prerequisites (not code).** `TALENTOS_GOOGLE_CSE_KEY` (own Google Custom Search
JSON API key); `TALENTOS_MODEL_PROVIDER=session` with a Claude session fulfilling the
outbox; three real JDs (pasted); consent to store the CV text of the candidates reviewed
(owner's own CV may be one of the five for one search, as a stand-in).

**Procedure per search (Claude drives, owner pastes).**

1. Create search → paste JD → intake → derive plan → Generate strings and Compose from
   search plan (Waves A/B active: coverage panel, QA, calibration panel empty).
2. Discover: run ≥5 strings across both engines; save ≥5 candidate results explicitly with
   names; note yield per string.
3. For each of 5 candidates: obtain CV text lawfully (owner pastes; TalentOS never fetches);
   confirm extraction; Analyze → copy artifact request → fulfil in the Claude session →
   Validate and import; accept/dismiss/correct with notes.
4. Regenerate strings; record which terms moved and why (calibration panel); run the
   regenerated strings; compare yield before/after.
5. Prepare reviewed shortlist; export.

**Measurements (recorded in `docs/PILOT-2026-09-<dd>.md`, per search and total).**
review time per candidate; evidence-location time; manual corrections; unsupported
suggestions rejected at import (must be 0 fabricated passages in accepted output);
acceptance rate; strings run / URLs saved / candidates created (yield); calibration
decisions applied and whether post-calibration yield rose; QA warnings that fired; channels
uncovered. Separate technical defects (→ BACKLOG or a fix wave) from workflow findings.

**Close condition.** Three searches complete with all measurements recorded and zero
fabricated passages accepted. No superiority claim is written; the report states what was
measured against the owner's current workflow. hireEZ comparison stays out until equivalent
briefs are run in hireEZ (`CONNECTED_REVIEW.md`).

---

## Wave F — Two-sided guidance v2 (no migration)

**Goal.** Every next-best action carries its evidence (`reason`); the guide page shows a
one-line "next move" per thread; an HM calibration checkpoint fires after every 5 reviewed
candidates and yields a deterministic "what did I get wrong" playback; motivations and
concerns are capturable and feed a close-readiness action; per-stage SLA breaches from
`pipeline_events` raise thread-specific nudges. No model calls.

**Create.** `src/lib/domain/review-evidence.ts` (`latestReviewDecision`, `acceptedLinks`,
`requirementsWithoutAcceptedEvidence` moved verbatim from `document-review.tsx:398-403`),
`src/lib/domain/hm-calibration.ts` (**not** `calibration.ts`, which Wave B owns:
`HM_CALIBRATION_INTERVAL = 5`, `calibrationDue`, `buildCalibrationPlayback` → reviewedCount,
decisions {advance,hold,pass}, per-requirement candidatesWithAcceptedEvidence,
`neverEvidenced`, `unanchoredNotes`), `src/components/motivations-form.tsx`,
`src/components/calibration-playback.tsx`, `tests/unit/{review-evidence,hm-calibration}.test.ts`,
`tests/e2e/guide.spec.ts`.

**Modify.** `src/lib/domain/next-best-action.ts` (`reason: string` required on
`NextBestAction`; `ProjectSnapshot` + `hmReviewedCount`, `hmReviewedAtLastPlayback`,
`offersMissingMotivationsCount`, `stageSlaBreaches[]`; new rules `hm_calibration_checkpoint`
P2 HM `/guide#calibration`, `capture_motivations` P2 candidate, `hm_stage_sla` P1 HM,
`candidate_stage_sla` P2 candidate; `stalledCandidateCount` excludes SLA stages;
`summarizeThreads(actions)`); `src/lib/domain/pipeline.ts` (`STAGE_SLA_DAYS`: contacted 5,
responded 3, recruiter_screen 5, hm_review 3, interviewing 7, final 5, offer_extended 5);
`services/search-projects.ts` `buildProjectSnapshot` (compute the new fields; playback state
from `settings` key `hm_calibration:<projectId>`); `services/guidance.ts`
(`getCalibrationPlayback` capped at 50 candidates, `markCalibrationReviewed`,
`getCalibrationState`); `services/candidates.ts` (`updateCandidateProfile` motivations/
concerns); actions; `document-review.tsx` imports the moved helpers; guide page (thread
headline + reasons, "Calibration checkpoint" card, days-in-stage); dashboard + search page
render `reason`; candidate page "Motivations & concerns" card; `scripts/critical-path.mts`
asserts every action has a non-empty reason; `DECISIONS.md` D-031, `IMPLEMENTATION_PLAN.md`,
`BACKLOG.md`.

**Acceptance (run to close).** `next-best-action.test.ts` (factory updated; every action has
reason; checkpoint fires at 5/0, not 4, not 7/5, again 10/5; capture_motivations; SLA rules
and threads; summarizeThreads; healthy snapshot still `[]`). `hm-calibration.test.ts`
(`calibrationDue` boundaries; playback counts; neverEvidenced; unanchored note detection).
`review-evidence.test.ts` (latest decision wins; partial excluded). `guidance.test.ts`
extended (5 feedbacks ⇒ checkpoint; playback lists JD requirement as never evidenced; after
one accepted link ⇒ 1; mark reviewed clears; motivations flip offers count 1→0).
`guide.spec.ts` (mock): 5 candidates → HM review → 5 feedbacks → checkpoint action + playback
"0 of 5" → mark reviewed → gone; candidate motivations save/reload. `document-review.spec.ts`
unchanged. Then the five gates.

**BACKLOG.** model-drafted playback narrative via session provider; per-candidate next-move
lines; decline-with-respect + logistics packet kinds; HM nudge drafts; per-search SLA
thresholds (needs a `pipeline_stages` column → migration); close-plan consuming motivations.

---

## Wave G — Transparency: cost model and "what we will not do" (no migration)

**Goal.** Publish the cost model and the refusals as product surface, because each refusal is
a line on a competitor's complaint page.

**Deliverables.** `src/app/about/page.tsx` (local app; also mirrored as a section in the
TalentOS-Lite artifact "About" panel if that surface exists) rendering, from a single
`src/lib/product-principles.ts` constant: cost model (local-first; model work runs in the
owner's Claude session; discovery is BYOK Google at Google's published rate; no seats, no
credits, no renewal escalation); the six refusals (no scraping; no auto-send; no interview
recording; no personal contact enrichment; no protected-characteristic fields; no fabricated
evidence — every suggestion carries an exact quote or a live link); the two honest gaps (no
proprietary index; no verified personal contact data). `docs/POSITIONING.md` with the same
text plus the competitor scorecard from `COMPETITIVE-2026-09-05.md` §2, kept in sync by a
unit test that asserts each refusal string in `product-principles.ts` appears in
`POSITIONING.md`. Settings page links to `/about`.

**Acceptance.** `tests/unit/product-principles.test.ts` (six refusals present; every refusal
string appears in `docs/POSITIONING.md`; no protected-trait words in the file per the
fair-hiring grep). `tests/e2e/critical-path.spec.ts` + one step: `/about` renders "What we
will not do". Then `pnpm verify`.

---

## Execution protocol (every wave, Claude executes)

1. `git status` in `/Users/christoler/talentos-connected-review`; commit Codex's leftover work
   on its own commit ("chore: land Codex WIP before Wave X") so wave diffs are clean.
   Re-read `talentos/docs/CLAUDE_HANDOFF.md`, `BACKLOG.md`, the wave section above.
2. Branch: continue on `codex/talentos-connected-review` (owner's standing instruction) with
   one commit per logical step; wave close-out commit titled "Wave X CLOSED: …" only after
   the gates ran.
3. Migration waves (A, E): run `pnpm db:generate`, commit sql + snapshot + journal, migrate
   only `./data/smoke.db`, `./data/e2e.db`, vitest temp dirs. Never `./data/talentos.db`.
4. Gates before close-out, all five, output recorded in `docs/WAVE-<X>-REPORT.md`:
   `pnpm verify` · `TALENTOS_DATABASE_PATH=./data/smoke.db pnpm smoke` (fresh file) ·
   `pnpm e2e` · `pnpm e2e:artifact` · `pnpm test:documents:defects`; root `pnpm verify` when
   anything outside `talentos/` changed. Report failures verbatim; never weaken a gate.
5. Cut lines are stated per wave; a wave that misses one stays OPEN with the gap named.
6. Exact-head CI stays blocked by the account lock; one factual line in each report.

## Verification of the whole program

- After Wave P: `docs/PILOT-2026-09-<dd>.md` exists with the measurements table filled for
  three searches and "fabricated passages accepted: 0".
- Every competitive claim in `COMPETITIVE-2026-09-05.md` §3 maps to a shipped wave and a
  named test: zero fabricated evidence (existing + Wave P), calibration from search one
  (B), always-visible search (existing + A), two-sided guidance (F), no seats/credits (G).
- `pnpm verify` green on the worktree head after Wave G.
