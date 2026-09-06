# Competitive read: Metaview, hireEZ, Heartbeat.ai — and how TalentOS beats them

Date: 2026-09-05. Desk research only (public pages, review sites, pricing
aggregators). No product was trialled. Per `CONNECTED_REVIEW.md`, a superiority
claim still requires equivalent briefs run through both products; this
document tells you *where* that comparison can be won, not that it has been.

## 1. What each competitor actually is

### Metaview — "AI agents for winning teams"

- **Core:** interview notetaker (records/transcribes calls, writes
  scorecard-shaped notes, pushes them to the ATS). 4.8/5 on G2, 131 reviews.
- **2026 expansion:** Sourcing, Application Review, Screening (AI-run
  interviews), Outreach, Reports, Job Posts agents. Integrations: Ashby,
  Greenhouse, Lever, Gem, SmartRecruiters; claims 47 ATSs.
- **Thesis (their own words):** sourcing is "a calibration problem, not a
  Boolean problem". Signal lives in accept/reject decisions, HM debriefs and
  past interview transcripts, fed back into ranking. They quote 80–90 %
  precision "by the third calibration loop" and admit it takes 12–18 months
  of captured signal before it pays off.
- **Pricing:** Sourcing Free (100 profiles) / Pro $100 per user-month
  (200 profiles) / Max $300 (unlimited) / Enterprise quoted. The full agent
  bundle has no published price.
- **Weaknesses on record:** sourcing product has almost no independent
  review coverage; 200 profiles/month is thin for an active desk; the
  calibration loop only works if you run *their* recording bot on every
  interview (consent burden varies by jurisdiction); non-English and
  accented transcription is unreliable; summaries go generic on technical
  interviews.

### hireEZ — open-web sourcing suite

- **Core:** 800M+ profile index scraped/aggregated from 45+ open-web sources,
  Boolean + semantic search, contact enrichment, email/InMail sequencing,
  ATS rediscovery, CRM, analytics, "EZ Agent" workflow automation. 700+
  medical specialty filters. 45+ ATS integrations.
- **Pricing:** no public page. ~$169 (Startups, ~100 contact reveals per
  user-month) / ~$199 (Professional) / $250+ (Enterprise), annual only,
  onboarding fees $1k–2.5k+, documented 20–30 % renewal escalations, 60–90
  day cancellation windows. Vendr median contract $13k/yr.
- **Weaknesses on record:** contact accuracy is the number-one complaint
  (bounce rates approaching 30 %, contacts for relatives returned instead of
  the person); AI matching "generic" for niche/senior roles; weak phone
  enrichment; steep learning curve; credit caps; a public GDPR complaint
  about scraping without consent.

### Heartbeat.ai — healthcare contact data

- **Core:** 11M+ US clinician profiles with personal email and cell phone,
  NPI-keyed dedupe, state license matching, specialty/facility filters,
  Chrome extension, file-upload enrichment, Bullhorn and Apploi push/pull,
  Zapier/Make hooks.
- **Own benchmarks (non-guaranteed):** 82–84 % first-mobile accuracy,
  92–95 % email accuracy, ~10 % connect rate, 100–200 outreach attempts per
  placement.
- **Pricing:** from ~$750/month; pricing page sits behind bot detection.
- **Weaknesses on record:** healthcare-only, US-only; it is a list, not a
  workflow — nothing after the contact is revealed; explicitly disclaims
  deliverability, accuracy and legal safe harbour (TCPA/CAN-SPAM burden is
  on the buyer); data decay acknowledged as normal.

### The category's admitted gap

Every 2026 roundup lands on the same sentence: *almost no single tool covers
the entire funnel well*. The working stack is a sourcing engine + a separate
enrichment vendor + a separate outreach layer. Nobody owns the intelligence
that sits across all three, and nobody guides the hiring manager or the
candidate through the process.

## 2. Honest scorecard

