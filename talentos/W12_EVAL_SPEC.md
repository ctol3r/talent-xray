# W12 — Hiring Intelligence Adversarial Evaluation

> Wave type: evaluation, reasoning, hardening. No new product surface. No
> repository extraction. W0–W11 behaviour preserved.

## 1. Question this wave answers

Does the canonical hiring-intelligence system (D-011: `HiringNeedIR` →
`HiringIntentIR` with explicit `RequirementIR`s, the adaptive-intake
reasoner, and the `SearchPlanIR` re-derivation) model **ambiguous, real,
multi-stakeholder hiring-manager intent** — or does it merely perform well
on one clean CAIS fixture that the team has walked through eight times?

The wave is designed to expose failures. The corpus is written against
what a _correct_ system should do, not against what the current
implementation does (§6 records the discipline that enforces this).

## 2. Objects under test

| Object                                                           | Where                                                         | What we test                                                                                    |
| ---------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `derive_hiring_need`                                             | `src/lib/ai/tasks/hiring-need.ts`                             | JD → initial requirement / uncertainty / contradiction sets                                     |
| `intake_reasoning`                                               | `src/lib/ai/tasks/intake-reason.ts`                           | one turn: statement → claims, requirement updates, uncertainties, contradictions, next question |
| `recordManagerStatement`                                         | `src/lib/services/intelligence.ts`                            | service-level provenance: verbatim statement log, revision, merge of model output               |
| `derive_search_plan` + `composeDiscoveryQueries`                 | `src/lib/ai/tasks/search-plan.ts`, `services/intelligence.ts` | whether a manager answer mutates the plan where justified — and only there                      |
| `derive_personas`                                                | `src/lib/ai/tasks/personas.ts`                                | whether outreach assumptions follow the IR                                                      |
| `RequirementIR` / `ContradictionIR` / `ManagerStatement` schemas | `src/lib/core/ir.ts`                                          | whether the schema can _hold_ what a correct answer needs                                       |

## 3. Corpus

`eval/w12/corpus/*.json`, validated by `eval/w12/schema.ts`. At least 50
multi-turn conversations across at least 10 occupations. Every
conversation declares which of the 20 adversarial categories it carries;
`tests/unit/w12-corpus.test.ts` fails if any category, any special fixture
A–J, or the stakeholder-disagreement case is missing.

Special fixtures (one occupation each, several conversations each):
A CAIS research scientist · B ICU nurse · C enterprise account executive ·
D CNC machinist · E CFO · F propulsion engineer · G semiconductor process
engineer · H public-school principal · I executive chef · J data-center
electrical technician. Further occupations fill the corpus to ≥ 50.

### 3.1 Conversation shape

```
{
  id, occupation, fixtureLetter?, title, categories: [1..20],
  project: { name, companyName?, roleTitle, geography?, country?, industry?, seniority?, businessObjective? },
  jd: "<short JD, deliberately containing the adversarial material>",
  stakeholders?: [{ id, role, decisionAuthority? }],
  notes: "why this is adversarial; what a failure looks like",
  turns: [ { speaker, text, context?, expect } ... ]
}
```

Statements are **scripted fixtures**, never real hiring managers. Each
turn's `expect` block is the human-authored expected canonical outcome:

| Field              | Meaning                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `requirements[]`   | requirements that must exist after the turn — `aliases` (any must appear in label/definition/statement), expected `kind`, `status`, `origin`; `constructAliases` (the definition must name the underlying construct); `proxyTerms` (must be a false signal or a hint, never a filter); `evidenceAliases` / `falseSignalAliases`; `mustNotExist` for proxies that must not become requirements |
| `uncertainties[]`  | expected uncertainties with `consequential` and `status`; `shouldRemainUnknown` marks things the system must **not** infer                                                                                                                                                                                                                                                                    |
| `contradictions[]` | expected `ContradictionIR`s by alias                                                                                                                                                                                                                                                                                                                                                          |
| `nextQuestion`     | `targetsAliases` the question (or its targeted uncertainties) must address; `shouldChallenge` when the correct move is to push back on the manager; `mayBeNull`                                                                                                                                                                                                                               |
| `untouched[]`      | requirement keys from earlier turns that must **not** change this turn (the silent-mutation oracle)                                                                                                                                                                                                                                                                                           |
| `replan`           | `required` and, when true, per-dimension `changes` (occupation · population · adjacent · geography · channels · evidence · strings · screening · persona) with `aliases` that must appear and `mustNotContain` terms that must not                                                                                                                                                            |
| `forbiddenTerms[]` | fabrication canaries: strings that must not appear anywhere in the output                                                                                                                                                                                                                                                                                                                     |

