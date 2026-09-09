/**
 * The sourcing benchmark: what the ranker is actually worth, measured.
 *
 * Eight deliberately unlike searches spanning technical, scientific, recruiting,
 * commercial, finance, law, healthcare and construction work. If the ranker
 * only worked for robotics engineers it would be a robotics tool, not a talent
 * search engine, so this is what stops it being tuned into one.
 *
 * Every person below is invented. No real person is described, and the corpus
 * is small — which is the honest limit on what these numbers mean. A precision
 * of 1.00 over thirty-odd people mostly reflects thirty-odd people. See
 * `docs/SOURCING-EVALUATION.md`.
 *
 * `relevant`    people a competent sourcer would shortlist
 * `distractors` people the query drags in wrongly — usually the subject-matter
 *               experts when the query wants whoever recruits or sells to them
 * `expect`      the capability reading the query language should produce
 */
import type { Claim, SourcedPerson } from "@/lib/sourcing/evidence";
import {
  normalizeLocation,
  normalizeName,
  normalizeOrganization,
} from "@/lib/sourcing/normalize";
import { resolveAlias } from "@/lib/sourcing/ontology";
import { parseQuery } from "@/lib/sourcing/query-language";
import { rankPeople } from "@/lib/sourcing/rank";

interface PersonSpec {
  name: string;
  title: string;
  org: string;
  location: string;
  capabilities: string[];
  /** Capabilities inferred rather than observed — "hiring for", "supports". */
  derivedCapabilities?: string[];
  /** Distinct domains the evidence sits on. */
  domains: string[];
  artifacts?: { type: string; title: string; year: number }[];
  email?: boolean;
}

