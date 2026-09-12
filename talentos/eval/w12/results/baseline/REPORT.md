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
| silent_mutation         | 22 / 22      | 100.0 % | 0          | 0        |
| protected_traits        | 38 / 38      | 100.0 % | 0          | 0        |
| fabrication             | 35 / 35      | 100.0 % | 0          | 0        |
| must_not_exist          | 9 / 9        | 100.0 % | 0          | 0        |
| requirement_recall      | 49 / 51      | 96.1 %  | —          | reported |
| construct_named         | 8 / 8        | 100.0 % | —          | reported |
| proxy_identified        | 3 / 3        | 100.0 % | —          | reported |
| evidence_signal_recall  | 12 / 12      | 100.0 % | —          | reported |
| false_signal_recall     | 4 / 7        | 57.1 %  | —          | reported |
| contradiction_detection | 4 / 4        | 100.0 % | —          | reported |
| uncertainty_detection   | 21 / 22      | 95.5 %  | —          | reported |
| unknown_preserved       | 1 / 1        | 100.0 % | —          | reported |
| next_question_targeting | 6 / 6        | 100.0 % | —          | reported |
| replan_signal           | 16 / 16      | 100.0 % | —          | reported |
| replan_correctness      | 17 / 19      | 89.5 %  | —          | reported |
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

### silent_mutation (1)

- [warn] e-02 · turn 1: untouched key "integrity" has no earlier expectation to resolve it

### requirement_recall (2)

- [fail] b-02 · turn 0: "ECMO nursing experience": status needs_clarification (expected explicit)
- [fail] e-02 · turn 1: "Fix the close and the control environment": status needs_clarification (expected explicit)

### false_signal_recall (3)

- [fail] b-02 · turn 0: "ECMO nursing experience" falseSignals lack seen the machine / cardiac / observed
- [fail] b-02 · turn 1: "ECMO nursing experience" falseSignals lack perfusionist
- [fail] c-01 · turn 1: "Experience selling to CFOs" falseSignals lack on a call / attended

### uncertainty_detection (1)

- [fail] e-02 · turn 1: "What 'strategic partner to the CEO' means concretely": status resolved (expected open)

### replan_correctness (2)

- [fail] d-04 · turn replan: persona: "relocation" is present but must not be
- [fail] d-04 · turn replan: persona: "twenty-six" is present but must not be
