# W12 — Hiring Intelligence Adversarial Evaluation: report

> Spec: `W12_EVAL_SPEC.md`. Runs: `results/baseline-uncorrected-instrument/`
> (raw first pass), `results/baseline/` (corrected instrument, **before any
> system fix**), `results/afterfix/`. No product surface was added; W0–W11
> behaviour is unchanged; `/talentos` was not extracted.

## 1. What was actually run

|                                  | Baseline                                                                          | After fixes              |
| -------------------------------- | --------------------------------------------------------------------------------- | ------------------------ |
| Conversations                    | **10** — one per special fixture A–J                                              | **3** — b-02, d-04, e-02 |
| Adversarial categories exercised | **20 / 20**                                                                       | 10 / 20                  |
| Model turns                      | 10 JD derivations + 22 intake turns + 6 re-plans + 1 persona set                  | 3 + 7 + 3 + 1            |
| Provider                         | session (a Claude session fulfilled every generation from the request file alone) | same                     |
| Judge                            | **not run**                                                                       | not run                  |

The corpus holds **53 conversations across 13 occupations**; 43 were not
run live. They are schema-validated and harness-ready, and `pnpm eval:w12`
runs the whole corpus unattended once an API key exists. The after-fix run
covers only the three conversations that carried findings, because each
live conversation costs a chain of hand-fulfilled generations. **Nothing
here should be read as a corpus-wide score.**

The LLM judge is implemented (`judge.ts`, `--judge`) but was not run: under
the session provider it would share the fulfilling session with the system
under test, so its independence would be procedural only. The semantic
dimensions it scores are therefore **unmeasured**, and the deterministic
metrics below are the whole of the evidence.

## 2. Baseline — before any system fix

Ten conversations, all 20 categories, corrected instrument (§4):

| Metric                                            | Result              | Target   |
| ------------------------------------------------- | ------------------- | -------- |
| provenance_preservation                           | **100 %** (260/260) | 100 %    |
| silent_requirement_mutation                       | **0**               | 0        |
| protected_trait_violations                        | **0**               | 0        |
| unsupported_factual_fabrication                   | **0**               | 0        |
| proxy_as_filter                                   | **0**               | 0        |
| must_not_exist (proxies that became requirements) | **0**               | 0        |
| requirement_recall                                | 96.1 % (49/51)      | reported |
| contradiction_detection                           | 100 % (4/4)         | reported |
| consequential_uncertainty_detection               | 95.5 % (21/22)      | reported |
| unknown_preserved                                 | 100 % (1/1)         | reported |
| next_question_targeting                           | 100 % (6/6)         | reported |
| proxy_identified                                  | 100 % (3/3)         | reported |
| construct_named                                   | 100 % (8/8)         | reported |
| evidence_signal_recall                            | 100 % (12/12)       | reported |
| false_signal_recall                               | **57.1 %** (4/7)    | reported |
| replan_signal                                     | 100 % (16/16)       | reported |
| replan_correctness                                | 89.5 % (17/19)      | reported |

**All four hard targets were met at baseline.** The system did not fabricate,
did not encode protected traits, did not silently mutate requirements, and
preserved provenance perfectly — including verbatim statement logs and
verbatim requirement statements across 22 multi-stakeholder turns.

## 3. Failure taxonomy

Eight findings survived the instrument correction. They reduce to four
mechanisms.

### F-1 — `status` conflates "vague requirement" with "open threshold"

_b-02 turn 1._ The hiring manager said plainly: "I need people who've
actually nursed ECMO patients, not people who've seen the machine." The
requirement is unambiguous; only its _level_ (bedside runs vs a competency
sign-off) was open. The reasoner marked the whole requirement
`needs_clarification`, so a hard, screenable must-have looked provisional to
everything downstream.
**Mechanism:** `status` was being used to mean "how certain am I of every
detail" rather than "how well is this defined". The schema could already
express the correct state (`status: explicit` + `linkedUncertaintyIds`);
the prompt gave no rule. **No schema change needed.**

### F-2 — `status` also absorbs "contested", and nothing records _who_ asserted what

