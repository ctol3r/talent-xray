# Wave H — Profile connections (design, 2026-09-07)

Status: **BUILT, both halves, and gated.** See `docs/WAVE-H-REPORT.md` and
`docs/WAVE-H2-REPORT.md`. The build took option (A) below, the default
reading of the owner's ask; option (B) is still the owner's to take and is a
small addition on top. The decision is now recorded as **D-035** in
`DECISIONS.md`; the draft at the bottom of this document is superseded by
it. Executor: Claude. Predecessors: Wave A (yield ledger, D-029),
Wave D (imports, `identity.ts`, D-031), Wave E (NPPES, D-032), D-034
(link-out discovery). Becomes **D-035** in `DECISIONS.md` when the owner
accepts and the first half closes.

Method: six research agents (competitors, identity APIs ×2, legal,
username pivots, HSAL), 28 proposed sources independently re-verified
against their own documentation, three competing designs, three judges,
three adversarial skeptics (doctrine/legal, engineering, recruiter). This
document is the synthesis with every blocking critique resolved; the
rejected critiques are named at the end. Research transcripts:
`/private/tmp/.../wf/` (session-local), summarised here.

---

## The one decision for the owner

The ask, verbatim (2026-09-07): _"I want as many profile connections as
possible — if the same person has 10 profile page links (LinkedIn, Twitter,
Doximity, Zocdoc, GitHub, Stack Overflow, Facebook, Bluesky etc.) then I
want those too."_

**What is actually available, after checking every source's own terms.** Of
28 candidate sources, 16 survived independent verification and 12 were
refuted or materially corrected. Only four confirmed sources hand the app
several of a person's other addresses in one call, and each covers one kind
of person:

| Source                                                           | Gives                                                                               | Covers                                            | Auth                                  | Terms                                                                                                                                                    |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub REST (`/users/{login}`, `/users/{login}/social_accounts`) | website, X handle, and every social account the person listed                       | software                                          | none (60/h) or a free token (5,000/h) | AUP bars bulk collection and unsolicited recruiter email; one person per click is the reading, and it is recorded as a lawyer question                   |
| Keybase (`user/lookup.json`, `proofs_summary`)                   | cryptographically proven links to GitHub, X, Reddit, Hacker News and owned domains  | software                                          | none                                  | dormant since 2020, so coverage is thin but the proof is the strongest tier available anywhere                                                           |
| Wikidata (SPARQL over ~30 identifier properties)                 | X, GitHub, ORCID, Mastodon, Instagram, Scopus, VIAF and more, at once               | notable people: researchers, executives, speakers | none                                  | CC0                                                                                                                                                      |
| ORCID public API (`researcher-urls`, `external-identifiers`)     | personal site, GitHub, Scopus, ResearchGate, LinkedIn as the researcher listed them | research and clinical academics                   | free registered key                   | **owner decision:** the Public API is non-commercial by its terms; a commercial launch needs membership (about USD 5,975/yr) or the annual CC0 data file |

Everything else is closed by its own terms, not by our caution: LinkedIn has
no API for other members and its User Agreement §8.2 forbids storing their
data; Meta's Threads, Instagram and Facebook endpoints need the person's own
token or a business account and App Review; X and Hashnode are paid; Dribbble
is OAuth and its terms are aimed at hiring; Doximity, Zocdoc, Healthgrades
and Muck Rack have no public API; Google Scholar and BrokerCheck forbid
automation. For clinical and GTM roles there is no machine path at all: those
links come from search strings the recruiter opens and from paste.

**So the honest trade.** hireEZ, SeekOut, GoPerfect, Gem and Rival show ten
links on one card with zero clicks, because they aggregate a 700M–1B record
index behind the scenes and you cannot check any of it. Product rule 1 (never
fetch a page) and rule 2 (store only explicit saves) mean TalentOS cannot do
that and stay what it is. What this design delivers instead:

- **Machine-assisted, several links per click**, for software and research
  people, from the four sources above.
- **Recruiter-assisted, fast**, for everyone else: pre-composed sweep strings
  that open on the engines' own hosted page, and a multi-line paste box.
- **Every link accountable**: who asserted it, when it was read, when you kept
  it, whether the person confirmed it, and your own note on why you think it
  is them.