| Dimension | Metaview | hireEZ | Heartbeat.ai | TalentOS today | TalentOS can win? |
| --- | --- | --- | --- | --- | --- |
| Candidate index | ATS + open web (secondary) | 800M scraped | 11M clinicians | Two 50-domain people-only CSEs, link-out | **No** on volume. Yes on precision and auditability |
| Verified contact data | none | emails, ~30 % bounce | cell + email, 82–95 % | name-pattern "unverified" only | **No** on personal contact. Yes on *identity* verification via public registries |
| Calibration loop | interview recordings → ranking, 12–18 mo | none | none | append-only accept/dismiss/correct history with exact anchors | **Yes** — same loop, no recording bot, usable from search one |
| Transparency of the search | ranked list "with reasons" | opaque AI match | filter list | composed query always visible/editable; every suggestion carries an exact quote | **Yes** — already a hard rule |
| Lifecycle coverage | source → screen → notes → scorecard | source → outreach → CRM | source → contact | intake → strategy → strings → review → shortlist → close | **Yes** — plus HM and candidate threads (roadmap) |
| Hiring-manager guidance | debrief notes | none | none | intake + calibration checkpoints (roadmap) | **Yes**, uncontested |
| Candidate guidance | AI screening calls | sequences | none | drafts only, recruiter sends | **Yes**, uncontested |
| Interview capture | bot on every call | none | none | none, by design | No, and don't chase it |
| Sequencing / auto-send | yes | yes | via Zapier | drafts only | No, by design |
| Privacy posture | records candidates | GDPR complaint | not a CRA, no safe harbour | local SQLite, no scraping, stores only what the recruiter saves | **Yes**, strongest in the set |
| Price / control | $100–300 per user-month + quoted bundle | ~$13k/yr median, escalating | ~$750/mo | owner's Claude subscription + Google BYOK at $5/1,000 queries, no seats, no credits | **Yes**, by an order of magnitude |
| ATS write-back | 47 ATSs | 45+ | Bullhorn, Apploi | none (out of scope) | Not now |

## 3. Where TalentOS beats all three — the thesis

**Metaview is right that calibration beats Boolean, and wrong that it needs a
recording bot.** hireEZ and Heartbeat sell data and admit it decays. TalentOS
should be the calibrated intelligence and workflow layer that sits *on top of*
whichever data the recruiter already has, wins on evidence and cost, and
never fabricates.

Five claims TalentOS can make that none of the three can:

1. **Zero fabricated evidence.** Every suggestion is anchored to an exact
   passage or a live link the recruiter can open. Fabricated quotes are
   rejected at import. Measurable; already built.
2. **Calibration from search one, without surveillance.** Accept, dismiss and
   correction decisions already exist as append-only history. Feed them back
   into the query composer and the ranking. No call recording, no consent
   forms, no 12-month warm-up.
3. **You always see what was searched.** Rule 6. hireEZ's "generic" AI match
   and Metaview's black-box shortlist cannot be audited; TalentOS strings can
   be read, edited and re-run.
4. **Two-sided guidance.** HM thread and candidate thread (ROADMAP-AGENT-TEAMS)
   are uncontested by all three.
5. **No seats, no credits, no renewal escalation.** Local-first on the
   owner's subscription plus BYOK Google. A solo recruiter paying hireEZ
   $2–3k/yr is the beachhead.

## 4. What to build, in order of evidence

Ordered by how directly each item attacks a documented competitor weakness
while staying inside the product rules (link-out only, no bulk persistence,
no auto-send, no model API key, unverified emails labelled).

1. **Run the 3×5 pilot first.** Nothing below is a competitive claim until
   review time, evidence-location time, corrections and acceptance rate are
   measured on real documents. Already the open gate.

