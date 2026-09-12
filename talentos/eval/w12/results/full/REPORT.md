# W12 evaluation run — full

Provider under test: **session**. Judge: same provider (procedural independence only when the provider is `session`).

## Coverage (read this first)

- Corpus: 53 conversations. Attempted: 53. **Done: 53.** Pending: 0. Errored: 0.
- Done: a-01, a-02, a-03, a-04, a-05, b-01, b-02, b-03, b-04, b-05, c-01, c-02, c-03, c-04, c-05, d-01, d-02, d-03, d-04, d-05, e-01, e-02, e-03, e-04, e-05, f-01, f-02, f-03, f-04, f-05, g-01, g-02, g-03, g-04, g-05, h-01, h-02, h-03, h-04, h-05, i-01, i-02, i-03, i-04, i-05, j-01, j-02, j-03, j-04, j-05, x-01, x-02, x-03
- Adversarial categories exercised by done conversations: 20/20

## Deterministic metrics

| Metric | Pass / total | Rate | Violations | Target |
| --- | --- | --- | --- | --- |
| provenance_preservation | 1406 / 1414 | 99.4 % | — | 100 % |
| silent_mutation | 63 / 63 | 100.0 % | 0 | 0 |
| protected_traits | 240 / 241 | 99.6 % | 1 | 0 |
| fabrication | 169 / 169 | 100.0 % | 0 | 0 |
| must_not_exist | 32 / 37 | 86.5 % | 5 | 0 |
| proxy_as_filter | 20 / 20 | 100.0 % | 0 | 0 |
| requirement_recall | 209 / 231 | 90.5 % | — | reported |
| construct_named | 21 / 26 | 80.8 % | — | reported |
| proxy_identified | 16 / 22 | 72.7 % | — | reported |
| evidence_signal_recall | 29 / 30 | 96.7 % | — | reported |
| false_signal_recall | 19 / 31 | 61.3 % | — | reported |
| contradiction_detection | 20 / 26 | 76.9 % | — | reported |
| uncertainty_detection | 85 / 108 | 78.7 % | — | reported |
| unknown_preserved | 10 / 14 | 71.4 % | — | reported |
| next_question_targeting | 39 / 39 | 100.0 % | — | reported |
| replan_signal | 77 / 82 | 93.9 % | — | reported |
| replan_correctness | 245 / 263 | 93.2 % | — | reported |
| heuristic_mutation | 19 / 21 | 90.5 % | — | reported |

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

### provenance_preservation (8)
- [fail] a-05 · turn 0: requirement "Ten or more years evaluating agentic AI systems" (origin jd) has a statement that is not verbatim from the JD: "The ten years is real, my VP wrote it. Boston is non-negotiable, we have the lab"
- [fail] c-01 · turn 1: requirement "Experience selling to CFOs" (origin jd) has a statement that is not verbatim from the JD: "When I say experience selling to CFOs I mean they've closed deals where the CFO "
- [fail] d-01 · turn 1: requirement "Self-starter" (origin jd) has a statement that is not verbatim from the JD: "Self-starter — I mean they don't need me standing over them when a job is new. T"
- [fail] e-03 · turn 1: requirement "Based in Austin; relocation expected" (origin jd) has a statement that is not verbatim from the JD: "OK, if I have to rank: scaling past a billion is the one I care about; Big 4 was"
- [fail] g-04 · turn 1: requirement "Thin-film or wet-etch background (transferable with ramp)" (origin manager_statement) has a statement that is not verbatim from any hiring-manager statement: "Thin-film — CVD, ALD — people understand plasma and chamber matching, so they ca"
- [fail] i-01 · turn 1: requirement "Manage a brigade of 22" (origin jd) has a statement that is not verbatim from the JD: "A brigade of twenty-two here is really two brigades, restaurant and banquet, and"
- [fail] i-04 · turn 1: requirement "Michelin-starred background" (origin jd) has a statement that is not verbatim from the JD: "Hotel people are fine as long as the dinner room on their record is genuinely go"
- [fail] i-05 · turn 1: requirement "Michelin-starred background" (origin jd) has a statement that is not verbatim from the JD: "The rule is really: has run a kitchen where the food was the reason people came,"

### silent_mutation (2)
- [warn] a-03 · turn 1: untouched key "taste" has no earlier expectation to resolve it
- [warn] e-02 · turn 1: untouched key "integrity" has no earlier expectation to resolve it

