/**
 * Sourcing angles: the search-operator craft, encoded as data.
 *
 * A sourcer's real skill is knowing that CVs hide behind
 * `filetype:pdf ("curriculum vitae" OR resume) -template -sample`, that
 * conference speaker pages are a goldmine, and that award lists are
 * pre-filtered talent pools. This module holds that craft so one brief fans
 * out across every angle at once.
 *
 * Every angle carries the reason it finds passive people, and that reason is
 * shown to the recruiter — including for angles that cannot run, so they can
 * see what a connector is worth before turning it on.
 *
 * Ported from Hu (`app/sources/dorks.py`). Industry-neutral by construction:
 * the vocabulary comes from the brief, never from a hardcoded sector bias.
 */
import {
  keywords,
  negativeTerms,
  expandedSkills,
  type SourcingBrief,
} from "@/lib/sourcing/query-language";
import { isDirect } from "@/lib/sourcing/ontology";

/** What kind of thing an angle returns. */
export type AngleKind =
  | "document"
  | "page"
  | "list"
  | "paper"
  | "patent"
  | "dataset"
  | "repository"
  | "profile";

export interface SourcingAngle {
  name: string;
  label: string;
  kind: AngleKind;
  /** `{kw}` free text, `{skills}`, `{titles}`, `{orgs}`, `{locs}`. */
  pattern: string;
  /** Why this angle finds people who are not looking. Always shown. */
  rationale: string;
  filetypes?: readonly string[];
  negatives?: readonly string[];
  /** Only fires when the brief supplies these slots. */
  requires?: readonly string[];
  weight: number;
  tags?: readonly string[];
}

/** Noise that shows up in every people-search and never means a person. */
export const GLOBAL_NEGATIVES = [
  "-template",
  "-sample",
  "-example",
  '-"how to write"',
  '-"cover letter"',
] as const;

export const JOB_BOARD_NEGATIVES = [
  '-"job description"',
  '-"apply now"',
  '-"we are hiring"',
  "-site:indeed.com",
  "-site:glassdoor.com",
  "-site:ziprecruiter.com",
  "-site:monster.com",
  "-site:seek.com.au",
  "-site:naukri.com",
] as const;

