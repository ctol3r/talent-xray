# Roadmap — beyond sourcing: agent teams and two-sided guidance

Owner directive (2026-09-01): TalentOS should exceed HireEZ in capability,
guide the recruiter through the full process with BOTH the candidate and the
hiring manager (not a lead-generation tool), and be able to generate
multiple agents for each requested job.

## Honest capability read vs HireEZ

HireEZ's moat is **data**: a licensed aggregate people index, verified
contact data, ATS integrations, and hosted email sequencing. TalentOS will
not replicate that by scraping — the product rules forbid it (link out only,
never crawl, never bulk-persist) and so do the sources' terms. Where
TalentOS can genuinely beat HireEZ:

| Dimension                                                                     | HireEZ                         | TalentOS path                                                                                                            |
| ----------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Search intelligence (intake depth, success profiles, market models, strategy) | Thin — filters + AI summaries  | Already the core product; benchmarked (CAIS golden test)                                                                 |
| Lifecycle coverage                                                            | Stops near outreach/CRM        | Intake → sourcing → screen → interview design → scorecards → close → onboarding → search learning                        |
| Candidate discovery                                                           | Proprietary 800M-profile index | X-ray strings + the two live Talent X-Ray CSEs in this repo (people-only Google engines) — real discovery, link-out only |
| Contact data                                                                  | Verified contact database      | Not matched; name-pattern hypotheses labelled "unverified" only                                                          |
| Sequencing                                                                    | Hosted auto-send               | Deliberately not matched: drafts only, nothing sends without explicit action                                             |
| Cost / control                                                                | Per-seat SaaS                  | Local-first, runs on the owner's Claude subscription, fully editable + auditable                                         |

Claim to make: **more intelligent per search than HireEZ, not bigger than
HireEZ's database.** The discovery gap narrows via the CSE integration and
imports; it never closes via scraping.

## Two-sided guidance (candidate + hiring manager)

The lifecycle engine already models the recruiter's side. The additions:

- **Hiring-manager thread**: per-search HM brief (playback, calibration
  checkpoints, "what did I get wrong?"), a structured candidate-review
  queue with evidence-anchored feedback capture, SLA/next-step nudges when
  the HM stage stalls. Deliverable: an HM-facing page per search
  (shareable artifact) plus HM-thread items in Next Best Action.
- **Candidate thread**: per-candidate, per-stage communication guidance —
  process-transparency packet, stage prep guides, interview logistics
  comms, offer explainer, decline-with-respect templates; motivation and
  concern tracking feeding the close plan. All drafts; the recruiter sends.
- **Next Best Action v2**: coach both threads — every search surfaces the
  next move for the pipeline, the next move with the HM, and the next move
  with each active candidate, with reasoning.

## Multiple agents per job — architecture

Proven mechanism (this session): one job ran as a 14-agent team —
per-module specialist agents, a deterministic scorer, an adversarial judge.
Generalization, per surface:

1. **Local app + session provider (primary)**: a per-search **Crew**. The
   outbox becomes a job queue; "Kick off crew" enqueues the module set with
   dependencies (role intel → intake → profile → market ∥ strategy →
   channels → strings; candidate jobs per candidate). A Claude Code worker
   session fans each job out to a role-prompted subagent, plus a
   **critic/QA agent** per artifact (generator → critic → revision) and a
   **coordinator** that writes crew status + open questions back to the
   app. Same pipeline (zod, fair-hiring scan, audit) for every agent.
2. **Cloud sessions**: long-running searches can each own a scheduled
   Claude session (Routine) that works the queue and checks stalls —
   background autonomy with visible artifacts, still no outbound sends.
3. **Artifact (TalentOS Lite)**: no persistent processes, but a **virtual
   crew**: named specialists (Analyst, Strategist, String-smith, Writer,
   Screener, Critic) as role-scoped `sample` calls, run sequentially or
   fanned per candidate while the page is open; `sample` tools let the
   coordinator read/write page state. Runs on the viewer's usage; visible
   end to end.

### Non-negotiable guardrails (unchanged by agents)

Agents draft and analyze; they never decide. No auto-send, no auto-reject,
no autonomous employment decisions, no protected-trait inference, no
scraping. Every agent's output lands as an editable, provenance-labelled
draft with the same audit trail as today.

## Proposed waves

- **W7 — Crew orchestration**: outbox → job queue; crew kickoff UI; worker
  fan-out with critic pass; crew status + coordinator notes per search.
- **W8 — Discovery execution**: live people search backed by the two
  Talent X-Ray CSEs (BYO Google key); run composed strings in-app, save
  only user-picked URLs; candidate-from-result flow. _Corrected 2026-09-02
  (D-010): the engines are `TalentXRayCandidateDiscoveryProvider`, a
  separate boundary from the general `ResearchProvider`; saved snippets are
  unverified `candidate_source_evidence`, never resume text; provider rank
  is preserved, never mapped to a synthetic relevance score._
- **W9 — Two-sided guidance**: HM brief page + review queue + feedback
  capture; candidate packet generator; Next Best Action v2 (three
  threads).
- **W10 — Lite crew mode**: virtual crew + per-candidate fan-out in the
  artifact; crew transcript view.

Each wave lands with acceptance tests; the CAIS golden test grows a crew
edition (agents must beat the single-pass baseline on the same scorecard
before the crew ships as default).
