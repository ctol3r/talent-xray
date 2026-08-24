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

- Cloudflare Workers (OpenNext) deploy path — documented exit in ADR-001; build only if
  Vercel Pro hosting must be separated or lapses.
- Playwright e2e harness — added with the first wave that has a UI acceptance test (W2),
  not before.
