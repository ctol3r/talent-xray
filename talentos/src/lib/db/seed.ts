/**
 * Seed: owner user + the six golden fixtures (PRODUCT_SPEC.md) proving the
 * architecture generalizes across radically different searches.
 * Idempotent — runs once, guarded by a settings key.
 */
import { eq } from "drizzle-orm";
import { OWNER_NAME } from "@/lib/product";
import { DEFAULT_PIPELINE_STAGES } from "@/lib/domain/pipeline";
import type { Db } from "./client";
import {
  companies,
  jobDescriptions,
  pipelineStages,
  searchProjects,
  settings,
  users,
} from "./schema";

interface FixtureDefinition {
  name: string;
  company: string;
  roleTitle: string;
  geography: string;
  country: string;
  industry: string;
  seniority: string;
  employmentType: string;
  businessObjective: string;
  jd: string;
}

export const GOLDEN_FIXTURES: FixtureDefinition[] = [
  {
    name: "CAIS — Research Scientist / Research Engineer",
    company: "Center for AI Safety",
    roleTitle: "Research Scientist / Research Engineer",
    geography: "San Francisco, CA",
    country: "United States",
    industry: "AI safety research",
    seniority: "Senior",
    employmentType: "Permanent, full-time",
    businessObjective:
      "Expand empirical ML safety research capacity ahead of next benchmark cycle.",
    jd: `The Center for AI Safety (CAIS) is hiring a Research Scientist or Research Engineer to advance empirical machine learning safety research in San Francisco.

You will design and run experiments on frontier-scale language models: adversarial robustness, dangerous-capability evaluations, unlearning, and benchmark construction. You will own projects end to end — forming hypotheses, building training and evaluation infrastructure, running large-scale experiments, and publishing at top venues.

We are looking for someone with a strong empirical research record (e.g., first-author publications at NeurIPS, ICML, ICLR, or equivalent impact through open-source research artifacts), excellent engineering ability in Python and PyTorch or JAX, and experience with distributed training or large-scale experiment orchestration. Research taste matters more to us than citation counts: we want people who pick important problems and execute quickly.

Familiarity with AI safety literature is preferred. A PhD is common among our researchers but not required — several of our strongest contributors came from engineering-heavy backgrounds. The role is on-site in San Francisco with competitive nonprofit compensation. Interest in reducing societal-scale risks from AI is essential.`,
  },
  {
    name: "Sutter Health — Primary Care Physician",
    company: "Sutter Health",
    roleTitle: "Primary Care Physician",
    geography: "Sacramento, CA",
    country: "United States",
    industry: "Healthcare",
    seniority: "Attending",
    employmentType: "Permanent, full-time",
    businessObjective:
      "Restore panel capacity after two retirements in the Sacramento network.",
    jd: `Sutter Health is seeking a board-certified or board-eligible Primary Care Physician (Family Medicine or Internal Medicine) to join an established outpatient practice in Sacramento, California.

The role is 4.5 clinic days per week with a panel of approximately 1,800 patients, shared after-hours call of roughly 1:8, and full EHR support (Epic). Requirements: MD or DO, active and unrestricted California medical license (or eligibility), board certification or eligibility in Family Medicine or Internal Medicine, and current DEA registration. New residency graduates are welcome; mentorship is available.

Compensation includes a competitive base salary with quality incentives, sign-on bonus, relocation assistance, CME allowance, and a full benefits package. Loan-repayment support may be available. The practice emphasizes continuity of care and team-based medicine with embedded behavioral health.`,
  },
  {
    name: "Meridian — Senior Enterprise Account Executive",
    company: "Meridian Software",
    roleTitle: "Senior Enterprise Account Executive",
    geography: "New York, NY",
    country: "United States",
    industry: "B2B SaaS",
    seniority: "Senior IC",
    employmentType: "Permanent, full-time",
    businessObjective:
      "Open the East-coast enterprise segment for a workflow-automation platform.",
    jd: `Meridian Software is hiring a Senior Enterprise Account Executive in New York to sell our workflow-automation platform to Fortune 1000 accounts.

You will own a named-account territory of roughly 40 enterprise logos, running full-cycle sales: outbound prospecting alongside a BDR, multi-threaded discovery, executive alignment, security and procurement navigation, and close. Typical deals are $150k–$600k ACV with 6–9 month cycles. Quota is $1.4M in new ARR.

We are looking for 7+ years of enterprise SaaS sales experience, consistent attainment above 90% across recent years, experience selling to operations or IT leadership, and command of a structured sales methodology (MEDDICC or similar). Experience displacing legacy BPM tools is a plus. Compensation is a 50/50 OTE split with uncapped commissions and standard enterprise benefits. Hybrid: 3 days per week in the Manhattan office.`,
  },
  {
    name: "Precision Ohio — CNC Machinist",
    company: "Precision Components Ohio",
    roleTitle: "CNC Machinist",
    geography: "Columbus, OH",
    country: "United States",
    industry: "Advanced manufacturing",
    seniority: "Experienced",
    employmentType: "Permanent, full-time, second shift",
    businessObjective:
      "Staff a second shift for a new aerospace contract line.",
    jd: `Precision Components Ohio is hiring CNC Machinists for our Columbus facility supporting a new aerospace contract (second shift, 3:30pm–midnight, shift differential paid).

You will set up and operate 3- and 5-axis CNC mills and lathes (Haas, Mazak), read GD&T-dimensioned prints, hold tolerances to ±0.0005", perform first-article and in-process inspection with CMM support, and edit programs at the control (Mastercam experience is a plus but programming is not required).

Requirements: 3+ years of CNC machining experience in a precision environment, ability to read blueprints and use precision measuring instruments (micrometers, bore gauges, height gauges), and eligibility to work on ITAR-controlled projects. Aerospace or medical-device experience preferred. Journeyman card or NIMS credentials a plus. Overtime available; full benefits after 60 days; tool allowance provided.`,
  },
  {
    name: "Northwind — Chief Financial Officer",
    company: "Northwind Technologies",
    roleTitle: "Chief Financial Officer",
    geography: "Global (HQ: Austin, TX; open to relocation)",
    country: "United States",
    industry: "Technology",
    seniority: "Executive",
    employmentType: "Permanent, full-time",
    businessObjective:
      "Prepare a global 2,400-person technology company for a public offering within 24 months.",
    jd: `Northwind Technologies (2,400 employees, ~$480M revenue, operations in 14 countries) seeks a Chief Financial Officer to lead the company through its next phase: scaling internationally and preparing for a potential public offering within 24 months.

The CFO will own FP&A, accounting, tax, treasury, investor relations, and corporate development, leading a global finance organization of roughly 90. Near-term mandates: IPO readiness (SOX, audit posture, public-company reporting), pricing and margin strategy for a usage-based product line, and a disciplined M&A pipeline.

The ideal candidate has served as CFO or deputy CFO of a technology company through an IPO or in the public markets, has operated internationally, and pairs capital-markets credibility with strong operational finance. Board and audit-committee exposure required. Location flexible with significant travel to Austin and European hubs.`,
  },
  {
    name: "St Pancras — ICU Registered Nurse",
    company: "St Pancras University Hospital",
    roleTitle: "Registered Nurse — Intensive Care Unit",
    geography: "London",
    country: "United Kingdom",
    industry: "Healthcare",
    seniority: "Band 5/6",
    employmentType: "Permanent, full-time, rotating shifts",
    businessObjective:
      "Staff a 12-bed ICU expansion opening in the spring.",
    jd: `St Pancras University Hospital NHS Trust is recruiting Registered Nurses for our expanding Adult Intensive Care Unit in central London (Band 5, with Band 6 opportunities for experienced ICU nurses).

You will deliver level 2 and level 3 critical care: ventilated patients, renal replacement therapy, vasoactive infusions, and post-operative management, working 12.5-hour rotating shifts including nights and weekends.

Requirements: current NMC registration as an Adult Registered Nurse, and for Band 6, a post-registration critical care qualification (or equivalent experience) plus mentorship capability. Newly qualified nurses are supported through a structured ICU development programme with supernumerary time and a dedicated practice educator. We sponsor eligible international candidates and support OSCE preparation. Inner-London high-cost-area supplement applies; Agenda for Change terms.`,
  },
];

