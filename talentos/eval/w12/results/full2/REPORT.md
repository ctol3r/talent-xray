# W12 evaluation run — full2

Provider under test: **session**. Judge: same provider (procedural independence only when the provider is `session`).

## Coverage (read this first)

- Corpus: 53 conversations. Attempted: 53. **Done: 0.** Pending: 53. Errored: 0.
- Done: (none)
- Adversarial categories exercised by done conversations: 0/20 (missing: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20)
- Pending requests:
  - a-01: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-78e547fc6621.request.json
  - a-02: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-66b889cf7336.request.json
  - a-03: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-afb5ac1c63cb.request.json
  - a-04: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-861a023e765c.request.json
  - a-05: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-db3201288633.request.json
  - b-01: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-61a169e750cd.request.json
  - b-02: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-a480485b8ab2.request.json
  - b-03: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-6be74f3b111b.request.json
  - b-04: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-d8d781002be2.request.json
  - b-05: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-e345484623c6.request.json
  - c-01: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-5b7072baf694.request.json
  - c-02: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-31fe43f888e4.request.json
  - c-03: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-d84006152008.request.json
  - c-04: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-9a538e96e33d.request.json
  - c-05: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-0c7cb97128b9.request.json
  - d-01: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-3566ac9798b3.request.json
  - d-02: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-840ae55355d0.request.json
  - d-03: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-6d1d4d89b538.request.json
  - d-04: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-772b92b2f047.request.json
  - d-05: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-9e96e86a3649.request.json
  - e-01: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-85cae78f67b0.request.json
  - e-02: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-10026b9b88ea.request.json
  - e-03: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-250c27ad6933.request.json
  - e-04: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-1b14af87ccb7.request.json
  - e-05: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/AudiencePersonas-d1061750f9a5.request.json
  - f-01: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-ca00500ceaa6.request.json
  - f-02: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-c6d74c1acf9a.request.json
  - f-03: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-e52c13cdbba7.request.json
  - f-04: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-93ca97ee2f21.request.json
  - f-05: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-5a59cc4c52bd.request.json
  - g-01: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-ff30efb88aff.request.json
  - g-02: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-9df27378dcb8.request.json
  - g-03: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-20692fa2fd49.request.json
  - g-04: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-41b0527174c9.request.json
  - g-05: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-404978af3b1c.request.json
  - h-01: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-0c985debdbc4.request.json
  - h-02: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-0bcd224b7940.request.json
  - h-03: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-fb056b1e49bb.request.json
  - h-04: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-c737f86e524a.request.json
  - h-05: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-e4d38fd4f231.request.json
  - i-01: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-28ef45f0fe7d.request.json
  - i-02: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-30d6d998ffc1.request.json
  - i-03: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-ced736a74365.request.json
  - i-04: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-a633629dddac.request.json
  - i-05: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-20b69e6de727.request.json
  - j-01: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-57ce28c190ab.request.json
  - j-02: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-07e4fae0eaf1.request.json
  - j-03: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-28f2eeb75393.request.json
  - j-04: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-01b682d93b49.request.json
  - j-05: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-770b502edcd4.request.json
  - x-01: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-0417c89842e4.request.json
  - x-02: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-970a8dbb5aed.request.json
  - x-03: /home/user/talent-xray/talentos/eval/w12/results/full2/outbox/IntakeReasoning-34d29bcf2896.request.json

## Deterministic metrics

