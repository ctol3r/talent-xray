# Discovery provider assessment (2026-09-07)

Context: D-033. Google's Custom Search JSON API is closed to new customers
and ends for everyone on 2027-01-01. The owner's account has no
grandfathered project. This page assesses the replacements the owner asked
for ("assess all three") plus one option found during the assessment. The
decision is the owner's; the recommendation is at the end.

## What a replacement must satisfy

Taken from CLAUDE.md, D-010, D-026 and the pilot strings actually stored
for Search 1:

1. **The composer's string goes through unchanged.** It uses quoted
   phrases, `OR` groups in parentheses, `-` exclusions (quoted and bare),
   and `site:` with a path (`site:linkedin.com/in OR site:linkedin.com/pub`).
   The composer is the only validated part of the system and is not to be
   redesigned.
2. **The people-only corpus stays.** 102 URL patterns across the two
   engines (52 on Core, 50 on the second engine, read from the control
   panel today; lists in `docs/engines/`, read from the control panel
   today; the second engine is named "HU" there, not "Verified & Reach"). Patterns are path-scoped
   (`*.linkedin.com/in/*`, `www.crunchbase.com/person/*`,
   `npiregistry.cms.hhs.gov/*`), not bare domains.
3. **Link out only.** URL, title, snippet from the provider; never a page
   fetch.
4. **Bring-your-own-key economics.** An individual recruiter can sign up,
   pay per query, and stay inside a free tier for a three-search pilot.
5. **No terms clause that forbids the use.**

## Findings

### 1. Vertex AI Search (now "Agent Search"), Google's named successor

- Query syntax: quotes yes. `OR`/`AND` documented only for structured and
  unstructured stores; not confirmed for website stores. `NOT` and `-term`
  in the query: not supported. `site:` in the query: not supported; site
  scoping moves to a `filter` parameter that allows only `AND` in basic
  mode. Exclusions like `-"recruiter job"` have no query-level equivalent.
- Corpus: basic website search allows 50 URL patterns per data store over
  Google's public index, no domain verification. Two stores reproduce the
  two engines.
- Price: website data requires Enterprise edition, $4.00 per 1,000
  queries; 10,000 free queries per account per month. Individual
  enablement is a billing-enabled project plus a console toggle.
- Availability: open; no allowlist found.
- **Terms: blocking.** Google Cloud Service Specific Terms §21: "Customer
  may use only Customer Data and web domains that it owns or is authorized
  to utilize." The corpus is 102 patterns on other people's domains.
- Verdict: composer partial at best, corpus technically yes, contractually
  no. Not viable without a legal read that says §21 permits it.

### 2. General web-search APIs with domain filtering

| Provider                   | Composer verbatim                                                                     | site path                             | 100-pattern allow-list | $ / 1k       | Free tier                      | Individual BYOK | Link-out fields                         | Risk                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------- | ---------------------- | ------------ | ------------------------------ | --------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Brave Web Search           | partial: quotes, `OR`, `-`, `site:domain`; parentheses and `site:` paths undocumented | via a "goggle" path rule, not `site:` | yes, inline goggle     | $5           | $5 credit/month, card required | yes             | url, title, description                 | operators "experimental"; 400-char / 50-word cap; "Powered by Brave" attribution; no-storage clause |
| Bing (Grounding with Bing) | none: an LLM rewrites the query                                                       | config only                           | via Bing Custom Search | $14          | none; Azure subscription       | no              | citations inside model text             | not a search API; raw results withheld                                                              |
| SerpAPI (Google engine)    | **full**                                                                              | yes                                   | yes                    | $25 → $10    | 250/month                      | yes             | link, title, snippet                    | scrapes Google result pages against Google's terms; the legal shield starts at $150/month           |
| Exa                        | none: natural-language only, no keyword mode                                          | yes (`includeDomains` paths)          | yes, up to 1,200       | $7           | $20 once + $10/month           | yes             | url, title                              | composer semantics lost; `people` vertical is an aggregated profile database                        |
| Tavily                     | partial: quotes only                                                                  | yes                                   | yes, up to 300         | $8 / $16     | 1,000 credits/month            | yes             | url, title, content                     | no `OR`, `-`, `site:`                                                                               |
| Jina s.jina.ai             | none                                                                                  | domain only                           | not documented         | not verified | 10M tokens                     | yes             | url, title + fetched content by default | fetches result pages by default (rule 1)                                                            |

- Only SerpAPI takes the string verbatim, and it does so by scraping Google
  result pages, which is what the product rules forbid the app from doing
  itself. Paying a third party to do it is a distinction a reader of
  LEGAL.md will not accept.
