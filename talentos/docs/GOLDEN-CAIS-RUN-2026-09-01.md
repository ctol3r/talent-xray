# CAIS golden test — first live run record

Date: 2026-09-01 · Provider: **Claude session** (generations fulfilled by a
Claude Code session via the D-008 file handoff — no API key) · Runner:
`pnpm golden:session` · Full generated output: `data/golden-cais-report.md`
(local, gitignored — candidate-shaped data stays out of git).

## Verdict: PASS

- **Intake concept scorecard: 15/16** (threshold 12). The single miss,
  "Capacity- vs capability-driven hiring", is a probe false negative: the
  intake explicitly frames the fork ("whether this hire exists to land a
  specific benchmark release or to add general research capacity is the
  single biggest fork in the search") with the keywords further apart than
  the regex's 80-char window. Left as-is — loosening a probe after seeing
  output would be grade inflation.
- **Guardrails: 5/5** — playback present; no market claim labeled
  "verified"; x-ray `site:` queries composed; evidence alignment surfaces
  gaps (missing/unknown), not just matches; zero protected-trait references
  across every generated payload.
- **Qualitative judge (independent model review): grade B.** Intake,
  sourcing strategy, screen guide, and interview plan judged top-decile
  ("a top recruiter would run this search off these documents"); search
  strings judged the weakest deliverable (query-length limits, cross-surface
  duplicates, off-profession portfolio x-rays, strategy-coverage gaps) —
  filed as Search String Lab follow-ups in `docs/BACKLOG.md`.

## What the first attempt caught (the point of the benchmark)

Run 1 FAILED the certainty guardrail: market-intelligence output labeled
context-derived claims "verified". Root cause was a prompt/contract
inconsistency; fixed at the schema layer (model-output certainty is now
`estimated|inferred|unknown` — "verified" is unrepresentable in generation;
commit e4f1516), market intelligence regenerated, re-scored to PASS.

## Fidelity note

The session provider exercises the exact same prompts, schemas, validation,
fair-hiring scan, audit logging, and persistence as the Anthropic API
provider; only the transport differs. The fulfilling model for this run was
the Claude Code session's model, recorded as `claude-session` in generation
meta. The API-key edition (`pnpm golden:cais`) remains available and unrun.
