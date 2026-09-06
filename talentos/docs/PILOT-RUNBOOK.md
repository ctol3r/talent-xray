# Wave P runbook — what the owner does, then what a Claude Code session does

Two parts. Part A is three human steps that no prompt can do for you.
Part B is a prompt you paste into a Claude Code session in the worktree;
it runs the entire pilot from there and fills `docs/PILOT-2026-09-06.md`.

## Part A — owner steps (about 10 minutes)

### A1. Get your own Google Custom Search JSON API key

The two people-only engines already exist (cx `a157d37906e1141cc` and
`918bc00e18d0c46e5`). What is missing is an API key on _your_ Google
account, so the 100 free queries per day and any paid queries are yours.

1. Open https://console.cloud.google.com/ and sign in.
2. Create or pick a project (top bar → project picker → New project →
   name it "talentos" → Create → select it).
3. Enable the API: https://console.cloud.google.com/apis/library/customsearch.googleapis.com
   → **Enable**.
4. Create the key: https://console.cloud.google.com/apis/credentials →
   **Create credentials → API key**. Copy the key.
5. Restrict it (recommended): click the new key → under **API
   restrictions** choose _Restrict key_ → tick **Custom Search API** →
   Save. Leave application restrictions at None (the call comes from your
   own machine).
6. Paste it into the env file, on the line that is currently blank:

   ```bash
   open -e "/Users/christoler/talentos-connected-review/talentos/.env"
   ```

   Change `TALENTOS_GOOGLE_CSE_KEY=` to `TALENTOS_GOOGLE_CSE_KEY=<your key>`
   and save. The file is gitignored.

Cost: Google's published rate is 100 queries/day free, then USD 5 per
1,000. A three-search pilot with ~15 runs per search stays inside the free
tier. Nothing in TalentOS retries or batches queries.

### A2. Pick three real job descriptions

Save each as plain text (or keep the tab open to paste from). Prefer three
different professions so the profession-aware platform pruning and channel
coverage get exercised. If one involves US clinicians, also set
`TALENTOS_REGISTRY_NPPES=1` in the same env file.

### A3. Decide on CV consent

The review step needs each candidate's CV text pasted or uploaded. It is
stored in `document_versions` on the local SQLite file only, never sent
anywhere. Decide now whether you are willing to store up to fifteen. Your
own CV may stand in for one candidate in one search.

When A1–A3 are done, go to Part B.

## Part B — the prompt for a Claude Code session

Open a Claude Code session with the worktree as its working directory:

```bash
cd /Users/christoler/talentos-connected-review && claude
```

Paste this prompt verbatim:

```text
You are running Wave P of the TalentOS action plan: a 3-search × 5-candidate
pilot. Read, in this order, before doing anything:
- talentos/docs/ACTION-PLAN-2026-09-05.md (section "Wave P")
- talentos/docs/PILOT-2026-09-06.md (the record you will fill)
- talentos/docs/CLAUDE_HANDOFF.md and CLAUDE.md (doctrine)
- talentos/docs/DECISIONS.md D-008 (session provider), D-010 (discovery
  boundary), D-029 to D-032 (what Waves A/B/D/E shipped)

Hard rules for this run:
1. Never type, read aloud, or move an API key. If TALENTOS_GOOGLE_CSE_KEY in
   talentos/.env is empty, stop and tell the owner; do not substitute a mock
   provider and do not proceed with fixture data.
2. Never fetch, open programmatically, or scrape a search-result page. Links
   are opened by the owner in their browser. CV text is pasted by the owner.
3. Record only what actually happened. Percent-complete is banned; the wave
   is OPEN until the close condition in PILOT-2026-09-06.md is met.
4. Do not add features. Anything you notice goes to talentos/docs/BACKLOG.md.

Setup:
- Confirm talentos/.env has TALENTOS_MODEL_PROVIDER=session,
  TALENTOS_DISCOVERY_PROVIDER=talent-xray, TALENTOS_DATABASE_PATH=./data/talentos.db
  and a non-empty TALENTOS_GOOGLE_CSE_KEY (check with grep -c, never print it).
- In talentos/, run `pnpm build` then `pnpm start --port 3000` in the
  background. This creates ./data/talentos.db with every migration applied.
  Open http://127.0.0.1:3000 in the browser tool and confirm the Settings
  page says the discovery provider is configured.

Session-provider loop (you are the model):
- Whenever a generation is requested in the UI, the app writes a request
  file under talentos/data/session-outbox/ and shows the path. Read the
  request, produce output that matches its JSON schema exactly, write it to
  the response path it names, then click the generate button again. Never
  invent facts about people; every claim must come from the pasted text.

Per search, ask the owner for the JD text, then drive the UI:
1. /searches/new → paste JD → Extract role intelligence → Intake (answer
   with the owner) → derive the search plan → Strings: "Generate strings"
   and "Compose from search plan". Note the coverage card, QA badges and
   the calibration panel (it should say no review decisions yet).
2. Discover: run at least five stored strings across both engines. Ask the
   owner to open promising results and confirm names; save at least five
   with "Save as candidate". Do not save anything the owner did not name.
3. For each of the five candidates: ask the owner to paste or upload the
   CV; confirm extraction; Analyze → copy the artifact request → fulfil it
   yourself in this session (exact quotes only; reject anything you cannot
   quote verbatim) → paste the response JSON → Validate and import. Then
   the owner accepts / dismisses / corrects; you time each step with the
   owner's say-so and record corrections and rejected passages.
4. Strings again: Regenerate. Record every calibration decision the panel
   shows (term, action, reason). Run the regenerated strings; record yield
   before vs after from the Discover yield card.
5. Prepare reviewed shortlist → export.

After each search, fill that search's table in
talentos/docs/PILOT-2026-09-06.md with the numbers you actually observed.
After the third search, fill Totals, list technical defects (file them in
BACKLOG.md) and workflow findings, and set the status line to CLOSED only if
every table is filled and "fabricated passages accepted" is 0. Commit the
record with the message "Wave P: pilot record" and Co-Authored-By trailer.
Do not write any superiority claim about hireEZ, Metaview or Heartbeat.
```

## What this runbook does not do

- It cannot obtain the key for you, choose your searches, or give consent.
- It does not run the pilot against fixtures. A pilot on fixtures is not a
  pilot, and the doctrine says so.
