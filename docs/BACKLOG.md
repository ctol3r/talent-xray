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

  Stay on GitHub — migrating CI elsewhere was evaluated 2026-08-24 and every option is
  worse. GitHub Pro includes 3,000 private-repo Actions minutes/month, which this
  pipeline fits inside for free. Codeberg is disqualified (FLOSS-scoped terms, and its
  CI requires public repos). Bitbucket Free allows only 50 build minutes/month, roughly
  6–15 runs. GitLab Free gives 400 minutes but gates CI behind risk-based identity
  verification that can itself demand a payment method — the very thing that is broken
  (and GitLab's terms pages 403 automated fetches, so its commercial-use stance is
  unverified). Self-hosted Forgejo/Gitea is unlimited and unrestricted, but means
  running a runner and porting `ci.yml`, whose Actions dialect is deliberately
  "familiar, not compatible" with GitHub's.

  Note for whoever debugs this next: GitHub's docs imply a within-quota account should
  not be blocked at all ("usage is blocked once you use up your quota"), which
  contradicts what this account is actually doing. Do not argue from the free quota —
  what clears the flag is a card that successfully authorizes, and failing that,
  GitHub Billing Support clearing it manually.

  Update 2026-09-05: the repo was made **public**, and the block did not lift. The
  workflow is now parsed (runs appear under `CI` instead of `BuildFailed`), but both
  jobs end `failure` two to three seconds after creation with no runner assigned
  (`runner_id` 0, no log to download, empty check output), on this branch and on an
  unrelated one, and identically on a re-run. So "public repos still run" above is
  wrong for this account: a failed-payment lock stops Actions dispatching runners
  regardless of visibility. The fix is the same — a card that authorizes, or Billing
  Support — and until then `pnpm verify` locally is the CI.

- Pull the protected-characteristics grep test forward from W5 into W1, landing with
  the first schema migration — LEGAL.md guardrail 4 is doctrine-only until it exists.