const CORPUS: PersonSpec[] = [
  // ── battery / thermal ───────────────────────────────────────────────────
  {
    name: "Ingrid Falk",
    title: "Principal Engineer, Battery Thermal Safety",
    org: "Vantage Cell Systems",
    location: "Gothenburg, Sweden",
    capabilities: [
      "battery systems",
      "thermal engineering",
      "functional safety",
    ],
    domains: ["vantagecell.invalid", "batteryconf.invalid"],
    artifacts: [
      {
        type: "publication",
        title: "Propagation limits in prismatic packs",
        year: 2024,
      },
    ],
    email: true,
  },
  {
    name: "Bjorn Halvorsen",
    title: "Director of Battery Engineering",
    org: "Orbital Freight",
    location: "Trondheim, Norway",
    capabilities: ["battery systems", "thermal engineering"],
    domains: ["orbitalfreight.invalid"],
    email: true,
  },
  {
    name: "Peter Osei-Bonsu",
    title: "Senior Cell Characterisation Engineer",
    org: "Vantage Cell Systems",
    location: "Gothenburg, Sweden",
    capabilities: ["battery systems", "materials science"],
    domains: ["vantagecell.invalid"],
  },
  {
    name: "Tomas Lindqvist",
    title: "Controls Engineer",
    org: "Vantage Cell Systems",
    location: "Gothenburg, Sweden",
    capabilities: ["controls", "embedded systems"],
    domains: ["vantagecell.invalid"],
  },
  {
    name: "Grace Okoro",
    title: "Plant Director",
    org: "Northforge Manufacturing",
    location: "Detroit",
    capabilities: ["mechanical engineering"],
    domains: ["northforge.invalid"],
  },

  // ── robotics / ML research ──────────────────────────────────────────────
  {
    name: "Amara Okonkwo",
    title: "Head of Perception",
    org: "Wayline Autonomy",
    location: "Edinburgh",
    capabilities: ["perception", "machine learning", "robotics"],
    domains: ["wayline.invalid", "arxiv.invalid", "okonkwo.invalid"],
    artifacts: [
      {
        type: "publication",
        title: "Sensor fusion under occlusion",
        year: 2025,
      },
    ],
    email: true,
  },
  {
    name: "Iain Mackenzie",
    title: "Professor of Autonomous Systems",
    org: "University of Edinburgh",
    location: "Edinburgh",
    capabilities: ["robotics", "autonomy", "research science"],
    domains: ["ed.invalid", "arxiv.invalid"],
    artifacts: [
      {
        type: "publication",
        title: "Field robots in unstructured terrain",
        year: 2023,
      },
    ],
  },
  {
    name: "Nadia Haddad",
    title: "Senior Lecturer, Machine Learning",
    org: "University of Bristol",
    location: "Bristol",
    capabilities: ["machine learning", "computer vision", "research science"],
    domains: ["bristol.invalid", "arxiv.invalid"],
    artifacts: [
      {
        type: "publication",
        title: "Label efficiency in segmentation",
        year: 2024,
      },
    ],
  },
  {
    name: "Priya Raghunathan",
    title: "Staff Machine Learning Engineer",
    org: "Wayline Autonomy",
    location: "London",
    capabilities: ["machine learning", "perception", "robotics"],
    domains: ["wayline.invalid", "github.invalid"],
    email: true,
  },
  {
    name: "Rowan Pike",
    title: "Technology Evangelist",
    org: "Keystone Advisors",
    location: "London",
    // The keyword impostor: names the field everywhere, evidences none of it.
    capabilities: [],
    derivedCapabilities: ["robotics", "machine learning"],
    domains: ["keystone.invalid"],
  },

  // ── technical recruiting ────────────────────────────────────────────────
  {
    name: "Sarah Chen",
    title: "Head of Technical Recruiting",
    org: "Wayline Autonomy",
    location: "San Francisco Bay Area",
    capabilities: ["technical recruiting", "talent leadership"],
    derivedCapabilities: ["robotics", "machine learning"],
    domains: ["wayline.invalid", "talentsummit.invalid"],
    email: true,
  },
  {
    name: "Devi Ramaswamy",
    title: "VP Talent",
    org: "Meridian Cloud",
    location: "San Francisco Bay Area",
    capabilities: [
      "talent leadership",
      "technical recruiting",
      "talent intelligence",
    ],
    domains: ["meridian.invalid", "talentsummit.invalid"],
    email: true,
  },
  {
    name: "Marcus Ellery",
    title: "Principal Technical Sourcer",
    org: "Talentline",
    location: "Austin",
    capabilities: ["talent sourcing", "technical recruiting"],
    domains: ["talentline.invalid"],
  },
  {
    name: "Hannah Vogel",
    title: "Physician Recruiter",
    org: "Sutter Health",
    location: "San Francisco Bay Area",
    capabilities: ["healthcare recruiting"],
    domains: ["sutter.invalid"],
  },

  // ── commercial / go-to-market ───────────────────────────────────────────
  {
    name: "Diego Marchetti",
    title: "Chief Revenue Officer",
    org: "Harrowgate Software",
    location: "New York",
    capabilities: ["sales leadership", "go-to-market", "enterprise sales"],
    domains: ["harrowgate.invalid", "podcast.invalid"],
    email: true,
  },
  {
    name: "Fiona Brady",
    title: "VP Sales, EMEA",
    org: "Studio LM",
    location: "London",
    capabilities: ["sales leadership", "enterprise sales"],
    domains: ["studiolm.invalid"],
  },
  {
    name: "Kwame Boateng",
    title: "Head of Product Marketing",
    org: "Harrowgate Software",
    location: "New York",
    capabilities: ["go-to-market"],
    domains: ["harrowgate.invalid"],
  },
  {
    name: "Lena Fischer",
    title: "Enterprise Account Executive",
    org: "Meridian Cloud",
    location: "Berlin",
    capabilities: ["enterprise sales"],
    domains: ["meridian.invalid"],
  },

  // ── finance / professional services ─────────────────────────────────────
  {
    name: "Rachel Adeyemi",
    title: "Chief Financial Officer",
    org: "Aldergate Group",
    location: "London",
    capabilities: [
      "financial leadership",
      "corporate finance",
      "operational finance",
    ],
    domains: ["aldergate.invalid", "companieshouse.invalid"],
    email: true,
  },
  {
    name: "Stefan Novak",
    title: "VP Finance",
    org: "Studio LM",
    location: "Warsaw",
    capabilities: ["financial leadership", "operational finance"],
    domains: ["studiolm.invalid"],
  },
  {
    name: "Yuki Tanaka",
    title: "Group Financial Controller",
    org: "Orbital Freight",
    location: "Tokyo",
    capabilities: ["operational finance"],
    domains: ["orbitalfreight.invalid"],
  },
  {
    name: "Oliver Grant",
    title: "Corporate Development Director",
    org: "Aldergate Group",
    location: "London",
    capabilities: ["corporate finance"],
    domains: ["aldergate.invalid"],
  },

  // ── law ─────────────────────────────────────────────────────────────────
  {
    name: "Fiona Sinclair",
    title: "Partner, Employment",
    org: "Harrowgate Chambers",
    location: "London",
    capabilities: ["employment lawyer", "civil litigation"],
    domains: ["harrowgatechambers.invalid", "lawsociety.invalid"],
    email: true,
  },
  {
    name: "Ravi Menon",
    title: "Senior Associate, Employment Disputes",
    org: "Aldergate Legal",
    location: "Manchester",
    capabilities: ["employment tribunal", "civil litigation"],
    domains: ["aldergatelegal.invalid"],
  },
  {
    name: "Bea Thornton",
    title: "Head of Employment Law",
    org: "Meridian Cloud",
    location: "London",
    capabilities: ["employment lawyer", "in house counsel"],
    domains: ["meridian.invalid", "lawsociety.invalid"],
  },
  {
    name: "Callum Doyle",
    title: "Corporate Lawyer",
    org: "Aldergate Legal",
    location: "London",
    capabilities: ["corporate lawyer", "share purchase agreement"],
    domains: ["aldergatelegal.invalid"],
  },

  // ── healthcare ──────────────────────────────────────────────────────────
  {
    name: "Aoife Brennan",
    title: "Senior Sister, Intensive Care",
    org: "Northwind Teaching Hospital",
    location: "Edinburgh",
    capabilities: ["intensive care nurse", "ventilator management"],
    domains: ["northwindhospital.invalid", "nmc.invalid"],
    email: true,
  },
  {
    name: "Tobias Lindgren",
    title: "Critical Care Charge Nurse",
    org: "Vantage General Hospital",
    location: "Gothenburg, Sweden",
    capabilities: ["critical care nurse", "sedation monitoring"],
    domains: ["vantagehospital.invalid"],
  },
  {
    name: "Meera Pillai",
    title: "Advanced Critical Care Practitioner",
    org: "Northwind Teaching Hospital",
    location: "Edinburgh",
    capabilities: ["advanced clinical practitioner", "critical care outreach"],
    domains: ["northwindhospital.invalid", "nmc.invalid"],
  },
  {
    name: "Ewan Kerr",
    title: "Ward Sister, General Medicine",
    org: "Northwind Teaching Hospital",
    location: "Edinburgh",
    capabilities: ["ward nurse"],
    domains: ["northwindhospital.invalid"],
  },
  {
    name: "Sofia Marchetti",
    title: "Nurse Recruitment Lead",
    org: "Talentline Health",
    location: "London",
    capabilities: ["nurse recruiting"],
    derivedCapabilities: ["intensive care nurse"],
    domains: ["talentlinehealth.invalid"],
  },

  // ── built environment ───────────────────────────────────────────────────
  {
    name: "Nia Okafor",
    title: "Senior Quantity Surveyor",
    org: "Northforge Construction",
    location: "Manchester",
    capabilities: ["quantity surveyor", "cost plan"],
    domains: ["northforgeconstruction.invalid", "rics.invalid"],
    email: true,
  },
  {
    name: "Hamish Reid",
    title: "Commercial Manager",
    org: "Aldergate Build",
    location: "Edinburgh",
    capabilities: ["cost consultant", "construction final account"],
    domains: ["aldergatebuild.invalid"],
  },
  {
    name: "Zofia Kaminska",
    title: "Principal Structural Engineer",
    org: "Northforge Construction",
    location: "Manchester",
    capabilities: ["structural engineer", "reinforced concrete design"],
    domains: ["northforgeconstruction.invalid", "istructe.invalid"],
  },
];

