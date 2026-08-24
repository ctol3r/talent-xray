# LEGAL.md — Talent X-Ray

Two parts: the engineering guardrails that hold regardless of what any lawyer says, and
the open Google-terms questions that must be answered before paid launch.

## Part 1 — Non-negotiable engineering guardrails

These are product invariants, enforced in code and tests, not policies subject to
interpretation.

### 1. Never fetch, crawl, or scrape a result page

The product surfaces Google's index; it does not re-crawl the web. No server or client
code may request a result URL's content — not for previews, not for enrichment, not for
"just the title tag." Results link out (`target="_blank" rel="noopener"`) and that is the
entire interaction. This keeps us clear of LinkedIn's ToS and every other site's, and it
means we never hold a copy of anyone's page.

### 2. Never bulk-persist search results

We store the **query** a user ran, and only those result URLs a user **explicitly
saves** (a deliberate one-at-a-time act). No SERP payload is ever written to the
database; no table may have a column capable of holding one. Designed as if Google's
terms prohibit caching outright, because we have not yet verified that they don't
(see Part 2, Q1).

### 3. Generated email addresses are hypotheses, labelled "unverified"

The contact finder produces name-pattern **permutations**, not verified addresses. Every
surface that renders one carries a visible "unverified" badge that cannot be dismissed or
hidden by CSS. No bulk-generate, no "copy all." A permanent test asserts the badge is
present wherever a generated address renders.

### 4. No field, anywhere, for protected characteristics

No column, filter, enum, note template, or free-form-adjacent structure for race,
ethnicity, religion, age, gender identity, disability, national origin, sexual
orientation, health, pregnancy, or veteran status. A hiring tool that lets a user record
those is a discrimination lawsuit. A permanent CI test greps schema and codebase for
these field names and fails the build on a match.

### 5. A working DSAR path, and honest outreach

Any person can ask what we hold about them and have it deleted. Since we hold only
public URLs and user-typed notes, this is genuinely easy — we build it properly anyway:
a request form at `/privacy/request`, lookup by email or profile URL across **all**
orgs, export and deletion with a receipt, and a documented response SLA. Any outreach
feature carries an unsubscribe path and honours suppression.

## Part 2 — Open Google-terms questions (P0 — answer before charging a dollar)

The Custom Search JSON API "Additional Terms of Service" is largely a billing document;
the substantive restrictions live in the general Google APIs ToS and the Programmable
Search Engine ToS. These have **not** been fully verified. Do not launch paid until each
box is checked with a citation to the controlling clause.

- [ ] **Q1 — Storage and caching of results.** What may we retain from a JSON API
      response, and for how long? Current engineering posture is maximally conservative
      (store the query; store only user-saved URLs; never persist a SERP) — confirm that
      posture is sufficient, and whether even saved URLs carry retention obligations.
- [ ] **Q2 — Commercial resale and branding.** May a paid product present JSON API
      results in its own UI, and what attribution is required? Does BYOK (the customer's
      own key, making the customer the API principal) change the analysis? We believe it
      materially improves our posture; verify it.
- [ ] **Q3 — Ad display on the free tier.** The CSE Search Element is ad-supported.
      Confirm we may not suppress or restyle those ads, and audit our CSS so it does not
      accidentally do so.

Sources to read: `developers.google.com/custom-search/terms`,
`developers.google.com/terms`, and the Programmable Search Engine terms linked from the
PSE control panel.
