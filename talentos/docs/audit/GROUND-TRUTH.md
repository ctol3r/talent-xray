# Ground truth

**2026-09-08. Read-only.** No code changed, no dependency added, no migration run.
Repo root confirmed as `/Users/christoler/talentos-connected-review/talentos` — it
is the directory holding `data/talentos.db`. `CLAUDE.md` there is one line,
`@AGENTS.md`, and `AGENTS.md` carries only the Next.js agent block; the product
doctrine lives in `docs/` (`DECISIONS.md`, `BACKLOG.md`, `CLAUDE_HANDOFF.md`) and in
the parent repo's `CLAUDE.md`.

## Two things to read before the rest

**The tree was being written to while this was compiled.** Files changed under this
audit as it ran — `src/components/parallel-ribbons.tsx` grew from roughly 7KB to
15KB, `src/components/page-preview.tsx`, `src/components/hill-chart.tsx`,
`artifact-src/core/hill.ts` and six test files were all touched inside the same
hour, and `tests/e2e/parallel-regression.spec.ts` appeared mid-pass. More than one
agent is working in this worktree. Every line below was true of the checkout at the
moment it was read; anything about component internals has the shortest shelf life.

**The working tree is not the committed tree.** `git status` shows well over a
hundred modified and untracked files, including `docs/DECISIONS.md`, most of
`src/components/`, and the whole of `src/app/api/`. Statements below describe the
files on disk, not any commit.

Gates as of the last full run: `pnpm verify` green (124 test files, 1402 tests),
`pnpm e2e` 68 passed, `pnpm e2e:artifact` 32 passed, smoke, defects, benchmark and
extraction all clean.

## 1 — Build

It is Next.js App Router on pnpm, but three things depart from a stock setup and each of them exists for a reason somebody has already been bitten by: the dev server writes to a different dist directory, a second browser-only product is built into one committed HTML file, and `pnpm verify` gates on both artifact drift and a scan that fails if private runtime data was packaged into the build.

> TalentOS is a Next.js 16.3.2 / React 19.2.8 App Router app on pnpm 10.17.1, using better-sqlite3 + drizzle-orm against a local SQLite file, with its own pnpm workspace root separate from the parent talent-xray repo. It is not a plain Next setup: `pnpm dev` redirects the build output to `.next-dev` via TALENTOS_DIST_DIR, a second product is built by esbuild into a single committed HTML file (`artifact/talentos-lite.html`), and `pnpm verify` gates on both artifact drift and a build-trace scan that fails if private runtime data was packaged. The DB client refuses to auto-apply pending migrations unless TALENTOS_ALLOW_MIGRATIONS=1.

- **package.json defines 30 scripts; the standard Next four are dev/build/start/lint**
  - `package.json` · `scripts`
  - dev = "TALENTOS_DIST_DIR=.next-dev next dev --hostname 127.0.0.1"; build = "next build"; start = "next start --hostname 127.0.0.1"; lint = "eslint ."; typecheck = "next typegen && tsc --noEmit"; test = "vitest run"; format = "prettier --write ."; format:check = "prettier --check .".
- **pnpm verify chains seven steps, in this order, with && between each**
  - `package.json` · `scripts.verify`
  - "pnpm format:check && pnpm typecheck && pnpm lint && pnpm build:artifact:check && pnpm test && pnpm build && pnpm check:private-build". Note format:check runs FIRST and build runs SECOND-TO-LAST, and check:private-build must run after build because it reads .next/server traces. It does NOT run e2e, integration tests, smoke, or benchmark.
- **README's description of pnpm verify is stale — it omits two of the seven steps**
  - `README.md`
  - README '## Verify' says "format check, typecheck, lint, unit tests, build". The actual chain in package.json also includes build:artifact:check and check:private-build.
- **Next.js is 16.3.2 in both the manifest and the installed package**
  - `node_modules/next/package.json` · `version`
  - node_modules/next/package.json version = "16.3.2"; package.json dependency pin is the exact string "16.3.2" (not a range). eslint-config-next is pinned to the same "16.3.2".
- **React and react-dom are both exactly 19.2.8, pinned without a range**
  - `package.json` · `dependencies`
  - package.json: "react": "19.2.8", "react-dom": "19.2.8". Verified installed: node_modules/react/package.json and node_modules/react-dom/package.json both report "version": "19.2.8".
- **TypeScript is strict:true but without the extra-strict flags**
  - `tsconfig.json` · `compilerOptions`
  - strict: true, target ES2022, module esnext, moduleResolution "bundler", allowJs true, skipLibCheck true, allowImportingTsExtensions true, isolatedModules true, incremental true, paths {"@/_": ["./src/_"]}. NOT set: noUncheckedIndexedAccess, exactOptionalPropertyTypes, noImplicitOverride, noUnusedLocals. include covers **/*.mts (so scripts/ are typechecked); exclude is [node_modules, data, test-results, playwright-report].
- **`any` is banned by ESLint, not by tsconfig**
  - `eslint.config.mjs` · `eslintConfig`
  - Rule "@typescript-eslint/no-explicit-any": "error", layered on eslint-config-next/core-web-vitals and eslint-config-next/typescript. globalIgnores includes .next/**, .next-dev/**, data/**, drizzle/**, vendor/**, test-results/**, playwright-report/**.
- **The dev server writes its build to .next-dev, not .next — a deliberate deviation from stock Next**
  - `next.config.ts` · `nextConfig.distDir`
  - distDir = process.env.TALENTOS_DIST_DIR ?? ".next". Only the dev script sets TALENTOS_DIST_DIR (=.next-dev). The inline comment states next dev and next build both writing .next corrupted whichever lost the race, producing pages that would not update and a test server that would not start.
- **next.config.ts pins Turbopack/tracing roots to talentos/ and excludes runtime data from output tracing**
  - `next.config.ts` · `nextConfig`
  - turbopack.root and outputFileTracingRoot both = path.join(import.meta.dirname) so Turbopack does not infer the parent talent-xray repo. outputFileTracingExcludes["/_"] = ["./data/\**/_", "**/\*.db", "**/_.db-wal", "\**/_.db-shm", "**/session-outbox/**/*"]. Also experimental.serverActions.bodySizeLimit = "21mb", serverExternalPackages = [better-sqlite3, pdfjs-dist, mammoth], transpilePackages = ["@talentos/hsal-adapter"].
- **The dev server binds 127.0.0.1 and passes no --port, so it uses the Next default 3000**
  - `package.json` · `scripts.dev`
  - "TALENTOS_DIST_DIR=.next-dev next dev --hostname 127.0.0.1" — no --port flag and no PORT variable in .env or .env.example. README documents the URL as http://127.0.0.1:3000 and recommends launching it as `TALENTOS_MODEL_PROVIDER=session pnpm dev`. The port number itself is Next's default, not stated in the script.
- **The database driver is better-sqlite3 13.0.3 wrapped by drizzle-orm 0.45.2**
  - `src/lib/db/client.ts` · `Db`
  - `import Database from "better-sqlite3"` plus drizzle/better-sqlite3; exported type Db = BetterSQLite3Database<typeof schema>. Installed versions verified: node_modules/better-sqlite3/package.json 13.0.3, node_modules/drizzle-orm/package.json 0.45.2.
- **DB file path resolves from TALENTOS_DATABASE_PATH, defaulting to ./data/talentos.db, joined against process.cwd()**
  - `src/lib/db/client.ts` · `resolveDatabasePath`
  - const configured = process.env.TALENTOS_DATABASE_PATH ?? "./data/talentos.db"; absolute paths pass through, relative paths are path.join(process.cwd(), configured) — so the resolved file depends on the working directory of whatever process opens it. Migrations folder is path.join(process.cwd(), "drizzle").
- **getDb is a global singleton that survives Next hot reloads**
  - `src/lib/db/client.ts` · `getDb`
  - Caches on globalThis.__talentosDb (declared via `declare global { var __talentosDb: Db | undefined }`). createDb sets pragma journal_mode = WAL and foreign_keys = ON, runs drizzle migrate(), then calls backfillLegacyDocuments(db) from @/lib/documents/backfill on every cold start.
- **An existing database with pending migrations throws instead of migrating, unless TALENTOS_ALLOW_MIGRATIONS=1**
  - `src/lib/db/client.ts` · `createDb`
  - createDb reads drizzle/meta/_journal.json, compares MAX(created_at) in __drizzle_migrations against max journal entry `when`, and if the DB already existed and is behind, closes the handle and throws "Pending database migration. Back up the database and obtain owner authorization, then run pnpm db:migrate. No migration was applied." Brand-new database files migrate silently. The only place that sets the override is src/lib/db/migrate.ts (`process.env.TALENTOS_ALLOW_MIGRATIONS = "1"` before getDb()).
- **A second better-sqlite3 handle is opened outside the client, bypassing the migration guard**
  - `scripts/purge-search.mts`
  - Line 22 resolves process.env.TALENTOS_DATABASE_PATH ?? "./data/talentos.db" and line 30 does `new Database(dbPath)` directly. These are the only two `new Database(` call sites in src/, scripts/ and packages/.
- **A second, browser-only product is built by esbuild into one committed HTML file**
  - `scripts/build-artifact.mts` · `renderArtifact`
  - Bundles artifact-src/main.ts with esbuild (format iife, platform browser, target es2022, alias "@" -> src/, minifyWhitespace + minifySyntax but minifyIdentifiers:false and keepNames:true so stack traces still name functions), inlines artifact-src/styles.css and artifact-src/template.html, escapes </script, and writes artifact/talentos-lite.html. Version stamp is content-addressed: sha256 of (unversioned bundle + styles + template) sliced to 10 hex, appended to package.json version, injected as **TALENTOS_ARTIFACT_VERSION**. Hard-fails if output exceeds 16 MB.
- **pnpm build:artifact:check is a drift gate inside verify — it rebuilds in memory and fails if the committed HTML differs**
  - `scripts/build-artifact.mts` · `main`
  - With --check it does not write; it byte-compares against artifact/talentos-lite.html and exits 1 with "artifact/talentos-lite.html is out of date — run `pnpm build:artifact` and commit the result." The output file IS tracked by git (git ls-files artifact/ returns artifact/talentos-lite.html, currently 1,411,503 bytes and showing as modified on branch codex/talentos-connected-review).
- **check:private-build scans Next build traces and fails the build if any runtime data file was packaged**
  - `scripts/check-private-build.mts`
  - Walks .next/server for *.nft.json, resolves every entry in each manifest's `files` array, and counts a violation if the target is under ./data, under TALENTOS_DOCUMENT_DIR (default ~/.local/share/talentos/documents), or matches /\.db(-wal|-shm)?$/. Throws "Build traces are missing; run pnpm build first." when no traces exist, and "Build packaging references N runtime data files. Do not ship this build." on any hit. Note it walks ".next/server" literally, so it does not see a TALENTOS_DIST_DIR-relocated build.
- **talentos/ is its own pnpm workspace root, isolated from the parent talent-xray repo**
  - `pnpm-workspace.yaml`
  - Comment states it makes talentos/ its own workspace root with own lockfile and node_modules. packages: ["packages/*"]. onlyBuiltDependencies: better-sqlite3, esbuild, sharp, unrs-resolver. packageManager in package.json is pnpm@10.17.1; installed pnpm is 10.17.1 and node is v24.10.0.
- **One workspace package and one vendored SDK are wired in by file: path, not a registry**
  - `packages/hsal-adapter/package.json` · `@talentos/hsal-adapter`
  - Root package.json depends on "@talentos/hsal-adapter": "workspace:*" and "@hsal/sdk": "file:vendor/@hsal/sdk". The adapter is TypeScript-source-only (main and types both "./src/index.ts"), which is why next.config.ts lists it in transpilePackages. Re-vendoring is `pnpm hsal:vendor`, which shells out to a sibling checkout: `pnpm --dir ../../hsal sdk:vendor "$(pwd)/vendor" && pnpm install` — that path resolves to /Users/christoler/hsal, which exists.
- **Unit tests and integration tests use two separate vitest configs**
  - `vitest.config.mts`
  - Default config: environment node, include ["tests/unit/**/\*.test.ts"], alias @ -> ./src. pnpm test runs only this (121 files in tests/unit). vitest.integration.config.mts includes tests/integration/**/*.test.ts with testTimeout/hookTimeout 60_000 and fileParallelism:false, run via pnpm test:integration — it is NOT part of verify. tests/integration currently holds one file, hsal-sp104.test.ts.
- **There are three Playwright configs; the app e2e run needs a prior pnpm build and frees port 3999 first**
  - `playwright.config.ts`
  - testDir ./tests/e2e, baseURL http://localhost:3999, workers 1, timeout 180s, webServer command "pnpm start --port 3999" with reuseExistingServer:false and env TALENTOS_MODEL_PROVIDER=mock, TALENTOS_DISCOVERY_PROVIDER=mock, TALENTOS_OPEN_INDEX=mock, TALENTOS_REGISTRY_NPPES=mock, TALENTOS_PROFILES_GITHUB=mock, TALENTOS_PROFILES_KEYBASE=mock, TALENTOS_DATABASE_PATH=./data/e2e.db, TALENTOS_DOCUMENT_DIR=/tmp/talentos-e2e-documents. The e2e script is "tsx scripts/free-port.mts 3999 && playwright test". The other two configs are playwright.artifact.config.ts (no web server; serves the committed HTML and stubs window.claude) and playwright.hsal.config.ts.
- **scripts/free-port.mts SIGTERMs then SIGKILLs whatever is listening on the given port**
  - `scripts/free-port.mts` · `pidsOn`
  - Uses lsof -nP -iTCP:<port> -sTCP:LISTEN -t, rejects ports outside 1024-65535, sends SIGTERM to each pid, then after 1500ms SIGKILLs any survivor. Run automatically by pnpm e2e.
- **pnpm smoke refuses to run against the real database**
  - `scripts/critical-path.mts`
  - Line 19 reads TALENTOS_DATABASE_PATH and lines 20-23 abort with "Refusing to run: set TALENTOS_DATABASE_PATH to a throwaway file. `pnpm smoke` does this for you." The script entry is "TALENTOS_DATABASE_PATH=./data/smoke.db TALENTOS_MODEL_PROVIDER=mock tsx scripts/critical-path.mts".
- **All non-Next scripts run through tsx directly on .mts files; there is no compile step for them**
  - `package.json` · `scripts`
  - db:migrate, db:seed, smoke, golden:cais, golden:session, benchmark, extraction, probe:search, outbox, graph:sync, purge:search, crew:work, eval:w12, eval:w12:fulfil, build:artifact, test:documents:defects, check:private-build, seed:sp104, demo:sp104, free:port all invoke `tsx <script>`. tsx ^4.23.13 is a devDependency. Schema generation is drizzle-kit (db:generate).
- **drizzle-kit writes migrations to ./drizzle from a single schema file**
  - `drizzle.config.ts` · `default`
  - dialect sqlite, schema "./src/lib/db/schema.ts" (33 KB), out "./drizzle", dbCredentials.url = process.env.TALENTOS_DATABASE_PATH ?? "./data/talentos.db".
- **The data directory is gitignored and currently holds the live DB plus four backups and test databases**
  - `.gitignore`
  - .gitignore excludes /data/, .next, .next-dev, _.tsbuildinfo, next-env.d.ts, .env_ (except .env.example), /test-results/, /playwright-report/, /coverage. On disk: data/talentos.db (1.6 MB, plus a 4.1 MB -wal), data/e2e.db, data/e2e-hsal.db, data/smoke.db, data/session-outbox/ (79 entries) and four talentos.backup-* files.
- **Env vars in use are all TALENTOS\_-prefixed plus two secrets**
  - `.env.example`
  - .env.example declares ANTHROPIC_API_KEY, TALENTOS_DATABASE_PATH, TALENTOS_DISCOVERY_PROVIDER, TALENTOS_GOOGLE_CSE_KEY, TALENTOS_MODEL, TALENTOS_MODEL_PROVIDER, TALENTOS_REGISTRY_NPPES, TALENTOS_RESEARCH_PROVIDER, TALENTOS_SESSION_OUTBOX. The local .env adds HSAL_TOKEN, TALENTOS_OPEN_INDEX and TALENTOS_OPEN_INDEX_CONTACT. Values not read. Two more appear only in code, never in .env: TALENTOS_DIST_DIR (package.json dev script) and TALENTOS_ALLOW_MIGRATIONS (src/lib/db/migrate.ts); TALENTOS_DOCUMENT_DIR appears in scripts/check-private-build.mts and playwright.config.ts.
- **AGENTS.md is machine-generated by next dev and CLAUDE.md is a one-line include of it**
  - `AGENTS.md`
  - AGENTS.md is wrapped in <!-- BEGIN:nextjs-agent-rules --> markers and states it is re-added by next dev, generated by node_modules/next/dist/server/lib/generate-agent-files.js. talentos/CLAUDE.md contains only "@AGENTS.md" (11 bytes) — the project rules that matter live in the parent repo's CLAUDE.md, not here.
- **The App Router surface is src/app with 17 route groups and an api directory**
  - `src/app/layout.tsx`
  - src/app contains api, candidates, capture, companies, daily, dashboard, documents, graph, notes, search, searches, settings, sourcing, tags, tasks, plus layout.tsx, page.tsx and globals.css. Siblings are src/components (82 entries) and src/lib (18 entries). There is no src/pages directory.

**Could not determine:**