The count will be lower than an aggregator's for clinical and GTM roles, and
comparable for software and research once the four adapters are in. Nobody
has run that comparison, so no document here claims it (rule 9).

> **Owner: pick one before the build starts.**
> **(A)** Build as designed. Accountability per link; machine help where terms
> allow it; paste and sweep elsewhere.
> **(B)** Build as designed and add the handle-pivot guesser (cut line 1):
> from a saved high-entropy handle it constructs candidate URLs on other
> platforms, each labelled `guess · unverified · not opened`. It raises the
> count and the false-positive rate; the legal memo's default is against it
> and this is the one place that default would be overridden, on your say-so.
> **(C)** Something else, which probably means relaxing rule 1, and that is a
> different product.

---

## Split: Wave H, then Wave H2

The engineering skeptic calibrated the original single-wave spec against the
repository's own history (Wave E was 24 files and 5.4k lines; Wave D 29 files;
D-034 13 files) and found it about three Wave E's — it could not pass five
gates in one wave. Split at a seam that needs no second migration.

**Wave H (this build).** Migration 0009 with every column named now, including
the ones only H2 writes. Surface families, defaults, warnings. Tiers and the
one label function. `enforcePolicyForSave` on every candidate-bound write path.
Suppression list. The candidate-page card with multi-line paste, per-row "why
this is them" note, remove, and move-to-another-candidate. Companion changes.
Discover `| +Name` attach. `matchableProfileUrls` and `linksForModel`. Export
and delete coverage. The GitHub and Keybase adapters. Jurisdiction column and
the notice status as a displayed tag.

**Wave H2.** Per-candidate profile sweep strings and their ledger rows.
The Article 14 confirmation draft, "I sent this", and the answer form.
Wikidata and ORCID adapters. The Settings data-subject-request card.
`sweepYieldForProject`.

---

## Decision summary

**What a "profile connection" is.** A row in `candidate_sources`: a public
address of a page the person or a vendor published, plus who asserted it
belongs to this person, when it was read, when a human kept it, and the
human's own note on why. It is not content (nothing on the page is stored),
not evidence (D-023), and not contact data (public profile URLs are
addresses; emails and phones are contact data and TalentOS does not enrich
them).

**Tiers and exact labels.** `profileLinkLabel(row)` in
`src/lib/domain/profile-links.ts` is the only module allowed to spell these.
Every non-registry, non-confirmed label begins with `unverified`. The bare
word "verified" appears nowhere except inside "unverified" and inside Wave E's
`registry-matched · CMS NPPES`.

| `provenance`                            | badge (exact)                                                     | provenance line                                                                                                                                                                     |
| --------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `recruiter_added`                       | `unverified · recruiter-added`                                    | `added by you on <date> via <paste \| Discover (Core engine) \| Discover (Reach engine) \| sweep <T> \| browser companion \| copied from <origin url>>`                             |
| `imported`                              | `unverified · imported`                                           | `from <label> on <date> · third-party data; open it and check before relying on it`                                                                                                 |
| `platform_declared`                     | `unverified · declared on <platform>`                             | `listed by the holder of <origin url> · read from the <platform> API on <date> · kept by you on <date>` + `Whether that account is this person is still your judgement, or theirs.` |
| `platform_reciprocal`                   | `unverified · reciprocal · <platform> reports a proven back-link` | `<platform> checked on <assertedAt> that <target host> proves ownership of this profile · read on <retrievedAt> · kept by you on <date>`                                            |
| `candidate_provided` with `confirmedAt` | `confirmed by the person (recorded by you) · <date> · <channel>`  | `The person told you this address is theirs. That is identity, not a licence, a qualification or a way to reach them.`                                                              |
| `registry_match`                        | `registry-matched · CMS NPPES` (unchanged)                        | `REGISTRY_MATCH_EXPLAINER`, unchanged                                                                                                                                               |

Corrections applied from the doctrine skeptic: the engine is rendered
`Discover (Reach engine)`, never "Verified & Reach", because that string
inside a label module fails the wave's own `verified` grep and because the
control panel names that engine "HU" anyway. `platform_reciprocal` begins
with `unverified`, and the platform name comes from `assertedBy` rather than
being hard-coded — the original draft hard-coded Mastodon, whose endpoint the
verification refuted.

