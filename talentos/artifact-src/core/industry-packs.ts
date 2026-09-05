/**
 * Industry packs (spec §7). "Universal" is the default and the fallback;
 * the others adapt what the agents are told to look for, which platforms
 * are worth compiling for, and which kinds of evidence exist at all.
 *
 * A pack is guidance and platform selection — never a requirement, never a
 * filter, and never a claim. `applies()` only ever SUGGESTS a pack; the
 * recruiter selects it, and the selection is a consequential context field
 * so switching it re-versions the search and marks outputs stale.
 */
import type { SearchContext } from "./search-context";
import type { SourceKind } from "./research";

export interface PackSuggestion {
  score: number;
  reason: string;
}

export interface IndustryPack {
  id: string;
  label: string;
  summary: string;
  /** Extra themes the intake interview must cover for this field. */
  intakeThemes: string[];
  /** What counts as observable evidence here, and what only looks like it. */
  evidenceNotes: string[];
  /** Field-specific honesty and fair-hiring cautions carried into prompts. */
  cautions: string[];
  /** Platform tags the query compiler should offer beyond "general". */
  platformTags: string[];
  /** Source kinds that actually bear on this field's claims. */
  sourceKinds: SourceKind[];
  /** How strongly this pack fits a search. 0 = not this pack. */
  applies(ctx: SearchContext): PackSuggestion;
}

const hay = (ctx: SearchContext): string =>
  [
    ctx.industry,
    ctx.subindustry,
    ctx.profession,
    ctx.roleFamily,
    ctx.roleTitle,
    ctx.company,
    ctx.jobDescription.slice(0, 2000),
  ]
    .join(" ")
    .toLowerCase();

const hits = (text: string, words: string[]): string[] =>
  words.filter((w) => text.includes(w));

function matcher(words: string[], noun: string) {
  return (ctx: SearchContext): PackSuggestion => {
    const found = hits(hay(ctx), words);
    return found.length
      ? {
          score: Math.min(1, found.length / 3),
          reason: `${noun} vocabulary in the brief: ${found.slice(0, 4).join(", ")}.`,
        }
      : {
          score: 0,
          reason: `No ${noun.toLowerCase()} vocabulary in the brief.`,
        };
  };
}

export const UNIVERSAL_PACK: IndustryPack = {
  id: "universal",
  label: "Universal",
  summary:
    "The default. No field-specific assumptions — evidence is whatever the brief and the hiring manager define it to be.",
  intakeThemes: [
    "Why the role exists now, and what changes if it stays unfilled",
    "What the first 90 and 180 days must produce",
    "Which requirements are trainable and which are genuinely non-negotiable",
  ],
  evidenceNotes: [
    "Evidence is whatever a person has publicly done that a requirement names. Say what would satisfy each requirement before searching for it.",
  ],
  cautions: [
    "Without a field-specific pack, do not assume a credential, a school or an employer means anything in particular. Name the construct instead.",
  ],
  platformTags: [],
  sourceKinds: ["job_openings", "compensation", "government_labor_statistics"],
  applies: () => ({
    score: 0.01,
    reason: "Always applicable — the fallback when nothing more specific fits.",
  }),
};

