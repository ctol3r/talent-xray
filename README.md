# Talent X-Ray

A people-only search product. It queries two Google Programmable Search Engines
restricted to surfaces where humans describe themselves — profiles, portfolios, CVs,
credential registries, rosters — and turns intuitive filters into precise boolean
queries. Company marketing pages and job postings are absent by construction.

Read [CLAUDE.md](CLAUDE.md) first: it is the build doctrine, and every rule in it is
load-bearing.

## Layout

| Path                   | Purpose                                                         |
| ---------------------- | --------------------------------------------------------------- |
| `app/`                 | Next.js App Router routes                                       |
| `components/`          | UI components                                                   |
| `lib/`                 | Domain logic — query composer, corpus, facets                   |
| `lib/corpus/`          | The 100-domain corpus, facets, recipes                          |
| `supabase/migrations/` | SQL migrations (RLS policies live with their tables)            |
| `reference/`           | `talent-xray.html`, the validated reference console — read-only |
| `docs/`                | ADRs, [LEGAL.md](docs/LEGAL.md), [BACKLOG.md](docs/BACKLOG.md)  |
| `tests/`               | Vitest unit tests (Playwright arrives with the first UI wave)   |

## Develop

```bash
pnpm install
pnpm dev        # local dev server
pnpm typecheck  # tsc --noEmit
pnpm lint       # eslint
pnpm test       # vitest
pnpm build      # production build
```

Hosting is decided in [docs/ADR-001-hosting.md](docs/ADR-001-hosting.md). CI runs
typecheck, lint, unit tests, and build on every push.