- The exact dev-server port is not written anywhere in the build config — scripts.dev passes --hostname 127.0.0.1 with no --port, and no PORT variable exists in .env or .env.example. 3000 is Next's default and is what README.md documents; I did not start a server to confirm.
- I did not run pnpm verify, build, or any test, so I cannot say whether the seven verify steps currently pass. The working tree is dirty on branch codex/talentos-connected-review with artifact/talentos-lite.html, artifact-src/*, next.config.ts, package.json and playwright.config.ts all modified, which is exactly the state that build:artifact:check is designed to catch.
- scripts/check-private-build.mts hardcodes the literal path ".next/server" rather than reading TALENTOS_DIST_DIR. Whether that is intentional (verify always runs the plain `next build`, which writes .next) or a latent gap I could not determine from source alone.
- packages/hsal-adapter has its own node_modules containing @hsal/sdk and zod; I did not verify that the vendored vendor/@hsal/sdk build is current relative to the sibling /Users/christoler/hsal checkout.

## 2 — The outbox contract

The most important section, and the one with the most to say. It is a two-file handoff on local disk with a hash-keyed filename, and its idempotence is real but not total. Two independent producers write into the same directory, the directory rule is implemented three times, and the schema check on a response sits outside the try/catch that writes the audit row — which puts the most likely fulfilment mistake in the one place that leaves no trace.

> The outbox is a two-file handoff on local disk: a generation or research call writes `<base>.request.json` into `TALENTOS_SESSION_OUTBOX` (default `./data/session-outbox`, resolved against process.cwd()) and throws a Pending error; a Claude session writes the bare payload object to `<base>.response.json`; the caller re-runs and the provider returns it. Two independent producers exist — `createSessionProvider` in src/lib/ai/session.ts (base = `<schemaName>-<sha256(system+"\n"+user) first 12 hex>`) and `createSessionResearchProvider` in src/lib/research/session-research.ts (base = `Research-<sha256(query+"\n"+String(limit)) first 12 hex>`) — and both write into the same directory, which scripts/outbox.mts reads with a union type. Idempotence comes from the response-exists check running before the request write plus a filename that is a pure function of the prompt bytes; it is not total, because ensureIds mints fresh UUIDs and a new audit row is inserted on every re-run.

- **Outbox directory is resolved from TALENTOS_SESSION_OUTBOX, defaulting to ./data/session-outbox; a relative value is joined to process.cwd(); the directory is created on demand.**
  - `src/lib/ai/session.ts` · `createSessionProvider`
  - outboxDir() lines 42-48: `process.env.TALENTOS_SESSION_OUTBOX ?? "./data/session-outbox"`, then `path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured)`. Line 56 calls `fs.mkdirSync(dir, { recursive: true })` on every generateStructured call.
- **The research provider duplicates outboxDir() rather than importing it — same env var, same default, separate copy.**
  - `src/lib/research/session-research.ts` · `createSessionResearchProvider`
  - Lines 56-62 are byte-equivalent to session.ts lines 42-48. Two independent implementations of the directory contract; changing one does not change the other.
- **scripts/outbox.mts resolves the same directory with path.resolve rather than isAbsolute/join — a third copy of the resolution rule.**
  - `scripts/outbox.mts`
  - Lines 17-19: `path.resolve(process.env.TALENTOS_SESSION_OUTBOX ?? "./data/session-outbox")`. Functionally equivalent for a cwd-relative value but not the same code.
- **This install is actually configured for the session provider with the default outbox path.**
  - `.env`
  - .env line 10 `TALENTOS_MODEL_PROVIDER=session`, line 13 `TALENTOS_SESSION_OUTBOX=./data/session-outbox`, line 21 `TALENTOS_MODEL=claude-opus-5`. (.env.example line 10 ships `anthropic` instead.)
- **A GENERATION request file has exactly six top-level keys, written pretty-printed with 2-space indent.**
  - `src/lib/ai/session.ts` · `createSessionProvider`
  - session.ts lines 84-100, in file order: `schemaName` (string, from request.schemaName); `instructions` (fixed literal: "Compose the highest-quality output satisfying `system` and `user`, then write ONLY the output JSON object (no markdown fences) to `respondTo`."); `respondTo` (absolute path of the response file); `system` (string); `user` (string); `outputJsonSchema` (result of z.toJSONSchema(request.schema)). If z.toJSONSchema throws, outputJsonSchema is set to undefined (lines 78-83) and JSON.stringify OMITS the key entirely — the fulfilling session then gets no schema at all and only discovers the mismatch when run.ts re-validates.
- **A RESEARCH request file has a different six-key shape, distinguished by `kind: "research"` and the presence of `query`.**
  - `src/lib/research/session-research.ts` · `createSessionResearchProvider`
  - session-research.ts lines 105-122, in file order: `kind` (literal "research"); `instructions` (audience-level-only scope rule plus the findings shape, and "never fabricate a URL"); `query` (string); `limit` (number); `respondTo`; `responseSchema` (z.toJSONSchema(researchResponseSchema)). Note there is NO try/catch around z.toJSONSchema here, unlike session.ts — a schema-conversion failure would throw instead of degrading.
- **Generation filename = `${schemaName}-${hash}` where hash is sha256 over system, a literal newline, then user, hex, truncated to 12 characters.**
  - `src/lib/ai/session.ts` · `createSessionProvider`
  - session.ts lines 57-65: `createHash("sha256").update(request.system).update("\n").update(request.user).digest("hex").slice(0, 12)`; then `${base}.request.json` and `${base}.response.json` in the same directory. The schema, schemaName and maxTokens are NOT hashed — only the two prompt strings.
- **Research filename = `Research-${hash}` where hash is sha256 over query, a newline, then String(limit), truncated to 12 characters.**
  - `src/lib/research/session-research.ts` · `createSessionResearchProvider`
  - session-research.ts lines 72-80. limit defaults to 8 (line 69, `options?.limit ?? 8`), but the persona pipeline passes 6, so live filenames are keyed on query+"6".
- **The audit contextHash and the outbox filename hash are computed from the same bytes but truncated differently — 16 chars vs 12 — so they are not the same string.**
  - `src/lib/ai/run.ts` · `runAiTask`
  - run.ts lines 58-65 contextHash() slices to 16; session.ts line 62 slices to 12. The filename hash is a prefix of the audit hash. 12 hex chars is 48 bits of collision space.
- **The response is expected as the BARE payload object at `<base>.response.json` — no envelope, no wrapper key.**
  - `data/session-outbox/ExpertReply-c8965bf18eed.response.json`
  - Verified against three real files in data/session-outbox/: ExpertReply-c8965bf18eed.response.json top-level keys are [answer, uncertain, declined, next]; HiringNeed-a06f723d1232.response.json is [need, requirements, uncertainties, contradictions]; Research-361e66a252dd.response.json is [findings] with 6 entries keyed url/title/snippet/retrievedAt.
- **session.ts reads the response with an UNCHECKED cast — it never validates against the zod schema it shipped in the request.**
  - `src/lib/ai/session.ts` · `createSessionProvider`
  - Lines 67-76: `JSON.parse(rawText) as T`. Only malformed JSON is caught, and it becomes a GenerationFailedError telling the operator to fix or delete the file. Schema conformance is somebody else's problem.
- **Schema validation of the response happens in run.ts at line 148 — OUTSIDE the try/catch that ends at line 145 — so a response file that is valid JSON but violates the schema throws a raw ZodError with NO ai_generations audit row.**
  - `src/lib/ai/run.ts` · `runAiTask`
  - The try block spans lines 113-145; `const parsed = def.schema.parse(raw)` is line 148, after it. The failure path at lines 131-145 (which does call audit("failed")) is therefore never reached for a schema-invalid response. src/lib/actions/helpers.ts lines 29-37 catches the ZodError and reports kind "validation". Net effect: the most likely session-fulfilment mistake is the one case that leaves no audit trace.
- **The research response IS validated, against researchResponseSchema, and failure produces a plain Error naming the file.**
  - `src/lib/research/session-research.ts` · `researchResponseSchema`
  - Lines 82-103: safeParse against `z.object({findings: z.array(z.object({url: z.string().min(4), title: optional, snippet: optional, retrievedAt: optional}))})`. On success findings are sliced to `limit`, stamped `source: "session-research"` (SESSION_RESEARCH_SOURCE, line 43), the originating `query`, `retrievedAt ?? now`, and `providerRank: index + 1`.
- **`pnpm outbox` maps to `tsx scripts/outbox.mts`.**
  - `package.json`
  - package.json scripts, line reading `"outbox": "tsx scripts/outbox.mts"`.
- **With no argument, `pnpm outbox` lists every .request.json that has no sibling .response.json, oldest mtime first, and prints five labelled lines per entry plus a copy-paste instruction naming only the oldest.**
  - `scripts/outbox.mts`
  - Lines 79-119. Pending set = readdirSync filtered to `.endsWith(".request.json")`, `answered` computed by existsSync on the name with `.request.json` replaced by `.response.json`, keep the unanswered, stat for mtime, sort ascending. Per entry it prints the filename then `asks   :`, `written:` (ISO mtime), `about  :` (first 100 chars), `answer :` (respondTo). Header is `N request(s) waiting for a Claude session.` Trailer is a single line: "Read <dir>/<pending[0].name>, answer it against the schema it carries, and write the JSON object to the path in its respondTo field."
- **Two early exits: a missing directory prints "No outbox at <dir>. Nothing is waiting." and an empty pending set prints "Nothing is waiting. Every request in the outbox has been answered." Both exit 0.**
  - `scripts/outbox.mts`
  - Lines 74-77 and 96-101. An unanswered request is never an error exit code from this script.
- **With a filename argument, `pnpm outbox <file>` prints the full request: a header with the inferred kind, then Instructions, System, User, Query (whichever exist) and "## Write the answer to" + respondTo.**
  - `scripts/outbox.mts`
  - Lines 58-72. A non-absolute argument is joined to the outbox dir. Sections are conditional, so the same code prints both request kinds.
- **describe() infers the request kind by duck-typing on `query`, and falls back to the first non-empty, non-'#' line of `user` as the one-line summary.**
  - `scripts/outbox.mts`
  - Lines 42-56. Research → `research (<kind ?? "search">, up to <limit ?? "?"> results)`. Generation → `request.schemaName ?? "unknown"`. The RequestFile interface at lines 27-36 makes every key but respondTo optional precisely so one reader handles both producers.
- **scripts/outbox.mts is provably read-only: it calls only readFileSync, readdirSync, statSync and existsSync.**
  - `scripts/outbox.mts`
  - No write, unlink, mkdir or network call appears anywhere in the file; its header comment at line 12 states "It reads and prints. It never writes a response and never calls out." I did not execute it — these claims are from source.
- **A request nobody answers is never deleted, expired or garbage-collected. Nothing in the repo removes outbox files.**
  - `src/lib/services/documents.ts`
  - A repo-wide search for unlinkSync/rmSync outside node_modules and .next returns hits only in src/lib/services/documents.ts (private document store), tests/e2e/global-setup.ts, scripts/critical-path.mts, scripts/golden-cais.mts, scripts/lib/hsal-gateway.ts, scripts/e2e-hsal-server.mts and unit tests using their own tmp dirs. No path touches the session outbox.
- **A pending handoff writes NO ai_generations audit row — it is rethrown before the audit call.**
  - `src/lib/ai/run.ts` · `runAiTask`
  - run.ts lines 131-133: `if (error instanceof SessionFulfillmentPendingError) throw error;` sits above the audit("failed"|"refused") call at lines 139-142, with the comment "A pending session handoff is not a failed generation — no audit row." Unanswered work is therefore invisible in the database; the filesystem is the only record.
- **While a request stays unanswered, every re-run rewrites the same file unconditionally, so its mtime advances — `written:` in `pnpm outbox` is last-attempt time, not first-ask time.**
  - `src/lib/ai/session.ts` · `createSessionProvider`
  - session.ts line 84 calls fs.writeFileSync with no existsSync guard on the request path (only the response path is guarded, line 67). Same for session-research.ts line 105. scripts/outbox.mts line 93 sorts and reports `fs.statSync(entry.full).mtime`.
- **Callers render a pending handoff as a waiting state, not an error, in four separate places.**
  - `src/lib/actions/helpers.ts` · `act`
  - src/lib/actions/helpers.ts lines 51-63 maps both SessionFulfillmentPendingError and ResearchPendingError to `{ok:false, kind:"pending", handoff:{requestPath,responsePath}}`; src/components/generate-button.tsx lines 58-59 renders HandoffWaiting with a copy-paste line built at line 92; src/lib/services/crew.ts lines 459-462 stores error.requestPath on the crew job and returns "pending"; src/lib/services/expert.ts lines 173-193 writes a chat turn carrying `waiting: {requestPath, responsePath}`.
- **The crew job table persists the handoff path in a column, with an 'awaiting_model' status in the enum.**
  - `src/lib/db/schema.ts` · `crewJobs`
  - src/lib/db/schema.ts lines 828-829: `/** Session-provider handoff file, when status is awaiting_model. */ requestPath: text("request_path")`. CREW_JOB_STATUSES in src/lib/core/enums.ts lines 173-181 includes "awaiting_model". Note crew.ts line 460 sets requestPath but does NOT set status to "awaiting_model" — the job keeps whatever status it had.
- **Idempotence mechanism 1: the response-exists check runs BEFORE the request is written, so a re-run with unchanged prompts returns the stored JSON and never re-throws.**
  - `src/lib/ai/session.ts` · `createSessionProvider`
  - session.ts line 67 `if (fs.existsSync(responsePath))` precedes the writeFileSync at line 84 and the throw at line 101. session-research.ts line 82 has the identical ordering.
- **Idempotence mechanism 2: the filename is a pure function of the prompt bytes, and the prompts are pure functions of ctx — no task prompt builder introduces a timestamp or random value.**
  - `src/lib/ai/run.ts` · `runAiTask`
  - run.ts lines 90-91 compute `def.system(ctx)` / `def.user(ctx)`. A search for `new Date|Date.now|toISOString|randomUUID` across all 24 files in src/lib/ai/tasks/ returns zero hits.
- **Idempotence is NOT total: ensureIds mints a fresh crypto.randomUUID() for every array element lacking a string id, so re-running the same response file produces different ids in the persisted payload each time.**
  - `src/lib/core/payloads.ts` · `ensureIds`
  - src/lib/core/payloads.ts lines 626-641: `if (isListItem && typeof record.id !== "string") { record.id = crypto.randomUUID(); }`. It is applied at run.ts line 149, after schema validation, on every run including cached-response runs.
- **Idempotence is NOT total: each successful re-run stamps a new generatedAt and inserts another ai_generations row.**
  - `src/lib/ai/run.ts` · `runAiTask`
  - run.ts line 158 sets `generatedAt: new Date().toISOString()`; line 151 calls audit("ok"), which inserts into aiGenerations (lines 99-110) with durationMs measured from line 93. Reading a cached response file counts as a generation for audit purposes.
- **Because the hash covers the whole prompt, and the expert prompt embeds the conversation so far, a duplicated question would orphan the already-answered request — the code has an explicit guard for it.**
  - `src/lib/services/expert.ts` · `askExpert`
  - src/lib/services/expert.ts lines 117-127 comment: a duplicated question "changes the history, which changes the hash, which writes a _new_ request file and leaves the answered one sitting there unread. The second ask has to be the same ask, byte for byte." Lines 128-131 implement the guard (`asking = tail?.who === "you" && tail.text === asked`), and lines 100-104 strip a prior waiting turn for the same question.
- **Research runs batch all pending queries before throwing, so one pass writes every request file it still needs.**
  - `src/lib/services/research.ts`
  - src/lib/services/research.ts lines 151-186: each ResearchPendingError is pushed to a `pending` array and the loop continues; only after the loop does it rethrow a single ResearchPendingError carrying `rest.map(e => e.requestPath)` as `alsoPending`. The constructor at src/lib/research/session-research.ts lines 26-40 switches its message on the count and points the operator at `pnpm outbox`.
- **Redacted structure of one real unanswered request file, data/session-outbox/ExpertReply-30799f1ed9ca.request.json (3841 bytes).**
  - `data/session-outbox/ExpertReply-30799f1ed9ca.request.json`
  - Six top-level keys, matching session.ts exactly. schemaName: string, 11 chars, value "ExpertReply". instructions: string, 142 chars, the fixed literal from session.ts line 90. respondTo: string, 111 chars, basename "ExpertReply-30799f1ed9ca.response.json". system: string, 2666 chars (content redacted). user: string, 29 chars (content redacted). outputJsonSchema: object whose keys are $schema, type, properties, required, additionalProperties. No names, prose or prompt bodies reproduced.
- **The live outbox holds 41 request files and 36 response files; 5 requests are unanswered.**
  - `data/session-outbox`
  - Unanswered: EvidenceAlignment-5a175526a87c, ExpertReply-30799f1ed9ca, ExpertReply-bf82b31299fe, RoleIntelligence-bb2ea1fa1b6f, SuccessProfile-9d3ecd0f7200 (all .request.json in data/session-outbox/). Filename prefixes observed across the directory: AudiencePersonas, ChannelSuggestions, EvidenceAlignment, ExpertReply, HiringNeed, IntakeSession, MarketResearch, OutreachSequence, Research, RoleIntelligence, SearchPlan, SourcingStrategy, StringExpansion, SuccessProfile.
- **A second in-repo writer of response files exists: the W12 eval fulfiller.**
  - `scripts/eval-w12-fulfil.mts`
  - scripts/eval-w12-fulfil.mts declares its own `respondTo: string` interface at line 18 and writes the answer with `fs.writeFileSync(req.respondTo, JSON.stringify(body, null, 2))` at line 129. scripts/eval-w12.mts line 31 redirects TALENTOS_SESSION_OUTBOX to a per-run results directory, so eval traffic does not mix with data/session-outbox.
- **In session mode the audit row records model "claude-session", not TALENTOS_MODEL — resolveModelId() is not consulted.**
  - `src/lib/ai/provider.ts` · `getProviderStatus`
  - src/lib/ai/provider.ts lines 75-83: the session branch of getProviderStatus() returns `model: "claude-session"` hardcoded, and only the anthropic branch (lines 84-94) calls resolveModelId(). run.ts line 121 passes `status.model` into createSessionProvider, and line 103 writes `model: status.model` to aiGenerations. So .env's `TALENTOS_MODEL=claude-opus-5` has no effect while the session provider is active.
- **The session provider is the default when TALENTOS_MODEL_PROVIDER is unset, and always reports configured: true.**
  - `src/lib/ai/provider.ts` · `resolveProviderKind`
  - provider.ts lines 41-47: resolveProviderKind() returns "session" for an unset or unrecognised value. Lines 75-83 report configured: true unconditionally, so runAiTask's ProviderNotConfiguredError guard (run.ts lines 86-88) never fires in session mode.
- **The research provider follows the model provider's posture when TALENTOS_RESEARCH_PROVIDER is unset, which is why research requests land in the same outbox.**
  - `src/lib/research/provider.ts` · `resolveResearchProviderKind`
  - src/lib/research/provider.ts lines 57-65: explicit value wins; unset falls through to TALENTOS_MODEL_PROVIDER (session → session, mock → mock); anything else resolves to "none".
- **The outbox is excluded from Next's output file tracing, so request/response files are never packaged into a build.**
  - `next.config.ts`
  - next.config.ts line 24 lists `"**/session-outbox/**/*"` in outputFileTracingExcludes["/_"], alongside ./data/\**/_ and the SQLite files.
- **Both pending errors carry requestPath and responsePath as readonly constructor properties; ResearchPendingError adds a third, alsoPending.**
  - `src/lib/ai/session.ts` · `SessionFulfillmentPendingError`
  - src/lib/ai/session.ts lines 29-40 (SessionFulfillmentPendingError, name set to "SessionFulfillmentPendingError"); src/lib/research/session-research.ts lines 18-41 (ResearchPendingError, third arg `alsoPending: string[] = []`, name set to "ResearchPendingError"). helpers.ts reads only the first two, so alsoPending paths never reach the UI envelope.

**Could not determine:**

- I did not execute `pnpm outbox`; every claim about its output is read off scripts/outbox.mts source, not observed at runtime. The read-only constraint took precedence over runtime verification.
- CANNOT-DETERMINE whether any process outside this repository answers request files. Nothing in the source polls, watches or fulfils the outbox — the only in-repo writers of response files are scripts/eval-w12-fulfil.mts (eval harness) and the unit tests (tests/unit/intake-session.test.ts line 58). In normal operation fulfilment is a human pasting a line into a Claude session; that actor is outside the code.
- CANNOT-DETERMINE whether the 5 currently unanswered requests are abandoned or merely not yet fulfilled. The code records no ask-time, no owner and no expiry, and run.ts writes no audit row for a pending handoff, so there is no in-repo signal distinguishing the two. mtime is unreliable here because an unanswered request is rewritten on every re-run.
- I did not verify the 12-hex-char filename hashes against a recomputation of sha256(system+"\n"+user) for any real file — doing so would have required reading the unredacted prompt bodies of a production request. The derivation is stated from source (src/lib/ai/session.ts lines 57-65).
- crew.ts line 460 sets requestPath without setting status to "awaiting_model", despite the schema comment at src/lib/db/schema.ts line 828 saying the column is populated "when status is awaiting_model". I did not trace whether some other call site sets that status, so whether the enum value is ever actually written is unresolved.

## 3 — The ask path

One question, end to end. The headline is the correction: **the question is persisted, before the model is called**, and re-asking is the documented collection mechanism rather than a defect.

> A question typed into `ExpertChat` goes to the `askExpertAction` server action, which validates with zod and calls `askExpert`, which writes the question to SQLite before any model call. The specialist is picked by pure keyword arithmetic in `routeQuestion` (artifact-src/core/experts.ts), and with no model key the provider writes a request file to data/session-outbox and throws, which `askExpert` catches and records as a "waiting" turn carrying both file paths. Persistence is a single JSON blob in the `settings` table under the key `chat:main` — no chat table, no migration; the artifact path stores the same conversation in `localStorage` under `talentos-expert-chat-v1` and answers inline via the viewer's own Claude instead of a file handoff.

- **The input is owned by the client component ExpertChat: a controlled textarea bound to React state `text`, plus a `named` select that overrides routing. Enter submits, shift-enter newlines.**
  - `src/components/expert-chat.tsx` · `ExpertChat`
  - `const [text, setText] = useState("")` line 102; textarea `value={text}` line 181-195; onKeyDown Enter handler lines 184-191; specialist select lines 206-222.
- **The component sends via `send(question)`, which wraps the call in useTransition and calls the server action with `{ question, expert? }`.**
  - `src/components/expert-chat.tsx` · `send`
  - Lines 113-128. On `result.ok` it clears the textarea and calls `router.refresh()`; it never renders `result.data.turns` — the transcript comes back only from the server re-render.
- **The server action receiving the question is `askExpertAction`, a "use server" function that zod-parses the input at the boundary.**
  - `src/lib/actions/expert.ts` · `askExpertAction`
  - `askInput = z.object({ question: z.string().min(1).max(4000), expert: z.string().max(40).optional() })` lines 9-13; calls `askExpert(getDb(), parsed.question, parsed.expert)` line 20; then `revalidatePath("/", "layout")` line 21.
- **There is no API route for the expert ask. The only caller of askExpertAction is the chat component, and the only caller of askExpert is the action.**
  - `src/lib/actions/expert.ts` · `askExpertAction`
  - grep across src, tests, eval, scripts returns exactly four hits: the import and call in src/components/expert-chat.tsx, the definition in src/lib/actions/expert.ts, and the definition in src/lib/services/expert.ts.
- **The specialist is chosen by `routeQuestion` in artifact-src/core/experts.ts — deterministic keyword scoring, no model call. A caller-named specialist bypasses it via `expertById`.**
  - `artifact-src/core/experts.ts` · `routeQuestion`
  - In src/lib/services/expert.ts lines 108-110: `const routing = chosen ? { expert: expertById(chosen), because: [] } : routeQuestion(asked)`. routeQuestion lowercases, strips punctuation, matches each expert's `knows` stems with a `(^|[^a-z0-9])` prefix regex (`uses`), scores hits as phrase.length (x2 for multi-word phrases), highest score wins, ties keep the earlier expert; no match falls to `generalist`.
- **There are 8 specialists in the EXPERTS roster; `generalist` has an empty `knows` array and is the fallback returned by expertById for any unknown id.**
  - `artifact-src/core/experts.ts` · `EXPERTS`
  - intake, sourcing, outreach, screening, market, close, fair-hiring, generalist. `expertById` returns `EXPERTS[EXPERTS.length - 1]` when no id matches, so an unrecognised `expert` string from the client silently becomes the generalist rather than erroring.
- **THE QUESTION IS PERSISTED — written to SQLite BEFORE the model is called, and it survives whatever happens next.**
  - `src/lib/services/expert.ts` · `askExpert`
  - src/lib/services/expert.ts line 140: `writeChat(db, turns)` executes before the `try { await askTheExpert(...) }` block at line 147. The file's own header comment states: "A turn is written before the answer is asked for."
- **THE STORAGE KEY IS `chat:main` — a single row in the `settings` key/value table. No chat table and no migration.**
  - `src/lib/services/expert.ts` · `CHAT_KEY`
  - `export const CHAT_KEY = "chat:main";` at src/lib/services/expert.ts line 23. readChat/writeChat select and upsert `settings` where `settings.key === CHAT_KEY`; writeChat uses `.onConflictDoUpdate({ target: settings.key, set: { value, updatedAt } })`.
- **The `settings` table is `key TEXT PRIMARY KEY, value TEXT (json mode), updated_at`. The whole conversation is one JSON document in `value`.**
  - `src/lib/db/schema.ts` · `settings`
  - src/lib/db/schema.ts lines 838-842: `export const settings = sqliteTable("settings", { key: text("key").primaryKey(), value: text("value", { mode: "json" }).$type<unknown>(), updatedAt: updatedAt() })`.
- **The stored shape is `{ version: 1, turns: ChatTurn[] }`, validated by zod on both read and write, capped at MAX_TURNS = 200 (oldest dropped).**
  - `src/lib/services/expert.ts` · `chatSchema`
  - `chatSchema = z.object({ version: z.literal(1), turns: z.array(turnSchema).max(MAX_TURNS) })` lines 49-52; writeChat does `turns.slice(-MAX_TURNS)`. readChat uses safeParse and returns `[]` on any parse failure — a malformed row silently reads as an empty conversation.
- **The live database confirms it: settings row `chat:main` holds a question turn and a waiting turn with both outbox paths.**
  - `data/talentos.db` · `settings.chat:main`
  - sqlite3 data/talentos.db SELECT on key='chat:main' returns {"version":1,"turns":[{"id":"q1788921292576","who":"you","text":"why is nobody replying"},{"id":"w1788921292581","who":"expert","text":"why is nobody replying","expert":"outreach","because":["reply"],"waiting":{requestPath/responsePath ...ExpertReply-bf82b31299fe...}}]}. The matching file data/session-outbox/ExpertReply-bf82b31299fe.request.json exists on disk.
- **THE OUTBOX WRITE happens in the session provider's generateStructured, not in the service or the action.**
  - `src/lib/ai/session.ts` · `createSessionProvider`
  - src/lib/ai/session.ts lines 84-101: fs.writeFileSync(requestPath, JSON.stringify({ schemaName, instructions, respondTo, system, user, outputJsonSchema })) then `throw new SessionFulfillmentPendingError(requestPath, responsePath)`. Directory from `outboxDir()`: `process.env.TALENTOS_SESSION_OUTBOX ?? "./data/session-outbox"`.
- **The outbox filename is `<schemaName>-<sha256(system+"\n"+user) first 12 hex>.request.json`, and an existing `.response.json` short-circuits and returns the parsed JSON.**
  - `src/lib/ai/session.ts` · `SessionFulfillmentPendingError`
  - src/lib/ai/session.ts lines 57-76. For this path schemaName is "ExpertReply" (set in src/lib/ai/tasks/expert.ts line 78). Because the hash covers the prompt and the prompt embeds the conversation history, re-asking the identical question is idempotent and collects the answer.
- **The provider defaults to `session` (file handoff) when nothing is configured, which is why the waiting state is the normal state in this install.**
  - `src/lib/ai/provider.ts` · `resolveProviderKind`
  - src/lib/ai/provider.ts `resolveProviderKind()` lines 41-47 returns "session" as the fallback; `getProviderStatus()` reports kind "session", model "claude-session", configured true. src/lib/ai/tasks/expert.ts lines 63-66 then builds `createSessionProvider(status.model)`.
- **The prompt is assembled in `askTheExpert`, which enforces the no-facts-about-named-people rule in the system prompt and caps history at 8 turns / 600 chars per turn.**
  - `src/lib/ai/tasks/expert.ts` · `askTheExpert`
  - src/lib/ai/tasks/expert.ts: HISTORY_TURNS = 8, HISTORY_CHARS = 600 (lines 53-54); schema `expertReplySchema` = { answer, uncertain[], declined, next[] }; maxTokens 1200.
- **The pending error is caught inside askExpert and recorded as a `waiting` turn whose `text` is the question itself — that is what lets a re-ask find and replace it instead of stacking waits.**
  - `src/lib/services/expert.ts` · `askExpert`
  - src/lib/services/expert.ts lines 173-196: `error instanceof SessionFulfillmentPendingError ? { requestPath, responsePath } : null`; the turn is `{ id: `w${Date.now()}`, who: "expert", text: waiting ? asked : error.message, expert, because, waiting }`, then `writeChat(db, said)`. Line 116 filters out any prior expert turn with `waiting && turn.text === asked`.
- **A re-ask does not append a duplicate question turn, deliberately, because a changed history would change the prompt hash and orphan the already-answered request file.**
  - `src/lib/services/expert.ts` · `askExpert`
  - src/lib/services/expert.ts lines 127-139: `const asking = tail?.who === "you" && tail.text === asked;` and `turns = asking ? settled : [...settled, newQuestionTurn]`. The comment says "The second ask has to be the same ask, byte for byte."
- **Because askExpert swallows the pending error, askExpertAction returns `ok: true` on a wait. The `pending` branch of the action error envelope is unreachable for this path.**
  - `src/lib/actions/helpers.ts` · `act`
  - src/lib/actions/helpers.ts lines 51-64 maps SessionFulfillmentPendingError to `{ ok:false, kind:"pending", handoff }`, but askExpert catches it first (src/lib/services/expert.ts line 173). The only errors the chat's `setError` can show are the zod validation failure (empty or >4000 chars) or a DB failure. ProviderNotConfiguredError likewise lands in the transcript as an expert turn's text, not in the red error box.
- **WHILE WAITING the UI shows two distinct things: an in-flight state and a persisted waiting turn.**
  - `src/components/expert-chat.tsx` · `Waiting`
  - In-flight (useTransition `pending`): the submit button reads "Asking…" and is disabled, suggestion chips and Clear are disabled; there is no optimistic echo of the question and the textarea keeps its text until the action resolves (src/components/expert-chat.tsx lines 197-203, 122). After resolution + router.refresh(), the `Waiting` component renders an amber panel naming the specialist, the sentence "…is waiting on a Claude session — there is no model key in this install, so the question is a file somebody answers", the monospace `turn.waiting.requestPath`, and the instruction to run `pnpm outbox` (lines 38-58).
- **The transcript the user sees is read server-side on the home page, not from the action's return value — so persistence is load-bearing for display.**
  - `src/app/page.tsx` · `HomePage`
  - src/app/page.tsx line 33 `const turns = readChat(db)` and line 84 `<ExpertChat turns={turns} />`. The component's `router.refresh()` is what re-runs this.
- **Successful answers are scanned for protected-characteristic language and the hits are stored on the turn as `flagged` (warned, never blocked).**
  - `src/lib/domain/fair-hiring.ts` · `scanPayloadForProtectedTraits`
  - src/lib/services/expert.ts lines 153-155 `scanPayloadForProtectedTraits(reply).map(hit => hit.trait)`; rendered by the `Answer` component as "⚖️ Mentions … — worth a look before you use it."
- **ARTIFACT PATH — persistence: localStorage under the key `talentos-expert-chat-v1`, capped at MAX_TURNS = 120, with try/catch fallbacks so a storage-refusing viewer still gets a working (non-persistent) conversation.**
  - `artifact-src/ui/expert.ts` · `KEY`
  - artifact-src/ui/expert.ts line 25 `const KEY = "talentos-expert-chat-v1";` line 27 `MAX_TURNS = 120`; `read()` lines 42-53 and `write()` lines 55-61. No `version` wrapper and no zod — the stored value is a bare Turn[] array, validated only by `Array.isArray`.
- **ARTIFACT PATH — no server action, no outbox, no file handoff: it answers inline by borrowing the viewer's own Claude through the `sample` capability.**
  - `artifact-src/ai/tasks.ts` · `askExpert`
  - artifact-src/ui/expert.ts calls `askExpert(routing.expert, asked, history)` from artifact-src/ai/tasks.ts, which builds one prompt string and calls `sampleJson` → `sampleApi.json(prompt, { signal, cache: false, onText, modelTier })` (artifact-src/ai/tasks.ts lines 139-157, 215). The module comment says a server "has no viewer to borrow — which is why the same feature over there writes a request file for a Claude session to fulfil."
- **ARTIFACT PATH — routing is shared code, so both paths pick the same specialist for the same sentence.**
  - `artifact-src/core/experts.ts` · `expertById`
  - Both artifact-src/ui/expert.ts (line 16-21) and src/lib/services/expert.ts (line 21, via a relative ../../../artifact-src path) import `EXPERTS`, `expertById` and `routeQuestion` from artifact-src/core/experts.ts.
- **ARTIFACT PATH — differences in behaviour on failure and on waiting: the question is persisted, but a failed ask is NOT; the error lives in a module-level variable and is lost on reload.**
  - `artifact-src/ui/expert.ts` · `send`
  - artifact-src/ui/expert.ts line 81 `write(turns)` persists the question before the call, but the catch at lines 110-117 only sets `trouble = errorMessage(error)` (module state, line 64) and re-renders. Waiting shows as an inline `Asking…` line (line 187) plus a disabled button; there is no requestPath and no `waiting` field on the artifact Turn interface (lines 29-40). When `aiAvailable()` is false the whole chat is replaced by a warning and no input is rendered (lines 167-175).
- **ARTIFACT PATH — response validation is hand-rolled, not zod. The reply schema is asked for in prose inside the prompt.**
  - `artifact-src/ai/tasks.ts` · `askExpert`
  - artifact-src/ai/tasks.ts lines 209-210 embed `Reply with JSON only: {"answer": string, "uncertain": string[], "declined": boolean, "next": string[]}` in the prompt; lines 216-237 coerce with a `list()` helper and throw GenerationError("bad_shape") if `answer` is missing. The Next path instead passes `expertReplySchema` to the provider (src/lib/ai/tasks/expert.ts line 77).
- **Test coverage on this path is routing only. tests/unit/experts.test.ts covers routeQuestion (11 cases); no test found exercising askExpert persistence or the chat:main round-trip.**
  - `tests/unit/experts.test.ts`
  - grep for "expert" across tests/ returns tests/unit/experts.test.ts, tests/unit/artifact-phases.test.ts, tests/unit/sourcing-angles.test.ts, tests/e2e/pane-kinds.spec.ts. Only the first is about the expert roster, and every `it()` in it is about routing.

**Could not determine:**

- Whether the waiting turn ever gets replaced in practice depends on a Claude session writing the .response.json; in data/session-outbox only 1 of 3 ExpertReply requests has a matching response (ExpertReply-c8965bf18eed), so the other two questions are still sitting as waiting turns. I did not run pnpm outbox to confirm how it reports them — I only read the script name in package.json line 25.
- Turn ids are `q${Date.now()}` / `a${Date.now()}` / `w${Date.now()}` (src/lib/services/expert.ts lines 134, 159, 184). Two turns of the same kind written in the same millisecond would collide as React keys. I did not find a case where that can happen, since question and answer carry different prefixes, so I am not calling it a bug.
- src/lib/services/expert.ts imports artifact-src via a relative `../../../artifact-src/core/experts` path rather than the `@/` alias. I did not check tsconfig include/rootDir to confirm whether that crosses a project boundary in a way the build cares about — CANNOT-DETERMINE without running the build, which is out of scope here.

## 4 — The four inputs

Two share a parser and two do not. `/search` and `/sourcing` both call the same `parseQuery`; the palette filters a fixed command list with an inline substring match and reaches neither search surface; the ask box routes to a specialist, which is not a query parser at all.

> The four input surfaces do not share one query parser: /search and /sourcing both call `parseQuery` from `src/lib/sourcing/query-language.ts`, while the command palette uses an unnamed inline substring filter and the home ask box uses `routeQuestion` from `artifact-src/core/experts.ts`, which is a specialist router, not a query parser. So it is two shared and two separate implementations. The palette also has no command that reaches /search or /sourcing at all, even though both are in the left nav.

- **(a) The command palette is owned entirely by CommandBar; it calls no parser and no service. Filtering is an unnamed inline predicate inside a useMemo: `commands.filter(c => `${c.label} ${c.keywords ?? ""}`.toLowerCase().includes(q))`, then grouped by a fixed GROUP_ORDER and capped at 40.**
  - `src/components/command-bar.tsx` · `CommandBar`
  - Filter at lines 275-290. Query state is local `query`; there is no import of parseQuery or any lib/sourcing module. Imports are only tagHref, PHASES, JOB_STATUSES/labelFor.
- **(a) The palette's only action is navigation: the selected Command's `href` is pushed to the router. It never queries the DB — the command list is built from props (searches, people, tags) plus static PHASES-derived module paths.**
  - `src/components/command-bar.tsx` · `run`
  - `run` (lines 292-300) does setOpen(false); setQuery(""); router.push(command.href).
- **(a) The palette contains no entry for /search or /sourcing, so neither search surface is reachable from Cmd+K or "/".**
  - `src/components/command-bar.tsx` · `COMMAND_BAR_EVENT`
  - The "Go" list (lines 155-225) is dashboard, /searches/new, /searches, /candidates, /tags, /graph, /daily, /tasks, /settings. grep for "/search\" in this file returns nothing. By contrast src/components/app-shell.tsx line 29 and line 33 list /search and /sourcing in the nav.
- **(b) /search is a server component that owns a plain GET form (action="/search", name="q") and hands the raw string to the service `globalSearch`.**
  - `src/app/search/page.tsx` · `Page`
  - Line 23: `const result = query ? globalSearch(getDb(), query) : null`. Form at lines 38-52.
- **(b) globalSearch calls parseQuery, builds an in-memory row set from searchProjects, candidates, listTags and tasks, scores each row with the module-local `scoreRow`, sorts by score, slices to limit (default 40).**
  - `src/lib/services/global-search.ts` · `globalSearch`
  - Line 123 `const brief = parseQuery(query)`. scoreRow is defined at line 64 and is NOT exported. Returns { brief, reading: describeBrief(brief), hits, counts, warnings: brief.warnings }.
- **(b) The page renders the parser's own explanation of the query — result.reading and result.warnings — directly, which is how it satisfies the "never hide what you searched" rule.**
  - `src/app/search/page.tsx` · `Page`
  - Lines 53-70 render result.reading (from describeBrief) and result.warnings (brief.warnings).
- **(c) /sourcing splits input ownership: the visible input lives in the client component SourcingConsole, but it is a plain GET form to /sourcing, so the server page reads the string from searchParams.**
  - `src/components/sourcing-console.tsx` · `SourcingConsole`
  - Line 92 `<form action="/sourcing" method="get">`, input name="q" at line 94, checkbox name="live" value="1" at lines 130-137. The component imports only FIELD_ALIASES from query-language, to count filters for the help toggle.
- **(c) The /sourcing page calls runSourcingQuery, or runLiveSourcingQuery when live=1.**
  - `src/app/sourcing/page.tsx` · `Page`
  - Lines 121-125: `asking ? await runLiveSourcingQuery(db, query) : runSourcingQuery(db, query)`, where `asking = live === "1"`.
- **(c) runSourcingQuery calls the same parseQuery, then rankPeople over workspacePeople and buildPlan over the parsed brief. It returns { brief, plan, ranked, hrefs }.**
  - `src/lib/services/sourcing.ts` · `runSourcingQuery`
  - Line 297 `const brief = parseQuery(query)`; line 298 rankPeople(people, brief, …); line 301 buildPlan(brief, env, { structured: structuredSources(brief, availableConnectors(env)) }).
- **(c) runLiveSourcingQuery is a wrapper: it calls runSourcingQuery first and reuses that same brief for the open-index call and the re-rank. There is no second parse.**
  - `src/lib/services/sourcing.ts` · `runLiveSourcingQuery`
  - Line 494 `const base = runSourcingQuery(db, query, options)`, then searchOpenIndex(toOpenIndexSpec(base.brief, …)) and rankPeople(combined, base.brief, …).
- **(c) buildPlan accepts either a raw string or an already-parsed brief and parses only when handed a string, so the /sourcing path parses exactly once.**
  - `src/lib/sourcing/plan.ts` · `buildPlan`
  - Line 94: `const brief = typeof query === "string" ? parseQuery(query) : query;`
- **(c) The dossier page under /sourcing parses again, twice, for its own purposes — once for the incoming brief and once for a self-brief built from the person's own fields.**
  - `src/app/sourcing/person/[id]/page.tsx` · `Page`
  - Line 35 `parseQuery(query || person.title || person.name)` and line 37 `parseQuery([person.title, person.organization, person.location].filter(Boolean).join(" "))`.
- **(d) The home ask box is owned by ExpertChat. It does not parse the question into a query at all; it scores it against per-specialist vocabularies with routeQuestion, purely to pick who answers.**
  - `src/components/expert-chat.tsx` · `ExpertChat`
  - Line 108: `const preview = text.trim() ? routeQuestion(text) : null` — used only to label the select box. Imports EXPERTS, expertById, routeQuestion from ../../artifact-src/core/experts.
- **(d) Submission goes to a server action, not a search service. askExpertAction validates with zod (question 1..4000 chars, optional expert id) and calls askExpert.**
  - `src/lib/actions/expert.ts` · `askExpertAction`
  - Lines 9-24. `const turns = await askExpert(getDb(), parsed.question, parsed.expert)` then revalidatePath("/", "layout").
- **(d) askExpert re-runs the same routing server-side unless the caller named a specialist, appends the turn to a chat transcript stored under a settings key, and delegates the answer to askTheExpert.**
  - `src/lib/services/expert.ts` · `askExpert`
  - Line 108-110: `const routing = chosen ? { expert: expertById(chosen), because: [] } : routeQuestion(asked)`. CHAT_KEY = "chat:main" (line 23), MAX_TURNS = 200 (line 25). Imports askTheExpert from @/lib/ai/tasks/expert.
- **(d) routeQuestion is a scoring router, not a parser: it lowercases, strips non-letter/number chars, prefix-matches each expert's `knows` phrases with a word-boundary regex, and scores phrase length (doubled for multi-word phrases). No filters, no fields, no brief.**
  - `artifact-src/core/experts.ts` · `routeQuestion`
  - Lines 246-273; helper `uses` at line 232 builds `new RegExp('(^|[^a-z0-9])' + escaped)`. Falls back to GENERALIST when nothing matches. Returns { expert, because }.
- **PLAIN ANSWER: they do not share one query parser. Two of the four (/search, /sourcing) share exactly one: parseQuery. The command palette has a separate, unnamed inline substring filter. The home ask box has a separate function, routeQuestion, which is not a query parser at all.**
  - `src/lib/sourcing/query-language.ts` · `parseQuery`
  - parseQuery is declared at line 632 with signature `parseQuery(text: string, options: { expand?: boolean } = {}): SourcingBrief`, documented "Never throws on input". Its only non-test callers in src/ and artifact-src/ are: src/lib/services/global-search.ts:123, src/lib/services/sourcing.ts:297, src/lib/sourcing/plan.ts:94, src/app/sourcing/person/[id]/page.tsx:35 and :37, src/lib/sourcing/benchmark.ts:626, artifact-src/ui/sourcing.ts:242. Neither command-bar.tsx nor expert-chat.tsx appears.
- **The browser artifact build shares the server's parser rather than duplicating it, so parseQuery has three consumers across both builds.**
  - `artifact-src/ui/sourcing.ts` · `parseQuery`
  - Line 20 imports { describeBrief, parseQuery, type SourcingBrief } from "@/lib/sourcing/query-language"; line 242 `const brief = query.trim() ? parseQuery(query) : null`.
- **The shared surface between /search and /sourcing is deliberate and documented in both modules' headers, and both render describeBrief output back to the user.**
  - `src/lib/services/global-search.ts` · `describeBrief`
  - global-search.ts header (lines 2-8) says "Same query language as sourcing". describeBrief is defined at src/lib/sourcing/query-language.ts:869 and is consumed by src/app/search/page.tsx (via result.reading) and by src/lib/sourcing/plan.ts (via answer.plan.reading, rendered at src/app/sourcing/page.tsx:390-402).

**Could not determine:**

- Whether the palette's omission of /search and /sourcing is intentional. The nav in src/components/app-shell.tsx carries both, and the palette's own header comment claims "Everything addressable lives here" — the two claims disagree, but nothing in the source states which is the intended behaviour.
- scoreRow in src/lib/services/global-search.ts and the ranker in src/lib/sourcing/rank.ts both consume the same SourcingBrief but implement scoring independently. I read scoreRow in full; I did not read rank.ts, so I cannot say how far the two scoring models diverge — only that they are separate code.

## 5 — The query grammar

One implementation, and it is well covered. This is the healthiest part of the system audited here.

> There is exactly one implementation of the filter-token grammar: `src/lib/sourcing/query-language.ts`, whose `parseQuery` tokenises with a single regex (`TOKEN_RE`, line 368) and dispatches through a private `applyField`. Every other place that handles a query string imports `parseQuery` from that module — the Next app services, the artifact UI, and the built single-file artifact, which is an esbuild bundle of the same source. It is directly covered by `tests/unit/sourcing-query-language.test.ts` (224 lines, 6 describe blocks) and exercised indirectly by six more unit suites plus two Playwright specs.

- **One and only one parser for the filter tokens. parseQuery tokenises the whole string with a single regex and never throws on input.**
  - `src/lib/sourcing/query-language.ts` · `parseQuery`
  - TOKEN_RE at line 368: /(-)?(?:([A-Za-z_]+):(?:"([^"]_)"|([^\s()]+))|"([^"]_)"|(\()|(\))|([^\s()]+))/g — captures optional leading '-', field name, quoted or bare value, quoted phrase, parens, bare word. parseQuery at line 632.
- **The token vocabulary lives in one exported alias table; field dispatch is a single private switch.**
  - `src/lib/sourcing/query-language.ts` · `FIELD_ALIASES`
  - FIELD_ALIASES (line 37) maps 50+ spellings onto 18 canonical fields: skill, title, org, loc, seniority, site, filetype, artifact, source, after, before, intitle, inurl, intext, has, lang, industry, name. Aliases include skills/capability/tech/expertise→skill, role/job/position→title, company/employer/institution/school/university→org, location/city/where/region/country→loc, level→seniority, domain/host→site, ext/format→filetype, type/doc→artifact, since/from/newer→after, until/to/older→before, with→has, sector→industry, person→name, connector→source. Dispatch is applyField (line 507, not exported).
- **Supporting vocabularies are all exported from the same file — there is no second copy anywhere.**
  - `src/lib/sourcing/query-language.ts` · `HAS_FLAGS`
  - FILETYPE_CONTENT_TYPES (96, 15 filetypes), HAS_FLAGS (119, 17 flags incl. email/contact/phone/publication/repository/patent/cv/portfolio/orcid/github/dataset/personal_domain), HAS_CANONICAL (140, private: paper→publication, repo→repository, resume→cv, website→personal_domain), ARTIFACT_ALIASES (147, 21 aliases), QUERY_STOPWORDS (176), QUALIFYING_VERBS (308).
- **Unknown fields and unreadable filetypes degrade to warnings rather than errors.**
  - `src/lib/sourcing/query-language.ts` · `applyField`
  - Unknown field name → warning "unknown filter 'x:' treated as a keyword" and the literal 'x:value' is pushed as a keyword term (lines 663-676). filetype not in FILETYPE_CONTENT_TYPES → warning and the filter is dropped (571-580). has: flag not in HAS_FLAGS → warning (613-618). Unparseable after:/before: → warning (591-605).
- **after:/before: are parsed by an exported date reader that accepts absolute and relative forms.**
  - `src/lib/sourcing/query-language.ts` · `parseDate`
  - parseDate (408) handles today/now/yesterday, relative Nd/Nw/Nm/Ny via REL_DATE_RE (371), YYYY-MM-DD, YYYY/MM/DD, DD/MM/YYYY, YYYY-MM, YYYY, and a trailing-year fallback in prose. windowContains (446) deliberately keeps undated evidence.
- **The grammar round-trips: unparseBrief renders a brief back to canonical token syntax.**
  - `src/lib/sourcing/query-language.ts` · `unparseBrief`
  - Line 905 emits skill:, title:, org:, loc:, seniority:, industry:, filetype:, artifact:, has:, site:, -site:, after:, before: and negated terms. describeBrief (869) renders the same brief as prose rows for the UI.
- **Next.js sourcing service calls the one parser; it does not re-parse.**
  - `src/lib/services/sourcing.ts` · `parseQuery`
  - Imports parseQuery at line 39, calls it at line 297.
- **Cross-workspace global search reuses the same grammar rather than defining its own.**
  - `src/lib/services/global-search.ts` · `globalSearch`
  - Imports describeBrief/keywords/negativeTerms/parseQuery (lines 15-21) and calls parseQuery at line 123. Module header states it is the same query language as sourcing.
- **The browser artifact UI imports the same parser from src/ — no artifact-local copy exists.**
  - `artifact-src/ui/sourcing.ts` · `parseQuery`
  - Imports { describeBrief, parseQuery, type SourcingBrief } from "@/lib/sourcing/query-language" (lines 18-22), calls parseQuery at line 242.
- **The single-file artifact contains a compiled copy of that same module, produced by esbuild with an alias to src/, not a separately maintained parser.**
  - `scripts/build-artifact.mts`
  - Build entry artifact-src/main.ts, alias { "@": <root>/src } at scripts/build-artifact.mts:46. artifact/talentos-lite.html contains exactly one occurrence of the TOKEN_RE character class and one "unknown filter" string.
- **angles.ts is an output target for the token vocabulary, not a second parser: it emits web operators from an already-parsed brief.**
  - `src/lib/sourcing/angles.ts` · `renderAngle`
  - Renders filetype: (522-528), site:/-site: (531-532), intitle: (535), inurl: (538), intext: (539). It imports keywords/negativeTerms/expandedSkills from query-language and never reads raw query text.
- **A second, smaller `kind:value` string form exists — requirement keys — but it is produced and read by different code and is not parsed by parseQuery.**
  - `src/lib/sourcing/dossier.ts` · `requirementText`
  - Produced in rank.ts as `skill:${key}` (265), `org:${org}` (320, 328), `title:${wanted}` (338), `loc:${norm}` (383-384), `has:${flag}` (551). Read back by requirementText (dossier.ts:41-56), which splits on ':' and handles only skill/loc/org/title, returning the raw string for anything else. dossier.ts:84 also does requirement.startsWith("skill:").
- **The boolean string composer is a separate system that takes structured input, not tokens — it does not parse the grammar.**
  - `src/lib/domain/search-strings.ts` · `StringLabInput`
  - StringLabInput (search-strings.ts:11) is arrays of titles/mustHave/anyOf/credentials/locations/companies/exclusions. artifact-src/core/query-compiler.ts wraps composeQueries for platform limits. Neither reads skill:/loc:/has: token strings.
- **The dedicated test suite is one file with six describe blocks covering fields, terms, natural language, dates, windows and round-tripping.**
  - `tests/unit/sourcing-query-language.test.ts`
  - 224 lines. Fields: all filters in one string incl. skill/title/org/loc/filetype/after/has/-site/industry (20-36); alias acceptance company/location/capability (38-43); comma and pipe splitting (45-54); unknown field warns and becomes a keyword (56-60); unreadable filetype warns and is dropped (62-66). Terms: quoted phrase kept while bare stopwords dropped (70-77); leading-dash negation (79-82); OR groups share a non-zero group id (84-89). Natural language: multi-word capability promoted from prose (93-104); capability after a qualifying verb becomes qualifierSkills not a requirement (106-113); qualifier stands in when nothing else survives (115-120); phrase halves ('Bay','Area') not left as keywords (122-133); a standalone capability word is kept (135-138); a place in prose fills loc: (140-143); ontology expansion carries reasons (145-150). parseDate: absolute/relative/trailing-year/null (153-175). windowContains: undated kept, out-of-window excluded (177-195). Round-tripping: unparseBrief re-parses to the same skills/locations/has/excludeSites; describeBrief rows; freeText output (197-224).
- **Six further unit suites exercise the grammar indirectly by importing parseQuery.**
  - `tests/unit/sourcing-angles.test.ts`
  - tests/unit/sourcing-angles.test.ts (operator rendering, brief operators overriding angle defaults, artifact:/filetype: narrowing, bare has:email refusing to render), sourcing-rank.test.ts (has:, negation, -site:, skill:/loc: scoring), sourcing-plan.test.ts (buildPlan on 'skill:robotics has:email'), sourcing-open-index.test.ts, sourcing-benchmark.test.ts, sourcing-similar.test.ts (requirementText for skill:/loc:/org:).
- **global-search.test.ts asserts the grammar's behaviour through the workspace search path.**
  - `tests/unit/global-search.test.ts` · `globalSearch`
  - globalSearch(db, "loc:london recruiter -closed") — reading contains 'locations: london' and 'excluding terms: closed' (26-30); negated term excludes rows (42-46); 'wibble:thing' surfaces a warning rather than being dropped (54-56).
- **Two Playwright specs drive the grammar end to end.**
  - `tests/e2e/sourcing.spec.ts`
  - tests/e2e/sourcing.spec.ts navigates to /sourcing?q=skill%3Arobotics at lines 31, 52, 62, 99. tests/e2e-artifact/artifact.spec.ts:1230 fills #sourcing-q with 'skill:robotics' and clicks #sourcing-go.
- **Only tests/unit/**/*.test.ts runs under the default vitest config; `pnpm test` is `vitest run`.**
  - `vitest.config.mts`
  - vitest.config.mts include: ["tests/unit/**/*.test.ts"], alias @ -> ./src. package.json line 11 "test": "vitest run"; line 29 verify chains format:check, typecheck, lint, build:artifact:check, test, build.
- **The in-app help table listing the tokens is hand-maintained and no test checks it against FIELD_ALIASES.**
  - `src/components/sourcing-console.tsx` · `FIELD_HELP`
  - FIELD_HELP (line 16) documents skill:, title:, org:, loc:, seniority:, industry:, has:, artifact:, filetype:, site:, after:/before:, quotes/dash, OR. It omits source:, lang:, name:, intitle:, inurl:, intext: and the type: alias. Only the canonical-field count is derived from FIELD_ALIASES (line 87: new Set(Object.values(FIELD_ALIASES)).size). No test file references FIELD_HELP.
- **Two parsed filters have no consumer anywhere in the repo: lang: and source:.**
  - `src/lib/sourcing/query-language.ts` · `SourcingBrief`
  - brief.languages is written at query-language.ts:623 and read nowhere else (grep for 'brief.languages' across src, artifact-src, tests, scripts, eval returns only that write). brief.sources is written at line 590 and likewise has no reader; rank.ts:771 'b.sources' is a RankedPerson field, not the brief. By contrast brief.seniority is consumed by rank.ts:426-454 and 672, brief.industries by rank.ts:480-495 and angles.ts:433, brief.artifactTypes by angles.ts:466-467 and rank.ts:582-588, brief.intext/intitle/inurl by angles.ts:535-539, brief.names by global-search.ts:79 and structured-sources.ts:33.
- **No parser copy exists in the browser extension, and the Python original referenced in the header is not in this repo.**
  - `src/lib/sourcing/query-language.ts`
  - rg for parseQuery/skill:/loc: across browser-extension/ returns nothing; find for _.py across the repo (excluding node_modules) returns nothing. The file header cites 'Ported from Hu (app/query/parser.py)'. find for query-language_ returns exactly one file.

**Could not determine:**

- Whether lang: and source: are intentionally reserved for future use or are dead filters — the source carries no comment either way, and no BACKLOG entry was checked.
- Whether tests/e2e/sourcing.spec.ts and tests/e2e-artifact/artifact.spec.ts currently pass — I did not run them (read-only recon, no test execution).
- artifact-src/core/facets.ts could not be grepped as text (rg reports it as binary, NUL byte around offset 2111), so I cannot rule out token-parsing code inside it; every other artifact-src/core file was read or grepped and none parses field:value.
- Whether the compiled parser inside artifact/talentos-lite.html is byte-current with src/lib/sourcing/query-language.ts — package.json has a build:artifact:check step in `verify`, but I did not run it.

## 6 — Time and events

Every timestamp is an ISO-8601 TEXT column and the only event table is `pipeline_events`. That decides which elapsed-day metrics are computable from what already exists and which need events emitted first — the list below is explicit about both.

> Every timestamp in /Users/christoler/talentos-connected-review/talentos/src/lib/db/schema.ts is a SQLite TEXT column holding an ISO-8601 string; there is no integer-epoch or DATETIME column anywhere, and the only event table in the whole schema is `pipeline_events` (stage moves). Stage-to-stage elapsed days, candidate-added-to-first-move, outreach send-to-reply on a single message, task cycle time, crew/AI job durations and document-review turnaround are all computable from columns that already exist. Time-to-fill, disposition timing (reject/withdraw/hire), scorecard turnaround, offer-to-actual-start, and any multi-touch response latency are NOT computable today because no timestamp is written for those transitions — they would need new columns or new event rows.

- **Job (search project) — creation and last-touch timestamps; the only 'job age' anchors that exist**
  - `src/lib/db/schema.ts` · `searchProjects`
  - search_projects.created_at TEXT NOT NULL (line 133, default new Date().toISOString()); search_projects.updated_at TEXT NOT NULL (line 134). No opened_at, no closed_at, no status_changed_at.
- **Job — the only forward-looking date on a requisition is a plan, not an event**
  - `src/lib/db/schema.ts` · `searchProjects.targetStartDate`
  - search_projects.target_start_date TEXT nullable (line 123). search_projects.status TEXT NOT NULL default 'open' (line 118) is one of open|on_hold|closed per SEARCH_STATUSES in src/lib/core/enums.ts:138 — and carries no timestamp of its own.
- **Job — per-artifact created/updated pairs, all TEXT ISO strings**
  - `src/lib/db/schema.ts` · `jobDescriptions, hiringManagers, roleIntelligence, intakeSessions, successProfiles, roleKnowledge, marketResearch, sourcingStrategies, screenGuides, interviewPlans, hmBriefs, hiringIntelligence, closePlans, onboardingPlans`
  - job_descriptions.created_at (147); hiring_managers.created_at (159); role_intelligence.created_at/updated_at (174-175); intake_sessions.created_at/updated_at (189-190); success_profiles.created_at/updated_at (203-204); role_knowledge.created_at/updated_at (215-216); market_research.created_at/updated_at (229-230); sourcing_strategies.created_at/updated_at (245-246); screen_guides.created_at/updated_at (556-557); interview_plans.created_at/updated_at (570-571); hm_briefs.created_at/updated_at (791-792); hiring_intelligence.created_at/updated_at (761-762); close_plans.created_at/updated_at (665-666); onboarding_plans.created_at/updated_at (686-687).
- **Job — sourcing surface verification and query-run ledger carry real event times**
  - `src/lib/db/schema.ts` · `sourceChannels, searchQueries, searchQueryRuns`
  - source_channels.verified_at TEXT nullable (267) plus created_at/updated_at (273-274); search_queries.created_at/updated_at (305-306); search_query_runs.ran_at TEXT NOT NULL default now (330) — search_query_runs has NO created_at/updated_at, ran_at is the only time on the row.
- **Job — periodic stage counts are stored, but as counts per window, not per-candidate durations**
  - `src/lib/db/schema.ts` · `pipelineSnapshots`
  - pipeline_snapshots.period_start TEXT NOT NULL (936), period_end TEXT NOT NULL (937), observed_at TEXT NOT NULL (940), created_at (942); counts is JSON Record<string,number> (938-939). Individual dwell times cannot be recovered from these.
- **Job — research, AI-generation and crew-orchestration timing**
  - `src/lib/db/schema.ts` · `researchSources, aiGenerations, crewJobs, searchLearnings, hsalBindings, hsalSearchLearnings, settings`
  - research_sources.retrieved_at TEXT NOT NULL default now (738), created_at (743); ai_generations.created_at (778) and ai_generations.duration_ms INTEGER NOT NULL (772) — the only non-TEXT time value in the schema; crew_jobs.started_at TEXT nullable (832), finished_at TEXT nullable (833), created_at/updated_at (834-835); search_learnings.created_at (703); hsal_bindings.created_at/updated_at (925-926); hsal_search_learnings.created_at (967); settings.updated_at (841).
- **Candidate — creation, last-touch, a due date, and the Article 14 notice timestamp**
  - `src/lib/db/schema.ts` · `candidates`
  - candidates.created_at TEXT NOT NULL (368); candidates.updated_at TEXT NOT NULL (369); candidates.next_action_due TEXT nullable (355); candidates.notice_resolved_at TEXT nullable (366) paired with notice_resolution (365). candidates.stage TEXT NOT NULL default 'research' (341) and candidates.disposition TEXT NOT NULL default 'active' (342-345) have NO timestamp columns of their own.
- **Candidate — hiring-manager feedback carries its own timestamp inside JSON, not as a column**
  - `src/lib/core/payloads.ts` · `hmFeedbackEntrySchema`
  - candidates.hm_feedback is JSON HmFeedbackEntry[] (schema.ts:348-351); each entry is { at: string; decision: 'advance'|'hold'|'pass'; evidenceNote: string } at payloads.ts:677-681. The `at` is not queryable as a column.
- **Candidate — profile-source rows record four distinct times with different meanings**
  - `src/lib/db/schema.ts` · `candidateSources`
  - candidate_sources.asserted_at TEXT nullable (392, the platform's own assertion time); retrieved_at TEXT nullable (394, when a structured API was read); confirmed_at TEXT nullable (396, set only when the person themselves confirmed) with confirmed_via (397); created_at (402).
- **Candidate — discovery evidence, registry matches and suppressions are all time-stamped**
  - `src/lib/db/schema.ts` · `candidateSourceEvidence, candidateRegistryMatches, profileSuppressions, candidateEvidence`
  - candidate_source_evidence.retrieved_at TEXT NOT NULL default now (443) and created_at (459); candidate_registry_matches.matched_at TEXT NOT NULL default now (483) and created_at (487); profile_suppressions.recorded_at TEXT NOT NULL default now (417) and created_at (421); candidate_evidence.created_at/updated_at (508-509).
- **Candidate — document pipeline timestamps (CV/JD versions, comparisons, links, reviews)**
  - `src/lib/db/schema.ts` · `documentVersions, documentComparisons, documentLinks, documentReviews, candidatePackets`
  - document_versions.created_at (863); document_comparisons.created_at (885); document_links.created_at (901); document_reviews.created_at (911); candidate_packets.created_at/updated_at (808-809). Each is created_at only — no updated_at on the version/comparison/link/review rows.
- **Candidate — planned start date is a plan with a boolean confirmation and no confirmation time**
  - `src/lib/db/schema.ts` · `onboardingPlans`
  - onboarding_plans.start_date TEXT nullable (681); onboarding_plans.start_confirmed INTEGER boolean NOT NULL default false (682-684). Nothing records WHEN start_confirmed flipped, or whether the person actually started.
- **Stage change — pipeline_events.occurred_at is the single stage-transition timestamp in the system**
  - `src/lib/db/schema.ts` · `pipelineEvents`
  - pipeline_events columns: id, search_project_id, candidate_id, from_stage TEXT nullable, to_stage TEXT NOT NULL, occurred_at TEXT NOT NULL default new Date().toISOString() (line 630), note. Verified against the live DB with PRAGMA table_info(pipeline_events) on data/talentos.db — same seven columns. There is no created_at, so 'when it happened' and 'when it was recorded' cannot be distinguished, and a move that happened yesterday cannot be backdated through the writer.
- **Stage change — the pipeline_events row is written on exactly two code paths, both in the candidates service**
  - `src/lib/services/candidates.ts` · `createCandidate, moveCandidateStage`
  - createCandidate inserts an arrival event with fromStage: null (candidates.ts:128-135); moveCandidateStage updates candidates.stage then inserts fromStage/toStage (candidates.ts:214-224) and early-returns when the stage is unchanged (line 212). Bulk import goes through createCandidate (src/lib/services/imports.ts:168-188), so it emits an event too. Grep of src/lib/services for `stage:` finds no third writer of candidates.stage.
- **Stage change — pipeline_stages, the stage definition table, has no timestamp at all**
  - `src/lib/db/schema.ts` · `pipelineStages`
  - pipeline_stages columns are id, search_project_id, key, label, position, is_terminal (lines 604-616). Stage-list edits are untracked in time.
- **Outreach send — only two nullable timestamps exist per message, and no send history**
  - `src/lib/db/schema.ts` · `outreachMessages`
  - outreach_messages.sent_at TEXT nullable (540); replied_at TEXT nullable (541); created_at (542); updated_at (543); status TEXT NOT NULL default 'drafted' (539). outreach_sequences carries only created_at/updated_at (526-527).
- **Outreach send — sent_at and replied_at are written only on the transition into that exact status, so a skipped status leaves a permanent null**
  - `src/lib/services/workflow.ts` · `updateOutreachStatus`
  - workflow.ts:246-255 sets sentAt: input.status === 'sent' ? now : undefined and repliedAt: input.status === 'replied' ? now : undefined. A message moved drafted -> replied never gets a sent_at; a message moved replied -> no_reply keeps a stale replied_at. Status is one mutable column, so the drafted/sent/replied sequence is not retained.
- **Decision — offer timing is recorded, but 'resolved' conflates accepted, declined and withdrawn**
  - `src/lib/db/schema.ts` · `offers`
  - offers.extended_at TEXT nullable (646); offers.resolved_at TEXT nullable (647); created_at/updated_at (648-649); status default 'preparing' (645). Written in src/lib/services/workflow.ts:193-196: extendedAt set when status === 'extended', resolvedAt set when status is one of accepted|declined|withdrawn. Distinguishing a hire from a decline requires reading offers.status alongside resolved_at.
- **Decision — scorecards have no submission timestamp**
  - `src/lib/db/schema.ts` · `scorecards`
  - scorecards.status is 'draft'|'submitted' (592-595) but the table carries only created_at/updated_at (601-602). updated_at is overwritten by any later edit of a submitted card, so the moment of submission is not recoverable. There is also no timestamp anywhere for 'the interview happened' — scorecards.stage_name is a label and interview_plans is a plan document.
- **Decision — document review accept/dismiss is time-stamped**
  - `src/lib/db/schema.ts` · `documentReviews`
  - document_reviews.decision TEXT NOT NULL ('accepted'|'dismissed'), actor, note, created_at (905-912). This is the one decision type with a clean single decision timestamp.
- **Decision — candidate disposition changes (not_selected, withdrawn, hired) leave no timestamp**
  - `src/lib/services/candidates.ts` · `updateCandidate`
  - candidates.disposition is in updateCandidateInput (candidates.ts:155-157) and updateCandidate writes only { ...fields, updatedAt } (candidates.ts:188-192). candidates.updated_at is then clobbered by every subsequent edit, so 'when was this person rejected/withdrawn/hired' is unrecoverable.
- **Task timing exists end to end**
  - `src/lib/db/schema.ts` · `tasks`
  - tasks.due_at TEXT nullable (714); tasks.created_at (722); tasks.completed_at TEXT nullable (723); status 'open'|'done' (721).
- **COMPUTABLE TODAY — stage-to-stage elapsed days and current-stage dwell**
  - `src/lib/db/schema.ts` · `pipelineEvents.occurredAt`
  - Order pipeline_events by occurred_at per candidate; the gap between consecutive rows is time-in-stage, and (now - last occurred_at) is current dwell. No new event type is required. Caveat is data, not schema: the live data/talentos.db holds 7 candidates and 1 pipeline_events row, and 6 candidates sit in hm_review/recruiter_screen/interviewing with no arrival event, so historic dwell is null for them; candidates.created_at is the only fallback anchor.
- **COMPUTABLE TODAY — candidate-added to first stage move, and candidate-added to first outreach send**
  - `src/lib/db/schema.ts` · `candidates.createdAt`
  - candidates.created_at -> MIN(pipeline_events.occurred_at WHERE from_stage IS NOT NULL) gives time-to-first-move. candidates.created_at -> MIN(outreach_messages.sent_at) gives time-to-first-contact, wherever sent_at was actually written.
- **COMPUTABLE TODAY (single-message only) — time-to-first-response**
  - `src/lib/db/schema.ts` · `outreachMessages.sentAt, outreachMessages.repliedAt`
  - replied_at - sent_at on one row is the only response-latency this schema can express. It breaks whenever the reply follows a different message in the sequence than the one marked replied, when a second reply arrives, or when sent_at was never written (drafted -> replied). In data/talentos.db all 7 outreach_messages are status 'drafted' with sent_at and replied_at NULL, so no response time exists yet in practice.
- **COMPUTABLE TODAY — task cycle time, sourcing cadence, model/crew durations, document-review turnaround**
  - `src/lib/db/schema.ts` · `tasks.completedAt, searchQueryRuns.ranAt, crewJobs.startedAt, aiGenerations.durationMs, documentReviews.createdAt`
  - tasks.created_at -> completed_at, and completed_at vs due_at for lateness; search_query_runs.ran_at for run-to-run gaps; crew_jobs.started_at -> finished_at; ai_generations.duration_ms directly; document_comparisons.created_at -> document_reviews.created_at.
- **COMPUTABLE TODAY (partially) — job age and time-to-offer-accept, but not time-to-fill**
  - `src/lib/services/job-movement.ts` · `deskMovement`
  - job-movement.ts:100 already treats search_projects.created_at as the job's opening (`const opened = job.createdAt ?? now`) and passes it to jobClock (artifact-src/core/clock.ts, which computes daysElapsed/daysLeft against target_start_date). So job age and days-vs-agreed-window are computable now, and search_projects.created_at -> offers.resolved_at (filtered to offers.status = 'accepted') gives time-to-offer-accept.
- **NOT COMPUTABLE — time-to-fill in the requisition sense (open -> closed/filled)**
  - `src/lib/db/schema.ts` · `searchProjects.status`
  - search_projects has no closed_at or status_changed_at, and updated_at is overwritten by every subsequent edit (src/lib/services/search-projects.ts:144 accepts status in the update input with no timestamp write). A new column or a job-status event row would have to be emitted first. onboarding_plans.start_date is a plan and start_confirmed is a boolean with no confirmed-at, so 'the hire actually started on date X' is also unrecorded.
- **NOT COMPUTABLE — time-to-reject, time-to-withdraw, time-to-hire-decision**
  - `src/lib/db/schema.ts` · `candidates.disposition`
  - disposition transitions write no timestamp anywhere. Would need either a disposition_changed_at column or a disposition event row. Note this is separate from stage: a candidate can be marked not_selected without any pipeline_events row being written, because moveCandidateStage is a different call from updateCandidate.
- **NOT COMPUTABLE — scorecard turnaround and interview-to-decision latency**
  - `src/lib/db/schema.ts` · `scorecards.status`
  - No submitted_at on scorecards, and no timestamp at all for the interview event itself. Both an interview-occurred event and a scorecard-submitted timestamp would have to be emitted first.
- **NOT COMPUTABLE — multi-touch outreach latency, per-step send cadence, and sequence completion time**
  - `src/lib/db/schema.ts` · `outreachMessages`
  - Two nullable columns on a mutable-status row cannot represent nth-message -> reply, a second reply, a bounce, or a re-send. An outreach_events table (message_id, kind, occurred_at) would be required.
- **NOT COMPUTABLE — time a job spent on hold, and any stage-definition change history**
  - `src/lib/db/schema.ts` · `searchProjects.status, pipelineStages`
  - open/on_hold/closed transitions are not logged; pipeline_stages rows have no timestamps, so a stage renamed or reordered mid-search silently rewrites the meaning of past pipeline_events.to_stage values.

**Could not determine:**

- Whether elapsed-day metrics are surfaced anywhere in the UI: I found only src/lib/services/job-movement.ts (deskMovement) and artifact-src/core/clock.ts (jobClock) doing day math, and neither computes time-in-stage or response latency — movementReading is an event-density measure. I did not read every page component, so a UI-side computation may exist that I did not see.
- Whether any code path outside src/lib/services writes candidates.stage directly (e.g. a route handler or script). I grepped src/lib/services for `stage:` and found only candidates.ts:215 and imports.ts:185 (which routes through createCandidate); I did not grep the whole repo including scripts/ and tests/.
- artifact-src/core/movement.ts contents — I confirmed the file exists and read clock.ts, but did not read movement.ts in full, so I cannot state exactly what movementReading returns beyond its use in job-movement.ts.
- The 6-of-7-candidates-with-no-arrival-event gap in data/talentos.db is most likely seeded data predating the createCandidate event insert, but I did not read src/lib/db/seed.ts to confirm the seeder bypasses createCandidate.

## 7 — Tags and graph

Tags are text, parsed at read time, with no table anywhere — the doctrine holds in the code. Neo4j is not touched at boot and the app degrades to a status card without it.

> Tags are parsed out of free text at read time by `parseTagRefs`/`tagsIn` in src/lib/core/tags.ts; there is no tag table in the Drizzle schema and none in data/talentos.db. The graph exists twice: an in-process projection rebuilt from SQLite per search (`knowledgeGraph`), and an optional Neo4j mirror written by `syncGraph`, driven either by scripts/graph-sync.mts or the `syncGraphAction` server action. Neo4j is not touched at boot — src/lib/db/client.ts has no Neo4j import and `globalGraphView` returns a "not configured"/"unreachable" state instead of throwing — so with Neo4j stopped only /graph degrades to a status card.

- **Tag syntax is parsed out of prose here; this is the only parser.**
  - `src/lib/core/tags.ts` · `parseTagRefs, tagsIn, segmentTagText, tagSlug, tagTitle, tagIsAllowed`
  - `parseTagRefs` recognises three forms (`#word`, `[[two words]]`, `#[[two words]]`), longest-first, and masks URLs, `www.` addresses and backtick code before matching so `example.com/#section` is not a tag. `tagsIn` dedupes to slug+display, `segmentTagText` splits for rendering. `tagSlug` canonicalises (`C#` -> `c-sharp`, bare numbers rejected).