### protected_traits (1)
- [fail] a-05 · turn -1: age referenced in a requirement's defining text: "tic AI evaluation is a field only a few years old, so no candidate anywhere has ten years"

### must_not_exist (5)
- [fail] e-01 · turn 1: "Public-company CFO title (board's requirement; a proxy)" exists as a preferred requirement but must not (Title is no longer a requirement of any kind — only the construct remains.)
- [fail] g-01 · turn 0: "Detail-oriented (filler, withdrawn)" exists as a preferred requirement but must not (detail)
- [fail] i-05 · turn 0: "Television appearances (not a qualification)" exists as a preferred requirement but must not (TV must not become a requirement; at most a false signal on the cooking construct.)
- [fail] j-05 · turn 0: "BSEE (withdrawn)" exists as a preferred requirement but must not (bsee)
- [fail] x-01 · turn 0: "Native speaker (withdrawn)" exists as a preferred requirement but must not (native)

### requirement_recall (22)
- [fail] b-01 · turn 0: "NMC registration": kind must_have (expected preferred)
- [fail] c-03 · turn 1: "Owns new-logo enterprise deals": origin jd (expected manager_statement)
- [fail] c-05 · turn 0: "Can hold a revenue-cycle conversation with a hospital CFO": status explicit (expected needs_clarification)
- [fail] c-05 · turn 1: "Can hold a revenue-cycle conversation with a hospital CFO": kind must_have (expected trainable)
- [fail] d-03 · turn 1: "Second shift": kind must_have (expected preferred)
- [fail] e-01 · turn -1: "Strong integrity; will tell the CEO no": status explicit (expected needs_clarification)
- [fail] e-03 · turn 1: "Based in Austin; relocation expected": kind preferred (expected must_have)
- [fail] e-04 · turn -1: "Strong integrity; will tell the CEO no": status explicit (expected needs_clarification)
- [fail] f-04 · turn 0: "Familiarity with test-stand operations": origin jd (expected manager_statement)
- [fail] g-05 · turn 0: "Nanosheet development exposure (pilot line acceptable)": kind preferred (expected must_have)
- [fail] h-05 · turn 0: "Start July 1": origin jd (expected manager_statement)
- [fail] h-05 · turn 0: "Start on July first": status explicit (expected needs_clarification)
- [fail] i-01 · turn 1: "Oversee banquets and in-room dining": origin jd (expected manager_statement)
- [fail] i-02 · turn 0: "Oversee banquets and in-room dining": origin jd (expected manager_statement)
- [fail] i-04 · turn 1: "Lead a creative, seasonal fine-dining program": status needs_clarification (expected explicit)
- [fail] i-05 · turn 1: "Michelin-starred background": origin jd (expected manager_statement)
- [fail] j-01 · turn 0: "Virginia journeyman electrician license": kind must_have (expected preferred)
- [fail] j-03 · turn 1: "Has worked nights before": kind preferred (expected must_have)
- [fail] x-01 · turn 0: "Simultaneous and consecutive modes": origin jd (expected manager_statement)
- [fail] x-02 · turn -1: "Comfortable working at 90 meters": status explicit (expected needs_clarification)
- [fail] x-02 · turn 0: "GWO Basic Safety Training": kind must_have (expected preferred)
- [fail] x-03 · turn 0: "EDC systems (Medidata Rave)": origin jd (expected manager_statement)

### construct_named (5)
- [fail] b-01 · turn 0: "NMC registration" definition does not name the construct (busy / general ICU / rotation / substantive)
- [fail] c-01 · turn 0: "Owns new-logo enterprise deals" definition does not name the construct (new logo / opened themselves / seventy percent / 70)
- [fail] c-03 · turn 1: "Owns new-logo enterprise deals" definition does not name the construct (land / expand / enterprise)
- [fail] e-03 · turn 1: "Big 4 background" definition does not name the construct (rigor)
- [fail] i-01 · turn 0: "Writes and changes their own menus" definition does not name the construct (retention / brigade stays / turnover)