| Metric | Pass / total | Rate | Violations | Target |
| --- | --- | --- | --- | --- |
| provenance_preservation | 854 / 854 | 100.0 % | — | 100 % |
| silent_mutation | 11 / 11 | 100.0 % | 0 | 0 |
| protected_traits | 132 / 134 | 98.5 % | 2 | 0 |
| fabrication | 124 / 124 | 100.0 % | 0 | 0 |
| must_not_exist | 17 / 18 | 94.4 % | 1 | 0 |
| proxy_as_filter | 19 / 19 | 100.0 % | 0 | 0 |
| requirement_recall | 142 / 157 | 90.4 % | — | reported |
| construct_named | 16 / 18 | 88.9 % | — | reported |
| proxy_identified | 17 / 19 | 89.5 % | — | reported |
| evidence_signal_recall | 16 / 20 | 80.0 % | — | reported |
| false_signal_recall | 14 / 19 | 73.7 % | — | reported |
| contradiction_detection | 5 / 8 | 62.5 % | — | reported |
| uncertainty_detection | 43 / 59 | 72.9 % | — | reported |
| unknown_preserved | 8 / 11 | 72.7 % | — | reported |
| next_question_targeting | 30 / 31 | 96.8 % | — | reported |
| replan_signal | 29 / 29 | 100.0 % | — | reported |
| replan_correctness | 101 / 104 | 97.1 % | — | reported |
| heuristic_mutation | 14 / 14 | 100.0 % | — | reported |

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

### protected_traits (2)
- [fail] a-05 · turn -1: age referenced in a requirement's defining text: "tic AI evaluation is a field only a few years old, so no candidate anywhere has ten years"
- [fail] f-02 · turn 0: national origin referenced in a requirement's defining text: "t, and using them would be screening on national origin.
The employer's own documented U.S.-per"

### must_not_exist (1)
- [fail] b-05 · turn 0: "Lives within a manageable commute of the unit" exists as a preferred requirement but must not (No requirement may encode age.)

### requirement_recall (15)
- [fail] b-03 · turn 0: "Permanent Band 6 post": origin jd (expected manager_statement)
- [fail] b-03 · turn 0: "Permanent Band 6 post": status explicit (expected needs_clarification)
- [fail] c-04 · turn 0: "Remote is acceptable": status explicit (expected needs_clarification)
- [fail] d-01 · turn 0: "Set up and run five-axis machining centres": origin jd (expected manager_statement)
- [fail] e-01 · turn 0: "Lead finance through IPO readiness": origin jd (expected manager_statement)
- [fail] f-04 · turn 0: "Familiarity with test-stand operations": origin jd (expected manager_statement)
- [fail] g-02 · turn 0: expected requirement "pedigree" (TSMC) is missing
- [fail] g-02 · turn 0: "PhD (corporate posting standard, not a bar)": kind preferred (expected must_have)
- [fail] g-02 · turn 0: "Named-fab preference (the manager's own example refutes it)": kind preferred (expected trainable)
- [fail] g-05 · turn 0: "Nanosheet development exposure (pilot line acceptable)": kind preferred (expected must_have)
- [fail] i-02 · turn 0: "Oversee banquets and in-room dining": origin jd (expected manager_statement)
- [fail] i-04 · turn 0: expected requirement "no-hotel" (hotel people) is missing
- [fail] x-01 · turn 0: "Simultaneous and consecutive modes": origin jd (expected manager_statement)
- [fail] x-02 · turn 0: "Troubleshoot converters and pitch systems": origin jd (expected manager_statement)
- [fail] x-03 · turn 0: "EDC systems (Medidata Rave)": origin jd (expected manager_statement)

### construct_named (2)
- [fail] c-01 · turn 0: "Owns new-logo enterprise deals" definition does not name the construct (new logo / opened themselves / seventy percent / 70)
- [fail] e-01 · turn 0: "Lead finance through IPO readiness" definition does not name the construct (S-1 / IPO readiness / SOX / led / roadshow)

### proxy_identified (2)
- [fail] e-01 · turn 0: "Lead finance through IPO readiness": proxy (public-company CFO / CFO title) is neither a false signal nor contextualized by the construct
- [fail] h-04 · turn 0: "Doctorate (a board member's preference, not a bar)": proxy (Harvard / Stanford / Columbia) is neither a false signal nor contextualized by the construct

### evidence_signal_recall (4)
- [fail] a-01 · turn 0: "Research taste" evidenceSpec lacks self-initiated / became benchmarks / other people run
- [fail] b-02 · turn 0: "Has nursed ECMO patients" evidenceSpec lacks nursed / ECMO patients / cannulat / circuit
- [fail] h-03 · turn 0: "Bilingual Spanish" evidenceSpec lacks fluen / proficien / conduct / meetings in Spanish
- [fail] i-01 · turn 0: "Retains a brigade" evidenceSpec lacks retention / turnover / stayed