function buildPerson(spec: PersonSpec): SourcedPerson {
  const id = spec.name.toLowerCase().replace(/[^a-z]+/g, "-");
  const claims: Claim[] = [];
  let n = 0;
  const next = () => `${id}-${(n += 1)}`;
  const domain = (i: number) => spec.domains[i % spec.domains.length];

  claims.push({
    id: next(),
    kind: "employment",
    claim: `${spec.title} at ${spec.org}`,
    normalized: normalizeOrganization(spec.org),
    sourceUrl: `https://${domain(0)}/team`,
    sourceTitle: `${spec.org} — team`,
    confidence: 0.9,
    title: spec.title,
    organization: spec.org,
    date: "2025-06-01",
  });

  claims.push({
    id: next(),
    kind: "location",
    claim: spec.location,
    normalized: normalizeLocation(spec.location),
    sourceUrl: `https://${domain(0)}/team`,
    sourceTitle: `${spec.org} — team`,
    confidence: 0.8,
  });

  spec.capabilities.forEach((capability, i) => {
    claims.push({
      id: next(),
      kind: "capability",
      claim: capability,
      normalized: resolveAlias(capability) ?? capability,
      sourceUrl: `https://${domain(i)}/bio`,
      sourceTitle: "profile",
      confidence: 0.85,
      date: "2025-01-01",
    });
  });

  (spec.derivedCapabilities ?? []).forEach((capability, i) => {
    claims.push({
      id: next(),
      kind: "capability",
      claim: capability,
      normalized: resolveAlias(capability) ?? capability,
      sourceUrl: `https://${domain(i)}/bio`,
      sourceTitle: "profile",
      confidence: 0.7,
      derived: true,
      date: "2025-01-01",
    });
  });

  (spec.artifacts ?? []).forEach((artifact, i) => {
    claims.push({
      id: next(),
      kind: "artifact",
      claim: artifact.title,
      normalized: artifact.title.toLowerCase(),
      sourceUrl: `https://${domain(i + 1)}/${artifact.type}/${i}`,
      sourceTitle: artifact.type,
      confidence: 0.9,
      artifactType: artifact.type,
      date: `${artifact.year}-01-01`,
    });
  });

  if (spec.email) {
    claims.push({
      id: next(),
      kind: "contact",
      claim: `${spec.name.split(" ")[0].toLowerCase()}@${spec.domains[0]}`,
      normalized: `${spec.name.split(" ")[0].toLowerCase()}@${spec.domains[0]}`,
      sourceUrl: `https://${domain(0)}/contact`,
      sourceTitle: "published contact page",
      confidence: 0.8,
      contactType: "email",
    });
  }

  return {
    id,
    name: spec.name,
    title: spec.title,
    organization: spec.org,
    location: spec.location,
    summary: `${spec.title} at ${spec.org}`,
    claims,
  };
}

