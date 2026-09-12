# W12 evaluation run — baseline

Provider under test: **session**. Judge: same provider (procedural independence only when the provider is `session`).

## Coverage (read this first)

- Corpus: 53 conversations. Attempted: 10. **Done: 10.** Pending: 0. Errored: 0.
- Done: a-01, b-02, c-01, d-04, e-02, f-01, g-05, h-03, i-01, j-05
- Adversarial categories exercised by done conversations: 20/20

## Deterministic metrics

| Metric                  | Pass / total | Rate    | Violations | Target   |
| ----------------------- | ------------ | ------- | ---------- | -------- |
| provenance_preservation | 260 / 260    | 100.0 % | —          | 100 %    |
| silent_mutation         | 21 / 22      | 95.5 %  | 1          | 0        |
| protected_traits        | 38 / 38      | 100.0 % | 0          | 0        |
| fabrication             | 40 / 42      | 95.2 %  | 2          | 0        |
| must_not_exist          | 9 / 9        | 100.0 % | 0          | 0        |
| requirement_recall      | 46 / 51      | 90.2 %  | —          | reported |
| construct_named         | 7 / 8        | 87.5 %  | —          | reported |
| proxy_identified        | 3 / 3        | 100.0 % | —          | reported |
| evidence_signal_recall  | 9 / 12       | 75.0 %  | —          | reported |
| false_signal_recall     | 4 / 7        | 57.1 %  | —          | reported |
| contradiction_detection | 4 / 4        | 100.0 % | —          | reported |
| uncertainty_detection   | 20 / 22      | 90.9 %  | —          | reported |
| unknown_preserved       | 1 / 1        | 100.0 % | —          | reported |
| next_question_targeting | 6 / 6        | 100.0 % | —          | reported |
| replan_signal           | 16 / 16      | 100.0 % | —          | reported |
| replan_correctness      | 16 / 19      | 84.2 %  | —          | reported |
| heuristic_mutation      | 4 / 4        | 100.0 % | —          | reported |

## Judge (semantic dimensions, 0–2)

- Conversations judged: 0
- constructDefinition: —
- proxyIdentification: —
- nextQuestionValue: —
- challengeAppropriateness: —
- replanCorrectness: —
- unsupported inferences listed by the judge: 0
- modelsIntent average: —

## Findings by metric

### silent_mutation (2)

- [warn] e-02 · turn 1: untouched key "integrity" has no earlier expectation to resolve it
- [fail] g-05 · turn 1: untouched requirement "Advanced-node etch experience (5+ years)" changed (definition, evidenceSpec, falseSignals) on a statement that did not address it

### fabrication (2)

- [fail] b-02 · turn -1: number "18" appears in the output but in no input
- [fail] g-05 · turn 0: number "7" appears in the output but in no input

### requirement_recall (5)

- [fail] b-02 · turn 0: "ECMO nursing experience": status needs_clarification (expected explicit)
- [fail] b-02 · turn 1: "ICU experience (two years)": status needs_clarification (expected explicit)
- [fail] e-02 · turn 1: "Lead finance through IPO readiness": origin jd (expected manager_statement)
- [fail] f-01 · turn 1: "LOX/RP-1 systems": kind preferred (expected trainable)
- [fail] g-05 · turn 0: "Advanced-node etch experience (5+ years)": kind must_have (expected preferred)

### construct_named (1)

- [fail] i-01 · turn 0: "Creative, seasonal fine-dining leadership" definition does not name the construct (retention / brigade stays / turnover)

### evidence_signal_recall (3)

- [fail] b-02 · turn 1: "ICU experience (two years)" evidenceSpec lacks competency / signed off / bedside
- [fail] c-01 · turn 1: "Executive presence" evidenceSpec lacks signed / closed / economic buyer
- [fail] i-01 · turn 0: "Creative, seasonal fine-dining leadership" evidenceSpec lacks retention / turnover / stayed

### false_signal_recall (3)

- [fail] b-02 · turn 0: "ECMO nursing experience" falseSignals lack seen the machine / cardiac / observed
- [fail] b-02 · turn 1: "ICU experience (two years)" falseSignals lack perfusionist
- [fail] c-01 · turn 1: "Executive presence" falseSignals lack on a call / attended

### uncertainty_detection (2)

- [fail] b-02 · turn 0: "Which sub-specialty case mix the unit runs beyond general ICU": status resolved (expected open)
- [fail] e-02 · turn 1: "What 'strategic partner to the CEO' means concretely": status resolved (expected open)

### replan_correctness (3)

- [fail] b-02 · turn replan: strings: "perfusionist" is present but must not be
- [fail] d-04 · turn replan: persona: "relocation" is present but must not be
- [fail] d-04 · turn replan: persona: "twenty-six" is present but must not be