## 4. Harness

`eval/w12/` — provider-agnostic, resumable under the session provider
(D-008), driven by `pnpm eval:w12`.

For each conversation: fresh project in a throwaway database → JD saved →
`deriveHiringNeed` → for each turn `recordManagerStatement` (snapshot
before/after) → deterministic checks → where `replan.required`,
`deriveSearchPlan` + `composeDiscoveryQueries` (+ `derivePersonas` under the
mock research provider when a persona change is expected) → checks → one
LLM-judge call per conversation. Results land in `eval/w12/results/<run>/`
as JSON plus a markdown report with coverage stated explicitly: a partial
run can never present itself as a full one.

### 4.1 Deterministic checks (`eval/w12/checks.ts`)

| Metric                                           | Definition                                                                                                                                                                                                                                                                                                             | Target             |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| **provenance_preservation**                      | per turn: statement log equals the scripted statements verbatim and in order; every claim carries provenance; every `manager_statement`-origin requirement's `statement` is a verbatim substring of some statement (whitespace/quote-normalized); every `jd`-origin requirement's `statement` is a substring of the JD | **100 %** of turns |
| **silent_requirement_mutation**                  | per turn: a requirement listed in `untouched` whose kind/definition/status/evidenceSpec/falseSignals changed, or any requirement whose id disappeared without the expectation removing it                                                                                                                              | **0**              |
| **heuristic_mutation**                           | advisory: a pre-existing requirement whose kind changed with no content-word overlap between its label and the statement                                                                                                                                                                                               | reported           |
| **unsupported_fabrication**                      | numbers in the output absent from every input (JD, project facts, statements, prior IR), plus any `forbiddenTerms` hit                                                                                                                                                                                                 | **0**              |
| **protected_trait_violations**                   | `scanPayloadForProtectedTraits` over the full output                                                                                                                                                                                                                                                                   | **0**              |
| **requirement_recall**                           | expected requirements matched (alias + kind/status/origin when specified) ÷ expected                                                                                                                                                                                                                                   | reported           |
| **proxy_as_requirement**                         | expected-`mustNotExist` proxies that became requirements, or proxy terms that appear as must-have/credential/company search terms at re-plan                                                                                                                                                                           | **0**              |
| **construct_named**                              | expected requirements whose definition names the construct (`constructAliases`)                                                                                                                                                                                                                                        | reported           |
| **evidence_signal_recall / false_signal_recall** | expected evidence / false-signal aliases present                                                                                                                                                                                                                                                                       | reported           |
| **contradiction_detection**                      | expected contradictions matched by alias in claimA/claimB/note                                                                                                                                                                                                                                                         | reported           |
| **consequential_uncertainty_detection**          | expected uncertainties matched with the right `consequential` flag and status; `shouldRemainUnknown` items must be open and not covered by an `explicit` requirement                                                                                                                                                   | reported           |
| **next_question_targeting**                      | the next question (text or targeted uncertainties) addresses a `targetsAliases` entry                                                                                                                                                                                                                                  | reported           |
| **replan_signal**                                | system-implied "re-plan needed" (any requirement changed/added or consequential uncertainty resolved) versus the expected `replan.required` — missed and spurious both count                                                                                                                                           | reported           |
| **replan_correctness**                           | for each expected change dimension, aliases present in the right part of the new plan and `mustNotContain` absent; strings checked on the composed queries                                                                                                                                                             | reported           |

### 4.2 LLM judge (`eval/w12/judge.ts`)

An AI task (`w12_judge`) with a strict output schema, one call per
conversation, seeing only: the scripted statements, the JD, the system's
outputs per turn, and the fixture's `notes` + expectation text as the
rubric. It scores 0–2 per turn on: construct definition quality,
proxy-to-construct identification, next-question information value,
challenge appropriateness (where expected), re-plan correctness (where
run), and lists unsupported inferences with the offending strings.