- **The fair-hiring gate on tags is `tagIsAllowed`, and it reads its patterns from the fair-hiring module rather than restating them.**
  - `src/lib/core/tags.ts` · `tagIsAllowed`
  - Tests both the slug and a space-normalised form against BLOCKED_FIELD_PATTERNS and BLOCKED_IMPORT_HEADER_PATTERNS imported from @/lib/domain/fair-hiring. Applied inside parseTagRefs, and again in suggestCandidateTags and suggestTagsFromEvidence before anything is offered.
- **The tag index is a full scan of six named prose columns across five tables, run on every read.**
  - `src/lib/services/tags.ts` · `scanTagMentions, listTags, tagPage`
  - `scanTagMentions` selects search_projects (recruiter_notes, business_objective), candidates (recruiter_notes), search_learnings (text), candidate_sources (why_note), source_channels (why_relevant, note). All six columns verified present via PRAGMA table_info on data/talentos.db. `listTags` and `tagPage` group that scan; there is no cache.
- **No tag table exists in the schema.**
  - `src/lib/db/schema.ts`
  - src/lib/db/schema.ts declares 47 sqliteTable calls and none is tag-related (grep -i tag hits only `stage`/`stageName`/`pipeline_stages`). `SELECT name FROM sqlite_master WHERE name LIKE '%tag%'` on data/talentos.db returns only pipeline_stages and its autoindex.