export const ANGLES: readonly SourcingAngle[] = [
  {
    name: "cv_pdf",
    label: "Public CVs and résumés (PDF)",
    kind: "document",
    pattern: '{kw} ("curriculum vitae" OR "resume" OR "résumé" OR "cv")',
    filetypes: ["pdf"],
    rationale:
      "People who publish a PDF CV are documenting themselves for peers, not applying for a job. It is the densest single source of employment history, education and contact routes on the open web.",
    negatives: [
      ...GLOBAL_NEGATIVES,
      ...JOB_BOARD_NEGATIVES,
      '-"resume template"',
    ],
    weight: 1.35,
    tags: ["cv", "resume"],
  },
  {
    name: "cv_doc",
    label: "Public CVs (Word/RTF)",
    kind: "document",
    pattern:
      '{kw} ("curriculum vitae" OR resume) ("work experience" OR "professional experience")',
    filetypes: ["doc", "docx", "rtf"],
    rationale:
      "Older or academic CVs are still commonly posted as Word documents.",
    negatives: [...GLOBAL_NEGATIVES, ...JOB_BOARD_NEGATIVES],
    weight: 1.0,
    tags: ["cv", "resume"],
  },
  {
    name: "academic_cv",
    label: "Academic CVs on university domains",
    kind: "document",
    pattern:
      '{kw} ("curriculum vitae" OR cv) (site:.edu OR site:.ac.uk OR site:.edu.au)',
    filetypes: ["pdf"],
    rationale:
      "Faculty and research staff maintain full CVs on institutional hosts, including grants, supervision history and prior industry roles.",
    weight: 1.15,
    tags: ["cv"],
  },
  {
    name: "personal_site_bio",
    label: "Personal sites and about pages",
    kind: "page",
    pattern:
      '{kw} (intitle:"about me" OR intitle:"about" OR inurl:/about OR inurl:/bio)',
    rationale:
      "A self-hosted bio is written by the person, is rarely indexed by recruiting tools, and usually links out to everything else they own.",
    negatives: [...GLOBAL_NEGATIVES],
    weight: 1.2,
    tags: ["bio"],
  },
  {
    name: "portfolio",
    label: "Portfolios and personal work pages",
    kind: "page",
    pattern:
      '{kw} (intitle:portfolio OR inurl:/portfolio OR intitle:"selected work")',
    rationale:
      "Designers, architects, writers and creative engineers show capability through work samples rather than job titles.",
    weight: 1.0,
    tags: ["portfolio"],
  },
  {
    name: "team_page",
    label: "Company team and leadership pages",
    kind: "list",
    pattern:
      '{kw} (inurl:/team OR inurl:/people OR inurl:/our-team OR intitle:"our team" OR intitle:leadership)',
    rationale:
      "Team pages name people who are employed and therefore passive. They also give the exact current employer, which dated profiles do not.",
    negatives: ['-"join our team"', "-careers", '-"open roles"'],
    weight: 1.25,
    tags: ["team_page", "directory_record"],
  },
  {
    name: "staff_directory",
    label: "Staff and faculty directories",
    kind: "list",
    pattern:
      '{kw} (inurl:/directory OR inurl:/staff OR inurl:/faculty OR intitle:"staff directory")',
    rationale:
      "Institutional directories are structured, complete and updated — the closest thing to an org chart that exists publicly.",
    weight: 1.15,
    tags: ["directory_record"],
  },
  {
    name: "conference_speaker",
    label: "Conference speakers and programmes",
    kind: "list",
    pattern:
      '{kw} (intitle:speakers OR inurl:/speakers OR "keynote" OR "invited talk" OR "programme committee")',
    rationale:
      "Speaking is a public commitment of expertise. Speaker pages carry a name, a current employer, a topic and often a contact route.",
    weight: 1.3,
    tags: ["conference_profile", "talk"],
  },
  {
    name: "award_list",
    label: "Award winners and recognition lists",
    kind: "list",
    pattern:
      '{kw} ("award winner" OR "recipients" OR "honoree" OR "40 under 40" OR "fellow of the")',
    rationale:
      "Award lists are pre-vetted talent pools: somebody credible has already ranked these people against their peers.",
    weight: 1.2,
    tags: ["directory_record"],
  },
  {
    name: "professional_body",
    label: "Professional body membership rolls",
    kind: "list",
    pattern:
      '{kw} ("member directory" OR "membership roll" OR "chartered" OR "registered" OR "licensed")',
    rationale:
      "Licensed professions — medicine, law, engineering, accountancy, surveying — publish member registers with verified credentials.",
    weight: 1.1,
    tags: ["directory_record", "government_record"],
  },
  {
    name: "patent_inventor",
    label: "Named inventors on patents",
    kind: "patent",
    pattern:
      '{kw} (site:patents.google.com OR "inventor:" OR "united states patent")',
    rationale:
      "Inventors are named individually and dated. A patent proves hands-on depth in a narrow area that no CV summary can.",
    weight: 1.15,
    tags: ["patent"],
  },
  {
    name: "press_expert",
    label: "Experts quoted in press and analysis",
    kind: "page",
    pattern:
      '{kw} ("said" OR "according to" OR "told us") ("head of" OR "director of" OR "professor of")',
    rationale:
      "Journalists quote the person a company puts forward as its authority on a subject. That is a strong seniority and credibility signal.",
    weight: 0.9,
    tags: ["bio"],
  },
  {
    name: "podcast_guest",
    label: "Podcast and webinar guests",
    kind: "page",
    pattern:
      '{kw} ("episode" OR "guest" OR "in conversation with") (inurl:/podcast OR inurl:/episode)',
    rationale:
      "Long-form guests explain how they actually work, which is far richer context for outreach than any profile headline.",
    weight: 0.85,
    tags: ["talk"],
  },
  {
    name: "job_change",
    label: "Appointment and promotion announcements",
    kind: "page",
    pattern:
      '{kw} ("has joined" OR "appointed as" OR "welcomes" OR "promoted to" OR "named as")',
    rationale:
      "Announcements timestamp a move. Someone 18–30 months into a role is statistically the most receptive passive candidate there is.",
    weight: 1.05,
    tags: ["bio"],
  },
  {
    name: "people_dataset",
    label: "Spreadsheets and datasets listing people",
    kind: "dataset",
    pattern:
      '{kw} ("name" AND ("title" OR "role" OR "organisation" OR "organization"))',
    filetypes: ["csv", "xls", "xlsx"],
    rationale:
      "Attendee lists, grant registers, exhibitor lists and committee rosters are routinely published as spreadsheets and never indexed by talent tools.",
    weight: 1.1,
    tags: ["dataset", "directory_record"],
  },
  {
    name: "grant_register",
    label: "Grant and funding registers",
    kind: "dataset",
    pattern:
      '{kw} ("principal investigator" OR "grant awarded" OR "funded project" OR "award number")',
    rationale:
      "Funding registers name the lead researcher, the institution, the budget and the dates — a fully sourced profile in one row.",
    weight: 1.05,
    tags: ["dataset", "government_record"],
  },
  {
    name: "alumni_list",
    label: "Alumni and cohort lists",
    kind: "list",
    pattern: '{kw} ("alumni" OR "cohort" OR "class of" OR "graduating class")',
    rationale:
      "Alumni pages map a person's network and let you source whole cohorts from a programme known to produce the skill you need.",
    weight: 0.95,
    tags: ["directory_record"],
  },
  {
    name: "publication_author",
    label: "Paper authors and preprints",
    kind: "paper",
    pattern:
      '{kw} ("we present" OR "in this paper" OR abstract) (filetype:pdf OR site:arxiv.org)',
    rationale:
      "Authorship is dated, attributed and specific. It is the best evidence of deep technical or clinical capability outside of employment.",
    filetypes: ["pdf"],
    weight: 1.2,
    tags: ["publication"],
  },
  {
    name: "thesis",
    label: "Theses and dissertations",
    kind: "document",
    pattern:
      '{kw} ("thesis submitted" OR "dissertation" OR "in partial fulfilment")',
    filetypes: ["pdf"],
    rationale:
      "A thesis names the author, supervisor and institution, and marks someone at a natural career transition point.",
    weight: 1.0,
    tags: ["publication"],
  },
  {
    name: "repo_owner",
    label: "Repository owners and contributors",
    kind: "repository",
    pattern: "{kw} (site:github.com OR site:gitlab.com OR site:huggingface.co)",
    rationale: "Public code is demonstrated, dated, reviewable capability.",
    weight: 1.0,
    tags: ["repository"],
  },
  {
    name: "contact_route",
    label: "Pages exposing a professional contact route",
    kind: "page",
    pattern: '{kw} ("contact me" OR "email me" OR "get in touch")',
    rationale:
      "Only runs when the brief asks for contact routes. Talent records the professional address a person chose to publish — nothing else.",
    requires: ["kw"],
    weight: 0.8,
    tags: ["bio"],
  },
];