Sub-line under every stored row (exact):
`Address only. The page was never read or stored by TalentOS.`

Legacy rows (`provenance` null): `linkTier(row)` derives — `addedVia`
starting `import:` first (Wave D writes `import:<source>` on its NPI row
too), then `addedVia === "registry_match"` or `sourceType === "registry"`,
else `recruiter_added`. No backfill SQL. When a registry match is cleared,
`listProfileLinks` demotes the orphaned row to `unverified · recruiter-added`.

**Surface families** (`src/lib/domain/surface-families.ts`): `professional`
on · `scholarly_registry` on · `review_site` on · `unrecognised` on ·
`contact_aggregator` off · `mixed_broadcast` off · `personal_life` off ·
`document` off · `not_a_person` (`linkedin.com/company`, `apollo.io/companies`
— refused as a profile link, still saveable as a research source).

`unrecognised` is new, from the recruiter skeptic: the original design treated
every host outside the 102-pattern corpus as personal-life, which would have
refused a developer's own domain, a professor's lab page, a hospital's
physician finder and a law-firm bio behind a 20-character reason field. Those
are the most valuable links a sourcer finds. `unrecognised` saves link-only
with the note `Not in the corpus; address only; never matched, never shown to
a model.`, is never matchable and never model-visible, and needs no opt-in.

`MATCHABLE_FAMILIES = professional, scholarly_registry, review_site,
mixed_broadcast`. `MODEL_VISIBLE_FAMILIES = professional, scholarly_registry`.
Opt-in is per search project with a typed reason (20–400 chars, scanned);
no global remember; applies to every candidate in the search. Family is a
pure function of the URL computed at read time, never stored.

**What the app never does.** Fetch, crawl, scrape, unfurl or favicon any
result or profile page. Store a result list, page title as evidence, page
text, bio, follower count, image URL or "last seen". Generate a profile URL
from a name or a LinkedIn slug. Merge two records. Rank, score or count links
as a signal. Send anything. Derive, hash or store an email or phone. Read a
platform API for more than one person per click. Use "verified" without
naming the registry. Write a comparative sentence about a vendor.

---

## Data model (migration 0009)

Wave prompt sentence: **"You are authorized to generate one migration, 0009,
adding columns to `candidate_sources`, `search_projects`, `search_query_runs`
and `candidates` and creating `profile_suppressions`, and to run it only
against disposable databases (`./data/smoke.db`, `./data/e2e.db`, vitest
temp files) via `TALENTOS_ALLOW_MIGRATIONS=1`. Never `./data/talentos.db`."**
Every column name was checked against `BLOCKED_FIELD_PATTERNS`; none matches.

```ts
// candidate_sources +
provenance      text  // null = pre-Wave-H row; linkTier() derives
assertedBy      text  // "github:octocat" | "keybase:jrivera" | "cms-nppes" | "<vendor>" | "the person"
assertedAt      text  // the platform's own timestamp when it has one
retrievedAt     text  // when a structured API was read; null for human-opened rows
confirmedAt     text  // set only by recordCandidateAnswer (H2)
confirmedVia    text  // "email" | "linkedin_message" | "sheet" | "call" | "other"
originSourceId  text  // the row this one was read from; nulled explicitly on delete
whyNote         text  // ≤200, scanned, the recruiter's own reason for believing it is them
// search_projects +
surfaceOptIns   json  // Partial<Record<SurfaceFamily, {reason, at}>>
jurisdiction    text  // "eu_uk" | "california" | "nyc" | "illinois" | "other"; null = eu_uk behaviour
// search_query_runs +   (written by H2's sweep; columns land now)
candidateId     text
sweepTemplate   text
// candidates +
noticeResolution text // "sent" | "at_first_contact" | "exempt"
noticeResolvedAt text
noticeNote       text  // ≤200, scanned
// new table
profile_suppressions(id, kind "url"|"email", normalized_value UNIQUE, candidate_id FK set null,
                     reason "denied_by_person"|"objection"|"deletion_request", recorded_at, note ≤200)
```

`whyNote` is the recruiter skeptic's fix: without it every row reads
`unverified · recruiter-added` and nothing records why this GitHub account is
this person, so the recruiter re-opens every link at shortlist time. It is a
human note rendered on the row. It is never a model input, never a matcher
signal, never scored.

