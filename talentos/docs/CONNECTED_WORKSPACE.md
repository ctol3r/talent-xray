# Connected workspace additions

TalentOS now connects the review workflow to role compensation, sourcing/exposure research, a navigable record graph, and explicit browser capture. These are local single-user features. They do not require an AI model API key, a graph database, or an additional database migration.

## Daily workflow

1. Open **Market** to collect and review compensation sources, then calculate a provisional base-pay range. See `COMPENSATION.md` for the calculation and evidence exclusions.
2. Open **Sources** to prepare a Codex/Claude research request for candidate sourcing and opportunity exposure. Preview the returned JSON, select the recommendations to retain, and save them to the existing channel catalog. Suggestions carry purpose, priority, relevance, geography, cost/access evidence and limitations. They are neither exhaustive nor independently verified. Existing channel review controls remain available.
3. Open **Knowledge graph** to inspect records and their incoming/outgoing links. Select a candidate, requirement, source or comparison and follow references back to the underlying record. Add a labeled manual relationship when you want to record your own connection. Stored CV–JD relationships retain assessment/review context; accepting a relationship never authenticates a source or qualification.
4. Open **Browser companion** alongside a browser, use its bookmarklet, or load the optional unpacked Chrome extension. Review the URL/title and choose the existing search or candidate before saving. The captured reference then appears in the connected workspace. See `BROWSER_COMPANION.md` for setup and limitations.

## Ownership and boundaries

- Existing project/candidate/document/comparison/source records own their facts. Graph nodes and backlinks are projections of those references. Explicit manual relationships live in the existing settings store, with actor and creation time; they do not duplicate candidate records or infer identity merges.
- `sourceChannels` remains the single channel catalog. Imported source-recommendation metadata uses its existing note field; legacy notes remain readable. The existing generation validator records imported provenance without invoking a model API.
- Browser captures use `candidateSources` or `researchSources`. A URL/title is an unverified reference, not extracted CV text, page evidence or proof of a person's qualification. Saving is explicit and no page fetch occurs.
- Compensation uses the existing settings store and does not overwrite the employer's budget note or candidate offers. Imported research is unreviewed until checked by the recruiter.
- The graph is a recruiting-record workspace, not a full Roam block editor or a copy of the Athens platform. The Chrome extension is a local unpacked companion, not a Web Store release. The manual companion supports browsers that block bookmarklets.

## Continuation

Continue in the isolated checkout `/Users/christoler/talentos-connected-review`, branch `codex/talentos-connected-review`; preserve `/Users/christoler/talent xray` and its untracked `AGENTS.md`. The base PR #1 advanced to `1d9354670fa0a23a62e4aeff286124508d88fe62` with documentation-only updates; no competing implementation was introduced by those commits.

The owner's supplied context says to leave the already diagnosed GitHub billing issue aside. Do not create duplicate reminders or repeat requests to address it. That preference does not turn unexecuted CI into passing checks or authorize a merge. Continue local validation and keep delivery status explicit.

Personal-database migration, installed real-document review, the three-search/fifteen-CV pilot and hireEZ comparison remain separate release/validation gates from these feature additions. Do not infer market usefulness or competitive superiority from fixture tests.