async function seedFixture(db: Db, fixture: FixtureDefinition): Promise<void> {
  const [company] = await db
    .insert(companies)
    .values({ name: fixture.company, industry: fixture.industry })
    .returning();
  const [project] = await db
    .insert(searchProjects)
    .values({
      name: fixture.name,
      companyId: company.id,
      companyName: fixture.company,
      roleTitle: fixture.roleTitle,
      geography: fixture.geography,
      country: fixture.country,
      industry: fixture.industry,
      seniority: fixture.seniority,
      employmentType: fixture.employmentType,
      businessObjective: fixture.businessObjective,
    })
    .returning();
  await db.insert(jobDescriptions).values({
    searchProjectId: project.id,
    source: "pasted",
    rawText: fixture.jd,
  });
  await db.insert(pipelineStages).values(
    DEFAULT_PIPELINE_STAGES.map((stage) => ({
      searchProjectId: project.id,
      ...stage,
    })),
  );
}

export async function seed(db: Db): Promise<{ seeded: boolean }> {
  const marker = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "seeded"));
  if (marker.length > 0) return { seeded: false };

  await db.insert(users).values({ name: OWNER_NAME });
  for (const fixture of GOLDEN_FIXTURES) {
    await seedFixture(db, fixture);
  }
  await db
    .insert(settings)
    .values({ key: "seeded", value: { at: new Date().toISOString() } });
  return { seeded: true };
}