### false_signal_recall (5)
- [fail] e-01 · turn 0: "Lead finance through IPO readiness" falseSignals lack title / investor dinners
- [fail] f-02 · turn 0: "U.S. person as defined by ITAR" falseSignals lack accent / foreign degree / national origin
- [fail] f-03 · turn 0: "Has fired engines, breadth over brand" falseSignals lack one valve / big-company / brand
- [fail] h-04 · turn 0: "Doctorate (a board member's preference, not a bar)" falseSignals lack Columbia / Ivy / brand / program
- [fail] j-01 · turn 0: "Data-centre time (rule of thumb, waivable)" falseSignals lack years

### contradiction_detection (3)
- [fail] b-03 · turn 0: expected contradiction "con-employment" not recorded
- [fail] c-04 · turn 0: expected contradiction "con-location" not recorded
- [fail] i-05 · turn 0: expected contradiction "con-chain" not recorded

### uncertainty_detection (16)
- [fail] b-01 · turn -1: "What 'calm under pressure' concretely means in this unit and how it will be assessed": consequential=false (expected true)
- [fail] b-01 · turn 0: "What 'calm under pressure' concretely means in this unit and how it will be assessed": consequential=false (expected true)
- [fail] b-02 · turn 0: "Which specialist therapies the unit runs (for example renal replacement or extracorporeal support) and whether experience with them is expected": status resolved (expected open)
- [fail] c-01 · turn -1: "What 'hungry' and 'hunter' concretely mean to this hiring manager": consequential=false (expected true)
- [fail] c-01 · turn -1: "What 'executive presence' means here in observable terms": consequential=false (expected true)
- [fail] c-01 · turn 0: "What 'hungry' and 'hunter' concretely mean to this hiring manager": consequential=false (expected true)
- [fail] c-01 · turn 0: "What 'executive presence' means here in observable terms": consequential=false (expected true)
- [fail] c-02 · turn 0: expected uncertainty "unc-proxy" (Salesforce) not recorded
- [fail] c-03 · turn 0: "Average deal size and sales-cycle length behind the $1.5M quota": status resolved (expected open)
- [fail] d-05 · turn 0: expected uncertainty "unc-adjacent" (who else) not recorded
- [fail] e-02 · turn -1: "What 'strategic partner to the CEO' means concretely": consequential=false (expected true)
- [fail] e-02 · turn 0: "What 'strategic partner to the CEO' means concretely": consequential=false (expected true)
- [fail] e-03 · turn 0: "The equity component of the package": status resolved (expected open)
- [fail] e-03 · turn 0: "Whether relocation to Austin is financially supported": status resolved (expected open)
- [fail] f-01 · turn 0: expected uncertainty "unc-adjacent" (adjacent) not recorded
- [fail] g-04 · turn 0: "Which process module this seat owns": status resolved (expected open)

### unknown_preserved (3)
- [fail] e-05 · turn 0: "unc-reloc" should remain unknown but requirement "Based in Austin; relocation expected" asserts it
- [fail] g-03 · turn 0: "unc-sponsor" should remain unknown but requirement "Own a process module through ramp" asserts it
- [fail] i-03 · turn 0: "unc-housing" should remain unknown but requirement "Housing not provided" asserts it

### next_question_targeting (1)
- [fail] d-05 · turn 0: next question does not address who else / other / trades / mold / tool / adjacent / background: "That is the most useful thing I have been told about this seat — it tells me which shops to look in "

### replan_correctness (3)
- [fail] a-02 · turn replan: adjacent: none of startup / infrastructure / harness / Kaggle present after re-plan
- [fail] e-01 · turn replan: adjacent: none of VP Finance / VP of Finance / number two / Chief Accounting Officer present after re-plan
- [fail] g-02 · turn replan: adjacent: none of 200mm / analog / trailing / mature node present after re-plan
