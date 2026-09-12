/**
 * Versioned, immutable SearchContext (spec §6).
 *
 * The legacy "facts" object under `searches/{id}` stays as the editable
 * form model (so every stored search still loads). A SearchContext is
 * derived from it and stamped with a content-addressed `searchVersion`;
 * every generated output records the version it consumed, and a change to
 * any consequential field yields a new version and a human-readable diff.
 */
import { z } from "zod";
import { managerStatementSchema } from "@/lib/core/ir";

export const searchContextSchema = z.object({
  searchId: z.string(),
  searchVersion: z.string(),
  searchName: z.string(),
  company: z.string().default(""),
  companyStage: z.string().default(""),
  companySize: z.string().default(""),
  companyBusinessModel: z.string().default(""),
  companyReputationContext: z.string().default(""),
  industry: z.string().default(""),
  subindustry: z.string().default(""),
  profession: z.string().default(""),
  roleFamily: z.string().default(""),
  roleTitle: z.string(),
  seniority: z.string().default(""),
  employmentType: z.string().default(""),
  geography: z.string().default(""),
  country: z.string().default(""),
  jurisdiction: z.string().default(""),
  workplaceModel: z.string().default(""),
  compensationContext: z.string().default(""),
  businessObjective: z.string().default(""),
  teamContext: z.string().default(""),
  hiringReason: z.string().default(""),
  openedAt: z.string().default(""),
  desiredStartDate: z.string().default(""),
  urgency: z.string().default(""),
  availableTimeframe: z.string().default(""),
  constraints: z.array(z.string()).default([]),
  recruiterNotes: z.string().default(""),
  jobDescription: z.string().default(""),
  hiringManagerStatements: z.array(managerStatementSchema).default([]),
  selectedIndustryPack: z.string().default("universal"),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type SearchContext = z.infer<typeof searchContextSchema>;

/** The editable form model that has always been stored as `facts`. */
export const searchFactsSchema = z.object({
  id: z.string(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  example: z.boolean().optional(),
  name: z.string().optional(),
  companyName: z.string().optional(),
  roleTitle: z.string(),
  geography: z.string().optional(),
  country: z.string().optional(),
  industry: z.string().optional(),
  seniority: z.string().optional(),
  employmentType: z.string().optional(),
  compensationNote: z.string().optional(),
  businessObjective: z.string().optional(),
  recruiterNotes: z.string().optional(),
  jd: z.string().optional(),
  // New in W13 — optional so legacy records load unchanged.
  companyStage: z.string().optional(),
  companySize: z.string().optional(),
  companyBusinessModel: z.string().optional(),
  companyReputationContext: z.string().optional(),
  subindustry: z.string().optional(),
  profession: z.string().optional(),
  roleFamily: z.string().optional(),
  jurisdiction: z.string().optional(),
  workplaceModel: z.string().optional(),
  teamContext: z.string().optional(),
  hiringReason: z.string().optional(),
  openedAt: z.string().optional(),
  desiredStartDate: z.string().optional(),
  urgency: z.string().optional(),
  availableTimeframe: z.string().optional(),
  constraints: z.array(z.string()).optional(),
  selectedIndustryPack: z.string().optional(),
});
export type SearchFacts = z.infer<typeof searchFactsSchema>;

/** Fields whose change makes downstream outputs stale. Order is display order. */
export const CONSEQUENTIAL_FIELDS: Array<{
  key: keyof SearchContext;
  label: string;
}> = [
  { key: "roleTitle", label: "Role title" },
  { key: "company", label: "Company" },
  { key: "companyStage", label: "Company stage" },
  { key: "companySize", label: "Company size" },
  { key: "companyBusinessModel", label: "Business model" },
  { key: "companyReputationContext", label: "Company reputation context" },
  { key: "industry", label: "Industry" },
  { key: "subindustry", label: "Sub-industry" },
  { key: "profession", label: "Profession" },
  { key: "roleFamily", label: "Role family" },
  { key: "seniority", label: "Seniority" },
  { key: "employmentType", label: "Employment type" },
  { key: "geography", label: "Geography" },
  { key: "country", label: "Country" },
  { key: "jurisdiction", label: "Jurisdiction" },
  { key: "workplaceModel", label: "Workplace model" },
  { key: "compensationContext", label: "Compensation context" },
  { key: "businessObjective", label: "Business objective" },
  { key: "teamContext", label: "Team context" },
  { key: "hiringReason", label: "Hiring reason" },
  { key: "openedAt", label: "Opened" },
  { key: "desiredStartDate", label: "Desired start date" },
  { key: "urgency", label: "Urgency" },
  { key: "availableTimeframe", label: "Available timeframe" },
  { key: "constraints", label: "Constraints" },
  { key: "recruiterNotes", label: "Recruiter notes" },
  { key: "jobDescription", label: "Job description" },
  { key: "hiringManagerStatements", label: "Hiring-manager statements" },
  { key: "selectedIndustryPack", label: "Industry pack" },
];

/** FNV-1a 32-bit, base36 — stable, dependency-free, good enough for a version key. */
export function contentHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36).padStart(7, "0");
}

function versionInput(ctx: Omit<SearchContext, "searchVersion">): string {
  const parts = CONSEQUENTIAL_FIELDS.map(({ key }) => {
    const v = (ctx as SearchContext)[key];
    if (key === "hiringManagerStatements") {
      return (v as SearchContext["hiringManagerStatements"])
        .map((s) => `${s.speaker}:${s.text}`)
        .join("");
    }
    return Array.isArray(v) ? v.join("") : String(v ?? "");
  });
  return parts.join("");
}

export function contextVersionOf(
  ctx: Omit<SearchContext, "searchVersion">,
): string {
  return "v" + contentHash(versionInput(ctx));
}

/** Derive the versioned context from the stored facts + the statement log. */
export function contextFromFacts(
  facts: SearchFacts,
  statements: SearchContext["hiringManagerStatements"] = [],
  now = new Date().toISOString(),
): SearchContext {
  const base = {
    searchId: facts.id,
    searchName:
      facts.name ?? `${facts.companyName ?? "Search"} — ${facts.roleTitle}`,
    company: facts.companyName ?? "",
    companyStage: facts.companyStage ?? "",
    companySize: facts.companySize ?? "",
    companyBusinessModel: facts.companyBusinessModel ?? "",
    companyReputationContext: facts.companyReputationContext ?? "",
    industry: facts.industry ?? "",
    subindustry: facts.subindustry ?? "",
    profession: facts.profession ?? "",
    roleFamily: facts.roleFamily ?? "",
    roleTitle: facts.roleTitle,
    seniority: facts.seniority ?? "",
    employmentType: facts.employmentType ?? "",
    geography: facts.geography ?? "",
    country: facts.country ?? "",
    jurisdiction: facts.jurisdiction ?? "",
    workplaceModel: facts.workplaceModel ?? "",
    compensationContext: facts.compensationNote ?? "",
    businessObjective: facts.businessObjective ?? "",
    teamContext: facts.teamContext ?? "",
    hiringReason: facts.hiringReason ?? "",
    openedAt: facts.openedAt ?? facts.createdAt ?? "",
    desiredStartDate: facts.desiredStartDate ?? "",
    urgency: facts.urgency ?? "",
    availableTimeframe: facts.availableTimeframe ?? "",
    constraints: facts.constraints ?? [],
    recruiterNotes: facts.recruiterNotes ?? "",
    jobDescription: facts.jd ?? "",
    hiringManagerStatements: statements,
    selectedIndustryPack: facts.selectedIndustryPack ?? "universal",
    createdAt: facts.createdAt ?? now,
    updatedAt: facts.updatedAt ?? now,
  };
  return searchContextSchema.parse({
    ...base,
    searchVersion: contextVersionOf(base),
  });
}

export interface ContextChange {
  field: keyof SearchContext;
  label: string;
  from: string;
  to: string;
}

function show(v: unknown): string {
  if (Array.isArray(v)) return v.length ? `${v.length} item(s)` : "(none)";
  const s = String(v ?? "").trim();
  if (!s) return "(empty)";
  return s.length > 80 ? s.slice(0, 77) + "…" : s;
}

export function diffContexts(
  prev: SearchContext | undefined,
  next: SearchContext,
): ContextChange[] {
  if (!prev) return [];
  const out: ContextChange[] = [];
  for (const { key, label } of CONSEQUENTIAL_FIELDS) {
    const a = prev[key];
    const b = next[key];
    const same =
      key === "hiringManagerStatements"
        ? JSON.stringify(a) === JSON.stringify(b)
        : Array.isArray(a) && Array.isArray(b)
          ? a.join("") === b.join("")
          : String(a ?? "") === String(b ?? "");
    if (!same) out.push({ field: key, label, from: show(a), to: show(b) });
  }
  return out;
}

/**
 * "On-site requirement changed from required to preferred. Market Intel,
 * Strategy, Search Strings, and 7 candidate assessments are now stale."
 */
export function describeDependencyDiff(
  changes: ContextChange[],
  affected: { moduleLabels: string[]; candidateAssessments: number },
): string {
  if (changes.length === 0) return "";
  const what =
    changes.length === 1
      ? `${changes[0].label} changed from ${changes[0].from} to ${changes[0].to}.`
      : `${changes.length} inputs changed (${changes.map((c) => c.label).join(", ")}).`;
  const targets = [...affected.moduleLabels];
  if (affected.candidateAssessments > 0) {
    targets.push(
      `${affected.candidateAssessments} candidate assessment${affected.candidateAssessments === 1 ? "" : "s"}`,
    );
  }
  if (targets.length === 0) return `${what} Nothing downstream is affected.`;
  const list =
    targets.length === 1
      ? targets[0]
      : `${targets.slice(0, -1).join(", ")}, and ${targets[targets.length - 1]}`;
  return `${what} ${list} ${targets.length === 1 && affected.candidateAssessments === 0 ? "is" : "are"} now stale.`;
}
