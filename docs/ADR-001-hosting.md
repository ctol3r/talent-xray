# ADR-001 — Hosting

Status: **Accepted** · Date: 2026-08-24

## Context

Talent X-Ray is a monetised product: it will run Stripe checkout from day one. Vercel's
Hobby plan is documented as restricted to non-commercial, personal use only ("As stated
in the fair use guidelines, the Hobby plan restricts users to non-commercial, personal
use only"), and Vercel pauses accounts for policy breaches. **Vercel Hobby is therefore
disqualified for any deployment that takes money.** The candidates evaluated:

|                     | Cloudflare Workers (OpenNext) + Supabase                                                                                         | Vercel Pro + Supabase                                                                                                                                                                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cost                | $0 — 100k req/day free, commercial use permitted                                                                                 | $20/mo                                                                                                                                                                                                                                                       |
| Commercial use      | Permitted on free tier                                                                                                           | Permitted                                                                                                                                                                                                                                                    |
| Next.js support     | Via `@opennextjs/cloudflare` adapter — **verified working against this repo's Next 16.3.2 during W0** (`pnpm cf:build` succeeds) | First-class, zero config                                                                                                                                                                                                                                     |
| Deployability today | Blocked on a one-time `wrangler login` (no Cloudflare auth exists on the build machine)                                          | **Blocked — the account's existing Pro team ("VITALCV") is suspended for a failed payment** (verified 2026-08-24, API returned `resource_creation_blocked`: "Your account has been suspended. To reactivate your subscription, add a valid payment method.") |

Facts verified during W0 that shaped this decision: the Vercel Pro team exists but is
**suspended** — a "one-click" Vercel deploy is not actually available until its billing
is fixed, and reactivating restores a real $20/mo cost. The OpenNext adapter's Next 16
compatibility, the main DX risk of the Cloudflare path, was tested against this exact
repo and works.

## Decision

**Cloudflare Workers via OpenNext for production** (the spec's Option A), with the
spec's Option C interim allowance: a non-commercial staging page may sit on the personal
Vercel Hobby account until the Cloudflare account is connected. The money-taking domain
lives on Cloudflare, full stop. (Note: as of 2026-08-24 the suspension blocks Vercel
resource creation entirely — even Hobby staging deploys fail with
`resource_creation_blocked` — so the staging allowance is moot until billing is fixed,
and Cloudflare is the only live path.)

The tradeoff in three sentences: Cloudflare is the only path that is simultaneously $0,
permitted for commercial use, and not gated on repairing a suspended subscription — and
its one real risk, OpenNext adapter compatibility with Next 16, was verified against
this repo rather than assumed. Vercel Pro has better DX but is suspended today, and
choosing it would couple this product's uptime to VitalCV's billing health. If DX
friction with OpenNext ever costs more than a day, reactivate Pro and switch — the app
is plain Next.js and moves with a config change.

## Deploy config (implemented in this repo)

- `open-next.config.ts` — OpenNext Cloudflare adapter config
- `wrangler.jsonc` — Worker name `talent-xray`, `nodejs_compat`, assets binding
- `pnpm cf:build` — builds the Worker bundle (verified green)
- `pnpm cf:deploy` — builds and deploys; **requires a one-time `wrangler login`** by
  Chris (account creation and auth cannot be done by the build agent)

## Consequences

- Production deploys are `pnpm cf:deploy` (later: CI-driven with a
  `CLOUDFLARE_API_TOKEN` secret).
- The Vercel Hobby staging page must never gain Stripe, auth, or any commercial
  surface. Kill it once Cloudflare prod is live.
- Supabase (free tier, commercial use permitted) is unaffected by any of this.
- Revisit only if OpenNext breaks on a future Next.js major and the fix costs more
  than a day.
