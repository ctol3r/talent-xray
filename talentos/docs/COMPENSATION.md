# Compensation recommendations

Open a search's **Market** page. Set its compensation geography, employment type, currency and annual/hourly basis. Add comparable sources manually or copy the research request into a Codex/Claude session, then import the returned JSON. No model API key or network request is used by this workflow.

Imported findings are always unreviewed, regardless of the submitted review flag. Open each source and check its amounts, actual data date, role/level comparability and excerpt before checking the review box. Editing a source clears its review. Sources remain user-supplied evidence, not independently authenticated market data.

**Save and recommend range** stores the inputs in the existing local settings table. It calculates a provisional base-pay band as the median of the eligible lower bounds and the median of their upper bounds. At least two source domains are required. This is an explicit starting-band heuristic, not a percentile estimate, exhaustive market benchmark or approved employer budget. Different domains can still reproduce the same underlying dataset; the recruiter must assess independence.

The calculation excludes unreviewed sources, duplicate URLs, future data, data older than 730 days, total-compensation figures, and mismatched currency/pay period/geography/employment type. Included data older than 365 days is labeled aging. No automatic currency conversion, geographic adjustment or annualization is performed. Source amounts and exact dates remain visible. Bonus, equity and benefits stay separate.

Saved inputs survive restart. A change to role, seniority, industry, geography/country/region, employment type or work arrangement suppresses the saved recommendation until source comparability is reviewed again. A stale open tab cannot overwrite the new context. Candidate offers, salary history, pipeline stages and the owner's existing compensation note are not modified.

Validation includes deterministic exclusion/range tests, a disposable SQLite restart/context test and a browser import-review-save-reload/edit test. All fixtures are synthetic. Actual market usefulness and compensation-source quality require real recruiting validation.