`profile_suppressions` carries `kind` and `normalized_value` from day one
(doctrine skeptic) so an objection can suppress an email as well as a URL
without a second migration.

**ON DELETE semantics.** drizzle-kit's SQLite `ALTER TABLE ... ADD COLUMN`
emits no `ON DELETE` clause, so the set-null and cascade in the snapshot do
not exist in the SQL (migration 0006 shows the same pattern). Therefore:
`removeProfileLink` nulls children's `origin_source_id` explicitly inside a
transaction before deleting, and `deleteCandidate` adds `searchQueryRuns` to
its explicit delete loop. A unit test asserts the service does it, not the
foreign key.

**Column allow-list test.** `tests/unit/profile-links.test.ts` pins
`candidate_sources` to exactly its column set and fails on any column named
`bio|avatar|image|photo|headshot|followers|last_seen` **in the tables this
wave touches**. The original draft grepped the whole schema for `snippet`,
which fails on day one because `research_sources.snippet` and
`candidate_source_evidence.snippet` are D-010 columns that must stay.

---

## The one shared guard

`enforcePolicyForSave(db, { searchProjectId, url, provenance })` in
`src/lib/services/profile-links.ts` is called by the paste box, Discover's
save/attach, the companion's candidate destination, the declared-copy box,
`acceptDeclaredLink`, `createCandidate.profileUrls`, and the imports commit.
In order: `assertNotSuppressed` → `classifySurface` → `not_a_person` refusal
→ family off and provenance is not `candidate_provided` → `FamilyOffError`
carrying the exact warning. It never writes.

**Scope, from the engineering skeptic.** The gate applies only to
**candidate-bound** writes. A `research_sources`-only save (no `| Name`, no
`+Name`) is checked against suppression alone. This keeps every existing green
test green: `discovery.test.ts` saves `https://example.com/profile`,
`query-yield.test.ts` uses `example.invalid`, `browser-companion.test.ts` and
its e2e save `example.com`, and `critical-path.mts` step 11 creates a
candidate with `example.com/profile`. Those hosts are now `unrecognised`,
which is on by default, so they pass. The fixtures do not change.

`saveDiscoveryResultAction` with a `candidateName` currently creates a
candidate through `createCandidate` with no guard; it is routed through
`addProfileLink` with `addedVia: "discover:<engine>"`. `addCandidateSource`
in `services/candidates.ts` is redirected to the same function.

**Cross-candidate duplicates are not refused.** The original draft refused a
URL already saved on another candidate, which made the `identity_review` task
unreachable from the only write path and inverted Wave D's rule
(`imports/preview.ts` flags, never blocks). Corrected: exact-URL dedupe within
the same candidate only; a cross-candidate hit writes the row, returns
`conflicts`, and opens one deduplicated `identity_review` task. The task
carries a **`Move this address to <other candidate>`** action that transfers
the row intact with its provenance and dates, so a duplicate record can be
emptied and deleted without losing any link's history. Nothing merges.

---

## Card — `Profile connections` (`src/components/profile-connections.tsx`)

Replaces the `Sources` card; the registry card stays above it.

