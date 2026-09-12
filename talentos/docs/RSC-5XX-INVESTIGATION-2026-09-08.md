# The prefetch 5xx wall — investigated 2026-09-08

**Lead as filed:** roughly 38 HTTP 503s on `?_rsc=` prefetch requests across
nearly every route during one page load, not reproducible on later loads.
Hypothesis to test first: a cold dev server prefetches every sidebar link at
once, each prefetch opens a SQLite connection, and the database returns busy.

**Result: the hypothesis is wrong, and the real cause is something else that
produces exactly the same picture.** Nothing was changed in the routing layer
or the connection strategy. Nothing needed to be.

---

## The hypothesis, tested and falsified

Two things have to be true for it, and neither is.

**A cold dev server does not prefetch at all.** `.next-dev` was removed, the
server started with no route compiled, and the job workspace loaded straight
from cold. The dev server logged three requests: the page, and two calls to
`/api/context`. Zero `?_rsc=`. Next's `<Link>` viewport prefetching is a
production behaviour; in dev it does not fire. Whatever produced 38 prefetches
was `next start`, not `next dev` — which matters, because it is `pnpm start`
that has been running on port 3000 through this whole pilot.

**Concurrent prefetches do not each open a connection.** `getDb()` caches one
handle on `globalThis.__talentosDb`, and `createDb()` is synchronous from the
first line to the assignment, so on Node's single thread no second request can
observe the cache empty. There is one connection per process by construction;
better-sqlite3 then serialises every query on it. There is no pool to tune and
no busy to return.

The decisive measurement is below: **36 simultaneous `?_rsc=` requests, same
connection strategy, all 200.**

## What actually happened

`createDb()` compares the newest entry in `drizzle/meta/_journal.json` against
the newest row in `__drizzle_migrations`, and throws if the file is ahead:

> Pending database migration. Back up the database and obtain owner
> authorization, then run pnpm db:migrate. No migration was applied.

That guard is correct and deliberate — a migration must not run on the owner's
data by accident. But two properties of it turn one pending migration into a
wall of failures:

1. **It throws per request, not once.** `getDb()` only writes the singleton on
   success, so every subsequent request re-runs the check and re-throws.
2. **Every route touches the database.** So every route fails, including every
   prefetch the sidebar fires — which is the "nearly every route" in the report.

A new migration file landing in `drizzle/` therefore breaks the entire app for
any server process started after it, until `pnpm db:migrate` is run.

### Measured, both ways

Both bursts: 36 routes, all `?_rsc=`, fired simultaneously at a freshly started
`next start`, against the same data.

| Condition                                                 | Result             |
| --------------------------------------------------------- | ------------------ |
| `drizzle/0012_search_milestones.sql` present, not applied | **36 of 36 → 500** |
| Same data, migration applied (to a `VACUUM INTO` copy)    | **36 of 36 → 200** |

The only difference between the two rows is whether a migration was pending.
Connection strategy, WAL mode, concurrency and data were identical.

### Why it would not reproduce

Because it depends on when your server process started, not on what you did in
the browser:

- The server that has been up on port 3000 since 21:16 still answers `?_rsc=`
  with 200 right now. It opened the database before `0012` existed and is
  holding the cached handle.
- A server started after `0012` landed fails every request.

So the window is: a migration file appears, and anything restarted before
`pnpm db:migrate` runs is comprehensively broken. Restart or migrate and it is
gone, with nothing to find. `data/talentos.backup-before-0010-*` and
`-before-0011-*` show the same window opened at least twice before.

### One number that does not match

The report says 503; every failure measured here is **500**. Nothing in this
codebase emits 503, and `next start` returns 500 for a render throw. The 503s
may have come from a different runtime — the Cloudflare deployment returns 503
when a Worker throws — or the count may have been read off a devtools panel
that groups them. **Not resolved.** The shape (one burst, every route, only
`?_rsc=`, gone afterwards) matches exactly, so this is recorded as the likely
cause rather than a certain one.

## State right now

`drizzle/0012_search_milestones.sql` (search_milestones table,
`search_projects.start_date_agreement`) **is pending against
`data/talentos.db`.** It was not applied: no migration runs without an explicit
instruction. Until it is, any newly started server 500s on every route.

```bash
TALENTOS_ALLOW_MIGRATIONS=1 pnpm db:migrate
```

## What was deliberately not changed

- **The guard.** It is doing its job. Refusing to open a database whose schema
  the code has moved past is the behaviour that protects the pilot data.
- **The connection strategy.** Falsified as a cause, and there is nothing
  wrong with it for one process.
- **The routing layer.** Never implicated.

Two follow-ups are in `BACKLOG.md`: the guard's failure has no readable face
(38 identical 500s and a server log nobody has open is a bad way to be told to
run one command), and `busy_timeout` is never set, which is latent rather than
live — one process means no contention today, but a dev server, a production
server and `pnpm smoke` all point at `./data/talentos.db` and any two of them
at once would meet an immediate `SQLITE_BUSY`.
