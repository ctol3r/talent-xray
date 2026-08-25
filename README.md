# Talent X-Ray

A people-only search product. It queries two Google Programmable Search Engines
restricted to surfaces where humans describe themselves — profiles, portfolios, CVs,
credential registries, rosters — and turns intuitive filters into precise boolean
queries. Company marketing pages and job postings are absent by construction.

Read [CLAUDE.md](CLAUDE.md) first: it is the build doctrine, and every rule in it is
load-bearing.

## Layout

| Path                   | Purpose                                                                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/`                 | Next.js App Router routes                                                                                                                           |
| `components/`          | UI components                                                                                                                                       |
| `lib/`                 | Domain logic — query composer, corpus, facets                                                                                                       |
| `lib/corpus/`          | The 100-domain corpus, facets, recipes                                                                                                              |
| `supabase/migrations/` | SQL migrations (RLS policies live with their tables)                                                                                                |
| `reference/`           | Home of `talent-xray.html`, the validated reference console (read-only; placed by Chris before W2 — see [reference/README.md](reference/README.md)) |
| `docs/`                | ADRs, [LEGAL.md](docs/LEGAL.md), [BACKLOG.md](docs/BACKLOG.md)                                                                                      |
| `tests/`               | Vitest unit tests (Playwright arrives with the first UI wave)                                                                                       |

## Develop

```bash
pnpm install
pnpm dev        # local dev server
pnpm typecheck  # next typegen && tsc --noEmit
pnpm lint       # eslint
pnpm test       # vitest
pnpm build      # production build
```

## Verify

`pnpm verify` runs every gate the CI workflow runs — format check, typecheck, lint,
unit tests, build — against your working tree. Run it before you commit.

`pnpm verify:clean` is the real CI equivalent: it clones the committed tree into a
temp directory, installs from the frozen lockfile, and runs the same gates there. It
catches what a working-tree check cannot — a file that was never committed, a stale
lockfile, a gitignored file the build secretly needs. Because it clones, it ignores
uncommitted changes (and says so when your tree is dirty).

A `pre-push` hook runs `pnpm verify` automatically and aborts the push on failure.
It is enabled via `core.hooksPath`; a fresh clone needs `pnpm hooks` once. Bypass a
single push deliberately with `git push --no-verify`.

Hosting is decided in [docs/ADR-001-hosting.md](docs/ADR-001-hosting.md). Deploy with
`pnpm cf:deploy`. The same gates also run in GitHub Actions on every push to `main`
and on every pull request — branch pushes without a PR are not CI-verified, and see
[docs/BACKLOG.md](docs/BACKLOG.md) for the account-level issue currently blocking
Actions.
