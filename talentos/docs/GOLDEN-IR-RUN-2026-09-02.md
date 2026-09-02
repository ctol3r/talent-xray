# CAIS golden path through the canonical IR — live run, 2026-09-02

Provider: **session** (D-008) — every generation fulfilled by a Claude
session through the file-handoff outbox; no API key. Same services and
schemas as the mock acceptance test (`tests/unit/ir-pipeline.test.ts`).
Discovery transport was stubbed (no Google key in the run environment); the
composed queries and the request to the live Core engine id are real.

Model turns: 11 (`derive_hiring_need`, `intake_reasoning` propose,
`intake_reasoning` statement ×5, `derive_search_plan` ×4). All eleven
passed zod validation and the fair-hiring scan with no warnings.

## What the run demonstrated

**JD → HiringNeedIR + initial intent.** 12 claims with provenance, 10
explicit unknowns, 8 RequirementIRs, 13 UncertaintyIRs (11 consequential),
0 contradictions. "Research taste" came out as:

- `statement` (verbatim): "Research taste matters more to us than citation
  counts: we want people who pick important problems and execute quickly."
- `definition`: a visible track record of choosing problems that turned out
  to matter — before the field agreed — and executing to a usable artifact
  quickly; judged from what was chosen and why, not citation totals.
- `status: needs_clarification`, linked to `unc-research-taste`
  (consequential: sourcing would otherwise default to venue prestige).

**Research boundary.** `ResearchProvider = none`; the people-only engines
refused the research question by construction.

**Adaptive intake — question 1 (highest information value):** asked the HM
for the one or two people on the team who most have research taste, what
they chose to work on before anyone agreed it mattered, and whether an
artifact-only builder with no first-author top-venue paper clears the bar.
Targeted `unc-research-taste` + `unc-equivalent-impact`.

**HM statement (scripted fixture, verbatim):** "By research taste I mean
they pick problems that matter before the field agrees they matter — look
for self-initiated projects that later became benchmarks, not citation
counts."

**Reasoner turn.** 3 claims extracted (`manager_statement`); the
requirement flipped to `explicit` / `origin: manager_statement` with the
definition rewritten in the HM's terms and a dated evidence spec ("the work
must predate the field's attention"); `unc-research-taste` resolved with
the statement as resolution; a new consequential uncertainty opened
(`unc-exemplar-artifacts`: which team projects became benchmarks); the next
question targeted RS-vs-RE + artifact-only builders + PhD weight — the half
of question 1 the HM did not answer. `revision: 0 → 1`.

**Search plan.** SuccessIR (3 outcomes, horizons marked inferred),
EvidenceIR (8 items keyed by requirement id), TalentPopulationIR (2 segments
— `scarce` and `unknown` supply; 2 adjacent segments; 3 exclusions),
SearchPlanIR (2 query plans, 5-step sequencing that explicitly waits on the
open relocation / priority-area / RS-vs-RE uncertainties).

**Composer.** 24 queries per segment. Segment 1 narrow, LinkedIn x-ray:

```
("Research Scientist" OR "Research Engineer") benchmark ("adversarial robustness" OR evaluations OR unlearning OR "red teaming" OR jailbreak OR "language models") ("San Francisco" OR "Bay Area" OR Berkeley) -recruiter (site:linkedin.com/in OR site:linkedin.com/pub)
```

**Discovery + save.** Request to `cx=a157d37906e1141cc` (Core), results
with `providerRank` and no relevance field; explicit save produced
`candidate.resumeText = null` and one `candidate_source_evidence` row
(`unverified`, `search_result`, rank 1).

## Intake loop, turn 2 (RS vs RE) — continued the same session run

