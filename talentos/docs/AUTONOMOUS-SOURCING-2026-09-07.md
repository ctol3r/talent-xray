# Scouring the open web — what it would take

The ask: source autonomously across professional bios, personal sites,
portfolios, public CVs, team and leadership pages, directories, speaker bios,
faculty and lab pages, publications, patents, repositories, contributor pages,
association pages, permitted social profiles, business contact pages, published
professional addresses, government datasets, organisational records and public
lists.

Every one of those surfaces is already **named, described and composed for** in
`src/lib/sourcing/angles.ts`. What is missing is not knowing where to look. It
is the hands.

## The brain is built

| Piece                                                                         | State                         |
| ----------------------------------------------------------------------------- | ----------------------------- |
| 20 sourcing angles, one per surface family, each with its rationale           | built                         |
| Query language: 18 filters, prose, OR groups, exclusions                      | built                         |
| Ontology: 408 capabilities, 4,434 aliases, 1,638 adjacency edges with reasons | built                         |
| Gazetteer: 390 places, 422 metro folds                                        | built                         |
| Ranker: 7 rules, evidenced vs adjacent, gaps, freshness                       | built, P@R 1.00 over 8 fields |
| Entity resolution: collaborators, name-frequency bar, transitive closure      | built                         |
| Dossier ribbons — says who, for every claim                                   | built                         |
| Auto-tagging off evidence, no key                                             | built                         |
| Structured connectors: Wikidata, OpenAlex, Crossref, GitHub                   | built, running                |

The honest summary of where that leaves us is in
`docs/SOURCING-EVALUATION.md`: **the ranker is now far better than its inputs.**
Most open-index rows carry a one-line description. Everything the ontology can
distinguish is wasted on evidence that thin.

## The hands are five components, in this order

**1. A web search connector.** Everything downstream begins with a URL list.
Without one, 12 of the 20 angles are open-by-hand. Three real options:

|                      | Index                     | Operators                                 | Terms                                       | Cost                  |
| -------------------- | ------------------------- | ----------------------------------------- | ------------------------------------------- | --------------------- |
| Brave Search API     | own crawler, 30–40B pages | documented, with an `operators` parameter | commercial permitted                        | card required, ~$5/1k |
| Serper / SerpAPI     | Google's results, resold  | full Google syntax                        | resells Google SERPs against Google's terms | cheaper               |
| SearXNG, self-hosted | meta-search over others   | varies by engine                          | your own instance, your own risk            | free, fragile         |

Recommend **Brave**: its own index rather than a reseller's, operators are a
documented feature rather than an accident, and it survives the question a
diligent customer will ask about where the results came from. Its two costs are
real and should be stated: a smaller index than Google, which hurts exactly the
long-tail orphan pages sourcing depends on; and no documented grouping, so the
composed `(a OR b) AND (c OR d)` must be tested rather than assumed.

**2. A policy gate — before the fetcher, not after.** `robots.txt`, crawl-delay,
per-host rate limit and concurrency of one, plus a source registry carrying a
written note per domain: what its terms say, when that was read, and what the
app may do there. This is the component that makes everything after it
defensible, and building it second rather than last is the whole difference
between a crawler and a liability.

**3. A fetcher.** Conditional GET (ETag / If-Modified-Since), a size cap, a
timeout, no JavaScript execution, a user agent that names the product and a
contact URL, and a hard refusal on any host the registry has not cleared.

**4. A page classifier.** Person, roster, document, or furniture. Without it a
crawl invents candidates — "Our Team" and "Field Robotics Summit" become
people, and a shortlist fills with rows nobody can contact or corroborate.

**5. An extractor.** Name, title, employer, location, published contact, and
artifacts, per surface. **This is the single biggest quality lever**, because
of the sentence above: the ranker is already better than its inputs.

## The one decision, and it is not mine

> **Decided 2026-09-08: the owner dismissed the rule.** Components 1–3 are
> built; see `docs/DECISIONS.md` D-082 for what replaced it and D-083 for the
> registry's default. The three consequences below were the ones worth
> weighing, and two of them are still open — they are listed again at the end
> of this document.

Components 2–5 all fetch a page. `docs/PILOT-RUNBOOK.md` §2 and
`docs/DECISIONS.md` forbid that: _never fetch, crawl or scrape a result page;
link out only._ That rule is recorded here by the owner, so reversing it is a
product decision, not an engineering one. Three consequences are real and worth
weighing rather than waving through:

- **Source terms.** Several of the richest surfaces forbid automated access in
  their terms whatever `robots.txt` says. The registry in component 2 is where
  that gets decided per domain, in writing, once.
- **Article 14 at volume.** `LEGAL.md` promises a deletion path and a notice.
  Both are answerable for a handful of saved records; at crawl volume they are
  a different problem, and the answer has to exist before the crawl does.
- **The storage rule.** _Never bulk-persist search results_ is the other half of
  the same decision. A crawler that discards everything is useless; one that
  keeps everything breaks the promise. The middle — keep the claim and the
  address, never the page — is what `evidence.ts` was shaped for.

## What is being built regardless

The classifier and the extractor **do not need the rule reversed**. They work on
text the recruiter already supplies lawfully: a pasted page, an uploaded
document, an import, the browser companion. Building them now means they are
proven against a real corpus before any crawler exists — and turning fetching on
later becomes a connector change rather than a product change.

That corpus is in progress: realistic pages for each of the twenty surfaces,
with the extraction a competent human would agree is correct, and adversarial
traps for the seven ways every naive extractor fails — furniture read as a
person, the conference read as the employer, the two-person roster read as one,
the table missed entirely, a job ad read as somebody who does the work, the
single-person page read as empty, and the page that names nobody at all.

## Order of work

1. Extractor + classifier, against the corpus, on supplied text. **Done** —
   D-081, 75% recall / 86% precision, held as a floor by `pnpm extraction`.
2. The decision above. **Made, 2026-09-08.**
3. Policy gate, fetcher, search connector. **Done** — D-082, D-083.
   `src/lib/fetch/` is the gate and the transport; `src/lib/research/web-search/`
   is the connector; `src/lib/services/page-reading.ts` is the only call site.
4. Everything else already worked the moment a URL arrived, and does.

## What is still open, and both are the owner's

**The operators are unverified.** Nobody has run a key against the open-web
index, so every row in `OPERATOR_SUPPORT` says `unverified` and the settings
page says how many. `pnpm probe:search` decides it: eight membership probes —
never count comparisons, which against a paged index measure the page size
rather than the operator — writing their verdicts to
`docs/SEARCH-OPERATORS-PROBE.md`. Until it has run, an angle composed with
`(a OR b)` may be running as a much broader query, and its rows would still
look like answers.

**Source terms and Article 14 at volume.** The registry now records a posture
and a basis per host. Twenty-one say `assumed`; three (ORCID, Semantic Scholar,
DBLP) say `documented-elsewhere`, which carries a licence reading recorded in
`DECISIONS.md` about those APIs rather than a reading of the sites' own terms.
Not one says `read` — nobody has read anybody's terms. That is honest rather than resolved. And the notice question
is answerable for a handful of explicitly-saved records and is a different
problem at crawl volume; nothing built here crawls, and the answer has to
exist before anything does.
