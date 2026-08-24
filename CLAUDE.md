# CLAUDE.md — Talent X-Ray

## What this is
A people-only search product. It queries two Google Programmable Search Engines restricted to
surfaces where humans describe themselves — profiles, social bios, portfolios, CVs, credential
registries, contact records, rosters — and turns intuitive filters into precise boolean queries.

Company marketing pages and job postings are absent by construction. That is the product.

## Live assets (already exist, do not recreate)
- Engine 1 "Talent X-Ray · Core"  — cx `a157d37906e1141cc` — 50 domains, universal spine
- Engine 2 "Verified & Reach"     — cx `918bc00e18d0c46e5` — 50 domains, registries + contact + rosters
- Reference implementation: `reference/talent-xray.html` — a working single-file console with a
  tested query composer, five result filter tabs, keyword highlighting and a contact finder.
  **Port its logic verbatim. Do not redesign the query composer.** It is the only part of this
  system that has been validated against live results.

## Hard product rules
1. Never fetch, crawl or scrape a result page. Link out only.
2. Never bulk-persist search results. Store the query, and only URLs a user explicitly saves.
3. Generated email addresses are labelled "unverified" on every surface that renders them.
4. No field anywhere for protected characteristics. See LEGAL.md.
5. Every result link opens in a new tab with rel="noopener".
6. The composed query is always visible and editable by the user. Never hide what you searched.

## Stack
Next.js (App Router, TypeScript strict) · Supabase Postgres + Auth · Stripe · Tailwind.
Host per the decision recorded in `docs/ADR-001-hosting.md`.

## Engineering rules
- TypeScript strict. No `any` in committed code.
- Every route handler validates input with zod at the boundary.
- Server-side only: Stripe secret, Supabase service role, any platform Google key.
  A customer's BYOK key is encrypted at rest and never returned to the client after save.
- Row Level Security on every table. Default deny. Write the policy in the same migration as
  the table.
- No migration runs without an explicit instruction in the wave prompt.
- Tests are Playwright + Vitest. A wave is not done until its acceptance tests pass on CI.

## Anti-drift
- Do not add features not named in the current wave. If you think of one, append it to
  `docs/BACKLOG.md` and carry on.
- Do not claim a wave is complete because the code compiles. Complete means the acceptance
  tests in the wave prompt pass, and you state which ones you actually ran.
- If a wave's acceptance test cannot pass for a reason outside the code — a missing key, a
  third-party outage, an unverified legal question — stop and say so. Do not stub past it.
- Percent-complete is banned. A wave is OPEN or CLOSED.
