# TalentOS — Backlog

Ideas and known gaps land here instead of creeping into the current work
(anti-drift rule). Source is noted per item.

## Search String Lab — findings from the CAIS golden-test judge review (2026-09-01)

The qualitative judge review of the first live CAIS golden run (Claude
session provider) graded the overall output B and named the search strings
as the weakest deliverable. Concrete follow-ups for the composer and the
string-expansion task:

- **Google's ~32-word query limit**: long templated booleans exceed it and
  silently truncate. The composer should count words per engine and split or
  trim, with a per-platform budget.
- **Cross-surface dedupe**: near-duplicate variants repeat verbatim across
  platforms; dedupe by normalized query text before persisting.
- **Profession-aware platform pruning**: portfolio x-rays (Behance/Dribbble)
  are zero-yield for ML researchers; the platform matrix should be filtered
  by the role's channel ecosystem, not emitted wholesale.
- **Strategy coverage check**: emit at least one query per channel the
  sourcing strategy names, and flag channels with no query.
- **String-level QA**: a validation pass (parenthesis balance, quote
  balance, word count, operator sanity) with visible warnings in the lab.

## Other

- **Session provider in the UI**: surface pending outbox requests as a
  visible queue state ("waiting for a Claude session") instead of an error
  toast, with a copyable fulfillment instruction. (Provider exists — D-008;
  UI affordance is the gap.)
- **TalentOS-Lite artifact**: a claude.ai artifact companion using the
  `sample` runtime capability (Claude calls billed to the owner's
  subscription, no API key) with `db` persistence — candidate for a
  lightweight on-the-go surface; the local app stays the system of record.