export const INDUSTRY_PACKS: IndustryPack[] = [
  UNIVERSAL_PACK,
  {
    id: "healthcare",
    label: "Healthcare & clinical",
    summary:
      "Licensed and credentialed clinical roles. Registration status, scope of practice, setting and rota shape the population more than titles do.",
    intakeThemes: [
      "Registration body, licence type and whether it must be in hand on day one",
      "Setting and acuity (ICU vs ward vs community) — the same title is a different job",
      "Shift pattern, rota, on-call and unsocial-hours expectations",
      "Supervision, scope of practice and what the post can and cannot do independently",
      "Revalidation, mandatory training and any specialist competencies",
    ],
    evidenceNotes: [
      "A licence or registration number in a public registry is checkable evidence; a claimed registration on a profile is not.",
      "Setting and acuity are usually inferable from the employer and unit, not from the job title.",
    ],
    cautions: [
      "A registry entry proves enumeration, not that a person is currently licensed, credentialed or in good standing. Say which you actually checked.",
      "Never infer health status, disability or caring responsibilities from a career gap or a shift preference.",
    ],
    platformTags: [],
    sourceKinds: [
      "licence_registry",
      "compensation",
      "job_openings",
      "government_labor_statistics",
    ],
    applies: matcher(
      [
        "nurse",
        "nursing",
        "clinician",
        "clinical",
        "physician",
        "doctor",
        "hospital",
        "icu",
        "healthcare",
        "health care",
        "patient",
        "nhs",
        "medical",
        "midwife",
        "paramedic",
        "pharmacist",
        "therapist",
      ],
      "Clinical",
    ),
  },
  {
    id: "ai_ml_research",
    label: "AI / ML research",
    summary:
      "Research scientists and research engineers. Publication record, research taste and experimental execution matter more than years of service.",
    intakeThemes: [
      "Scientist versus engineer, and how much of each this post really is",
      "Publication expectations: venues, first-authorship, and whether open-source artifacts count equally",
      "Research taste — what a good problem choice looks like here, concretely",
      "Scale of experiments the post will actually run, and the infrastructure they must build themselves",
      "Mission alignment, publication freedom and what the team competes on when it loses candidates",
    ],
    evidenceNotes: [
      "First-author papers, open-source research artifacts, benchmark and eval contributions, and cited preprints are observable.",
      "A named lab or advisor on a profile is a proxy for training, not evidence of independent research judgment.",
    ],
    cautions: [
      "Citation counts measure attention and field size as much as quality. Never use them as a threshold on their own.",
      "A PhD is a proxy: name what it stands for here, and put the proxy itself in the false signals.",
    ],
    platformTags: ["research", "engineering"],
    sourceKinds: [
      "publications",
      "leadership",
      "competitor_moves",
      "company_initiatives",
    ],
    applies: matcher(
      [
        "machine learning",
        "deep learning",
        "research scientist",
        "research engineer",
        "neurips",
        "icml",
        "iclr",
        "llm",
        "alignment",
        "ai safety",
        "pytorch",
        "jax",
        "model training",
        "artificial intelligence",
      ],
      "Research",
    ),
  },
  {
    id: "sales",
    label: "Sales & revenue",
    summary:
      "Quota-carrying roles. Segment, motion, deal size and cycle length define the population; attainment claims need context to mean anything.",
    intakeThemes: [
      "Motion and segment: inbound, outbound, PLG, enterprise, mid-market, SMB",
      "Deal size, cycle length and who else sits in the room",
      "Quota, ramp, territory and how much of the number is renewal versus new business",
      "Who they sell to, and whether that buyer relationship is the transferable asset",
      "What the top performer here does that the middle of the team does not",
    ],
    evidenceNotes: [
      "Segment, deal size and buyer persona are usually visible from employer and title history.",
      "Attainment percentages are self-reported and meaningless without the quota, the territory and the year.",
    ],
    cautions: [
      "President's Club and similar awards are employer-specific and not comparable across companies. Treat them as a proxy and name it.",
      "A short tenure in this field is often a company failing, not a person failing. Do not read it as a disqualifier without asking.",
    ],
    platformTags: [],
    sourceKinds: [
      "job_openings",
      "compensation",
      "competitor_moves",
      "layoffs",
      "company_initiatives",
    ],
    applies: matcher(
      [
        "account executive",
        "sales",
        "quota",
        "revenue",
        "business development",
        "sdr",
        "bdr",
        "customer success",
        "enterprise saas",
        "pipeline generation",
        "closing",
      ],
      "Sales",
    ),
  },
  {
    id: "skilled_trades",
    label: "Skilled trades & operations",
    summary:
      "Certificated, hands-on and shift-based work. Tickets, machine and platform experience, and travel radius decide reachability.",
    intakeThemes: [
      "Tickets, cards and certifications: which are legally required and which are trainable",
      "Specific machines, controls, materials or platforms the post must already know",
      "Shift pattern, site location, travel radius and whether transport is realistic",
      "Tolerance, safety and quality standards the work is actually held to",
      "Whether the employer will fund a ticket, and how long that takes",
    ],
    evidenceNotes: [
      "Named machines, controls and certifications on a profile or CV are concrete and checkable with the awarding body.",
      "Years of service is a weak signal here; the machines and tolerances worked to are the strong one.",
    ],
    cautions: [
      "Public profiles are sparse in these fields. Absence of an online presence is not absence of skill — plan for rosters, directories and referrals.",
      "Never treat a travel radius or shift constraint as a proxy for anything about the person's circumstances.",
    ],
    platformTags: [],
    sourceKinds: [
      "job_openings",
      "compensation",
      "occupational_taxonomy",
      "government_labor_statistics",
    ],
    applies: matcher(
      [
        "cnc",
        "machinist",
        "welder",
        "electrician",
        "technician",
        "fabrication",
        "maintenance",
        "hvac",
        "plumber",
        "manufacturing",
        "warehouse",
        "forklift",
        "apprenticeship",
        "tooling",
      ],
      "Trades",
    ),
  },
  {
    id: "finance",
    label: "Finance & accounting",
    summary:
      "Regulated and qualification-led roles. Standards, entity complexity and audit exposure define the population more than headcount does.",
    intakeThemes: [
      "Qualification required (and whether part-qualified or qualified-by-experience is genuinely acceptable)",
      "Reporting standards and jurisdictions: IFRS, GAAP, statutory, multi-entity, multi-currency",
      "Audit exposure, systems and the ERP the post must already know",
      "Whether this is a technical, commercial or controls-heavy post — the same title covers all three",
      "Regulatory regime and any approved-person or fit-and-proper requirement",
    ],
    evidenceNotes: [
      "Qualification bodies, ERP systems and named standards are observable and specific.",
      "Company size on a profile is a weak proxy for entity complexity, which is what actually transfers.",
    ],
    cautions: [
      "A Big Four background is a proxy for training and exposure; name the construct and list the proxy as a false signal.",
      "Never infer anything from a regulatory register beyond what it actually records.",
    ],
    platformTags: [],
    sourceKinds: [
      "compensation",
      "leadership",
      "company_initiatives",
      "government_labor_statistics",
    ],
    applies: matcher(
      [
        "accountant",
        "accounting",
        "finance",
        "controller",
        "cfo",
        "audit",
        "ifrs",
        "gaap",
        "financial reporting",
        "treasury",
        "fp&a",
        "tax",
        "bookkeep",
      ],
      "Finance",
    ),
  },
];

export function packById(id: string | undefined): IndustryPack {
  return INDUSTRY_PACKS.find((p) => p.id === id) ?? UNIVERSAL_PACK;
}

export function packFor(ctx: SearchContext): IndustryPack {
  return packById(ctx.selectedIndustryPack);
}

/** Best non-universal suggestion, when the brief clearly points at one. */
export function suggestPack(
  ctx: SearchContext,
): { pack: IndustryPack; reason: string } | null {
  const scored = INDUSTRY_PACKS.filter((p) => p.id !== "universal")
    .map((pack) => ({ pack, ...pack.applies(ctx) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best || best.pack.id === ctx.selectedIndustryPack) return null;
  return { pack: best.pack, reason: best.reason };
}

/** The pack's guidance, as a prompt section. Empty for Universal's defaults. */
export function renderPackSection(pack: IndustryPack): string {
  return `## Industry pack: ${pack.label}
${pack.summary}

Cover these themes wherever they are relevant to this module:
${pack.intakeThemes.map((t) => `- ${t}`).join("\n")}

What counts as evidence here:
${pack.evidenceNotes.map((t) => `- ${t}`).join("\n")}

Field-specific cautions (mandatory):
${pack.cautions.map((t) => `- ${t}`).join("\n")}`;
}