- Brave is the only first-party index with real boolean operators and a
  way to express the corpus. Porting means a per-provider compile step
  (parentheses and `site:` paths become a goggle), a length guard, and a
  live recall test against the known Google results. Nothing here says the
  goggle allow-list filters retrieval rather than re-ranking it.
- Exa and Tavily handle the corpus but cannot run boolean logic; the
  composer would be replaced, not ported.

### 3. Link-out only, and the option found on the way

Opening the composed string in the recruiter's own browser needs no key,
fetches nothing, and stores only the string and explicit saves. The
question is which page to open.

**3a. Public engines, verbatim.** Google web search documents quotes,
`OR`, `-` and `site:` with a URL prefix; parentheses are undocumented but
have always worked in practice. Bing documents every construct including
parentheses, but "Only the first 10 terms are used", and a pilot string
has about 20. DuckDuckGo, Brave and Yandex each drop at least one operator
and would need a per-engine rewrite. None of the reviewed terms forbids a
tool that sends a person to a search URL. Loses the corpus restriction
entirely unless every string carries the 102 patterns, which no engine's
length limit allows.

**3b. The engines' own hosted results page.** Google's Programmable Search
Engine announcement of 2026-01-20 keeps the Search Element as the free
product for engines that use "Sites to search" with 50 or fewer domains,
and only ends "Search the entire web" and the JSON API on 2027-01-01.
Both Talent X-Ray engines are 50-site engines with "Search the entire
web" off (checked in the control panel today). The hosted page is
`https://cse.google.com/cse?cx=<engine>&q=<string>`.

Tested today in the owner's browser with a stored Search 1 string on the
Core engine: about 230 results, the first six all LinkedIn profiles that
match the string, with the engine's own refinement tabs ("Resumes & CVs",
"LinkedIn only") available. The second engine answered a shorter string
with one RocketReach record. Operators, parentheses and `site:` paths all
behaved as they did through the JSON API.

What it keeps: the composer verbatim, the validated corpus, link-out only,
zero cost, no key, no new terms. What it loses: the app never sees the
result list, so the yield ledger cannot count results or dedupe across
strings, and a save is the recruiter pasting a URL rather than clicking
one. The page is ad-supported on the free tier (LEGAL.md Q3 already
tracks this). The status of the hosted page itself past 2027 is not
named in Google's announcement; the Element it is built on is described
as retained and was refreshed in February 2026.

## Recommendation

Adopt **3b now** as the discovery mode for the pilot and for Waves F and
G: the app composes, shows, and opens the hosted engine page; the yield
ledger records the run, the string, and the recruiter's explicit saves
with a manual result count if the recruiter types one. This is the only
option that satisfies all five criteria today and it needs no provider
code, only a link and a save form.

Keep **Brave** as the API candidate to evaluate when automatic yield
counts are worth paying for: run the Search 1 strings through a goggle
built from the 102 patterns and compare the result sets against the
hosted page. Budget the evaluation at one day and 300 free queries.

Do not pursue Vertex AI Search until someone reads §21 against this use.
Do not pursue SerpAPI. Bing is not a search API any more.

Sources: Google Custom Search JSON API overview; Programmable Search
Engine blog 2026-01-20 and 2026-02-11; Programmable Search help 12397162;
Google Cloud Service Specific Terms §21; Agent Search docs (prepare-data,
filter-website-search, pricing, searchLite); Brave API operators, goggles,
pricing, terms; Microsoft Bing retirement notice and Grounding pricing;
SerpAPI pricing and legal pages; Exa, Tavily and Jina API references;
Google "Refine web searches" and site: operator pages; Bing advanced
search options. URLs are in the three research transcripts of 2026-09-07
and will be pinned in D-034 when the decision is taken.

## Open-web search, added 2026-09-08

`TALENTOS_DISCOVERY_PROVIDER=brave` with `TALENTOS_BRAVE_SEARCH_KEY` runs the
composed angles against the whole open web instead of the hundred people-only
domains. Chosen over a Google-SERP reseller because it is its own index rather
than somebody else's results resold against their terms, and because its
operator support is a documented feature rather than an accident.

Two costs, both real:

- **A smaller index than Google**, which hurts exactly the long-tail orphan
  pages sourcing depends on — the personal site, the lab roster, the tender
  annex.
- **The operators are unverified here.** Nobody has run a key against it, so
  `OPERATOR_SUPPORT` says `unverified` on every row and the settings page
  counts them. `pnpm probe:search` settles it; it needs the key and makes eight
  real requests.

Rule 3 of this document — link out only, never a page — is superseded by
`docs/DECISIONS.md` D-082. A result row is still only a URL, a title and the
engine's own snippet. Opening one of those addresses is a separate act, behind
the policy gate in `src/lib/fetch/`, off unless `TALENTOS_FETCH=on` and a
contact URL are both set.
