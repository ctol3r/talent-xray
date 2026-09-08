# Search planning through the interface

The pilot needed scripts to derive the hiring need and search plan. Search
String Lab now exposes both existing services before its existing Compose
from search plan action. This extends the standalone app; it does not change
the composer or the published Claude artifact.

## Use

1. Create a search and save its job description.
2. Open Strings and select **Derive hiring need**.
3. Review its requirements, source phrases, unknowns and disagreements.
4. Select **Derive search plan** and review the proposed terms and rationale.
5. Select **Compose from search plan** to save visible, editable queries.

With the session provider, a generation first shows **Awaiting session
response**, including the request/response files under Session handoff files.
Have a Claude or Codex session fulfill that request, then select **Check for
response**. Pending requests do not count as saved drafts. Invalid responses
remain errors. This does not require an AI model API key.

Existing canonical requirements are reused. The initialization action does
not regenerate existing intent or erase manager decisions. Plan regeneration
uses the existing service: it replaces the derived plan and clears its
derived personas, as explained beside the action. Saved query rows remain
until the recruiter explicitly composes again. No outreach or stage changes
are performed by this flow.

## Verification and limits

The change is based on the published connected-review branch at `9ebabc2`.
The owner's newer local commits and uncommitted work are not included.

- Full local `pnpm verify`: 614 tests, typecheck, lint, formatting, artifact
  drift check, production build and private-data packaging check passed.
- All 10 standalone browser tests and all 30 artifact browser tests passed.
- The 20-step mock smoke workflow passed.
- `planning-actions.test.ts` checks 28 boundary, prerequisite, pending and
  provider-error cases. `planning-session.test.ts` uses actual services,
  SQLite and session files to verify pending → invalid response → valid
  response, without overwriting a manually added manager requirement.
- `search-planning.spec.ts` covers the complete UI sequence, reload
  persistence and the missing-JD route.

The browser and session fixtures are synthetic. These checks do not establish
model quality, hiring outcomes or operation against the personal database.
GitHub CI and installation into the existing personal checkout are separate
release gates. No personal migration or deployment was performed.

The pilot's over-budget query diagnosis remains open. This change preserves
the existing composer, its QA warnings and every query's editable text.
