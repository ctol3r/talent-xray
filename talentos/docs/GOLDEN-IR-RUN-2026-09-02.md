# CAIS golden path through the canonical IR — live run, 2026-09-02

Provider: **session** (D-008) — every generation fulfilled by a Claude
session through the file-handoff outbox; no API key. Same services and
schemas as the mock acceptance test (`tests/unit/ir-pipeline.test.ts`).
Discovery transport was stubbed (no Google key in the run environment); the
composed queries and the request to the live Core engine id are real.

Model turns: 4 (`derive_hiring_need`, `intake_reasoning` propose,
`intake_reasoning` statement, `derive_search_plan`). All four passed zod
validation and the fair-hiring scan with no warnings.

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
(RS-vs-RE, priority area, relocation) — the loop stopped after one
statement by design of the walkthrough, not because nothing was open.