/**
 * Sector vocabulary, added only when the brief names an industry. Keeps the
 * platform genuinely cross-sector instead of quietly tech-shaped.
 */
export const INDUSTRY_HINTS: Readonly<Record<string, readonly string[]>> = {
  healthcare: [
    "physician",
    "clinician",
    "consultant",
    "registrar",
    "board certified",
    "fellowship",
  ],
  medicine: [
    "physician",
    "consultant",
    "attending",
    "board certified",
    "residency",
  ],
  nursing: ["registered nurse", "rn", "nurse practitioner", "ward", "clinical"],
  law: [
    "solicitor",
    "barrister",
    "attorney",
    "counsel",
    "partner",
    "admitted to practice",
    "bar number",
  ],
  finance: ["cfa", "portfolio manager", "analyst", "trading", "risk", "audit"],
  accounting: ["cpa", "aca", "acca", "chartered accountant", "audit", "tax"],
  construction: [
    "chartered engineer",
    "site manager",
    "quantity surveyor",
    "riba",
    "ceng",
  ],
  architecture: ["riba", "aia", "architect", "practice", "competition"],
  education: ["teacher", "lecturer", "head of department", "qts", "curriculum"],
  academia: [
    "professor",
    "postdoc",
    "principal investigator",
    "lecturer",
    "faculty",
  ],
  manufacturing: [
    "plant manager",
    "lean",
    "six sigma",
    "production",
    "quality engineer",
  ],
  energy: ["upstream", "renewables", "grid", "hse", "commissioning"],
  aerospace: [
    "airworthiness",
    "propulsion",
    "avionics",
    "flight test",
    "as9100",
  ],
  automotive: [
    "powertrain",
    "vehicle dynamics",
    "homologation",
    "iatf",
    "adas",
  ],
  biotech: [
    "gmp",
    "assay",
    "clinical trial",
    "regulatory affairs",
    "bioprocess",
  ],
  pharma: [
    "gxp",
    "clinical development",
    "medical affairs",
    "regulatory",
    "pharmacovigilance",
  ],
  retail: ["merchandising", "buying", "category manager", "store operations"],
  hospitality: ["head chef", "general manager", "front of house", "michelin"],
  logistics: ["supply chain", "freight", "warehouse", "s&op", "procurement"],
  public_sector: [
    "civil service",
    "council",
    "director of",
    "statutory",
    "procurement",
  ],
  creative: [
    "art director",
    "creative director",
    "showreel",
    "portfolio",
    "d&ad",
  ],
  sports: ["head coach", "performance", "s&c", "academy", "physiotherapist"],
  agriculture: [
    "agronomist",
    "farm manager",
    "crop",
    "veterinary",
    "husbandry",
  ],
  marine: ["naval architect", "class society", "dry dock", "master mariner"],
  insurance: ["underwriter", "actuary", "claims", "broker", "lloyd's"],
  real_estate: ["mrics", "surveyor", "asset manager", "leasing", "valuation"],
};

