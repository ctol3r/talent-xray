# CAIS golden path through the canonical IR — live run, 2026-09-02

Provider: **session** (D-008) — every generation fulfilled by a Claude
session through the file-handoff outbox; no API key. Same services and
schemas as the mock acceptance test (`tests/unit/ir-pipeline.test.ts`).
Discovery transport was stubbed (no Google key in the run environment); the
composed queries and the request to the live Core engine id are real.

Model turns: 9 (`derive_hiring_need`, `intake_reasoning` propose,
`intake_reasoning` statement ×4, `derive_search_plan` ×3). All nine passed
zod validation and the fair-hiring scan with no warnings.

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
(scale bar, seniority, compensation band, mission assessment, agentic-gap
weight) — the loop stopped after four statements by choice, not because
nothing was open. The search plan is current as of revision 4.