2. **Decision-to-query calibration loop** (attacks Metaview's moat).
   - Each accept/dismiss/correct on a requirement link becomes a weighted
     signal on the requirement, the title synonyms and the platform it came
     from.
   - On the next string generation for the same search or a lookalike, the
     composer widens terms that produced accepted evidence and drops ones
     that only produced dismissals. Pre-composer normalization only, so the
     validated reference composer stays untouched.
   - Show the recruiter *why* a term moved ("3 accepted anchors, 0
     dismissed"). This is Metaview's "shortlist with reasons" done in the
     open.

3. **Yield ledger for search strings** (attacks hireEZ's opaque match and
   the String Lab's own B grade).
   - Persist per query: engine, platform, word count, and the count of URLs
     the recruiter explicitly saved from it. Allowed by rule 2 — queries and
     saved URLs only.
   - Roll up per role family: which platforms yield, which never do. This
     delivers the profession-aware platform pruning already in the backlog
     with data instead of guesswork, and gives the pilot its own metric.
   - Ship the backlog QA items with it: 32-word budget per engine,
     cross-surface dedupe, OR-group dedupe, paren/quote balance warnings.

4. **Registry-verified identity** (attacks Heartbeat and hireEZ on the axis
   they cannot claim).
   - Heartbeat sells *reachability*; nobody sells *verification*. The CMS
     NPPES registry is public, free, authoritative, and returns name,
     credential, taxonomy, practice address and office phone. Match a found
     clinician to their NPI record and label the identity "registry-matched"
     with the registry as the source. Extend to state licence boards and
     professional bodies as Engine 2 already targets them.
   - Say plainly: this gives you the verified person and their practice
     contact, not a personal cell. Recruiters who need cells keep paying
     Heartbeat; TalentOS still owns the workflow.

5. **Bring-your-own-data imports** (turns all three into suppliers).
   - CSV/JSON import adapters for hireEZ exports, Heartbeat file-upload
     results, LinkedIn Recruiter project exports and ATS candidate exports,
     mapped into the existing candidate and document-version tables with
     source labels.
   - Positioning: "keep your data vendor; put TalentOS's intelligence on
     top". This is exactly the stack the 2026 roundups say buyers assemble
     by hand.

6. **HM thread and candidate thread** as specified in ROADMAP-AGENT-TEAMS.
   Uncontested; the pilot will show whether HM stall nudges or candidate
   stage packets matter more.

7. **Transparent pricing and a "what we will not do" page** as marketing.
   Publish the cost model. State: no scraping, no auto-send, no interview
   recording, no protected-characteristic fields, no fabricated evidence.
   Every one of those is a line item on a competitor's complaint page.

## 5. What not to chase

- A scraped profile index. Forbidden by the rules, by source terms, and it
  is the thing hireEZ is being complained about for.
- Personal cell/email enrichment. Heartbeat's own accuracy is 82–95 % with
  no safe harbour; TalentOS cannot do better lawfully and should not try.
- An interview recording bot. It is Metaview's whole product and their
  reviewers' main source of complaints.
- Hosted sequencing. Drafts only is a feature, not a gap.
- ATS write-back before the pilot proves the review loop.

## 6. Sources

- Metaview: https://www.metaview.ai/ · https://www.metaview.ai/pricing ·
  https://www.metaview.ai/resources/blog/technical-sourcing ·
  https://www.noon.ai/blog/articles/265-metaview-review ·
  https://www.bluedothq.com/blog/metaview-review ·
  https://www.g2.com/products/metaview/reviews
- hireEZ: https://www.pin.com/blog/hireez-pricing/ ·
  https://mindhuntai.com/blog/hireez-review ·
  https://skima.ai/blog/product-deep-dives/hireez-review ·
  https://www.g2.com/products/hireez/reviews ·
  https://www.trustpilot.com/review/hireez.com ·
  https://www.vendr.com/marketplace/hireez
- Heartbeat.ai: https://heartbeat.ai/resources/provider-contact-data/ ·
  https://heartbeat.ai/resources/company/about-heartbeat-ai/ ·
  https://www.g2.com/products/heartbeat-ai/reviews ·
  https://sourceforge.net/software/product/Heartbeat.AI/
- Category: https://dupple.com/learn/best-ai-sourcing-tools ·
  https://info.juicebox.ai/best-ai-sourcing-tools
