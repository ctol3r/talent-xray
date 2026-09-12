# TalentOS × HSAL — Search Strategy / Pipeline Diagnosis

TalentOS performs the recruiting work. HSAL (Human State Access Layer) preserves how the human
and the machine learned what worked: the recruiter's belief, the evidence, the competing
explanations, the experiment, its result, the explicit revision, and the learning.

```
OBSERVE → BELIEVE → CHALLENGE → COMPARE EXPLANATIONS → DESIGN TEST → ACT → OBSERVE AGAIN → REVISE → LEARN
```

## Topology

| Piece                               | Where                                                                                              |
| ----------------------------------- | -------------------------------------------------------------------------------------------------- |
| HSAL runtime (gateway, SQLite, SDK) | sibling repository `../../hsal` (`HSAL_REPO`)                                                      |
| Adapter package                     | `packages/hsal-adapter` (`@talentos/hsal-adapter`) — talks to HSAL only through `@hsal/sdk`        |
| App glue                            | `src/lib/hsal/*`, `src/lib/actions/hsal.ts`, `src/app/searches/[id]/diagnosis/page.tsx`            |
| TalentOS tables                     | `hsal_bindings`, `pipeline_snapshots`, `hsal_search_learnings` (migration `0008_hsal_integration`) |
| Fixtures                            | `fixtures/sp104/*.json` + `fixtures/sp104/index.ts`                                                |
| Demo                                | `pnpm demo:sp104`                                                                                  |
| Tests                               | `tests/unit/hsal-adapter/*`, `tests/integration/hsal-sp104.test.ts`                                |

Dependency direction: TalentOS → `@hsal/sdk` → HSAL Gateway → HSAL state. HSAL imports nothing
from TalentOS; recruiting vocabulary reaches HSAL only as opaque tags (`kind`, `actionType`,
`sourceKind`, `sourceRef`, `scopeRef`).

## Run SP104 locally

```bash
# 1. HSAL (sibling repo)
cd ../../hsal && pnpm install && pnpm db:migrate && pnpm dev        # gateway on 127.0.0.1:4271
pnpm hsal auth issue talentos                                       # copy the hsal_… token

# 2. TalentOS
cd - && pnpm install
export HSAL_TOKEN=hsal_…                                            # from step 1
pnpm db:migrate                                                     # applies 0008_hsal_integration (existing DBs need TALENTOS_ALLOW_MIGRATIONS=1 per house policy)
pnpm seed:sp104                                                     # SP104 project, candidates, HM, W6 snapshot (idempotent)
pnpm dev                                                            # open http://127.0.0.1:3000/searches/SP104/diagnosis
```

Console demo (no UI, no token needed — spawns an ephemeral gateway if none is configured):

```bash
pnpm demo:sp104
```

Tests:

```bash
pnpm test                      # includes tests/unit/hsal-adapter (metrics, mapping, rules, ranking, learnings, AI merge)
pnpm test:integration          # Tests A–J against a real HSAL gateway with a temp database
pnpm build && pnpm e2e:hsal    # browser e2e against a real gateway spawned from the sibling repo:
                               #  - the whole loop on a search created in the UI (no fixtures)
                               #  - the SP104 walkthrough through the same forms, pinning the fixture ids
```

## The loop in the UI

`/searches/SP104/diagnosis` shows six recruiter-facing sections. Internally they map to HSAL objects:

| Heading                           | HSAL object                                                          | Action                           |
| --------------------------------- | -------------------------------------------------------------------- | -------------------------------- |
| What's happening?                 | State (counts observed, rates inferred)                              | Run diagnosis                    |
| What do you think?                | Belief (human-owned confidence)                                      | Record what I think              |
| What else could explain it?       | ExplanatoryModel ×5 with qualitative support                         | —                                |
| What evidence supports each view? | Evidence (candidate observations, HM statements, experiment results) | —                                |
| What should we test next?         | Intervention with experiment design, deterministic score             | Select test · Record result      |
| Revise what you think?            | BeliefRevision (stale-write guarded)                                 | Revise my confidence             |
| Act, then observe again           | Evidence (profile change, user-asserted) · State · Trajectory        | Apply profile change · Ingest W9 |
| What did we learn?                | SearchLearning (TalentOS table, HSAL ids only)                       | Save learning                    |
| Provenance                        | HSALEvent log                                                        | —                                |