- **Accepting a suggested tag writes the word into recruiter notes, not into a table.**
  - `src/lib/services/tags.ts` · `appendTagToNotes`
  - `appendTagToNotes` appends `#word` or `[[two words]]` on its own line and is a no-op if the slug is already present, so a derived tag is deleted the same way a typed one is.
- **Two tag-suggestion paths exist: one needs a model key, one does not.**
  - `src/lib/sourcing/auto-tags.ts` · `suggestTagsFromEvidence, tagsAsText`
  - `suggestCandidateTags` calls runAiTask(candidateTagsTask). `readTagsFromEvidence` wraps `suggestTagsFromEvidence`, which derives tags from a person's claims (capability matches, locations, employment organisations, artifact types) with no provider and returns evidence quotes plus a confidence blending claim strength and cross-domain corroboration.
- **The graph is synchronised to Neo4j from two entry points, both calling the same writer.**
  - `src/lib/services/global-graph.ts` · `syncWholeGraph, globalGraphView, HOW_TO_START`
  - scripts/graph-sync.mts (`pnpm graph:sync`, package.json line 26) loops listSearchProjects -> knowledgeGraph -> syncGraph. `syncWholeGraph` in src/lib/services/global-graph.ts does the same loop and is called by the `syncGraphAction` server action in src/lib/actions/graph-sync.ts, surfaced as a button in src/components/global-graph.tsx.