export function benchmarkCorpus(): SourcedPerson[] {
  return CORPUS.map(buildPerson);
}

export interface BenchmarkQuery {
  id: string;
  query: string;
  field: string;
  expectCapabilities: string[];
  relevant: string[];
  distractors: string[];
}

export const BENCHMARK_QUERIES: readonly BenchmarkQuery[] = [
  {
    id: "battery-thermal-safety",
    query: "battery thermal safety engineer",
    field: "technical",
    expectCapabilities: ["battery_systems", "thermal_engineering"],
    relevant: ["Ingrid Falk", "Bjorn Halvorsen", "Peter Osei-Bonsu"],
    distractors: ["Tomas Lindqvist", "Grace Okoro"],
  },
  {
    id: "robotics-ml-researcher",
    query: "robotics machine learning researcher publishing on perception",
    field: "scientific",
    expectCapabilities: ["robotics", "machine_learning"],
    relevant: [
      "Amara Okonkwo",
      "Iain Mackenzie",
      "Nadia Haddad",
      "Priya Raghunathan",
    ],
    // Rowan Pike names the field everywhere and evidences none of it.
    distractors: ["Rowan Pike"],
  },
  {
    id: "autonomy-technical-recruiter",
    query:
      "technical recruiter who has hired robotics and machine learning engineers",
    field: "recruiting",
    expectCapabilities: ["technical_recruiting"],
    relevant: ["Sarah Chen", "Devi Ramaswamy", "Marcus Ellery"],
    // The whole point of this query: the engineers must not outrank the people
    // who recruit them.
    distractors: ["Amara Okonkwo", "Priya Raghunathan", "Iain Mackenzie"],
  },
  {
    id: "gtm-revenue-leader",
    query: "revenue leader who has built a go-to-market function",
    field: "commercial",
    expectCapabilities: ["go_to_market", "sales_leadership"],
    relevant: ["Diego Marchetti", "Fiona Brady", "Kwame Boateng"],
    distractors: ["Lena Fischer"],
  },
  {
    id: "cfo-hypergrowth",
    query: "cfo corporate finance fundraising",
    field: "finance",
    expectCapabilities: ["financial_leadership", "corporate_finance"],
    relevant: ["Rachel Adeyemi", "Stefan Novak", "Oliver Grant"],
    distractors: ["Yuki Tanaka"],
  },
  {
    id: "employment-litigator",
    query: "employment lawyer with tribunal litigation experience",
    field: "law",
    expectCapabilities: ["employment_law", "litigation"],
    relevant: ["Fiona Sinclair", "Ravi Menon", "Bea Thornton"],
    // A corporate lawyer is a lawyer and not this lawyer.
    distractors: ["Callum Doyle"],
  },
  {
    id: "critical-care-nurse",
    query: "intensive care nurse ventilator management",
    field: "healthcare",
    expectCapabilities: ["critical_care_nursing"],
    relevant: ["Aoife Brennan", "Tobias Lindgren", "Meera Pillai"],
    // A ward sister is adjacent, not the same; a nurse recruiter is neither.
    distractors: ["Ewan Kerr", "Sofia Marchetti"],
  },
  {
    id: "quantity-surveyor",
    query: "quantity surveyor cost management construction",
    field: "built environment",
    expectCapabilities: ["quantity_surveying"],
    relevant: ["Nia Okafor", "Hamish Reid"],
    distractors: ["Zofia Kaminska"],
  },
];

