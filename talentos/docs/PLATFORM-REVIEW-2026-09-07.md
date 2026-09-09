# Platform review — 2026-09-07

Answers to the eight things the owner raised, in the order they were raised.
Three of them are now built and gated. Two are designed and deliberately not
built. Two need a decision from the owner. One needs information only the
owner has.

---

## 1. Evidence alignment and outreach were never broken

They were waiting, and the interface said "waiting" in red.

Running both against candidate `cb31644a-6741-4844-8d92-aa72ba3024b0`
produced `SessionFulfillmentPendingError` and `ResearchPendingError`. Neither
is a failure. This install has no model key, so generation is fulfilled by a
Claude session through a file handoff (D-008): the app writes a request file
and throws, a session answers it, the app is re-run. `act()` had no case for
those two errors, so they fell through to the generic `"error"` kind, and
`GenerateButton` painted them in the same red block as a crash.

Outreach compounded it. It needs research, then personas, then the sequence,
and the research stage stopped at its first unanswered query instead of
writing the rest. Four audience queries meant four separate answer-and-re-run
cycles before the chain could even reach personas.

**What changed** (D-036):

- A handoff is its own result kind, `"pending"`, carrying both file paths.
- The button renders a neutral waiting panel that names the file and offers
  the instruction on a copy button.
- `researchAudience` now attempts every unanswered query, so one pass writes
  every request file and throws once, naming the count.
- `pnpm outbox` lists everything waiting, with what it asks for and where the
  answer goes. `pnpm outbox <file>` prints one request in full.

**Proof it works.** The three requests that were sitting unanswered were
answered, including four real web searches for the audience research. Both
features then produced real output and persisted it: one `candidate_evidence`
row with sixteen aligned criteria, and one `outreach_sequences` row with
seven messages. The alignment marks the founding-recruiter evidence strong
and the research-population close only partial, which is the honest reading
of that CV. The sequence names that gap in three separate steps rather than
writing around it.

## 2. The platform is over-elaborate

Agreed, and the measurement is worse than it looks:

|                           | count        |
| ------------------------- | ------------ |
| TypeScript in `src/`      | 37,978 lines |
| Pages                     | 33           |
| Modules inside one search | 21           |
| Components                | 42           |
| Services                  | 24           |
| Artifact source           | 13,081 lines |

Twenty-one modules for one search is the problem. It is not that any single
module is wrong; it is that the only way between them is a nav bar, so the
work feels like filing rather than thinking.

The important thing to say plainly: **items 3, 4, 5 and 6 are not additions
on top of that complexity. They are the simplification.** A command menu, a
graph that shows structure, connections on every page and tags that link jobs
to people all do the same thing — they let the recruiter move by meaning
instead of by menu. Every one of them lets a module page get quieter, because
the page no longer has to carry links to everywhere else.

What I would cut, in order, and have not cut without the owner's word:

1. `/crew` and `/diagnosis` are developer instruments, not recruiter pages.
2. `/guide` duplicates what the pages should say themselves.
3. `document-review.tsx` at 1,062 lines and `diagnosis-actions.tsx` at 666
   are each doing several jobs.
4. Seven seeded demo searches are still in the owner's database, which makes
   every list look busier than the real work.

## 3. The "/" command menu — built

`/` opens the menu from anywhere. `⌘K` still works. A slash typed into an
input, textarea or contenteditable is a slash, so Boolean strings and notes
are untouched. The menu is grouped in a fixed order: this search's modules,
the app's places, other searches, then every person on file with the search
they belong to. Two keystrokes from any page to any page, search or person.

Covered by `tests/e2e/command-menu.spec.ts`. Recorded as D-037.

## 4. The knowledge graph — rebuilt

It was a ring: whatever you selected sat in the middle, everything else was
spaced evenly around it. That drew every graph the same shape, so a hub with
twenty leaves and a chain of twenty looked identical. Calling it basic was
correct — it was a list drawn as a circle.

It is now a settled force layout (D-038): repulsion between records, springs
along links, deterministic from a hash of each record id, 600 iterations, no
animation loop. Plus zoom, pan, drag-to-pin, node size by number of
connections, and neighbourhood highlighting on hover. Because it is
deterministic it can be asserted on, and
`tests/unit/graph-layout.test.ts` asserts the property that matters: a hub
ends up nearer the centre of its own spokes than any spoke does.

Still missing against the Obsidian reference in the attachment: no colour
legend by tag (waits on item 6), no local-versus-global toggle beyond the
existing overview switch, no text filter that dims rather than removes, and
no persistence of a layout the recruiter arranged.

## 5. Every page connects to all pages — built, partly