- **The actual Neo4j writes are UPSERT_NODES / UPSERT_EDGES plus a per-search edge prune, in one transaction.**
  - `src/lib/graph/store.ts` · `syncGraph, UPSERT_NODES, UPSERT_EDGES, RELATIONSHIP_TYPES, relationshipType`
  - MERGE runs against the static `:Entity` label then attaches the kind label via `SET n:$(row.label)`. Relationship types come from the fixed RELATIONSHIP_TYPES allow-list; anything else becomes RELATED_TO. Tag nodes are written with searchProjectId null deliberately. The prune deletes edges incident to this search's nodes whose id is not in the current projection.
- **Neo4j is not required at boot: the SQLite client has no Neo4j import at all.**
  - `src/lib/db/client.ts` · `getDb, createDb`
  - src/lib/db/client.ts imports only better-sqlite3, drizzle, the migrator and backfillLegacyDocuments. Its only failure mode is the pending-migration guard, unrelated to Neo4j.
- **With Neo4j stopped, the app renders a status card; nothing throws on the read path.**
  - `src/lib/services/global-graph.ts` · `globalGraphView`
  - `neo4jSettings` returns null unless NEO4J_URI and NEO4J_PASSWORD are both set. `neo4jReachable` catches and returns {ok:false,detail}. `globalGraphView` returns configured:false or configured:true/reachable:false with `howToStart`, and only calls graphCounts()/wholeGraph() after reachable:true. src/app/graph/page.tsx renders whatever comes back. Per-job graph pages and every tag page read SQLite only.
