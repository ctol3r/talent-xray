# ADR-001 — Hosting

Status: **Accepted** · Date: 2026-08-24

## Context

Talent X-Ray is a monetised product: it will run Stripe checkout from day one. Vercel's
Hobby plan is documented as restricted to non-commercial, personal use only ("As stated in
the fair use guidelines, the Hobby plan restricts users to non-commercial, personal use
only"), and Vercel pauses accounts for policy breaches. **Vercel Hobby is therefore
disqualified for any deployment that takes money.** The candidates are:

|                     | Cloudflare Workers (OpenNext) + Supabase                                         | Vercel Pro + Supabase                                                                                                    |
| ------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Cost                | $0 (100k req/day free, commercial use permitted)                                 | $20/mo list price                                                                                                        |
| Commercial use      | Permitted on free tier                                                           | Permitted                                                                                                                |
| Next.js support     | Via OpenNext adapter — second-class, adapter lag on new Next majors              | First-class, zero config                                                                                                 |
| Deployability today | **Blocked** — no Cloudflare account or wrangler auth exists on the build machine | **Live** — an existing, already-paid Pro team ("VITALCV", `team_V9t533j9uGEbBpXN51y7ZRz8`) with the Vercel MCP connected |

The original build spec recommended Cloudflare as the only genuinely-$0 in-terms path,
with an explicit fallback: "if the DX friction costs you more than a day, switch to B."
During W0 we verified the account state and found the Pro team already exists and is
already paid for. That fact removes the entire cost argument for Cloudflare: the marginal
hosting cost of Vercel Pro is $0.

## Decision

**Vercel Pro**, deployed into the existing Pro team as its own project (`talent-xray`),
git-connected so every push to `main` deploys production.

The tradeoff in three sentences: Vercel gives first-class Next.js support and a deploy
path that works today, at zero marginal cost because the Pro team is already paid for.
Cloudflare would save nothing right now and would cost adapter friction (OpenNext lag on
new Next.js majors) plus a new account, new auth, and a new deploy pipeline before the
first page could be served. If hosting billing must later be separated from VitalCV's
team, a plain Next.js app is the most portable shape there is — migrating to a dedicated
Vercel team or to Cloudflare/OpenNext is a config change, not a rewrite.

## Consequences

- Deploy config is the git connection itself: project `talent-xray` in team
  `blockchaincv`, production branch `main`. No `vercel.json` is needed; the framework is
  auto-detected.
- The project rides on the VITALCV team's subscription. This is a hosting-billing
  convenience only — it does not touch the absorb-later contract (no shared auth, no
  shared DB, no code imports). Revisit if Talent X-Ray needs its own hosting invoice.
- Guard against ever downgrading this project onto a Hobby account while Stripe is live.
- Exit path if Vercel Pro lapses: Cloudflare Workers via `@opennextjs/cloudflare`
  (~1 day of work: adapter install, `wrangler.jsonc`, DNS).
