# Connected CV–JD review release

Status: implemented locally; technical verification results are recorded below. Real-document installation and recruiting pilot remain open gates.

## Scope and baseline

Based on PR #1, head `79f0a411f42043060261182c8e30799c5e74e115`, in an isolated worktree. The root checkout and its untracked AGENTS.md were preserved. Baseline TalentOS verification passed 398 tests, production build, the 20-step service smoke workflow and the original standalone browser test. The first smoke invocation lacked the explicit mock-provider setting; rerunning against a disposable database with that setting passed. No personal database migration or public deployment was performed.

The existing Boolean composer, search link-outs and Claude artifact are preserved. The new screen reuses the artifact's ribbon, deck and radial geometry. The release stays local and single-user; `dev` and `start` bind to `127.0.0.1`.

## Using the review

1. Create a search and candidate. Open **Review CV ↔ JD** or the candidate deck's comparison link.
2. Import PDF/DOCX or paste CV and JD text. Inspect extraction and confirm each document. Fix reading order explicitly; every correction creates another version. Legacy text is labeled legacy and requires confirmation.
3. Define canonical requirements through intake, or select exact JD passages and use **Add selected JD requirement**. Manager additions are stored as separate canonical requirements and do not rewrite the JD.
4. Open the current comparison. Use **Select exact passages** and mouse or keyboard selections to create manual relationships.
5. **Analyze** prepares an artifact request locally. Copy the request into the Codex or Claude session/artifact you choose. Paste its response JSON and select **Validate and import suggestions**. No model API key or automatic model request is used by this flow. A response must carry the matching context hash and schema; exact quotes must resolve uniquely. Ambiguous repeated quotes require manual occurrence selection. Imported authorship is labeled unverified.
6. Inspect the two panes, requirement list and explanation panel. Accept, dismiss or correct a relationship. Acceptance is not employment, qualification or source-authenticity verification. Corrections preserve the previous connection and review history.
7. Open **Review output**, write a recruiter conclusion, and explicitly select accepted relationships to export. Partial, contradictory and unknown assessments remain unresolved even when the relationship itself is accepted. Print shows accepted material and source references. Navigation and generated output do not advance candidate stages or send messages.
8. Use **Prepare reviewed shortlist**, explicitly select current reviewed comparisons, and save the draft selection. The selection uses the existing settings store. Export rechecks freshness; stale selected comparisons block export. This records output preparation, not contact or submission.

An interactive artifact supplies a UI and structured context. It does not embed the Codex or Claude model or silently invoke a subscription from the standalone app. Other modules default to the existing keyless session-file provider. Explicit legacy API configuration remains separate from this review flow.

## Persistence and boundaries

- `document_versions` owns uploaded/pasted CV and JD text, hashes, original-file references, confirmation state and prior-version references. The document service maintains `resumeText` and `job_descriptions` compatibility projections. New uploads are withheld from downstream projections until confirmed.
- `document_comparisons` stores exact CV/JD versions and canonical requirement snapshots. Any changed version or changed requirement context makes the historical comparison stale. Historical source text and decisions remain readable. No accepted connection is transferred automatically.
- `document_links` owns exact spans, assessment, explanation, limitations and per-generation provenance. `document_reviews` contains append-only reviewer decisions. Relationship review and source freshness are separate.
- Backlinks derive from these references. No graph database was added. Browser navigation memory contains only IDs, query parameters and scroll positions; document content stays in the application database/storage.
- Original files use opaque UUIDs and owner-only file creation outside the repository, defaulting to `~/.local/share/talentos/documents`. `TALENTOS_DOCUMENT_DIR` can select another private directory outside the checkout. Copies of the same original are not created for text corrections.
- Original-file access is through the local private route, with no-store headers, cross-site subresource rejection and sandboxed inline PDF responses. This is not multi-tenant authentication and is not authorized for internet exposure.
- Limits: 20 MiB/file, 100 PDF pages, 200,000 extracted characters. DOCX additionally has an archive expansion budget of 32 MiB and 2,048 entries. OCR is unavailable. Scanned, encrypted, corrupt or over-limit inputs produce errors. Multi-column extraction still requires human reading-order review.
- Candidate deletion includes comparison/history records and unreferenced original files. Upload writes that fail database insertion remove their new original file.

## Migration and rollback

The additive migrations are `0004_aspiring_vance_astro.sql` and `0005_misty_smiling_tiger.sql`. New databases initialize normally. Existing databases with pending schema changes stop before migration. `pnpm db:migrate` explicitly opts in and backfills existing text as legacy versions without inventing originals or extraction claims.

**Do not run the migration on the personal database until the owner explicitly authorizes it.** Tests use disposable databases.

Before an authorized upgrade, stop the local app and take a consistent SQLite backup (including live WAL state, or use SQLite's backup facility). Back up the private original directory separately. A database backup alone does not preserve originals. Resume the app only after migration succeeds.

For additive rollback, stop the new app, preserve the upgraded database plus original directory, then use the old code with a COPY of the pre-upgrade database. Do not run down migrations, delete new tables, or replace the preserved upgraded database. This retains imported documents and review history for resuming the upgrade. The old code will not understand the new review records.

## Release verification

Required local gates: root `pnpm verify` where shared code changes; TalentOS `pnpm verify`, `pnpm smoke` with mock provider/disposable DB, `pnpm e2e`, `pnpm e2e:artifact`, and `pnpm test:documents:defects`. The latter deliberately removes each source-anchor and stale-version guard, requires an assertion failure, then restores the source.

CI must run on the exact submitted head; missing or blocked checks are an open gate. A green build does not prove real-world review quality.

Outstanding external gates: identify three active searches and five authorized CVs per search; verify the installed app with real documents; record review time, evidence-location time, manual corrections, unsupported suggestions and acceptance rates. Zero fabricated passages in accepted output is mandatory. No real-search completion, hireEZ superiority, live sourcing validation, ATS integration, or paid-service commitment is claimed by fixture tests.

## Continuation

Continue on `codex/talentos-connected-review`. Preserve both the original checkout and any personal data. Run the recorded technical gates; inspect browser evidence; obtain the owner's named real pilot documents and explicit personal migration authorization before installation. Then run the 3×5 pilot and select the next improvement from measured failures. Competitive comparison requires equivalent briefs and actual hireEZ access, or must be described as comparison against the current workflow.

## Recorded local checks

- Root verification: 5 tests, formatting, typecheck, lint and build passed.
- TalentOS verification: 414 tests across 41 files, formatting, typecheck, lint, preserved artifact build and production build passed.
- Service smoke: 20 steps, 25 queries and 4 channels passed with the mock provider and disposable database.
- Standalone browser: 2 tests passed, covering the existing workflow and the new PDF/DOCX → artifact validation/manual connection → review → shortlist/export → replacement/history workflow.
- Preserved artifact browser: all 30 tests passed.
- Deliberate removal of anchor validation and stale-version protection each produced the expected assertion failure; source was restored afterward.
- Build packaging originally traced disposable runtime database files. Runtime-only path annotations and explicit exclusions removed those references. `pnpm check:private-build` now checks the generated traces and passed across 31 traces. The build contains no traced database or private original-file entries.

These are fixture-based local results. Exact-head CI, real-document installation, the recruiting pilot and competitive evaluation remain separate gates. See [Claude Code handoff](CLAUDE_HANDOFF.md).