### proxy_identified (6)
- [fail] b-04 · turn 0: "Nursing degree from a Russell Group university": proxy (Russell Group) is neither a false signal nor contextualized by the construct
- [fail] d-02 · turn 0: "NIMS certification": proxy (NIMS) is neither a false signal nor contextualized by the construct
- [fail] g-02 · turn -1: "Experience at TSMC, Intel, or Samsung": proxy (TSMC / Intel / Samsung) is neither a false signal nor contextualized by the construct
- [fail] h-04 · turn -1: "Graduate of a top-ranked educational leadership program": proxy (Harvard / Stanford / Columbia) is neither a false signal nor contextualized by the construct
- [fail] h-04 · turn 0: "Doctorate (a board member's preference, not a bar)": proxy (Harvard / Stanford / Columbia) is neither a false signal nor contextualized by the construct
- [fail] x-03 · turn 0: "CCRC certification (a result of the job, not a prerequisite)": proxy (CCRC) is neither a false signal nor contextualized by the construct

### evidence_signal_recall (1)
- [fail] i-01 · turn 0: "Writes and changes their own menus" evidenceSpec lacks retention / turnover / stayed

### false_signal_recall (12)
- [fail] b-01 · turn 0: "NMC registration" falseSignals lack rotation
- [fail] c-01 · turn 1: "Experience selling to CFOs" falseSignals lack on a call / attended
- [fail] c-05 · turn 1: "Can hold a revenue-cycle conversation with a hospital CFO" falseSignals lack sold to hospitals
- [fail] d-01 · turn 0: "Years of experience (explicitly not a criterion)" falseSignals lack years / tenure
- [fail] d-01 · turn 1: "Self-starter" falseSignals lack operator / wait to be told
- [fail] e-04 · turn 1: "Has led finance through a downturn or a failed raise" falseSignals lack only ever went up / every company / up and to the right
- [fail] f-02 · turn 0: "U.S. person as defined by ITAR" falseSignals lack accent / foreign degree / national origin
- [fail] f-03 · turn 0: "Named-employer preference (a proxy the manager's own example refutes)" falseSignals lack one valve / big-company / brand
- [fail] g-02 · turn 0: "PhD (corporate posting standard, not a bar)" falseSignals lack big-three / brand / leading-edge
- [fail] h-01 · turn 0: "Assistant-principal service (a guide, not a bar)" falseSignals lack years / tenure
- [fail] h-04 · turn 0: "Doctorate (a board member's preference, not a bar)" falseSignals lack Columbia / Ivy / brand / program
- [fail] j-01 · turn 0: "Virginia journeyman electrician license" falseSignals lack years

### contradiction_detection (6)
- [fail] c-02 · turn 1: expected contradiction "con-logo" not recorded
- [fail] c-03 · turn 1: expected contradiction "con-acv" not recorded
- [fail] e-01 · turn 0: expected contradiction "con-title" not recorded
- [fail] f-03 · turn 0: expected contradiction "con-pedigree" not recorded
- [fail] g-02 · turn 0: expected contradiction "con-pedigree" not recorded
- [fail] h-04 · turn 0: expected contradiction "con-degree" not recorded

### uncertainty_detection (23)
- [fail] a-03 · turn 2: "What the hiring manager concretely means by 'research taste', and who represents that bar today": status open (expected resolved)
- [fail] c-03 · turn 0: "Average deal size and sales-cycle length behind the $1.5M quota": status resolved (expected open)
- [fail] c-04 · turn 0: "How the $260k OTE splits between base and variable, and how it compares with the New York enterprise market": status resolved (expected open)
- [fail] c-04 · turn 1: "How the $260k OTE splits between base and variable, and how it compares with the New York enterprise market": status resolved (expected open)
- [fail] d-01 · turn 0: "What 'self-starter' means concretely on this floor": consequential=true (expected false)
- [fail] d-01 · turn 1: "What 'self-starter' means concretely on this floor": consequential=true (expected false)
- [fail] d-04 · turn 0: "How the stated rate compares with the regional market for five-axis setup work": status resolved (expected open)
- [fail] d-04 · turn 0: "How the stated rate compares with the regional market for five-axis setup work": status resolved (expected open)
- [fail] e-01 · turn 0: "Whether 'public-company CFO experience' means the title or the IPO work the title usually accompanies": status resolved (expected open)
- [fail] e-02 · turn 1: "What 'strategic partner to the CEO' means concretely": status resolved (expected open)
- [fail] e-02 · turn 2: "Who holds the decision — CEO, board, or audit committee": status open (expected resolved)
- [fail] e-03 · turn 0: "Whether relocation to Austin is financially supported": consequential=false (expected true)
- [fail] e-03 · turn 1: "Whether relocation to Austin is financially supported": status open (expected resolved); consequential=false (expected true)
- [fail] e-05 · turn 0: "Whether relocation to Austin is financially supported": consequential=false (expected true)
- [fail] e-05 · turn 1: "Whether relocation to Austin is financially supported": consequential=false (expected true)
- [fail] f-01 · turn 0: expected uncertainty "unc-adjacent" (adjacent) not recorded
- [fail] f-04 · turn 1: "Compensation, which the posting does not state": status resolved (expected open)
- [fail] g-03 · turn 0: "Whether the qualifying population exists in the Phoenix area or would need to relocate": status resolved (expected open)
- [fail] h-02 · turn 2: "Who selects the principal and who approves the appointment": status open (expected resolved)
- [fail] j-02 · turn 1: "Whether adjacent critical-facilities backgrounds count toward the data-centre requirement": status open (expected resolved)
- [fail] j-04 · turn 0: "The rate, and how it compares with the Northern Virginia data-centre corridor": status resolved (expected open)
- [fail] j-04 · turn 1: "The rate, and how it compares with the Northern Virginia data-centre corridor": status resolved (expected open)
- [fail] x-02 · turn 0: "Whether adjacent electrical trades count toward the two-year wind requirement": status resolved (expected open)