- **The write path does throw when Neo4j is unconfigured, but it is gated behind `configured` and wrapped in an error envelope.**
  - `src/lib/graph/driver.ts` · `getDriver, neo4jSettings, neo4jConfigured, neo4jReachable`
  - `syncWholeGraph` -> `ensureSchema` -> `getDriver`, which throws "Neo4j is not configured…" when settings are null. The Sync button in src/components/global-graph.tsx is rendered only when `graphView.configured`, and `act` converts any throw into {ok:false,kind:'error'}. scripts/graph-sync.mts prints a message and exits 0 when unconfigured, exits 1 when configured-but-unreachable.
- **Unpaired/unreachable is asserted as a non-failure by a unit test.**
  - `tests/unit/global-graph.test.ts`
  - Asserts configured:false and reachable:false without throwing, and configured:true/reachable:false against bolt://127.0.0.1:59999, plus that HOW_TO_START pins neo4j:2026.07.1 and mounts a volume.
- **Neo4j is currently configured on this machine.**
  - `.env`
  - NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD and NEO4J_DATABASE are all set in .env (lines 90-93). Values not read out. Whether the container is running was not checked — no process was started.
- **In-process traversal is a BFS over an adjacency map built from the per-search projection; it needs nothing installed.**
  - `src/lib/core/knowledge-graph.ts` · `graphAdjacency, graphNeighbours, graphWithin, graphKinds, graphNodeId`
  - `graphAdjacency` files every edge under both ends (bi-directional at the data level); `graphWithin` does breadth-first expansion to a depth with shortest path retained. jobContext calls graphWithin(depth 2).
- **Only one shipped query is genuinely traversal-shaped, and its sole caller is the CLI script.**
  - `src/lib/graph/store.ts` · `within, withinQuery, neighbours, tagCarriers, wholeGraph`
  - `within` (shortestPath, variable hop bound 1..5) is called only from scripts/graph-sync.mts line 72. `neighbours` (store.ts:247) is exported and has no caller anywhere in src or scripts. `TAG_CARRIERS` is a single hop — equivalent to a join — and is also only called from graph-sync.mts. `wholeGraph` and `graphCounts` are a full dump and counts, not traversal.
- **The cross-search tag questions the docs cite as justifying Neo4j are answered in SQLite today, without it.**
  - `src/lib/services/page-context.ts` · `pageContext, tagContext, jobContext, deskContext, noteContext`
  - `tagPage` computes carriers and co-occurring tags (a two-hop tag->holder->tag walk) by grouping one in-memory scan; `tagContext` and `deskContext` in page-context.ts build the panel graph the same way. These are group-bys over a scan, not variable-depth traversal — a tag table would make them ordinary SQL joins. The genuinely traversal-shaped need is jobContext's depth-2 walk over heterogeneous node kinds, and that already runs in process.
- **The per-job graph and the tag index disagree about which prose columns carry tags.**
  - `src/lib/services/knowledge-graph.ts` · `knowledgeGraph`
  - `knowledgeGraph`'s `mentionTag` is called for search recruiterNotes, search businessObjective, candidate recruiterNotes and channel whyRelevant/note — four of the six. search_learnings.text and candidate_sources.why_note are scanned by scanTagMentions but never produce a tag edge in the graph, so a tag written only in a learning or a why-note appears on its tag page and in backlinks but not in the per-job or Neo4j graph.
- **Tags written in a daily note are parsed but never indexed.**
  - `src/lib/services/daily.ts` · `readDailyNote, writeDailyNote`
  - page-context.ts line 397 calls tagsIn(readDailyNote(db, day)), so the note's words drive the panel. Daily notes live in the `settings` table under key `daily:<YYYY-MM-DD>` (readDailyNote, src/lib/services/daily.ts:47), which scanTagMentions does not read. A tag written only in a daily note therefore has zero mentions on its own tag page. Two `daily:%` rows exist in data/talentos.db.
- **`TagHolderKind` includes a value that is not a valid `GraphKind`, and it is cast rather than mapped.**
  - `src/lib/services/page-context.ts` · `pageContext`
  - TagHolderKind is search|candidate|learning|source|channel; graphKinds is search|candidate|requirement|document|comparison|channel|source|tag — no "learning". page-context.ts casts `mention.kind as GraphKind` at lines 124, 214 and 422, so a learning mention becomes a node with kind "learning". Not synced to Neo4j (page-context is never fed to syncGraph), so `labelFor` — which throws on an unknown kind — is not reached; the effect is confined to the panel renderer.
- **Most edge labels the projection emits are not in the Neo4j relationship allow-list and land as RELATED_TO.**
  - `src/lib/graph/store.ts` · `RELATIONSHIP_TYPES, relationshipType`
  - RELATIONSHIP_TYPES covers seven labels. knowledgeGraph also emits "has source channel", "references research", "has comparison", "references CV version", "references JD version", "revised as", "owns CV version"/"owns JD version" and per-evidence labels like "<assessment> · <decision> · current". `relationshipType` maps each to RELATED_TO, preserving the readable label on r.label only.
- **The design intent is recorded as a decision.**
  - `docs/DECISIONS.md` · `D-042`
  - D-042 (2026-09-07) states Neo4j is optional, that every traversal still runs in process, and gives the MERGE-on-:Entity rationale. Line 1849 notes the store held 277 records reachable only from a CLI script.

**Could not determine:**

- Whether the Neo4j container is actually running right now — .env is populated but I did not start a process, open a socket, or run pnpm graph:sync, so reachability is CANNOT-DETERMINE from source alone.
- Whether the panel renderer handles kind "learning" gracefully — I read page-context.ts and core/knowledge-graph.ts but did not read the graph drawing components (src/components/knowledge-graph.tsx, src/components/global-graph.tsx) beyond grepping for gating, so the visual effect of the invalid GraphKind is unverified.
- Whether the search_learnings / candidate_sources omission from mentionTag is deliberate. Nothing in the D-039 comment block in src/lib/services/knowledge-graph.ts or in docs/DECISIONS.md explains the four-of-six choice; the tags.ts header explicitly names all six as the set that matters.

## 8 — The guardrail test

A filesystem walk over `src/` matched against a hand-maintained pattern list, with exactly one exemption. Note what is **outside** the walk.

> The guardrail is `tests/unit/fair-hiring.test.ts` driving `BLOCKED_FIELD_PATTERNS` from `src/lib/domain/fair-hiring.ts`. It does not read the schema file specifically and does not use the TypeScript AST — it walks the filesystem recursively from the repo root's `src/` directory, collects every `.ts`/`.tsx` file, and regex-matches each file's whole text against a hand-maintained pattern list, failing on any hit. There is exactly one exemption, `domain/fair-hiring.ts`, because that module has to spell the words it bans.

- **The guardrail test file exists at the expected path and is 4933 bytes / 129 lines.**
  - `tests/unit/fair-hiring.test.ts`
  - Four describe blocks: "schema and payload definitions", "scanTextForProtectedTraits" (3 its), and "the recruiter-edit boundary" (3 its).
- **The build-failing assertion is a single `expect(violations).toEqual([])` over every regex hit found across the source tree.**
  - `tests/unit/fair-hiring.test.ts`
  - Lines 32-47 verbatim:
    it("contain no protected-characteristic field names", () => {
    const files = collectSourceFiles(join(root, "src")).filter(
    (f) => !exempt.some((e) => f.endsWith(e)),
    );
    const violations: string[] = [];
    for (const file of files) {
    const content = readFileSync(file, "utf8");
    for (const pattern of BLOCKED_FIELD_PATTERNS) {
    const match = pattern.exec(content);
    if (match) {
    violations.push(`${file}: "${match[0]}" (${pattern})`);
    }
    }
    }
    expect(violations).toEqual([]);
    });
- **Discovery is a filesystem walk, NOT a schema-file read and NOT an AST or drizzle-introspection pass.**
  - `tests/unit/fair-hiring.test.ts` · `collectSourceFiles`
  - Lines 14-26: `const root = join(__dirname, "..", "..")` (repo root), then a local recursive walker using node:fs `readdirSync`/`statSync`, pushing any entry matching `/\.(ts|tsx)$/`. It recurses unconditionally into every subdirectory — there is no node_modules/dist/.next skip, which is safe only because `src/` contains none. Non-TS files (.sql migrations, .json, .md) are never read.
- **The scan root is `src` only. `artifact-src/`, `scripts/`, `tests/`, `packages/`, `browser-extension/`, and the generated `drizzle/` SQL are all outside the walk.**
  - `tests/unit/fair-hiring.test.ts`
  - Line 33: `collectSourceFiles(join(root, "src"))`. `find src -name '*.ts' -o -name '*.tsx'` returns 343 files, so that is the whole population under test. `artifact-src/` is a sibling top-level directory and does import the guard (artifact-src/ai/tasks.ts:8, artifact-src/ui/shell.ts:22) but is not itself grepped.