export function industryTerms(brief: SourcingBrief): string[] {
  const out: string[] = [];
  for (const industry of brief.industries) {
    const key = industry.replace(/[\s-]/g, "_");
    out.push(...(INDUSTRY_HINTS[key] ?? []));
  }
  return out;
}

export function angleApplies(
  angle: SourcingAngle,
  brief: SourcingBrief,
): boolean {
  const slots: Record<string, boolean> = {
    skills: brief.skills.length > 0 || brief.skillTerms.length > 0,
    titles: brief.titles.length > 0,
    orgs: brief.orgs.length > 0,
    locs: brief.locations.length > 0,
    kw:
      keywords(brief).length > 0 ||
      brief.skillTerms.length > 0 ||
      brief.titles.length > 0,
  };
  for (const required of angle.requires ?? []) {
    if (!slots[required]) return false;
  }
  // A filetype-scoped brief mutes angles that target other formats.
  if (
    brief.filetypes.length > 0 &&
    angle.filetypes &&
    angle.filetypes.length > 0
  ) {
    if (!angle.filetypes.some((ft) => brief.filetypes.includes(ft)))
      return false;
  }
  if (brief.artifactTypes.length > 0 && angle.tags && angle.tags.length > 0) {
    if (!angle.tags.some((t) => brief.artifactTypes.includes(t))) return false;
  }
  return true;
}

function orGroup(values: string[], limit = 6): string {
  const items = values
    .filter((v) => v && v.trim())
    .slice(0, limit)
    .map((v) => v.trim());
  if (items.length === 0) return "";
  const quoted = items.map((v) => (v.includes(" ") ? `"${v}"` : v));
  return quoted.length === 1 ? quoted[0] : `(${quoted.join("|")})`;
}