## Any search, not only SP104

Every step of the loop works for a real search project: record the baseline pipeline
(`PipelineCountsForm`, pre-filled from pipeline events when there are any), bind, capture the
recruiter's belief, ingest HM decisions as evidence, diagnose, select the test, record the result
(`ExperimentResultForm`: summary, one observation per line, advanced/total), apply the profile
change (`ProfileChangeForm`), record the post-intervention pipeline (`PostInterventionForm`),
revise the belief, save the learning (`LearningForm`). Pure helpers live in `src/lib/hsal/generic.ts`
with unit tests in `tests/unit/hsal-generic.test.ts`.

## Invariants enforced

- No code path in the adapter or the app writes belief confidence except `reviseBelief`, which
  requires a `human:` actor that holds the belief and the currently held confidence
  (`409` on stale writes). AI capability presets in HSAL cannot obtain `belief:revise`.
- Diagnosis models, experiment results and trajectories never touch beliefs (Tests C, G).
- HM feedback is stored as "HM said X" with `epistemicStatus: observed` — behaviour, not truth.
- Every step appends an event under the acting actor; human decisions carried by TalentOS record
  `via: agent:talentos`.
- Deterministic path needs no LLM. `DiagnosisReasoningProvider` is optional; its output is
  schema-validated and can only add or annotate models.

## Ordinary chat vs TalentOS + HSAL (brief §47)

Ordinary chat:

> You should consider broadening the search, improving messaging, reviewing compensation, and
> recalibrating with the HM.

TalentOS + HSAL, for SP104:

```
Observed bottleneck:      HM review (4 → 1)
Human belief:             Talent supply — 76%
Competing model:          Success Profile Constraint (support HIGH)
Discriminating experiment: Blind Adjacent Profile Review (gain HIGH, cost LOW, reversible)
Result:                   7/10 advanced across Rust, C++, Java, Go
Belief revision:          76% → 31% (explicit, by the recruiter)
Search strategy changed:  Go → transferable; title → Staff-equivalent scope
Pipeline improved:        HM→onsite 25% → 62.5%; 5 onsites, 2 offers, 1 hire
Learning persisted:       LEARN-SP104-001
```

The value is not a prettier recommendation. It is that belief → evidence → competing
explanation → experiment → result → learning is explicit, attributable and durable.

## Architectural compromises (see docs/TALENTOS_HSAL_EXECUTION_PLAN.md, T-series)

- The SDK is consumed via a `link:` to the sibling repository and externalized in Next
  (`serverExternalPackages`); HSAL ships built `dist/` for `@hsal/protocol` and `@hsal/sdk`.
- SP104's structured candidate observations come from fixtures; real projects derive
  observations from recorded HM decisions on candidates and their success profile from the
  traced `SuccessProfilePayload` (criterion ids `CRIT-<slug>`).
- Pipeline snapshots are a new TalentOS table. Baseline and post-intervention counts are pre-filled
  from the workstation's own pipeline events (`deriveCountsFromEvents`: population = candidates
  with any pipeline event in the window, progress = furthest non-terminal stage up to the window
  end). `positive_reply` has no workstation stage, so it is left blank for the recruiter, as is any
  funnel stage a custom stage list cannot express; blank counts are rejected, never recorded as 0.
  Edited numbers or dates are recorded with source `manual`. Re-recording a period with different
  counts writes a new revision (`…-r2`); nothing is overwritten, matching HSAL's immutable States.
  This differs deliberately from the Analytics funnel, which counts all-time exact stage entries.
- Success Profile changes are applied by the human, on the Diagnosis page (one criterion per
  line; labels that match existing criteria keep their ids, so moving "Go" to transferable is
  recorded as a move of `CRIT-GO`) or in the Profile module. HSAL only records that a human did it.
- Learnings are written by the recruiter in a form (title, statement, category, confidence,
  applicability pre-filled from the project's role/seniority/industry/geography) and get ids
  `LEARN-<project>-NNN`. SP104 keeps its seeded values as defaults, so `pnpm demo:sp104` and the
  guided walkthrough are unchanged.