- **The patterns list is a plain exported array of 18 word-bounded RegExps, maintained by hand.**
  - `src/lib/domain/fair-hiring.ts` · `BLOCKED_FIELD_PATTERNS`
  - Lines 29-48: race, ethnicity, religion, gender, disability, national_?origin / nationalOrigin, sexual_?orientation / sexualOrientation, pregnan, marital, family_?status / familyStatus, veteran, date_?of_?birth / dateOfBirth, birth_?date, political. All /i except the three camelCase ones (nationalOrigin, sexualOrientation, familyStatus, dateOfBirth), which are case-sensitive.
- **`age` and `sex` are NOT in BLOCKED_FIELD_PATTERNS — they live only in a second list applied to vendor import headers, so a source file may legally contain those words.**
  - `src/lib/domain/fair-hiring.ts` · `BLOCKED_IMPORT_HEADER_PATTERNS`
  - Lines 57-68: age, sex, dob, nationality, citizenship, photo, picture, avatar, birth, ethnic. This list is not used by the fair-hiring grep test at all; it is consumed by src/lib/imports/scan.ts:29 and src/lib/core/tags.ts:104, and asserted against option copy in tests/unit/job-fields.test.ts:118-119.
- **There is exactly one exemption, and the stated reason is that the guardrail module necessarily names the traits it blocks.**
  - `tests/unit/fair-hiring.test.ts` · `exempt`
  - Lines 29-30 verbatim:
    // The guardrail module itself necessarily names the traits it blocks.
    const exempt = [join("domain", "fair-hiring.ts")];
    Matched by suffix (`f.endsWith(e)`), so any file at any path ending `domain/fair-hiring.ts` is skipped. The same rationale is restated in the source at src/lib/domain/fair-hiring.ts:54-55 ("Kept in this file on purpose: it is the only module allowed to spell these words").
- **Consuming modules stay clean by importing the symbols rather than re-spelling the words, which is why one exemption suffices.**
  - `src/lib/imports/scan.ts` · `BLOCKED_FIELD_PATTERNS`
  - src/lib/imports/scan.ts:9-11 and src/lib/core/tags.ts:25-26 import BLOCKED_FIELD_PATTERNS / BLOCKED_IMPORT_HEADER_PATTERNS / scanTextForProtectedTraits and spread them; they never write a trait word literally.
- **The second describe block asserts the runtime text scanner's behaviour, including a regression the comment attributes to W12 inspection.**
  - `tests/unit/fair-hiring.test.ts` · `scanTextForProtectedTraits`
  - Assertions, lines 50-80:
    expect(hits.map((h) => h.trait)).toContain("religion");
    expect(hits.map((h) => h.trait)).toContain("pregnancy/family status");
    expect(scanTextForProtectedTraits("Prefers a male candidate; note gender.").map((h) => h.trait)).toContain("sex/gender identity");
    expect(scanTextForProtectedTraits("Record the applicant's sex.").map((h) => h.trait)).toContain("sex/gender identity");
    expect(hits).toEqual([]); // for ordinary professional evidence
    Comment at 60-62: "PROTECTED_TRAITS and BLOCKED_FIELD_PATTERNS both covered gender, but the text scanner had no pattern for it, so the deterministic guard could not catch it."
- **The third describe block is a source-text grep of the recruiter-edit server action, not a behavioural test — it reads workflow.ts as a string to avoid importing a server action.**
  - `tests/unit/fair-hiring.test.ts`
  - Lines 98-128. Assertions verbatim:
    const direct = [...source.matchAll(/(\w+Schema)\.parse\(raw\)/g)].map((m) => m[1]);
    expect(direct).toEqual([]);
    expect(source).toContain("scanPayloadForProtectedTraits(saved)");
    expect(source).not.toContain("scanPayloadForProtectedTraits(raw)");
    expect(source).toContain("warnings: scanPayloadForProtectedTraits");
    expect(source).not.toMatch(/throw[^;]*scanPayloadForProtectedTraits/);
    Rationale in the block comment (lines 83-97): the guard previously ran only on model output via runAiTask, not on the "Edit JSON" boundary a person types into.
- **The asserted strings genuinely exist in the target file; the one sanctioned parse path is lowercase `schema.parse(raw)` inside a helper, which the capital-S regex deliberately does not match.**
  - `src/lib/actions/workflow.ts` · `saveArtifactJsonAction`
  - Line 92: `return ensureIds(schema.parse(raw));` inside the `checked` helper. Lines 211, 219, 231 return `{ warnings: scanPayloadForProtectedTraits(payload) }` / `(saved)`. Note the intake branch (211) scans `payload` rather than `saved`; the test only forbids the literal `(raw)`.
- **A hit is a warning, never a block: hits ride out in the success envelope as `warnings`.**
  - `src/lib/actions/workflow.ts` · `saveArtifactJsonAction`
  - Signature at line 199: `): Promise<ActionResult<{ warnings: TraitScanHit[] }>> {`. Matching comment in src/lib/domain/fair-hiring.ts:106-110 — "A hit is a review flag, not a hard block".
- **Two sibling grep-style guardrail tests exist beyond fair-hiring.test.ts and reuse the same pattern lists.**
  - `tests/unit/job-fields.test.ts` · `BLOCKED_IMPORT_HEADER_PATTERNS`
  - tests/unit/job-fields.test.ts:111-126 asserts no job-field option value/label/hint matches any pattern from either list. tests/unit/surface-families.test.ts:191-207 asserts every string in FAMILY_WARNINGS / FAMILY_NOTES / FAMILY_BADGE_SUFFIX / SURFACE_FAMILY_LABELS / NOT_A_PERSON_MESSAGE produces zero scanTextForProtectedTraits hits.
- **The test's own header comment cites the wrong ARCHITECTURE.md section number.**
  - `tests/unit/fair-hiring.test.ts`
  - Line 2: "the enforcement half of ARCHITECTURE.md §8". ARCHITECTURE.md:285 §8 is "Naming abstraction"; fair hiring is §10 "Fair hiring — enforcement, not policy" at ARCHITECTURE.md:312-329, which describes the grep at line 318.
- **"Fails the build" means the vitest unit suite; enforcement is local only — there is no CI workflow and no git hook in this repo.**
  - `package.json`
  - `"test": "vitest run"` and `"verify": "pnpm format:check && pnpm typecheck && pnpm lint && pnpm build:artifact:check && pnpm test && pnpm build && pnpm check:private-build"`. vitest.config.mts includes only `tests/unit/**/*.test.ts`. No `.github` directory in the package; the git root is /Users/christoler/talentos-connected-review and `git rev-parse --git-dir`/hooks contains no non-sample hooks, and there is no .husky.

**Could not determine:**

- Whether the src-only scan root is deliberate or an oversight: artifact-src/ ships the same product surface (artifact-src/ai/tasks.ts, artifact-src/ui/shell.ts, artifact-src/core/defect-checks.ts all import the guard) but no test greps its source for blocked field names. I looked at tests/unit/fair-hiring.test.ts line 33, the collectSourceFiles walker, and grepped tests/ for any other caller of BLOCKED_FIELD_PATTERNS — only job-fields.test.ts, which tests option copy, not files.
- Whether the drizzle-generated SQL under drizzle/ is covered anywhere. The walker filters to /\.(ts|tsx)$/ so .sql is never read; the practical coverage comes from src/lib/db/schema.ts being the drizzle-kit source (drizzle.config.ts: schema: "./src/lib/db/schema.ts"), which is inside the walk. I did not find a test that reads the .sql migrations.
- Whether the intake branch scanning `payload` instead of `saved` (src/lib/actions/workflow.ts:211) is intentional. The test at line 117 only requires the literal "scanPayloadForProtectedTraits(saved)" to appear somewhere in the file, so this branch is not individually asserted. CANNOT-DETERMINE intent from the source; the surrounding comment does not address it.
- Whether the guardrail has ever actually run green in an automated gate. No CI config and no hooks exist in this checkout, so I can only confirm the npm scripts that would run it, not that they run.

## 9 — Seed vs real

This checkout is a seeded demo install with a small amount of genuine pilot data on top. Which is which decides whether a finding is a product defect or an artifact of the seed.

> This checkout is a seeded demo install carrying a small amount of genuine pilot data on top. Of 10 rows in `search_projects`, 6 are the golden fixtures written by `seed()` in src/lib/db/seed.ts, 1 is the hardcoded SP104 demo from fixtures/sp104, and 3 are real pilot searches created 2026-09-07 with real pasted job descriptions. Of 7 candidates, 6 are synthetic ("Candidate C31" style, SP104 fixture) and 1 is the account owner's own CV used as a stand-in, documented as such in docs/PILOT-2026-09-06.md.

- **The database is explicitly marked as seeded. settings has key 'seeded' with value {"at":"2026-09-07T04:02:08.086Z"} — the idempotency marker written by seed().**
  - `src/lib/db/seed.ts` · `seed`
  - sqlite3 -readonly data/talentos.db "SELECT key, value FROM settings" returns: seeded|{"at":"2026-09-07T04:02:08.086Z"}. seed() guards on this key and inserts one user, six fixtures, and their pipeline stages.
- **Six of ten search_projects are the GOLDEN_FIXTURES defined in source, all created within 10ms of each other at 2026-09-07T04:02:08.**
  - `src/lib/db/seed.ts` · `GOLDEN_FIXTURES`
  - DB rows: 'CAIS — Research Scientist / Research Engineer' (93014e5e…), 'Sutter Health — Primary Care Physician' (3a1c24f7…), 'Meridian — Senior Enterprise Account Executive' (4eed5686…), 'Precision Ohio — CNC Machinist' (5aebdd5c…), 'Northwind — Chief Financial Officer' (9e8c50a8…), 'St Pancras — ICU Registered Nurse' (75a6be47…). created_at values 04:02:08.076Z through 04:02:08.085Z. Their JD text in job_descriptions matches the `jd` strings in GOLDEN_FIXTURES byte-for-byte in length (1272/903/890/884/908/897 chars).
- **Four of the eight companies rows are obviously synthetic firms invented for the fixtures: Meridian Software, Precision Components Ohio, Northwind Technologies, St Pancras University Hospital.**
  - `src/lib/db/seed.ts` · `GOLDEN_FIXTURES`
  - companies has 8 rows. Six created at 2026-09-07T04:02:08 come from seedFixture(); of those, Center for AI Safety and Sutter Health are real organisations, the other four are invented. The two remaining rows (Merge Labs, GitLab, 2026-09-07T18:31:47) come from the pilot searches. 'Axiom Compute' has no companies row at all — SP104 stores only company_name.
- **A seventh project, id literally 'SP104', is the HSAL demo fixture with a hand-written fixture date of 2026-07-20, three weeks before any migration in this database ran.**
  - `fixtures/sp104/search-project.json`
  - The file sets "id": "SP104", "createdAt": "2026-07-20T00:00:00.000Z", "updatedAt": "2026-08-31T00:00:00.000Z", company 'Axiom Compute'. The DB row matches exactly. Earliest __drizzle_migrations entry is 1788281660792 = 2026-09-01.
- **Six of the seven candidates rows are placeholder records of the form 'Candidate C31' — ids C31, C44, C52, C54, C61, C73, all search_project_id 'SP104', all inserted in the same millisecond range at 2026-09-07T05:36:23.63.**
  - `src/lib/hsal/seed-sp104.ts` · `SEED_CANDIDATES`
  - Their current_company values are invented infra firms: Meridian Cloud, Latticework, Northwind Data, Orbital Systems, Helix Compute, Quanta Infra. All have geography 'Bay Area'. profile JSON is a stub with empty education/publications/projects/licenses arrays and a 3-item skills list, e.g. C31: {"skills":["Rust","distributed systems","large-scale infrastructure"]}.
- **The single hiring_managers row is fixture data: 'Dana Whitfield', Director of Infrastructure, attached to SP104, style_notes 'Decisive; anchors on stack and title.'**
  - `src/lib/hsal/seed-sp104.ts` · `seedSp104`
  - created_at 2026-09-07T05:36:23.631Z, same batch as the C-numbered candidates. No hiring manager exists for any other project.
- **The only pipeline_snapshots row is a fixture snapshot dated 2026-08-31T18:00:00.000Z on SP104 — a round fixture timestamp, not observed activity.**
  - `fixtures/sp104/pipeline-w9.json`
  - The fixture file declares "id": "PIPE-SP104-W9", "searchProjectId": "SP104". fixtures/sp104/pipeline-w6.json is the sibling W6 snapshot. Seeding is driven by `pnpm seed:sp104` -> src/lib/hsal/seed-sp104-cli.ts, per package.json.
- **Three search_projects are real pilot searches, not seed: CAIS Founding Recruiter (b6a7ff8c…, 2026-09-07T04:04:12), Merge Labs Senior Recruiter (225497ba…, 18:31:47), GitLab Talent Brand Manager (82cd74e2…, 18:31:47).**
  - `docs/PILOT-2026-09-06.md`
  - The doc records Wave P as '3 searches × 5 candidates', names the CAIS Founding Recruiter JD as pulled via the Greenhouse board API and the Merge Labs Senior Recruiter JD via the Ashby posting API, 'pulled by the assistant as the owner's hands, not by the app'. Their job_descriptions.raw_text lengths are 5830 / 5183 / 7683 chars versus 884–1272 for the seeded fixtures, and the text opens with real posting headers ('Founding Recruiter San Francisco About The Center for AI Safety (CAIS)', 'Talent Brand Manager Remote; Remote, Canada; Remote, United States GitLab is the intelligent...').
- **Nearly all substantive activity in the database belongs to those three pilot projects; the six seeded fixtures have nothing beyond their JD, one document_version and 16 pipeline stages.**
  - `data/talentos.db`
  - Grouped counts by search_project_id: search_queries 279 rows split 122 / 90 / 67 across b6a7ff8c / 82cd74e2 / 225497ba and zero elsewhere; ai_generations 38 split 22 / 8 / 8 across the same three; research_sources 33 all on b6a7ff8c; source_channels 28 split 9/10/9; sourcing_strategies, role_intelligence, hiring_intelligence, market_research 3 rows each, one per pilot project. pipeline_stages is 16 per project × 10 projects = 160 (DEFAULT_PIPELINE_STAGES in src/lib/domain/pipeline.ts).
- **The 33 research_sources rows are real live web results, not fixtures — real third-party URLs captured 2026-09-07T19:34–19:37.**
  - `data/talentos.db`
  - Sample urls: https://safe.ai/, https://safe.ai/work, https://en.wikipedia.org/wiki/Center_for_AI_Safety, https://www.linkedin.com/company/center-for-ai-safety, https://www.weka.io/customers/center-for-ai-safety-cais/, https://forum.effectivealtruism.org/posts/... All carry search_project_id b6a7ff8c (CAIS Founding Recruiter).
- **The 11 search_query_runs rows are real recorded discovery runs on the three pilot projects, with plausible live result counts (3010, 218000, 4340000, 11000, 697000, 595000, 2750, 8920, 1, 2).**
  - `src/lib/services/discovery.ts` · `recordQueryRun`
  - discovery.ts line 185 calls recordQueryRun (imported from src/lib/services/query-yield.ts); src/lib/actions/discovery.ts line 34 does the same. Query text is real boolean sourcing strings with site:linkedin.com/in operators and engine values 'core' / 'reach'. ran_at values 2026-09-07T14:09 and 18:46.
- **The seventh candidate is not synthetic and not a third party — it is the account owner's own record, with their own real LinkedIn URL and a 4200-char CV stored in document_versions.**
  - `docs/PILOT-2026-09-06.md`
  - Prerequisite 4 in the doc reads: consent 'given (owner's own CV used as the stand-in candidate for Search 1; owner authorised use of CVs in their files)'. The candidates row (cb31644a…) carries the same name as OWNER_NAME in src/lib/product.ts, current_company 'Sutter Health', geography 'San Jose, CA', stage 'identified'. candidate_sources has one row, added_via 'manual', pointing at that person's public LinkedIn profile. All 7 outreach_messages, the 1 candidate_evidence row, the 1 pipeline_event and the 1 document_comparison attach to this single candidate.
- **The single users row is inserted by seed() from a hardcoded constant, not by any sign-up flow.**
  - `src/lib/product.ts` · `OWNER_NAME`
  - Line 13 defines OWNER_NAME as the owner's real name; src/lib/db/seed.ts does `await db.insert(users).values({ name: OWNER_NAME })`. The DB users row has created_at 2026-09-07T04:02:08.075Z (the seed timestamp) and a NULL email.
- **Two throwaway probe rows sit in tasks — 'pane-staleness probe 1788897351568' and 'catch-up probe 1788897420273', both status open, both created 2026-09-08 during UI testing.**
  - `data/talentos.db`
  - Both have empty search_project_id, candidate_id, kind and due_at. The titles appear nowhere in the repo (rg for 'pane-staleness|catch-up probe' over the tree excluding node_modules/.next returns nothing), so they were created ad hoc through the running app, not by a seed script. The numeric suffixes are Date.now() values: 1788897351568 = 2026-09-08T19:55:51Z, matching created_at.
- **All generated content in the database came from the session model provider, never a paid API — 37 of 38 ai_generations rows are provider 'session' / model 'claude-session'.**
  - `data/talentos.db`
  - SELECT provider, model, COUNT(*) FROM ai_generations GROUP BY 1,2 returns session|claude-session|37 and session|imported-artifact (author unverified)|1. Consistent with docs/PILOT-2026-09-06.md prerequisite 2, 'No model API key by owner decision (D-008)'.
