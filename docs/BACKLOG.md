# BACKLOG.md

Ideas and known gaps land here instead of creeping into the current wave.

## Known corpus gaps (honest, by construction)

- No .edu faculty directories — public-suffix wildcards are refused by the PSE control
  panel, and enumerating universities would consume the entire domain budget.
- No professional association member rosters — thousands of small domains, no room in a
  50-domain engine.
- No ATS-hosted talent-community pages.
- Gated sites (Doximity, ZoomInfo, PitchBook) return teaser pages, not records.
- Regional networks outside the US/EU are absent.
- Obvious next step once revenue exists: a third engine, "Associations & Faculty"
  (the next 50 domains).

## Deferred / not-now

- Playwright e2e harness — added with the first wave that has a UI acceptance test (W2),
  not before.
- CI deploy to Cloudflare (`CLOUDFLARE_API_TOKEN` secret + workflow step). Unblocked —
  `wrangler login` and the first `pnpm cf:deploy` both succeeded 2026-08-24. Do it once
  GitHub Actions itself runs again (see below).
- **GitHub Actions is blocked account-wide on private repos**: the account's payment
  method is rejected ("Invalid payment method - authorization hold failed", Visa ending
  1988). Workflows on this repo end in `startup_failure` in 0s; public repos still run
  because their Actions minutes are free. Not a code defect — the committed pipeline was
  verified green on a fresh clone. Only Chris can fix it (card entry).
- Pull the protected-characteristics grep test forward from W5 into W1, landing with
  the first schema migration — LEGAL.md guardrail 4 is doctrine-only until it exists.