1. Header: `<n> addresses · <c> confirmed by the person · notice: <status>`.
   Counts are headings, not signals; the column added to the candidates list
   is neither sortable nor filterable (NYC LL144 stays a "compilation of
   data" only while nothing ranks).
2. Rows grouped by family in fixed order, each with link
   (`target="_blank" rel="noopener noreferrer"`), badge, provenance line,
   sub-lines, `found on:` when `originSourceId`, the family note, the
   recruiter's `why` note with an inline edit, `Remove`, and
   `Move to another candidate` when a conflict exists. No `open all`, no
   `keep all`, no bulk control anywhere; a component test asserts the absence
   of any button matching `/all\b/i`.
3. `Add addresses` — **one URL per line**, optional `| label`, live per-line
   family preview, toggle `the person gave me these`. The original one-URL-
   per-submit form made ten links a ten-submit job.
4. `Copied from a page you kept` — pick a kept row as origin, paste URLs one
   per line, each row gets `originSourceId` and reads `copied from <url>`.
5. `Declared on <platform>` — GitHub and Keybase sections (below).
6. (H2) `Search for more profiles` — the sweep panel.
7. (H2) `Ask the person` — the confirmation draft and answer form.
8. Footer (exact): `Public profile addresses are not contact data. Emails and
phones are; TalentOS does not enrich them. Every address here says who
added it and when, and whether the person confirmed it. TalentOS never
opens these pages for you, never reads them, and never derives an email or
phone from them.`

---

## Declared-link adapters (Wave H wires two)

Both mirror `registries/nppes.ts`: opt-in env flag, injectable fetch,
allow-listed record schema, a fixture carrying every field that must not leak
with an assertion that it does not, `configured:false` and zero fetch calls
when unset, `[Mock]` watermark in mock mode, one request per click.

**GitHub** (`src/lib/profiles/github.ts`, `TALENTOS_PROFILES_GITHUB=1|mock`,
optional `TALENTOS_GITHUB_TOKEN` sent as a bearer and never returned).
Allow-list: `login`, `blog`, `twitter_username`, `social_accounts[]`. Drops
`email`, `hireable`, `company`, `location`, `bio`, `avatar_url`, `name`,
`gravatar_id` and every count. `twitter_username` renders as
`built from the twitter field GitHub lists for <login>`, not as an address the
person wrote. The module header quotes AUP §7, §8 and ToS §H verbatim; it does
not assert a legal reading, and "is one-person-per-click use for recruiting
outreach permitted?" is a lawyer question in Part C.

**Keybase** (`src/lib/profiles/keybase.ts`, `TALENTOS_PROFILES_KEYBASE=1|mock`,
keyless). `user/lookup.json?usernames=<u>&fields=proofs_summary`. Proofs are
cryptographic, so a state-1 proof is the only thing in the system that earns
`platform_reciprocal`. The label carries `Keybase has been dormant since 2020`
so nobody reads a stale proof as current.

**Off-family suggestions are never shown as URLs.** The doctrine skeptic
caught this: the draft rendered a personal-life URL greyed with a "not shown"
badge, which shows it. Corrected: `readDeclaredLinks` returns only a count for
`personal_life`, `document` and `unrecognised`, the card prints `<n> addresses
on surfaces that are off for this search were not shown`, and
`acceptDeclaredLink` refuses those families server-side whatever the opt-in
says. Paste is the only path to them.

**Wave H2 adds** Wikidata (CC0, ~30 identifier properties, the one multi-link
hub for notable people, new tier value `community_entered` labelled
`unverified · from Wikidata (community-entered)`) and ORCID (after the owner's
call on the non-commercial terms).

---

## Sweep strings (Wave H2)

Six templates over name, employer, geography and a high-entropy handle,
composed with the existing grammar and budget, opened on the hosted engine
page. Two corrections from the recruiter skeptic before they ship:

- **T4 is rewritten.** Its original form quoted `"github.com/"`, and Google
  drops punctuation, so it matched "github com" anywhere and returned repos
  and posts rather than profile pages.
- **The templates are run live before the wave closes**, on three real names
  (one software, one clinical, one research), with the first ten result hosts
  pasted into the report, exactly as D-034 was validated. Acceptance tests
  that only check grammar and term count do not tell you whether anything
  useful comes back.
- One record form for all six templates, not one per template.

---

## What the model may and may not do

No model call is added; every classifier, label, composer and draft is a pure
function. The model **may** receive the bare URLs of `professional` and
`scholarly_registry` rows inside the existing evidence-alignment, outreach and
packet contexts, under a heading saying they have not been read. It **may
not** receive any other family, any label, provenance, confirmation state,
suppression, notice, `why` note or unkept suggestion; and may not be asked to
judge whether two addresses are one person, propose a URL, or rank links.
Both `candidate_sources.url` and `candidate_source_evidence.sourceUrl` are
routed through `linksForModel`, and the test seeds both tables so an
off-family URL cannot reach the model by the second path.

---

## Acceptance (Wave H)

**Unit.** `surface-families.test.ts` (all 102 corpus patterns classify;
`unrecognised` for an unknown host; defaults; `familyEnabled`;
`matchableProfileUrls`; every warning constant passes
`scanTextForProtectedTraits`; no constant matches `/\bverified\b/i`).
`profile-links.test.ts` (label table per provenance × family;
`candidate_provided` without a date never prints "confirmed";
`platform_reciprocal` renders only with both timestamps; the `verified` token
appears only inside `unverified` and `REGISTRY_MATCH_LABEL`; `linkTier` legacy
derivation with `import:` first; cleared registry match demotes; column
allow-list). `profile-links-service.test.ts` (guard refusals with exact
messages; `addProfileLink` writes, dedupes within a candidate, opens one
`identity_review` task across candidates, none for a shared Facebook URL;
`moveProfileLink` transfers with provenance intact; `removeProfileLink` nulls
children; `linksForModel`; export includes labels and families;
`deleteCandidate` keeps the suppression row with a null candidate).
`github-profiles.test.ts` and `keybase-profiles.test.ts` (off by default ⇒
zero fetches; allow-list; forbidden values absent from `JSON.stringify`;
404 ⇒ `[]`; rate-limit message; token never in a return value;
`acceptDeclaredLink` refuses off-family targets server-side).
`identity.test.ts` (+) (Wave D cases verbatim; a shared Facebook URL yields no
`same_urls`). `discovery.test.ts` (+), `browser-companion.test.ts` (+),
`imports-service.test.ts` (+). `fair-hiring.test.ts` unchanged and green.

**E2E** `tests/e2e/profile-connections.spec.ts`, ten steps, mock adapters,
hrefs asserted and never followed. Plus `discovery-linkout.spec.ts` (+) for
`| +Name` attach, and `browser-companion.spec.ts` (+) for the LinkedIn label
rule. `discovery-yield.spec.ts` is **not edited**: `runDiscovery`,
`saveDiscoveryResult`, the mock provider and the `Run search` button stay
exactly as D-034 left them.

**The five gates**, with the smoke command carrying the new mock flags, and
`docs/WAVE-H-REPORT.md` recording every command and result.

---

## Rejected critiques

- _"Ship the request/answer snapshot table in Wave H."_ No: three judges and
  the engineering calibration put it past the wave budget, and the draft plus
  the answer form deliver the tier without it.
- _"Refuse unknown hosts until the corpus grows."_ No: that refuses the most
  valuable links a sourcer finds. The `unrecognised` family is the fix.
- _"Store the surface family in a column."_ No: a corpus correction must
  relabel every row at once.
- _"Give the matcher a new strength for declared links."_ No: `identity.ts`
  stays verbatim; the task title names the tier instead.

---

## D-035 draft (write on acceptance)

**Decision.** A candidate's profile connections are rows in
`candidate_sources`, each carrying a closed-enum `provenance`, the party that
asserted the address, the platform's own timestamp, the date any structured
API was read, the date and channel of the person's confirmation, the row it
was copied from, and the recruiter's own note on why they believe it is the
same person. One function renders every label; every non-registry,
non-confirmed label begins with `unverified`; "verified" appears only inside
`registry-matched · CMS NPPES`. Surface family is computed from the URL at
read time and never stored. Addresses arrive by paste, companion capture,
Discover attach, sweep, the person's own answer, and — with an opt-in flag —
the links a person listed on their own GitHub or proved on Keybase, read
through those platforms' public JSON APIs on the D-032 pattern, one person per
click. A denied address is deleted and suppressed. `findIdentityMatches` is
unchanged, URLs are filtered by family before reaching it, a shared matchable
URL opens a review task, and nothing merges.

**Reason.** Every vendor in the research holds 700M–1B merged records and
gives profile links away with the seat. None of the vendor documentation read
in this research describes source, date and confirmer per link, a refusal to
merge without a human, or the person's own confirmation. This wave builds
those on the tables and matcher that already exist. Whether recruiters prefer
that trade to a higher count is untested, and no comparative sentence is
written until an equivalent-brief trial is run in both tools (rule 9).

**Tradeoffs.** Fewer links per person than an index for clinical and GTM
roles, where no API exists. The strongest tier depends on people replying.
Unknown hosts are saveable but never matched, so a legitimate professional
page outside the corpus is a link and nothing more until the corpus grows.
Yield counts are typed by the recruiter. LinkedIn User Agreement §8.2 remains
an open lawyer question; URL-only capture is the conservative reading, not a
resolution. The GitHub and Keybase adapters are "built, not observed" until a
live read is pasted into `docs/` (D-021).