Two halves. The command menu is the fast half. The other half is a collapsed
strip at the foot of every search module listing that search's own records —
people, requirements, documents, comparisons, channels, sources — each linking
into the graph rather than into another module. Collapsed by default, because
the point is to remove navigation, not add a second nav bar.

What is not yet there is true per-record backlinks: standing on a person's
page and seeing the string that found them, the document they came from, and
the requirement they answer. The graph holds those edges already
(`graphBacklinks`), so this is wiring, not new data.

## 6. Smart tagging connecting jobs and candidates — designed, not built

Deliberately not built, for two reasons.

**The rule.** `CLAUDE.md`: no migration runs without an explicit instruction
in a wave prompt. A tag table is a migration. I wrote no migration and ran
none.

**The design, which needs no migration anyway.** The interesting tags are not
typed by hand, they are derived from records that already exist:

- A job carries a tag per canonical requirement, from the IR.
- A person carries a tag per requirement their evidence supports, with the
  alignment status attached, so "closed passive researchers" is a tag with a
  strength rather than a label someone stuck on.
- A person also carries tags from surface family, registry match and channel.
- Recruiter-added tags live in `settings` under a per-search key, the same
  pattern the graph's manual links already use. No new table.

Then a tag is a page: everything that carries it, jobs and people together,
which is exactly the connection asked for. It also gives the graph its colour
legend.

This is one wave. It needs the owner to say go, and to say whether a derived
tag can ever be removed by hand or only overridden.

## 7. Sourcing better than hireEZ

The honest version, split into what is winnable and what is not.

**Not winnable under the current rules.** hireEZ's advantage is a proprietary
index of several hundred million profiles, built by crawling. Product rule 1
forbids fetching, crawling or scraping a result page, and rule 2 forbids bulk
persistence. Those rules are the product's position, not an oversight. As
long as they hold, this system cannot match hireEZ on raw recall, and no
sentence anywhere should claim it does. Per the standing rule, no comparative
claim gets written until an equivalent trial has actually been run.

**Winnable, and worth building.**

1. _Query quality._ hireEZ's weakest layer is the query. TalentOS has the
   canonical IR, a 102-domain X-ray corpus, a yield ledger recording which
   string produced which saved profile, and review decisions that already
   calibrate strings (D-030). An AI that iterates strings against that
   feedback is a genuinely better sourcing engine than one that iterates
   against nothing, and none of it needs a crawl.
2. _Rediscovery._ Every person ever saved, across every search, searchable by
   requirement match rather than keyword. Aggregators are bad at this because
   their index is not your history.
3. _Open, licensed indexes with real APIs._ For the research and software
   populations these searches actually target — the AI-safety roles above are
   the case in point — a legitimate structured index is reachable without
   crawling anything: OpenAlex, ORCID's public data file, Wikidata, GitHub,
   DBLP, Crossref, and NPPES which is already integrated. That is not a
   general people-search index. It is a very good one for exactly the
   populations that are hardest to reach and where hireEZ is weakest.

**The decision this needs from the owner.** Item 3 is a real data-source
commitment: which of those sources to index, whether an index of public
research records is compatible with "never bulk-persist search results"
(I read it as yes, because these are not search results and are published for
reuse, but that is the owner's call and ORCID's non-commercial term is still
open), and whether this lives in the artifact or the app. In the artifact it
must be CORS-reachable from the browser, which OpenAlex, Wikidata, Crossref
and GitHub are, and ORCID's public API is.

## 8. The attached features

**Already built, so nothing to integrate.** Parallel pages exist as D-028 and
`artifact-src/ui/parallel.ts`. The radial menu in the second image exists as
`artifact-src/core/radial.ts` and `artifact-src/ui/radial.ts`, tested in
`tests/unit/artifact-radial.test.ts`. The card gallery in the first
attachment is close to the existing deck (`artifact-src/core/deck.ts`).

**Blocked on information.** The eleven links are `video/mp4`. I cannot watch
video, so I have not guessed at what they show. Their names suggest concept
search, data transformations, globe search, poem reveal, pointer-lock
browsing, scroll-squish text, spatial-stretch text, talking cursors, a text
adventure, and page transitions — but a name is not a specification, and
building from a guess is how the wrong thing gets built well. One line each
on what the interaction does and what it is for in a recruiting context is
enough to scope them.

Two of them read as substantial rather than decorative and are worth
discussing first: concept search, which sounds like the query layer item 7
needs, and data transformations, which sounds like the import and mapping
work already in `import-wizard.tsx`.

---

## Gates run

`pnpm verify`, `pnpm smoke` (with the mock provider), `pnpm e2e`,
`pnpm e2e:artifact` and `pnpm test:documents:defects` all pass on this
branch. `tests/e2e/critical-path.spec.ts` needed one assertion scoped,
because the connected strip makes a channel name appear twice on the sources
page; the comment in the test says so.
