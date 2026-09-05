# ADR-001 — `/talentos` is a temporary incubation location

Status: **Accepted** (2026-09-02)

## Context

TalentOS lives at `/talentos` inside the Talent X-Ray repository. The two
products are different things:

- **Talent X-Ray** (repo root) is a live, commercial, people-only search SaaS
  with its own doctrine (`CLAUDE.md`, `LEGAL.md`), stack (Supabase, Stripe,
  Cloudflare), and deployment.
- **TalentOS** is a local-first, single-user hiring-intelligence workstation
  covering the full recruiting lifecycle.

They currently share a repository because the build was commissioned here and
because Talent X-Ray's two live Google Programmable Search engines are
TalentOS's first candidate-discovery backend. That convenience must not
harden into coupling.

## Decision

1. `/talentos` is a **temporary incubation location**. TalentOS is logically
   independent of Talent X-Ray today: separate lockfile, toolchain, database,
   CI job, and no imports in either direction.
2. TalentOS **will be extracted into its own repository** once the canonical
   IR boundary (D-011: `HiringNeedIR` … `SearchPlanIR`) and the provider
   boundary (D-010: `ResearchProvider` / `CandidateDiscoveryProvider`) are
   stable — i.e. when the interfaces have survived at least one full golden
   search without schema churn.
3. After extraction, Talent X-Ray remains independently usable and integrates
   with TalentOS **only** through `CandidateDiscoveryProvider`
   (`TalentXRayCandidateDiscoveryProvider` — engine IDs + a BYO Google key).
   No shared database, no shared code beyond that interface contract.

## Consequences

- Nothing in `/talentos` may import from the repo root or vice versa; the
  Talent X-Ray engine IDs enter TalentOS only through the discovery-provider
  module and env overrides.
- New TalentOS capabilities must not lean on being co-located with Talent
  X-Ray (no shared env, no shared build steps).
- The extraction is a `git filter-repo`/subtree move plus a rename of the
  package — kept cheap by the isolation rules above. Until then, do **not**
  move the directory; churn before the IR boundary stabilizes would be waste.
