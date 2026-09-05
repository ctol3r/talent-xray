# W12 evaluation run — afterfix

Provider under test: **session**. Judge: same provider (procedural independence only when the provider is `session`).

## Coverage (read this first)

- Corpus: 53 conversations. Attempted: 3. **Done: 3.** Pending: 0. Errored: 0.
- Done: b-02, d-04, e-02
- Adversarial categories exercised by done conversations: 10/20 (missing: 1, 3, 4, 8, 9, 12, 13, 14, 15, 16)

## Deterministic metrics

| Metric                  | Pass / total | Rate    | Violations | Target   |
| ----------------------- | ------------ | ------- | ---------- | -------- |
| provenance_preservation | 81 / 81      | 100.0 % | —          | 100 %    |
| silent_mutation         | 2 / 2        | 100.0 % | 0          | 0        |
| protected_traits        | 13 / 13      | 100.0 % | 0          | 0        |
| fabrication             | 10 / 10      | 100.0 % | 0          | 0        |
| must_not_exist          | 3 / 3        | 100.0 % | 0          | 0        |
| requirement_recall      | 10 / 10      | 100.0 % | —          | reported |
| construct_named         | 1 / 1        | 100.0 % | —          | reported |
| evidence_signal_recall  | 2 / 2        | 100.0 % | —          | reported |
| false_signal_recall     | 2 / 2        | 100.0 % | —          | reported |
| contradiction_detection | 2 / 2        | 100.0 % | —          | reported |
| uncertainty_detection   | 12 / 12      | 100.0 % | —          | reported |
| unknown_preserved       | 1 / 1        | 100.0 % | —          | reported |
| next_question_targeting | 3 / 3        | 100.0 % | —          | reported |
| replan_signal           | 4 / 4        | 100.0 % | —          | reported |
| replan_correctness      | 11 / 11      | 100.0 % | —          | reported |
| heuristic_mutation      | 1 / 1        | 100.0 % | —          | reported |

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