### unknown_preserved (4)
- [fail] c-04 · turn 1: "unc-comp" should remain unknown but it was resolved
- [fail] e-05 · turn 0: "unc-reloc" should remain unknown but requirement "Based in Austin; relocation expected" asserts it
- [fail] g-03 · turn 0: "unc-sponsor" should remain unknown but requirement "Own a process module through ramp" asserts it
- [fail] i-03 · turn 0: "unc-housing" should remain unknown but requirement "Housing not provided" asserts it

### replan_signal (5)
- [fail] a-03 · turn 2: no re-plan was expected but the turn changed requirements / resolved a consequential uncertainty (spurious churn)
- [fail] f-03 · turn 1: no re-plan was expected but the turn changed requirements / resolved a consequential uncertainty (spurious churn)
- [fail] f-05 · turn 1: no re-plan was expected but the turn changed requirements / resolved a consequential uncertainty (spurious churn)
- [fail] g-02 · turn 1: no re-plan was expected but the turn changed requirements / resolved a consequential uncertainty (spurious churn)
- [fail] h-04 · turn 1: no re-plan was expected but the turn changed requirements / resolved a consequential uncertainty (spurious churn)

### replan_correctness (18)
- [fail] a-02 · turn replan: strings: "PhD" is present but must not be
- [fail] a-04 · turn replan: persona: none of nonprofit / compensation / band present after re-plan
- [fail] d-02 · turn replan: strings: "operator" is present but must not be
- [fail] d-02 · turn replan: adjacent: none of Swiss present after re-plan
- [fail] d-04 · turn replan: geography: "relocation" is present but must not be
- [fail] d-04 · turn replan: persona: "relocation" is present but must not be
- [fail] d-05 · turn replan: adjacent: none of mold maker / tool and die / tool-and-die / Swiss present after re-plan
- [fail] e-01 · turn replan: adjacent: none of VP Finance / VP of Finance / number two / Chief Accounting Officer present after re-plan
- [fail] e-03 · turn replan: geography: none of Austin present after re-plan
- [fail] f-01 · turn replan: evidence: none of hot fire / red-line / redline / procedure present after re-plan
- [fail] f-01 · turn replan: adjacent: none of gas turbine / gas-turbine / test cell / dyno / automotive present after re-plan
- [fail] g-02 · turn replan: adjacent: none of 200mm / analog / trailing / mature node present after re-plan
- [fail] h-05 · turn replan: persona: none of stipend / July present after re-plan
- [fail] i-01 · turn replan: strings: none of ServSafe present after re-plan
- [fail] i-03 · turn replan: persona: "95" is present but must not be
- [fail] j-01 · turn replan: adjacent: none of hospital / facilities present after re-plan
- [fail] j-02 · turn replan: adjacent: none of navy / nuclear / hospital / substation / utility present after re-plan
- [fail] j-04 · turn replan: persona: "42" is present but must not be

### heuristic_mutation (2)
- [warn] e-02 · turn 2: kind of "Strategic partner to the CEO" changed must_have→preferred with no token overlap with the statement
- [warn] i-04 · turn 1: kind of "Michelin-starred background" changed must_have→preferred with no token overlap with the statement
