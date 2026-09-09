# Sourcing evaluation — 2026-09-07

What the sourcing engine is worth, measured, and what the measurement does not
cover. Run it with `pnpm benchmark`; `tests/unit/sourcing-benchmark.test.ts`
holds the floor so a ranking change that costs precision fails the build.

## What is measured

Eight deliberately unlike searches — technical, scientific, recruiting,
commercial, finance, law, healthcare, construction — over a corpus of 34
invented people (`src/lib/sourcing/benchmark.ts`). If the ranker only worked
for robotics engineers it would be a robotics tool, not a talent search engine;
the spread of fields is what stops it being tuned into one.

| Metric                                                | Result   |
| ----------------------------------------------------- | -------- |
| mean P@R (precision at the number of relevant people) | **1.00** |
| mean P@5                                              | 0.73     |
| mean recall                                           | 1.00     |
| queries with a relevant top hit                       | 5 / 5    |
| capability reading accuracy                           | 1.00     |
| distractors ranked above a relevant person            | **0**    |
| evidence coverage                                     | 1.00     |
| multi-source coverage                                 | 0.41     |
| unsourced contacts                                    | 0        |

**P@R, not P@5, is the headline.** With three relevant people in the corpus,
P@5 cannot exceed 0.60 however perfect the ranking is, so reporting P@5 alone
would print a ceiling as a defect. The failure that costs a recruiter something
is a distractor ranked _above_ a real candidate; that count is zero.

## Two defects the benchmark found on its first run

Both were found by measuring, not by reading the code.

**1. The headline recruiting query returned the wrong population.**
"a technical recruiter who has hired robotics and machine learning engineers"
read all three capabilities as requirements, so the engineers — who have
robotics and ML directly — outranked the recruiters, who have one of the three.
The search for the people who hire engineers returned the engineers. P@5 was
0.20.

Fixed structurally, not by tuning: a capability that follows a qualifying verb
(`hired`, `recruited`, `sells to`, `supports`, …) names the domain worked _on_,
not a capability held. Qualifiers earn credit and never create a gap, so a
recruiter is not marked down for not being a roboticist. The rule generalises
past recruiting — "a sales leader selling into hospitals" wants the seller.

**2. Every person on file was returned for every query.**
Someone whose evidence touched none of the brief's capabilities came back as a
weak result rather than as no result, padding the list with the whole workspace
and burying the people who answered. A relevance floor now drops them.

After both: mean P@R 0.56 → 1.00, top hit relevant 4/5 → 5/5.

## What these numbers do not say

**They are a 34-person corpus.** A precision of 1.00 over 34 people mostly
reflects 34 people. The benchmark says the ranker orders the evidence it is
given correctly. It says nothing about coverage.

**Coverage is the real gap, and it is structural rather than technical.**
TalentOS does not fetch, crawl or scrape a result page — a standing decision
(`docs/DECISIONS.md`, `docs/PILOT-RUNBOOK.md` §2), not a missing feature. So
evidence arrives from four lawful places: structured public APIs (Wikidata,
OpenAlex, Crossref, GitHub), documents the recruiter supplies, imports they
own, and addresses they save. The twenty search-operator angles are composed in
full and opened by the recruiter, or held dormant with the query they would run.

**The ontology is 408 capabilities, and that is now its strength rather than
its limit.** It was 33 — enough for five fields and little else. It was widened
across twelve profession families by twelve drafting agents, each one then
adversarially refuted by a second agent looking for aliases that would match
ordinary prose, adjacency claims a practitioner would dispute, and invented
occupations. 499 problems were reported and applied; 76 more entries were
dropped mechanically by `scripts/merge-ontology.mts` for colliding with an
alias another concept already owned. What survived — 408 capabilities, 4,434
aliases, 1,638 adjacency edges, every one of them carrying its reason — passes
the contract in `ontology-validate.ts` in full.

The three new benchmark fields were added AFTER the expansion and scored 1.00
at P@R on the first run, with no tuning. That is what the expansion was worth:
not a bigger list, but three professions the product could not previously
answer at all.

A capability still outside the ontology works as a keyword; it just does not
activate adjacency scoring or the gap list.

**The gazetteer is 390 places, with 422 metro-folding rules.** Widened by the
same method, and the work there was mostly refusal: a place name that is also
an ordinary English word matches prose and puts people in the wrong country.
`reading berkshire` ships and `reading` does not; `wales` never ships bare
because it sits inside `new south wales`, and neither does `england` (inside
`new england`) or `york` (inside `new york`). An unlisted place still works as a
keyword; it just does not activate location scoring.

## What changed after the first measurement

Five further rules, each one closing a case the ranker or the resolver could
not previously see. All are covered by tests; none moved a weight to make a
number look better.

| Rule                                                                | What it fixes                                        |
| ------------------------------------------------------------------- | ---------------------------------------------------- |
| A capability after a sourcing verb is the domain, not a requirement | the headline recruiting query returned the engineers |
| Relevance floor                                                     | every person on file came back for every query       |
| Freshness decay, with undated treated as unknown                    | a 2009 claim counted the same as a 2026 one          |
| Shared collaborators as identity evidence                           | an initialised byline could never be resolved        |
| Merge threshold rises with how common the name is                   | "Michael Smith" and a rare name shared one bar       |
| Transitive closure, offered rather than applied                     | A↔B and B↔C never compared A to C                    |

One guard came out of the last two: the "only one name token in common"
penalty is skipped when name similarity is already high, because it was
double-charging "S. Chen" against "Sarah Chen" — taking back the credit the
similarity measure had just given for recognising an initial.

## Next, ranked by expected improvement

1. Gazetteer expansion, on the location dimension — the same method, in flight.
2. A larger benchmark corpus, so the numbers above start to mean something.
3. More evidence per person. The ranker is now far better than its inputs: a
   Wikidata one-liner is all most open-index rows carry, and everything the
   ontology can now distinguish is wasted on evidence that thin.
4. A merge action. The review queue can be read but not cleared, because
   applying a merge needs a schema change and a decision about which record
   survives — neither of which is mine to make.
5. Co-authorship from the structured sources. The signal is built and tested,
   but nothing currently supplies an author list to it.