**Question asked** (the reasoner's next question from turn 1): one seat or
two; does an artifact-only builder with no first-author paper clear the bar,
and are they an RE or an RS here.

**HM statement (scripted fixture, verbatim):** "One seat, and the title
follows the person — we would hire either. The line for us: a Research
Scientist generates the research questions and is judged on the research
they originate; a Research Engineer is judged on whether the infrastructure
and evals they build let the whole team run experiments it could not run
before — but both own projects end to end here, nobody is a service
function. And yes, someone whose whole record is an adopted benchmark or
eval harness with no first-author paper absolutely clears the bar; we would
call them a Research Engineer, and some of our strongest people came in
exactly that way. The one profile that does not clear it is a maintainer
who only ships what others designed."

**Reasoner turn** (`revision: 1 → 2`, both statements `reasoned`; the
resumable two-phase loop held under the session provider on first try):

- 6 claims extracted with `manager_statement` provenance.
- `Strong empirical research record` → `explicit` / `origin:
manager_statement`, definition rewritten as two fully equivalent arms
  (first-author top-venue research the person originated, OR an adopted
  benchmark/eval harness with no paper); "maintaining what others
  designed" added as a false signal.
- New requirement, kind **`disqualifier`**: "End-to-end project ownership
  (not maintainer-only)" — the HM's one stated non-qualifier made explicit.
- Resolved: `unc-rs-vs-re` (one seat, title follows the person; RS
  originates questions, RE builds what lets the team run new experiments),
  `unc-equivalent-impact` (artifact-only builders clear the bar outright),
  `unc-phd-weight` (marked as inferred from the statement, not verbatim).
- Still open: 8 (6 consequential) — scale bar, priority area,
  capacity-vs-capability, mission assessment, seniority, compensation band,
  relocation, exemplar artifacts.
- Next question: which of the four areas the hire is for and whether the
  need is capacity or a missing capability ("what's the experiment you
  can't run right now?") — targeting priority area, capacity-vs-capability,
  and exemplar artifacts; relocation and the scale bar queued next.

Consequence for the plan: SearchPlanIR from turn 1 sequenced the GitHub
x-ray on segment 2 as "only after the HM confirms artifact-only builders
clear the bar" — that condition is now met, and the plan should be
re-derived (it is stale relative to revision 2).

## Intake loop, turn 3 (priority area / capacity vs capability) + re-plan

**HM statement (scripted fixture, verbatim):** "Evals and benchmark
construction first — the next benchmark cycle is the deadline, so this
person needs to own a benchmark end to end from day one. Mostly it is
capacity: we know how to build these and we need one more person who can
do it without being carried. But there is one capability gap: we cannot run
agentic, long-horizon dangerous-capability evals at scale today. The
experiment we can't run right now is a multi-step agent evaluation across a
family of open-weight models with a harness someone can maintain after the
paper ships. On exemplars: the benchmarks this team is best known for each
started as one person's side project before anyone asked for them — that's
the pattern."

**Reasoner turn** (`revision: 2 → 3`; the loop resumed cleanly again):

- 5 claims extracted (`manager_statement`).
- The model-inferred "Direct prior work in the named safety areas"
  (`preferred/assumed`) became **"Prior benchmark or evaluation construction,
  owned end to end"** — `must_have`, `explicit`, `origin: manager_statement`;
  robustness and unlearning demoted to secondary relevance.
- New requirement, `preferred`: **"Agentic, long-horizon evaluation
  infrastructure (capability gap)"** — with its own linked uncertainty
  (`unc-agentic-gap-weight`: how it weighs against core capacity).
- Resolved: `unc-priority-area`, `unc-capacity-vs-capability`,
  `unc-exemplar-artifacts` (pattern given, names to confirm from the public
  record). Opened: `unc-agentic-gap-weight`.
- 15 uncertainties total: 9 resolved, 6 open (all consequential): scale
  bar, mission assessment, seniority, compensation band, relocation,
  agentic-gap weight.
- Next question: relocation / hybrid — "the last big lever on pipeline
  size" — targeting `unc-relocation`; scale bar, seniority, compensation
  band queued.

**Re-plan (second `derive_search_plan`, against revision 3).** SuccessIR
outcomes now cite `manager_statement` provenance for the first two
horizons; EvidenceIR grew to 10 items including an explicit
origination/disqualifier check; TalentPopulationIR re-segmented to
"Benchmark and evaluation originators (RS or RE)" (`scarce`) and
"Agentic-evaluation infrastructure builders" (`unknown`); SearchPlanIR's
two plans dropped robustness/unlearning vocabulary for evaluation terms,
made the GitHub x-ray co-primary (artifact-only builders now clear the bar),
kept the agentic plan a supplement until its weight is answered, and added
a pre-outreach origination check because the maintainer-only disqualifier
is not visible in a search string. Segment 1 narrow, GitHub x-ray:

```
("Research Scientist" OR "Research Engineer") benchmark (evaluation OR evals OR "dangerous capabilities" OR "capability evaluation" OR "language models" OR LLM) ("San Francisco" OR "Bay Area" OR Berkeley) -recruiter site:github.com
```

## Intake loop, turn 4 (relocation / on-site) + re-plan

**HM statement (scripted fixture, verbatim):** "We will relocate the right
person from anywhere in the US — we've done it several times and it's fast.
International relocation is possible in principle but it has taken months
in the past, and with the benchmark cycle as the deadline we can't count on
it for this seat. On-site means on-site: at least four days a week in the
office; occasional weeks away with collaborators are fine. No remote
arrangement, even for someone exceptional."

**Reasoner turn** (`revision: 3 → 4`): 4 claims extracted; "On-site in San
Francisco" → "On-site in San Francisco (US-wide relocation supported)",
definition rewritten (four on-site days minimum, no remote, US-wide
sourcing geography, outside-US deprioritized for timeline rather than
excluded); `unc-relocation` resolved. 15 uncertainties: 10 resolved, 5
open (scale bar, mission assessment, seniority, compensation band,
agentic-gap weight). Next question: the true distributed-training / scale
bar and whether it is trainable — "decides whether a must-have term stays
in every query plan".

**Re-plan (third `derive_search_plan`, against revision 4).** Three query
plans: "Benchmark and evaluation originators — Bay Area first" (unchanged
vocabulary, location filter kept, run first for the deadline), the same
segment "— US national" (no location term: location applied in review,
not in the query, because a hub OR-group would be both noisy and
incomplete), and "Agentic-evaluation infrastructure builders — US national"
(the thin capability-gap population would be emptied by a Bay Area filter).
Sequencing adds an early on-site-pattern confirmation and a revisit of the
distributed-training must-have once the scale bar is answered. US-national
narrow, GitHub x-ray:

```
("Research Scientist" OR "Research Engineer") benchmark (evaluation OR evals OR "dangerous capabilities" OR "capability evaluation" OR "language models" OR LLM) -recruiter site:github.com
```

## Intake loop, turn 5 (scale bar) + re-plan

**HM statement (scripted fixture, verbatim):** "Orchestration is the real
bar. Running evals across a whole family of open-weight models reproducibly
— sweeps, checkpoints, the harness — is exactly what we do daily, and that
is required from day one. Multi-node training is not: we fine-tune
occasionally, mostly small, and anyone who has run large eval programs picks
it up in a quarter with our infra team. So: orchestration must-have,
distributed training trainable. Don't filter on 'distributed training' —
you'd throw away the benchmark builders."

**Reasoner turn** (`revision: 4 → 5`): 4 claims extracted; the JD's
either/or requirement "Distributed training or large-scale experiment
orchestration" became **"Large-scale evaluation orchestration"**
(`must_have`, `origin: manager_statement`, with "distributed-training
experience offered in place of orchestration" as a false signal) plus a new
**"Multi-node distributed training (trainable)"** requirement of kind
`trainable` whose false signals include treating its absence as
disqualifying; `unc-scale-bar` resolved. 15 uncertainties: 11 resolved, 4
open (seniority, compensation band, mission assessment, agentic-gap
weight). Next question: seniority (is a finishing PhD / postdoc who
originated an adopted benchmark in scope?) and the compensation band —
together they set the title set, the adjacent-segment decision, and which
segments are closable.

**Re-plan (fourth `derive_search_plan`, against revision 5).** Query terms
unchanged (there was deliberately no training term); EvidenceIR's
orchestration item rewritten to the HM's bar and an 11th item added for the
trainable requirement stating it must not lower review priority; the
PhD/postdoc adjacent segment's tradeoff no longer cites the scale bar;
sequencing step 6 now runs that variant as soon as seniority admits it and
tells screening to probe orchestration, never distributed training.

## Defect found and fixed by this run

`recordManagerStatement` minted a fresh statement id/timestamp on every
call, so the reasoner's prompt hash changed on each re-run and a parked
session response could never be consumed — the intake loop was not
resumable under the session provider. Fixed as a two-phase loop (statement
persisted verbatim before reasoning; `reasonedAt` stamped after; same-text
re-runs reuse the stored statement; a different statement while one is
pending is refused). Pinned by `tests/unit/intake-session.test.ts`.

## Not exercised here

A real hiring manager (the statement is the fixture's scripted answer), a
live Google key for the discovery transport, and the remaining intake turns
(seniority, compensation band, mission assessment, agentic-gap weight) —
the loop stopped after five statements by choice, not because nothing was
open. The search plan is current as of revision 5.

## Turn 6 — seniority (revision 6, fifth re-plan)

**Question asked (from turn 5).** Two bundled: what "Senior" means here — years, having
led a thread, or working unsupervised — and whether a finishing PhD candidate or a
postdoc who originated an adopted benchmark is in scope; plus the compensation band.

**Scripted hiring-manager answer (fixture, not a real hiring manager).** "Senior" is
HR's word, not the manager's, and must not be read as years. The bar is having owned a
research thread end to end: picked the problem, made the design calls, shipped it,
defended it when pushed back on. A finishing PhD candidate or postdoc who originated a
benchmark others now run is squarely in scope and among the strongest profiles, because
originating a benchmark beside a thesis is the taste signal itself. Out regardless of
tenure: eight years executing someone else's evaluation agenda, never choosing what to
measure. The written floor is one independent, shipped, adopted artifact. Do not screen
on "Senior" in a title; do not screen out students. The band was deliberately deferred —
the manager is retrieving it from ops and asked for a day.

**What the reasoner did.** Eight claims extracted. One new `RequirementIR` — _Owned a
research thread end to end (the actual seniority bar)_, must-have, with evidence spec
(repository creator, self-initiated project distinct from the thesis, public defence of
design decisions) and false signals (Senior/Staff titles, years, maintainer status,
student status used to exclude). Three existing requirements rewritten: the
maintainer-only disqualifier now names the long-tenure-without-origination profile
explicitly; the benchmark-construction and empirical-record requirements gained
career-stage parity and title-as-false-signal language. `unc-seniority` resolved;
`unc-comp-band` left open with its consequence rewritten to record the manager's own
deferral. One new consequential uncertainty opened by the answer:
`unc-student-availability` — the newly primary student pool is calendar-bound, and the
benchmark-cycle deadline may not admit a spring finish. Next question asks how hard that
deadline is and whether a seat would be held, and parks the band.

**Re-plan (fifth `derive_search_plan`, against revision 6).** The PhD/postdoc pool moved
from `adjacentSegments` to a third primary `TalentPopulationIR` segment, with its own
query plan where student titles are primary rather than adjacent, so the narrow and
balanced variants target them directly instead of only appearing in the broad pass. A
new exclusions entry states the anti-filter explicitly ("NOT an exclusion, stated to
prevent one: career stage"), and every query plan's rationale now records that no years
or "Senior" term may be added. Sequencing runs the student plan third, ahead of the
LinkedIn pass, with an explicit note that the surface will under-serve it — students are
visible by what they shipped, not by a title — and a fallback position if the deadline
turns out to be hard. A twelfth `EvidenceIR` item covers the new requirement.

**Personas rebuilt.** The re-plan dropped the stored personas, as designed (they are
bound to the population segments). Re-deriving produced three personas from the same 27
stored findings — no new web search, because the new segment's plan vocabulary
de-duplicates against segment 1's, so the deterministic query set was unchanged. The new
persona, _Thesis-adjacent benchmark originators_, is built around the failure mode this
turn created: an audience that self-selects out of anything labelled "Senior", is courted
by structured fellowship pipelines, and needs the timing question answered before it is
asked. Its do-not-say list forbids promising a held seat, since that is exactly what the
next question is about.

## Turn 7 — the benchmark-cycle deadline (revision 7, sixth re-plan)

**Question asked (from turn 6).** How hard is the deadline behind the hire — is there a
date by which the person must be producing — and would a seat be held for a strong
originator who cannot start until they finish? The band stayed parked.

**Scripted hiring-manager answer (fixture).** Cycle submissions close the first week of
March, so anyone carrying a benchmark into it must be producing by 1 December; that date
is the constraint, not a requisition close. The seat will be held once, at a higher bar,
for a candidate who is _clearly_ the strongest originator seen — not merely equal —
skipping the cycle with them; never for two people, and never as something a recruiter
may promise in an email. The degree in hand is not required: starting in December and
defending afterwards is fine, with reasonable writing time. Availability must be asked
early, not inferred from a graduation date. Headcount is one seat this fiscal year, with
a likely second next year that must not be sourced against.

**What the reasoner did.** Nine claims extracted. One new requirement — _Producing by
1 December (waivable once, for a clearly stronger originator)_ — deliberately typed
`preferred` rather than `must_have`, because the hiring manager reserved a waiver; its
false signals name the exact mistakes available (inferring a start date from an
enrollment year, treating a not-yet-graduated candidate as unavailable, putting the date
in a search string). Two consequential uncertainties resolved: student availability and
the headcount/timeline. One new uncertainty opened and immediately marked
**non-consequential** — what "clearly stronger" means for the deferred-start exception —
recorded with the note that the hiring manager reserved that call, so it is not mistaken
for a recruiter-side gap. This is the first turn that closed more uncertainty than it
opened.

**Re-plan (sixth `derive_search_plan`, against revision 7).** Outcomes are now dated
(90 days reads as end of February from a 1 December start; the release horizon is the
March cycle close). A thirteenth `EvidenceIR` item covers availability and says plainly
that it is asked, not researched. Every query plan's rationale gained the rule that no
graduation-year or availability phrasing may enter a string. Sequencing lost the
conditional that had hedged the student plan — the timing risk that justified deferring
it is gone, so it runs third outright — and gained three operational lines: open every
first conversation with the availability question, outreach may say the degree is not
required but may never promise a held seat, and one seat means filling it rather than
building a bench.

**Personas rebuilt (third time).** Again three personas from the same 27 findings with
no new web search. The student persona is where the turn lands: its concerns now include
the assumption that a defence date disqualifies them, its proof points carry the
degree-not-required fact, its tone guidance puts the timing answer in the _first_ message
rather than a later conversation, and its do-not-say list gained two entries drawn
directly from the hiring manager's constraint — never promise a held seat or a deferred
start, and never imply the December date is generally negotiable. The exception exists,
but it is not the recruiter's to offer.

## Turn 8 — the agentic-gap weight (revision 8, seventh re-plan)

**Question asked (from turn 7).** When a stronger benchmark originator with no agentic
background sits next to a slightly weaker originator who has built agent harnesses across
model families, which one does the hiring manager want — and does the agentic plan run as
a primary search or stay a supplement?

**Scripted hiring-manager answer (fixture).** Origination is never traded for a skill: a
strictly stronger originator wins every time, even against three shipped harnesses. The
"capability gap" was the manager's own misframing — harness engineering is trainable in a
quarter with support, exactly like distributed training. One part is not teachable, and it
is not engineering: having run an evaluation where the model _acts_ over multiple steps —
state, tool calls, partial credit, rollouts that derail. People who have only scored
single-turn outputs underestimate nondeterminism, cost, drifting environments, and scoring
a run that half-worked. Evidence of hitting those walls once, in any form, is the signal;
building the harness is not. And no pipeline of agent-infrastructure engineers — most
execute someone else's design and fail the ownership bar anyway.

**What the reasoner did.** Eight claims. The agentic requirement was _rewritten rather
than added to_: relabelled "Has evaluated a model that acts (multi-step, stateful
evaluation)", with the failure modes as its evidence spec and "scale of harness
engineering treated as the qualification" added as a false signal. A new `trainable`
requirement, _Agent-harness engineering_, mirrors the distributed-training precedent — a
bonus, never a filter, absence must not lower review priority. `unc-agentic-gap-weight`
resolved.

**First contradiction recorded in eight turns.** `con-agentic-gap-framing` pairs the
earlier claim that agentic evaluation is _the capability gap this hire should close_
against this turn's claim that the engineering is _trainable in a quarter_, and resolves
it: both hold, the team does lack the capability today, but acquiring it is not what the
hire is for. The contradiction was worth recording because the earlier framing had driven
real structure — a segment, a query plan, and evidence-gathering depth. The `status:
resolved` path had been exercised only in tests until now.

**Re-plan (seventh, against revision 8).** The retracted framing had to be chased out of
everything it had touched. `SuccessIR`'s mission no longer says the hire should "ideally
close the capability gap"; the 12-month outcome now notes the harness engineering may well
be learned here rather than brought. The agentic segment is relabelled _"supplementary
surface, not a hiring target"_ and its description records the retraction. A new exclusion
names agent-infrastructure pipelines as explicitly unwanted. Most consequentially, because
the signal now belongs to the _same_ population rather than a separate one, its vocabulary
moved into the benchmark plans' OR group — `agentic`, `tool use`, `multi-step` now sit
beside `evaluation` and `evals` in plans 1 and 4 — while the agentic plan itself drops to
last, "small and deliberately so". A fourteenth evidence item covers the trainable
requirement in the same words the distributed-training item uses. Sequencing gained the
finalist rule verbatim: never trade origination for agentic experience.

**Personas rebuilt (fourth time).** The agentic persona needed the most work, because the
retraction changes what outreach to it may honestly claim: it is now approached as
_originators who happen to carry the signal_, its first do-not-say entry forbids
positioning the seat as agent-infrastructure or eval-tooling work, and its tone guidance
requires saying plainly that origination is the bar rather than implying harness work
substitutes for it. A persona that mis-sells the seat would have been the most expensive
kind of drift here — the audience's own first question is whether this is a research seat
or a plumbing seat.

## W11 — research-gated personas and outreach (live, session providers)

Owner request the same day: "what happened to email outreach drafts? …
persona creation of targeted audiences … make sure it researches the web
before generating anything." Run against the same `ir-live` database
(intent revision 5, plan v4) with `TALENTOS_MODEL_PROVIDER=session` and the
research provider following it (`session`, D-013). The fulfilling Claude
session performed the web searches itself; no API key was involved.

**Audience research (5 deterministic queries from the IR, all visible and
stored with every finding).** Company mission; one query per talent
segment using the plan's own must-have / any-of vocabulary (benchmark ·
evaluation · evals; evals · agentic · agent evaluation); compensation; what
the audience values. Five `Research-<hash>.request.json` files were parked
at once, fulfilled with one web search each, and 27 findings were stored in
`research_sources` (`source = session-research`, `query`, `retrievedAt`;
one URL shared by two queries was stored once). Individuals' pages that the
searches returned (three biographies under the compensation query) were
excluded by the fulfilling session per the request's scope rule —
audience-level only, never a person.

**Personas (`derive_personas`, one session request).** Two
`AudiencePersonaIR`s, one per `TalentPopulationIR` segment:

- _Benchmark originators — RS/RE who shipped an adopted eval_: values
  owning a measurement problem end to end and public, adopted work;
  concerns are service-function risk, nonprofit pay versus labs, on-site SF
  relocation, and benchmark fragmentation; twelve citations (CAIS mission
  and work pages, the benchmark-fragmentation and evaluation-vs-deployment
  findings, the field's Iterators/Connectors talent analysis, the
  compensation career review, the 2026 evaluation convenings).
- _Agentic-eval infrastructure builders_: values cross-family harnesses and
  bringing consistency to an inconsistent field; concerns are "plumbing vs
  research", how much the agentic side leads (still open with the HM), and
  competing Bay Area employers and fellowships; twelve citations.

`groundPersonas` dropped 0 citations — every cited URL was a stored finding.

**Outreach (`outreach_generation`, one session request)** for the fixture
record "A. Researcher" (saved from the discovery walkthrough; no title, no
recorded evidence). The draft records `personaLabel` = the benchmark
originators persona, chosen from the discovery query the record was saved
from, and says so in `cadenceRationale`. Seven steps (email 1 → breakup,
LinkedIn connect, InMail) on a 0/4/9/15/24 cadence justified for a scarce,
heavily recruited audience; no sentence claims familiarity with the
person's work; nine citations point at research URLs (audience claims) and
the rest at canonical-IR requirement ids (seat, relocation, agentic gap).
Nothing was sent.

**Gotcha found by this run.** Re-running `derivePersonas` after personas
exist writes a _new_ session request: the rendered IR context now contains
the stored personas, so the prompt hash changes. `generateOutreach` never
re-derives (it checks for stored personas first); the scratch driver was
fixed to do the same. Noted in `docs/BACKLOG.md`.

**Not exercised here.** A real candidate with recorded evidence (the fixture
record has none, so the drafts are deliberately non-personalized), the
Outreach tab's persona card in a browser against this database, and a
research provider other than a Claude session.