- **Several tables are entirely empty, so the post-offer and packet halves of the product have no data at all — real or seeded.**
  - `data/talentos.db`
  - Zero rows in: offers, onboarding_plans, candidate_packets, candidate_registry_matches, candidate_source_evidence, close_plans, crew_jobs, profile_suppressions, role_knowledge, scorecards, screen_guides, search_learnings, hsal_bindings, hsal_search_learnings, interview_plans, hm_briefs.
- **data/talentos.db is not the only database in the checkout; four dated backups and three test databases sit beside it, and the main file has a 4MB uncheckpointed WAL.**
  - `data/talentos.db`
  - ls data/: talentos.db (1634304 bytes, mtime Sep 7 15:48) with talentos.db-wal at 4148872 bytes (Sep 8 21:20); backups talentos.backup-20260907-165038.db, talentos.backup-2026-09-07T23-51-09.db, talentos.backup-before-0010-172549.db, talentos.backup-before-0011-184250.db; test databases smoke.db (520192 bytes), e2e.db, e2e-hsal.db. smoke.db is written by `pnpm smoke` with TALENTOS_DATABASE_PATH=./data/smoke.db and TALENTOS_MODEL_PROVIDER=mock, per package.json.

**Could not determine:**

- Whether the result_count values in search_query_runs (e.g. 4340000) came from a live Google Custom Search response or from the hosted-results link-out path. docs/PILOT-2026-09-06.md states the Google key is refused with 403 and that discovery was changed to link-out (D-034), which would mean the counts were read off a results page rather than an API. I did not trace src/lib/services/query-yield.ts or src/lib/services/discovery.ts far enough to settle it — CANNOT-DETERMINE from what I read.
- Whether the two probe rows in tasks were created through the app UI or a manual API call. Their titles appear in no source file, so I can only say they were not written by any seed script in the repo.
- Whether the 279 search_queries rows were all generated in one pass per project or accumulated over separate sessions. Timestamps cluster tightly (122 rows on b6a7ff8c span 04:17:03 to 04:17:47) which suggests single generation runs, but I did not read the generation code.

## 10 — Findings audit

Ten claims from the browser audit, checked against source. **Three are contradicted, which is the best outcome available here: a contradicted finding removes work.**

> Six of the ten browser-audit claims survive verification against source; three are contradicted by code or data, and one is half-contradicted with the other half unverifiable from source. The contradicted ones remove work: the chat transcript IS persisted (settings key chat:main, question written before the model call), elapsed-time metrics DO exist (computeTimeInStage, stalledThresholdDays), and "/" DOES open the palette (handler in command-bar.tsx, asserted by a Playwright test). Repo root for all paths below is /Users/christoler/talentos-connected-review/talentos.

- **01 CONFIRMED — AI fulfilment requires an external Claude session to write a JSON response file; the app cannot fulfil itself.**
  - `src/lib/ai/session.ts` · `createSessionProvider, SessionFulfillmentPendingError`
  - resolveProviderKind() defaults to "session" and .env sets TALENTOS_MODEL_PROVIDER=session with ANTHROPIC_API_KEY empty. createSessionProvider writes <schemaName>-<hash>.request.json to data/session-outbox and throws SessionFulfillmentPendingError; it returns a value only when a matching .response.json already exists on disk. Nothing in the repo writes that file: scripts/outbox.mts states in its own header that it "reads and prints. It never writes a response and never calls out", scripts/eval-w12-fulfil.mts has a `respond` subcommand a fulfilling session invokes by hand, and scripts/crew-worker.mts exits 3 "awaiting model fulfillment" and prints a handoff list. Live evidence: data/session-outbox holds 41 .request.json and 36 .response.json files (5 unanswered).
- **02 CONTRADICTED — the asked question IS persisted, and re-asking is the documented, idempotent collection mechanism, not a defect.**
  - `src/lib/services/expert.ts` · `askExpert, readChat, CHAT_KEY`
  - askExpert() writes the transcript BEFORE the model call (`writeChat(db, turns)` precedes `await askTheExpert(...)`), under CHAT_KEY = "chat:main" in the settings table. On SessionFulfillmentPendingError it appends an expert turn carrying `waiting: { requestPath, responsePath }`, and the module docstring states the reason: "A turn is written before the answer is asked for … the gap between asking and being answered can be an hour. The question has to still be there." Re-asking is deliberately byte-identical (`const asking = tail?.who === "you" && tail.text === asked` suppresses a duplicate question turn) because the handoff is keyed on a hash of the prompt. Live DB confirms it: `select value from settings where key='chat:main'` returns a stored q-turn "why is nobody replying" plus a waiting turn pointing at ExpertReply-bf82b31299fe.request.json.
- **03 CONFIRMED — at least four separate free-text inputs accept overlapping text, and the palette has no path for a question.**
  - `src/components/command-bar.tsx` · `CommandBar, filtered`
  - The four (five, in fact): CommandBar's filter input (src/components/command-bar.tsx), the global /search `q` input (src/app/search/page.tsx), the /sourcing `q` input (src/components/sourcing-console.tsx), the ExpertChat textarea (src/components/expert-chat.tsx line 181) and the QuickNote outliner (src/components/quick-note.tsx). /search and /sourcing share one parser — global-search.ts imports parseQuery from @/lib/sourcing/query-language. The palette cannot handle a question: `filtered` is a plain substring match over a fixed Command[] built from PHASES, searches, tags and people; there is no fallthrough row that runs a global search or forwards the text to askExpert, so unmatched free text renders only "Nothing matches that."
- **04 CONFIRMED — each phase tab resolves to the same URL as the first sub-tab of that phase; Understand and Overview are literally one href.**
  - `src/components/workspace-nav.tsx` · `PHASES, WorkspaceNav`
  - WorkspaceNav renders the phase row with `href={`${base}${entry.modules[0].path}`}` and the module row with `href={`${base}${module.path}`}`. PHASES[0] ("understand") has modules[0] = { path: "", label: "Overview", exact: true }, so both rows emit `/searches/<id>`. The same overlap holds for every phase: find→/strategy, engage→/candidates, decide→/hill. Correction to the claim's wording: the two rows are not duplicates of each other in content (4 phases vs the active phase's modules) — the duplication is one href per phase, repeated in both rows. /searches/[id]/page.tsx is a plain OverviewPage with no redirect.
- **05 CONTRADICTED — an elapsed-time metric exists and is rendered in days on the analytics page.**
  - `src/lib/domain/analytics.ts` · `computeTimeInStage`
  - computeTimeInStage(events) returns average milliseconds per completed stage visit; the analytics page calls it and renders it under the card "🪜 Average time in stage (completed visits)" via a local `days(ms)` formatter (`${(ms / (24*3600*1000)).toFixed(1)}d`). A second elapsed-time measure exists in buildProjectSnapshot: `stalledThresholdDays = 7` with a `stalledCutoff` date used to compute `stalledCandidateCount` (src/lib/services/search-projects.ts lines 310–328). What genuinely does not exist is a whole-search time-to-fill/time-to-hire figure — grep for time.?to.?fill / days.?open across src returns only a coaching string (src/lib/domain/coaching.ts:108). The claim as written ("nowhere") is false.
- **06 CONFIRMED — page reading is off, no fetch contact URL is set, and all four declared-profile-link platforms resolve to "off".**
  - `src/lib/fetch/read-page.ts` · `readerEnv, whyDisabled`
  - readerEnv() requires `TALENTOS_FETCH === "on"` AND a TALENTOS_FETCH_CONTACT longer than 8 chars; .env sets neither (grep of TALENTOS_ in .env returns MODEL_PROVIDER, SESSION_OUTBOX, MODEL, DATABASE_PATH, DISCOVERY_PROVIDER, GOOGLE_CSE_KEY, REGISTRY_NPPES, RESEARCH_PROVIDER, OPEN_INDEX, OPEN_INDEX_CONTACT — no FETCH, no FETCH_CONTACT, no PROFILES__). So `enabled: false` and `contact: null`, and whyDisabled() returns "Reading pages is off. Set TALENTOS_FETCH=on to turn it on." Declared links: resolveDeclaredMode returns "off" for any unset value, and resolveGithubMode/resolveKeybaseMode/resolveOrcidMode/resolveWikidataMode each read an unset TALENTOS_PROFILES__ var, so declaredAccounts() marks every account `configured: false`. One nuance: a contact IS configured for a different subsystem — TALENTOS_OPEN_INDEX_CONTACT=ct@sourcd.xyz (CONTACT_ENV in src/lib/research/open-index/types.ts) — so "contact URL off" is true only of the page reader.
- **07 CONFIRMED — exactly 3 tags exist and Neo4j is explicitly not load-bearing; but there is NO cross-search edge, so the graph is emptier than the claim says.**
  - `src/lib/graph/driver.ts` · `neo4jSettings, neo4jConfigured`
  - Tags are parsed, not stored (src/lib/services/tags.ts scanTagMentions reads six free-text columns only). Extracting tag syntax from those columns in data/talentos.db yields exactly three: [[research engineers]] (2 mentions), #ai-safety, #boolean-search. Correction: both [[research engineers]] mentions sit inside ONE search — search_projects.b6a7ff8c-fc3e-4520-8699-a67ca2a1f4ca ("CAIS — Founding Recruiter") business_objective, and candidates.cb31644a recruiter_notes whose search_project_id is that same b6a7ff8c. There is no tag whose mentions span two searches, so the cross-search edge that global-graph.ts describes as "the thing Neo4j is here for" does not currently exist in the data. Neo4j not load-bearing is stated in the driver's own docstring: "Nothing in the product requires it: the graph is still derived from SQLite and every traversal still works in process." NEO4J_URI/USER/PASSWORD/DATABASE are set in .env, so neo4jConfigured() is true; reachability is runtime-only.
- **08 CONFIRMED — the "Missing information" fields are model-authored free-text strings with no field identity, no link and no action.**
  - `src/components/traced-list.tsx` · `StringList`
  - Both surfaces render `missingInformation: z.array(z.string())` — marketResearchPayloadSchema (src/lib/core/payloads.ts:157, shown on src/app/searches/[id]/market/page.tsx under "Missing information" in the Honesty ledger) and closePlanPayloadSchema (src/lib/core/payloads.ts:465, shown on src/app/searches/[id]/close/page.tsx:159 as "Missing information (go get it)"). Both go through StringList, which renders each item as an inert <span> — no href, no form, no id. There is no schema field mapping those strings back to a record, so nothing can be filled from them. Scoping note: two other things the app calls missing DO have a derivation path and should not be swept into this work — the Overview health checklist items each carry an `href` (src/app/searches/[id]/page.tsx healthItems), and the evidence status "missing" is deliberately excluded from the score denominator and reported as `coverage` (src/lib/domain/match-score.ts CREDIT).
- **09 CONFIRMED — candidate dispositions never reach the success profile; the only outcome feedback loop that exists feeds search strings instead.**
  - `src/lib/ai/context.ts` · `ProjectContext, loadProjectContext`
  - successProfileTask is generated from ProjectContext, whose declared fields are project, jdText, hiringManagerNames, intelligence, roleIntelligence, intake, successProfile, marketResearch, strategy, channelNames, critique — no candidates, no dispositions, no scorecards. DISPOSITIONS ("active", "on_hold", "withdrawn", "not_selected", "hired", src/lib/core/enums.ts:152) is read only by src/lib/services/search-projects.ts (next-best-action counting), src/app/candidates/page.tsx (a table column), src/app/searches/[id]/guide/page.tsx and src/lib/domain/facets.ts (a sourcing filter). synthesizeLearnings reads only hand-typed search_learnings rows (`provenance !== "model_inference"`) and writes back to search_learnings — never to success_profiles. The one real feedback loop is calibration: recruiter accept/dismiss/correct decisions on CV passages reshape the String Lab vocabulary (src/lib/domain/calibration.ts deriveTermDecisions), which is search strings, not the profile.
- **10 CONTRADICTED (palette half) — "/" does open the palette; the 503 half is CANNOT-DETERMINE.**
  - `src/components/command-bar.tsx` · `CommandBar useEffect onKey`
  - CommandBar's window keydown handler opens the menu on a bare "/" (guarded only by isTyping(event.target), which returns true for INPUT/TEXTAREA/SELECT/contentEditable), and CommandBar is mounted in the non-framed branch of AppShell (src/components/app-shell.tsx:329). tests/e2e/command-menu.spec.ts asserts it end-to-end: "a bare slash opens the menu and reaches another search" clicks the body to move focus out of a field, presses "/", and expects getByTestId("command-bar") to be visible. The likely cause of the observation: on Home and /daily the caret sits in the Outliner, where "/" opens the block slash-menu instead (tests/e2e/slash.spec.ts, data-testid "slash-menu") — a genuine two-menus-one-key collision, but not "/" failing to open the palette. On 503s: grep for "503" across src returns nothing, next.config.ts sets no error behaviour, and one unreproduced browser sample cannot be traced to source.

**Could not determine:**

- 10 (503 half): no source-level cause for a 503 on RSC prefetch exists in this repo — no 503 literal anywhere under src, no custom error handling in next.config.ts, nothing in test-results/. A single unreproduced sample cannot be confirmed or contradicted from source; it would need a reproduction with the dev server running, which is outside this read-only pass.
- 07: Neo4j reachability is runtime state. NEO4J_URI/NEO4J_PASSWORD are present in .env so neo4jConfigured() returns true, but whether a Neo4j instance is actually answering (globalGraphView's `reachable`) cannot be determined without connecting.
- 03: the audit said 'four' inputs; I found five overlapping free-text entry points. Which four the audit meant is not determinable from source, so the verdict rests on the general claim plus the palette-cannot-take-a-question half, which is verified.
- 08: the claim's wording ('fields the app names as missing') is ambiguous. I verified it against the two model-authored `missingInformation` lists. If the audit meant the Overview health checklist or the evidence-status 'missing', the verdict flips — both of those do have derivation paths, cited in the fact above.
- Data claims (07) were read from data/talentos.db via a read-only URI while a -wal file was present. Values reflect what that read returned (10 search projects, 7 candidates, 3 tags); if a writer had uncommitted state, counts could differ.

## The three changes I would make first

**1. Move `def.schema.parse(raw)` inside the try/catch in `src/lib/ai/run.ts`.**
One line. Today the try block ends at 145 and the parse is at 148, so a response
file that is valid JSON but violates the schema throws a raw `ZodError` and writes
**no `ai_generations` audit row**. That is the most likely mistake a fulfilling
session can make — the schema is optional in the request file and is omitted
entirely when `z.toJSONSchema` throws — and it is the one failure with no trace.
Everything else in that function is careful about the audit row; this is a
placement accident, not a decision.

**2. Give the command palette a fallthrough.**
Five free-text inputs accept overlapping text (`command-bar.tsx`, `/search`,
`/sourcing`, `expert-chat.tsx`, `quick-note.tsx`). The one that is always one
keystroke away is the only one that cannot do anything with a sentence: unmatched
text renders "Nothing matches that.", and the palette contains no entry for
`/search` or `/sourcing` at all, though both are in the left nav. Two rows at the
bottom of an empty result — _search everything for this_ and _ask the team this_ —
turn a dead end into the front door, and cost nothing structural.

While in there, the real "/" problem is not the one the audit reported. `/` **does**
open the palette (`command-bar.tsx`, asserted by `tests/e2e/command-menu.spec.ts`).
On Home and `/daily` the caret is in the outliner, where `/` opens the block menu
instead. That is a genuine two-menus-one-key collision and it needs a decision, not
a fix to the palette.

**3. Collapse the outbox directory rule to one implementation.**
`session.ts`, `session-research.ts` and `scripts/outbox.mts` each resolve
`TALENTOS_SESSION_OUTBOX` separately — two byte-equivalent copies and one that uses
`path.resolve` instead. The whole contract is "both sides agree on a directory and a
filename", and it is currently three agreements that happen to match. The same pass
should decide whether the research provider's missing try/catch around
`z.toJSONSchema` is deliberate: `session.ts` degrades to no schema,
`session-research.ts` would throw.

## What now looks wrong in the later waves

- **Anything premised on questions not being persisted should be dropped.** The
  transcript is in `settings` under `chat:main`, written before the model call, and
  the byte-identical re-ask is load-bearing: the handoff is keyed on a hash of the
  prompt, so a duplicated question turn would change the hash and orphan the answered
  file. That is not a bug to fix; it is a constraint to preserve, and anyone touching
  `askExpert` needs to know it.

- **Anything premised on "no elapsed-time metric anywhere" should be rescoped.**
  `computeTimeInStage` exists and is rendered in days on the analytics page, and
  `stalledThresholdDays` drives a stalled count. What genuinely does not exist is a
  whole-search **time-to-fill**, and the reason is in the schema rather than the UI:
  there is no `closed_at`, no `status_changed_at`, and no disposition timestamp. That
  is a schema plan under `docs/migrations/`, not a metrics ticket.

- **Graph work aimed at the cross-search edge is premature.** There are exactly three
  tags in the database and **no tag spans two searches** — so the one connection
  Neo4j is described as existing for does not occur in the data yet. The honest first
  step is one word written on two searches, not a traversal.

- **The guardrail's blind spot is worth naming before it is trusted further.** It
  walks `src/` only. `artifact-src/`, `scripts/`, `tests/`, `packages/` and the
  generated `drizzle/` SQL are outside it, and `artifact-src/` imports the guard
  without being scanned by it. Non-negotiable 2 says never weaken the test; widening
  its walk is the opposite of weakening it.

- **Seeded data will make several findings look worse than they are.** Six of ten
  search projects and six of seven candidates are fixtures, and one project carries a
  hand-written date three weeks before the earliest migration. Any finding about
  sparse pipelines, empty graphs or missing outcomes should be re-read against the
  three real pilot searches only.