export interface QueryScore {
  id: string;
  field: string;
  query: string;
  precisionAt5: number;
  precisionAt10: number;
  /**
   * Precision at R, where R is the number of relevant people. With three
   * relevant people in the corpus, P@5 cannot exceed 0.60 however perfect the
   * ranking is, so P@5 alone would report a ceiling as a defect.
   */
  precisionAtR: number;
  recall: number;
  topHitRelevant: boolean;
  /**
   * Distractors ranked ABOVE somebody relevant. This is the failure that
   * costs a recruiter something: a distractor at the bottom of a short list is
   * a filler row, one above a real candidate is a wasted shortlist slot.
   */
  distractorsAboveRelevant: string[];
  /** Distractors anywhere in the top five, reported but not a failure. */
  distractorsInTop5: string[];
  missing: string[];
  capabilityReadingOk: boolean;
  capabilityDetail: string;
}

export interface BenchmarkReport {
  queries: QueryScore[];
  meanPrecisionAt5: number;
  meanPrecisionAtR: number;
  meanRecall: number;
  queriesWithRelevantTopHit: number;
  capabilityReadingAccuracy: number;
  /** Corpus-wide health, independent of any one query. */
  corpus: {
    people: number;
    evidenceCoverage: number;
    multiSourceCoverage: number;
    unsourcedContacts: number;
    duplicateNameGroups: number;
  };
}