**Independence caveat.** With `TALENTOS_MODEL_PROVIDER=anthropic` the judge
runs on `TALENTOS_JUDGE_MODEL` (default: a different model from the system
under test). With the session provider the judge and the system share the
fulfilling session; the judge prompt is separate and rubric-driven, but the
independence is procedural, not model-level. This is stated on every
report.

## 5. Live-run protocol for this wave

No API key is configured in this environment, so the model under test is
the **session provider**: a Claude session fulfils each parked request from
the request file alone — system prompt, user prompt, output schema — with
the corpus expectations kept in separate files that are not consulted
while fulfilling. Fulfilment proceeds in rounds (all hiring-need requests,
then all turn-1 requests, …) because turn _t+1_ depends on turn _t_.

Because that protocol is expensive, the baseline and after-fix runs cover a
**stratified subset: one conversation per special fixture A–J (ten in
total), chosen so that all 20 adversarial categories are exercised between
them** — a-01, b-02, c-01, d-04, e-02, f-01, g-05, h-03, i-01, j-05. Every
intake turn in those ten runs live. Re-plans are the largest single
generation in the system, so the baseline runs them for a named subset of
conversations (`--replan-only`), recorded in the report rather than
implied. The remaining 43 conversations are corpus-validated and
harness-ready; `pnpm eval:w12` runs the full corpus unattended once an API
key exists. Coverage is printed at the top of every report, and the
after-fix run uses exactly the same selection as the baseline.

## 6. Anti-optimization discipline

1. Corpus and expectations are written before the harness runs and are
   committed before any fix (`corpus-frozen` tag in the report).
2. Expectations describe correct canonical outcomes for a recruiter, not
   the current schema's vocabulary; where the schema cannot hold the
   correct outcome, that is a finding, not an excuse.
3. Fixes are only allowed after the baseline is recorded and the failure
   taxonomy names the mechanism.
4. A fix may change prompts, service merge logic, and — only when the
   corpus proves the collapse causes wrong search behaviour — the smallest
   schema correction. Fixture text is never edited to make a test pass;
   an expectation is edited only when it is shown to be wrong, and the
   edit is logged in the report.

## 7. Schema questions this wave must settle with evidence

**Authority / provenance semantics** (`assertedBy`, `decisionAuthority`,
`challengedBy`, `approvedBy`). Not added on suggestion. The stakeholder
disagreement fixtures show whether the current `speaker` + `origin` +
`ContradictionIR` can represent "the hiring manager says must-have, the
VP says preferred" without one side silently overwriting the other. If
the baseline shows attribution loss or last-speaker-wins mutation, the
smallest correction that resolves it is proposed and tested; if not, no
change.

**Requirement facets** — CONSTRUCT · PROXY · SIGNAL · EVIDENCE · THRESHOLD ·
FALSE_SIGNAL · COUNTEREVIDENCE. `RequirementIR` today holds label,
statement, definition, kind, origin, evidenceSpec, falseSignals, status.
The proxy / threshold / counterevidence fixtures show whether collapsing
those facets produces wrong search behaviour (a proxy becoming a search
filter; a threshold silently becoming part of the construct; nothing that
could disconfirm). Only a proven collapse earns a schema field.

## 8. Search-mutation evaluation

A manager answer must be able to change — where justified and only where
justified — target occupation, primary population, adjacent populations,
geography, channels, evidence signals, search strings, screening
questions, and audience/persona assumptions. The corpus contains at least
one conversation per dimension whose expected re-plan names the change
and the terms that must _not_ appear. No mutation without attributable
evidence (a statement or JD phrase) and human-controlled intent (the
hiring manager said it; the recruiter ran the re-plan).

## 9. Deliverables

1. This spec · 2. corpus · 3. harness · 4. baseline scores (before fixes) ·
2. failure taxonomy · 6. targeted fixes · 7. scores after fixes ·
3. regression tests · 9. extraction-readiness recommendation — all in
   `eval/w12/REPORT.md` with the run directories it cites.
