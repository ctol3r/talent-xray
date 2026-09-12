# TalentOS — Product Specification

> Owner / primary user: Christopher Toler. Single-user, local-first.
> Working name — see `src/lib/product.ts` for the rename point.

## Thesis

Traditional ATS software records what recruiters did. TalentOS helps the
recruiter decide **what to do next**, across the entire lifecycle:

```
Job / business need → Role intelligence → HM intake → Success profile
→ Talent market model → Sourcing strategy → Search execution → Discovery
→ Evidence alignment → Outreach → Screening → Interview system → Pipeline
→ Closing → Offer → Onboarding → Search learning
```

It must generalize across any industry, occupation, seniority, geography,
company size, and employment type — deriving strategy dynamically from the
role, the hiring manager, the market, and recruiter feedback, **never** from
static recruiting templates. The acceptance test for that claim is the golden
fixture suite (§Golden fixtures): if two radically different roles produce
similar intakes, strategies, or screens, the system has failed.

## Core principle

Every recommendation answers: **what** should I do, **why**, on **what
evidence**, **how** do I execute, and **what's next**. Output shows source,
reasoning summary, confidence, assumptions, missing information, and (where
useful) an alternative interpretation. No unexplained AI output.

The search has **one canonical interpretation** (ARCHITECTURE.md §4): the JD
and hiring-manager statements are distilled into typed hiring-intelligence
objects (`HiringNeedIR` → `HiringIntentIR` with explicit `RequirementIR`s →
`SuccessIR`/`EvidenceIR`/`TalentPopulationIR`/`SearchPlanIR`). Every agent
and module consumes those objects; vague phrases like "research taste"
become defined, evidence-specified requirements or open uncertainties — not
strings each feature reinterprets.

## Primary object