function skillGroup(brief: SourcingBrief, includeAdjacent: boolean): string {
  const terms = [...brief.skillTerms];
  if (includeAdjacent) {
    for (const exp of expandedSkills(brief)) {
      if (!isDirect(exp)) terms.push(exp.label);
    }
  }
  return orGroup(terms, 6);
}

/** Fill an angle from the brief and append the brief's own operators. */
export function renderAngle(
  angle: SourcingAngle,
  brief: SourcingBrief,
  options: { includeAdjacent?: boolean } = {},
): string {
  const skills = skillGroup(brief, options.includeAdjacent === true);
  const titles = orGroup(brief.titles);
  const orgs = orGroup(brief.orgs);
  const locs = orGroup(brief.locations);

  let kwParts = [skills, titles, orgs].filter(Boolean);
  if (kwParts.length === 0) kwParts = [orGroup(keywords(brief), 6)];
  const kw = kwParts.filter(Boolean).join(" ");

  const query = angle.pattern
    .replace(/\{kw\}/g, kw)
    .replace(/\{skills\}/g, skills)
    .replace(/\{titles\}/g, titles)
    .replace(/\{orgs\}/g, orgs)
    .replace(/\{locs\}/g, locs);

  const extras: string[] = [];
  if (locs && !angle.pattern.includes("{locs}")) extras.push(locs);
  for (const hint of industryTerms(brief).slice(0, 4)) {
    extras.push(hint.includes(" ") ? `"${hint}"` : hint);
  }

  // The brief's own operators always win over the angle's defaults.
  if (brief.filetypes.length > 0) {
    extras.push(orGroup(brief.filetypes.map((ft) => `filetype:${ft}`)));
  } else if (
    angle.filetypes &&
    angle.filetypes.length > 0 &&
    !query.includes("filetype:")
  ) {
    extras.push(orGroup(angle.filetypes.map((ft) => `filetype:${ft}`)));
  }

  for (const site of brief.includeSites) extras.push(`site:${site}`);
  for (const site of brief.excludeSites) extras.push(`-site:${site}`);
  for (const phrase of brief.intitle) {
    extras.push(
      phrase.includes(" ") ? `intitle:"${phrase}"` : `intitle:${phrase}`,
    );
  }
  for (const phrase of brief.inurl) extras.push(`inurl:${phrase}`);
  for (const phrase of brief.intext) {
    extras.push(
      phrase.includes(" ") ? `intext:"${phrase}"` : `intext:${phrase}`,
    );
  }
  for (const term of negativeTerms(brief)) {
    extras.push(term.text.includes(" ") ? `-"${term.text}"` : `-${term.text}`);
  }
  extras.push(...(angle.negatives ?? []));

  return [query, ...extras]
    .filter(Boolean)
    .join(" ")
    .split(/\s+/)
    .join(" ")
    .trim();
}

export interface PlannedAngle {
  angle: SourcingAngle;
  query: string;
}

/** Every applicable angle, rendered, best-weighted first. */
export function planAngles(
  brief: SourcingBrief,
  options: { includeAdjacent?: boolean; limit?: number } = {},
): PlannedAngle[] {
  // With nothing to search for, every angle renders to bare operators — a
  // query that matches the whole web and means nothing.
  if (
    brief.skillTerms.length === 0 &&
    keywords(brief).length === 0 &&
    brief.titles.length === 0 &&
    brief.orgs.length === 0 &&
    brief.names.length === 0
  ) {
    return [];
  }

  const out: PlannedAngle[] = [];
  for (const angle of ANGLES) {
    if (!angleApplies(angle, brief)) continue;
    if (
      angle.name === "contact_route" &&
      !brief.has.includes("email") &&
      !brief.has.includes("contact")
    ) {
      continue;
    }
    const query = renderAngle(angle, brief, options);
    if (!query) continue;
    out.push({ angle, query });
  }
  out.sort((a, b) => b.angle.weight - a.angle.weight);
  return options.limit ? out.slice(0, options.limit) : out;
}

export function angleByName(name: string): SourcingAngle | null {
  return ANGLES.find((a) => a.name === name) ?? null;
}