function norm(name: string): string {
  return normalizeName(name);
}

export function scoreQuery(
  spec: BenchmarkQuery,
  corpus: SourcedPerson[],
): QueryScore {
  const brief = parseQuery(spec.query);
  const ranked = rankPeople(corpus, brief, { now: "2026-09-07", limit: 10 });
  const names = ranked.people.map((p) => norm(p.name));

  const relevant = new Set(spec.relevant.map(norm));
  const distractors = new Set(spec.distractors.map(norm));

  const precisionAt = (k: number) => {
    const top = names.slice(0, k);
    if (top.length === 0) return 0;
    return top.filter((n) => relevant.has(n)).length / Math.min(k, top.length);
  };

  const found = names.filter((n) => relevant.has(n));

  const lastRelevantIndex = names.reduce(
    (last, n, i) => (relevant.has(n) ? i : last),
    -1,
  );
  const distractorsAboveRelevant = names
    .slice(0, Math.max(0, lastRelevantIndex))
    .filter((n) => distractors.has(n));

  const readCapabilities = new Set(brief.skills);
  const missingCapabilities = spec.expectCapabilities.filter(
    (c) => !readCapabilities.has(c),
  );

  return {
    id: spec.id,
    field: spec.field,
    query: spec.query,
    precisionAt5: precisionAt(5),
    precisionAt10: precisionAt(10),
    precisionAtR: precisionAt(relevant.size),
    recall: relevant.size === 0 ? 0 : found.length / relevant.size,
    topHitRelevant: names.length > 0 && relevant.has(names[0]),
    distractorsAboveRelevant,
    distractorsInTop5: names.slice(0, 5).filter((n) => distractors.has(n)),
    missing: spec.relevant.filter((r) => !names.includes(norm(r))),
    capabilityReadingOk: missingCapabilities.length === 0,
    capabilityDetail:
      missingCapabilities.length === 0
        ? `read ${[...readCapabilities].join(", ") || "nothing"}`
        : `did not read ${missingCapabilities.join(", ")}`,
  };
}

export function runBenchmark(corpus = benchmarkCorpus()): BenchmarkReport {
  const queries = BENCHMARK_QUERIES.map((spec) => scoreQuery(spec, corpus));
  const mean = (values: number[]) =>
    values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;

  const withEvidence = corpus.filter((p) => p.claims.length > 0).length;
  const multiSource = corpus.filter(
    (p) => new Set(p.claims.map((c) => new URL(c.sourceUrl).hostname)).size > 1,
  ).length;
  const unsourcedContacts = corpus.reduce(
    (sum, p) =>
      sum + p.claims.filter((c) => c.kind === "contact" && !c.sourceUrl).length,
    0,
  );
  const byName = new Map<string, number>();
  for (const p of corpus)
    byName.set(norm(p.name), (byName.get(norm(p.name)) ?? 0) + 1);

  return {
    queries,
    meanPrecisionAt5: mean(queries.map((q) => q.precisionAt5)),
    meanPrecisionAtR: mean(queries.map((q) => q.precisionAtR)),
    meanRecall: mean(queries.map((q) => q.recall)),
    queriesWithRelevantTopHit: queries.filter((q) => q.topHitRelevant).length,
    capabilityReadingAccuracy: mean(
      queries.map((q) => (q.capabilityReadingOk ? 1 : 0)),
    ),
    corpus: {
      people: corpus.length,
      evidenceCoverage: corpus.length === 0 ? 0 : withEvidence / corpus.length,
      multiSourceCoverage:
        corpus.length === 0 ? 0 : multiSource / corpus.length,
      unsourcedContacts,
      duplicateNameGroups: [...byName.values()].filter((c) => c > 1).length,
    },
  };
}