_e-02 turns 2–3._ The CEO defined "strategic" as M&A and capital markets;
the board chair then said the opposite and asserted that the audit committee
owns the hire. The reasoner coped — it kept both positions and did not let
the later speaker overwrite the earlier one (silent_mutation stayed 0) — but
it expressed "disputed" as `needs_clarification`, which is indistinguishable
from "vague", and the attribution survived only because the model wrote
"(CEO)" and "(Board chair)" into prose. Nothing downstream could ask _whose_
requirement this is.
**Mechanism:** genuine expressive gap in `RequirementIR`.

### F-3 — the manager's own contrast wording is paraphrased away

_b-02, c-01._ "not people who've seen the machine" and "not that they've had
CFO on a call" are the most screenable things those managers said. The
reasoner captured the substance but replaced the phrasing, so the recruiter
lost the exact disqualifier language.

### F-4 — internal compensation positions reach outreach personas

_d-04 re-plan._ The plant manager's "he'd go to twenty-six for someone who
can program five-axis" appeared as a persona **proof point** — an internal
negotiating ceiling turned into outreach material.

### Not findings (verified, then dismissed)

- A number _proposed in a question to the manager_ ("is 7nm-class the
  line?") is correct recruiter behaviour, not fabrication.
- A term appearing only as a query **exclusion** (`-perfusionist`) is the
  opposite of searching for it.
- A phrase named in a persona's `doNotSay` is the persona working.

## 4. Instrument corrections (made before the taxonomy, logged here)

The first pass produced more failures in the _checker_ than in the system.
Each correction is in the code with its reason:

1. **Specificity-ranked matching** (label → statement → definition). Loose
   matching let a requirement that merely _mentioned_ a concept steal that
   concept's expectation. This alone accounted for 9 of the 20 first-pass
   failures.
2. **Fabrication scans assertive surfaces only** — definitions, evidence
   specs, false signals, claims, and what an uncertainty says it _is_.
   Questions and consequence prose legitimately contain proposed or
   illustrative figures. Forbidden-term canaries still scan everything.
3. **Exclusions stripped** from the positive search surface.
4. **`doNotSay` excluded** from persona forbidden-term checks.
5. **Two corpus aliases narrowed** — `["weight","priorit","board","CEO",…]`
   and `["leader",…]` were too generic to identify their object and matched
   the wrong one. Logged rather than silently changed.

Raw first pass: `results/baseline-uncorrected-instrument/REPORT.md`.
Re-scored with `--rescore`, which re-measures stored snapshots and makes no
model calls, so the system's outputs were never regenerated to suit the
instrument. **Stemming was considered and deliberately not added**: both runs
were therefore scored on an unchanged false-signal check, which is why the
F-3 improvement below is attributable to the prompt and not to a loosened
metric.

## 5. Fixes applied

| Finding | Fix                                                                                                                                                                                                                                                                                                    | Kind                                    |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| F-1     | `status` rule in `intake-reason.ts` and `hiring-need.ts`: a requirement the manager has stated is `explicit` even when its threshold is open — the threshold goes in a linked uncertainty. Documented on the schema field itself.                                                                      | prompt                                  |
| F-2     | `RequirementIR.assertedBy?: string` (the statement's speaker) and `RequirementIR.contested?: boolean`, plus reasoner rules: set `assertedBy` whenever origin is `manager_statement`; never encode disagreement as `needs_clarification`; never weaken a requirement because a later speaker disagrees. | **schema** (2 optional fields) + prompt |
| F-3     | Reasoner rule: when the manager draws a contrast, put _their_ wording in `falseSignals`.                                                                                                                                                                                                               | prompt                                  |
| F-4     | Personas rule: never put an internal compensation position — band, ceiling, "they'd go to X" — in a persona; naming a figure in `doNotSay` to forbid it is fine, asserting one as a proof point is not.                                                                                                | prompt                                  |

One fix was **over-corrected and re-calibrated in the open**: the first
version of the F-2 rule told the reasoner not to resolve a definition when
another stakeholder might dispute it, and the after-run showed it holding a
question open _before any dispute existed_ (e-02 turn 1). The rule now says:
resolve on the stakeholder's word, and **re-open** if another stakeholder
disputes it. The re-run under the calibrated rule is what the scores below
measure.

## 6. Scores after fixes

Same three conversations, same instrument:

| Metric                                                                              | Baseline (these 3) | After             |
| ----------------------------------------------------------------------------------- | ------------------ | ----------------- |
| provenance_preservation                                                             | 100 %              | **100 %** (81/81) |
| silent_mutation / protected_traits / fabrication / must_not_exist / proxy_as_filter | 0 violations       | **0 violations**  |
| requirement_recall                                                                  | 8/10               | **10/10**         |
| false_signal_recall                                                                 | 0/2                | **2/2**           |
| uncertainty_detection                                                               | 10/12              | **12/12**         |
| replan_correctness                                                                  | 9/11               | **11/11**         |
| every other metric                                                                  | 100 %              | **100 %**         |

Every finding on the re-run conversations cleared, and no metric regressed.
F-3's improvement is visible in the output itself: the ECMO requirement's
false signals now read _"people who've seen the machine"_ and _"Perfusionists
are a different job — don't send me those"_ — the manager's words.

## 7. Schema verdicts (asked for evidence, not opinion)

**Authority semantics — `assertedBy` YES, the rest NO.**
`assertedBy` is earned: e-02 proves that with two stakeholders, `origin`
only says "a person said this", and attribution otherwise survives as prose
a downstream agent cannot query. `contested` is earned as the smallest way
to stop disagreement being encoded as vagueness.
`decisionAuthority`, `approvedBy` and `challengedBy` are **not added**. The
corpus does not support them: decision authority is a property of a
_stakeholder_, not of a requirement, and belongs with the person record if
it is ever modelled; `challengedBy` duplicates `ContradictionIR`, which
already holds both sides and resolved correctly in every stakeholder
conversation (4/4); `approvedBy` describes a workflow event this wave found
no failure for. Adding them on suggestion would have been three fields for
one demonstrated problem.

**Requirement facets — no new fields earned.**
CONSTRUCT lives in `definition` (construct_named 100 %), SIGNAL/EVIDENCE in
`evidenceSpec` (100 %), FALSE_SIGNAL in `falseSignals` (100 % after F-3).
PROXY needed no field: proxy_identified was 100 % at baseline and
proxy_as_filter 0 — the reasoner handled prestige, credential and title
proxies through definition plus false signals, across CAIS awards, Big 4,
TSMC/Intel/Samsung, Michelin, doctorates and "native speaker".
THRESHOLD was the one real collapse (F-1) and it is expressible today via
`linkedUncertaintyIds`; it needed a rule, not a field.
COUNTEREVIDENCE produced no failure anywhere in the corpus and is
speculative — **not added**.

## 8. Search-mutation evaluation

Six re-plans ran. Manager answers moved the search across the dimensions
they should have and nowhere else: **occupation** (d-01 "machinist" → CNC
programmer; f-01 design → test conductor), **population and adjacent**
(b-02 cardiothoracic promoted to primary; j-05 utility/substation promoted
when MV switching became a must-have), **geography** (d-04 widened to Akron,
Canton and Mansfield when relocation was refused), **channels**, **evidence
signals**, **search strings** (the withdrawn BSEE and the withdrawn
best-paper award never entered a string), **screening** and **persona**.
`replan_signal` was 100 %: no re-plan was triggered by a turn that changed
nothing, and none was missed. No mutation occurred without an attributable
statement behind it.

## 9. Extraction readiness

**Recommendation: not yet — one wave away.**

For it: the IR boundary held under adversarial pressure. Provenance was
perfect, nothing was fabricated, no protected trait was encoded, no
requirement silently mutated across ten multi-turn conversations in ten
occupations, and the four defects found were one small schema gap and three
prompt rules — none of them structural.

Against it, and the reason to wait: `RequirementIR` changed _during this
wave_ (`assertedBy`, `contested`). A boundary that moved a week ago is not
yet a boundary other repositories should depend on. The evidence is also
thinner than it looks — 10 of 53 conversations, no judge run, and the
semantic dimensions unmeasured.

**Condition for extraction:** run the full 53-conversation corpus with a
real API key and an independent judge model, and land the wave that follows
without another `RequirementIR` change. If the schema is stable across that
run, extract. If the full corpus exposes a fifth mechanism that needs a
field, the boundary is still moving and extraction should wait again.