A **SearchProject** represents one hiring need (e.g. "Center for AI Safety —
Research Scientist/Engineer — San Francisco"). All modules live inside its
workspace and share its context.

## Search workspace modules

| #   | Module            | Route                | Phase 1 scope                                                                                                            |
| --- | ----------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 01  | Overview          | `/searches/id`       | Status, role hypothesis, next best actions, health                                                                       |
| 02  | Role Intelligence | `…/role`             | JD paste/type → extraction into hard req / preference / signal / assumption / open question; editable; hypothesis        |
| 03  | HM Intake         | `…/intake`           | Role-adaptive intake interview generation; answer capture; "recruiter playback" summary + "what did I get wrong?"        |
| 04  | Success Profile   | `…/profile`          | Structured profile compiled from intake + role intel, per-criterion provenance, editable                                 |
| 05  | Market Intel      | `…/market`           | Synthesis with mandatory certainty labels; "reliable exact data unavailable" honesty; Phase 2 adds live research         |
| 06  | Sourcing Strategy | `…/strategy`         | Search strategy brief: target/adjacent profiles, titles, companies, geos, ranked with rationale                          |
| 07  | Source Channels   | `…/sources`          | Profession-specific channel discovery, priority-ranked (high/medium/experimental) with reasons                           |
| 08  | Search Strings    | `…/strings`          | Deterministic boolean/x-ray composer + AI synonym/title expansion; narrow/balanced/broad/adjacent variants; all editable |
| 09  | Candidates        | `…/candidates`       | Candidate records (manual add + paste import), sources, profile URLs, notes                                              |
| 10  | Evidence          | `…/candidates/[cid]` | Per-criterion alignment: strong/partial/missing/contradictory/unknown + advisory review priority                         |
| 11  | Review queue      | `…/candidates`       | "Candidates to review first based on currently available job-related evidence"                                           |
| 12  | Outreach          | `…/outreach`         | Personalized sequences (email 1 → breakup, LinkedIn), evidence-cited personalization, cadence, tracking                  |
| 13  | Recruiter Screen  | `…/screen`           | Screen guide from success profile: question + why + strong/weak evidence + follow-ups                                    |
| 14  | Interview Plan    | `…/interviews`       | Stage architecture per profession; purpose/competencies/questions/rubric per stage; anti-duplication                     |
| 15  | Scorecards        | `…/interviews`       | Structured evidence capture; rating requires written evidence; observation ≠ interpretation ≠ rating                     |
| 16  | Pipeline          | `…/pipeline`         | Kanban + table, customizable stages, event log                                                                           |
| 17  | Next Best Action  | dashboard + overview | Deterministic rules over live state ("4 follow-ups due", "intake has 3 unresolved requirements")                         |
| 18  | Analytics         | `…/analytics`        | Funnel counts + conversion rates + time-in-stage from pipeline events                                                    |
| 19  | Diagnosis         | `…/analytics`        | Rule-based failure-mode analysis with suggested experiments                                                              |
| 20  | Close / Offer     | `…/close`            | Motivations, competing offers, concerns, ClosePlan, offer-call prep; no manipulation/deceptive tactics                   |
| 21  | Onboarding        | `…/close`            | Post-accept checklist, handoffs, comms schedule, start confirmation                                                      |
| 22  | Search Learnings  | `…/learnings`        | Outcome capture → generalized learnings, with small-sample warnings                                                      |

## Module contracts (what "good" means)

- **Role Intelligence** never silently converts vague JD language into hard
  requirements: everything lands in one of `hardRequirements`, `preferences`,
  `signals`, `assumptions`, `unresolvedQuestions`, and every inferred statement
  is editable. Ends with an explicit role hypothesis.
- **Intake** questions must be role-specific (an ML-research intake asks about
  publication quality and research taste; a physician intake asks about board
  status and call; an AE intake asks about quota and ACV). Sessions end with
  "Let me summarize the search as I now understand it" playback and "What did
  I get wrong?". **Live intake is adaptive**: the IntakeReasoner captures each
  hiring-manager statement verbatim, updates the requirement set, and asks the
  question that reduces the most consequential open uncertainty next — the
  full question bank is a resource, not a script.
- **Success Profile** keeps per-criterion provenance
  (`jd | hiring_manager | recruiter | market_research | model_inference`).
- **Market Intelligence** never fabricates precise labor-market numbers; the
  schema forces `certainty` on every claim and permits "reliable exact
  population data unavailable".
- **Channels/Job boards**: no invented boards. Phase 1 marks every
  model-suggested venue `certainty: inferred` with a "verify before use"
  affordance; Phase 2's research provider upgrades entries to
  `source_verified` with URL + retrievedAt.
- **Evidence alignment** is recruiter decision support: per-criterion evidence
  states, advisory review priority, always overridable, never framed as an
  employment decision.
- **Outreach** never invents candidate facts; each personalization cites the
  evidence item it used. Nothing sends automatically. **Research first
  (D-013):** every sequence is written against a research-backed
  `AudiencePersonaIR` for the candidate's talent segment — who they are, what
  they value, their concerns, where they read, tone, proof points — and the
  persona itself exists only once the audience has been researched on the
  web (findings cited by URL). Research is audience-level; the system never
  researches an individual.
- **Scorecards** refuse "culture fit = 2": a rating cannot be saved without
  behavioral/outcome evidence text.
- **Learnings** warn on generalizations from tiny samples.

## Navigation & UX

Linear + Notion + research workstation; not enterprise HR software. Dense,
fast, keyboard-first. Main nav: Dashboard · Searches · Candidates · Tasks ·
Settings. `⌘K` command bar: create search, add candidate, generate intake,
generate strategy/strings, draft outreach, "what should I do next?".
Every AI artifact shows provenance badges and an edit affordance. Loading,
empty, and error states are designed, not defaulted.

## Dashboard

Active searches · Today (follow-ups due, candidates to review, intake gaps,
stalled stages) · search health · next best actions.

## Safety / fair hiring (mandatory)

- No inference, storage, ranking, or filtering on protected traits (race,
  ethnicity, religion, age, gender identity, disability, national origin,
  sexual orientation, health, pregnancy, family status, political affiliation,
  veteran status).
- Advisory-only candidate review, transparent evidence, recruiter override on
  everything, auditability (criterion → evidence → source → human decision).
- Enforced in schema, prompts, output scanning, and CI grep tests — see
  ARCHITECTURE.md §8.

## Privacy

Local SQLite; deletion and export per candidate; provenance on all stored
sources; no scraping; drafts only for email. Candidate data never leaves the
machine except inside model API calls the user explicitly configured.

## Golden fixtures

Seeded SearchProjects proving generalization:

- **A** — Center for AI Safety, Research Scientist/Engineer, San Francisco
- **B** — Primary Care Physician, Sacramento
- **C** — Senior Enterprise AE, New York (B2B SaaS)
- **D** — CNC Machinist, Ohio
- **E** — CFO, global technology company
- **F** — ICU Registered Nurse, London

For each: intake questions, sourcing strategy, channels, evidence categories,
prescreen, interview process, and search queries must substantially differ.
Fixture A (CAIS) is the deep benchmark: intake must reach RS-vs-RE
distinction, publication quality, research taste, empirical-vs-theoretical
orientation, frontier-lab experience, mission alignment, competitive labs.

## Critical end-to-end test (Phase 1 acceptance)

1 create SearchProject → 2 paste CAIS JD → 3 role intelligence extraction →
4 edit requirements → 5 generate tailored intake → 6 capture answers →
7 generate success profile → 8 sourcing strategy → 9 channels →
10 boolean/x-ray queries → 11 add candidate → 12 evidence alignment →
13 outreach draft → 14 move through pipeline → 15 recruiter screen →
16 structured interview evidence → 17 close plan → 18 accepted →
19 onboarding plan → 20 funnel analytics + learnings.

Runs in Playwright against the mock provider; also runnable by hand against
the real provider.

## Phasing

**Phase 1 (this build):** everything above, local, manual candidate entry,
draft-only outreach.
**Phase 2:** automated **general** web research (ResearchProvider impls:
Exa/Tavily/Serper/full-web CSE), further CandidateDiscoveryProvider
implementations beyond the Talent X-Ray engines, Gmail (explicit-send only),
calendar, resume parsing improvements, semantic search (pgvector or vector
abstraction), browser importer. Research and candidate discovery stay
separate provider boundaries (D-010): a people-only engine never answers
market-research questions.

## Ultimate product test

For an unfamiliar role, Christopher can open the app knowing nothing about the
profession and progressively learn: what am I hiring, why it matters, what
excellence looks like, what to ask the HM, what evidence identifies these
people, where they exist, how to find/contact/evaluate them, where the search
is failing, how to close, and what the search taught him.
