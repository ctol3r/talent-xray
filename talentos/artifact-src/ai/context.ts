/**
 * Context assembly (ported from the artifact's renderContext, itself from
 * lib/ai/context). IR-first: once a canonical IR exists it is the SOURCE OF
 * TRUTH and downstream tasks are told not to re-derive requirements from
 * the JD. W13 changes: typed HM Intake answers are ALWAYS included (they
 * are human statements, and the old version dropped them once an IR
 * existed); the research snapshot — or its honest absence — is a section.
 */
import { clip } from "../core/dom";
import type { SearchContext } from "../core/search-context";
import type { StoredRecord } from "../core/store";
import type { IntentPayload, IntakePayload } from "../core/payloads";
import type { ResearchSnapshot } from "../core/research";
import { sourceFreshness } from "../core/research";
import { packById, renderPackSection } from "../core/industry-packs";

export interface ContextInput {
  ctx: SearchContext;
  artifacts: Record<string, StoredRecord>;
  intent: IntentPayload | null;
  snapshot?: ResearchSnapshot;
  nowIso: string;
}

export function renderContext(input: ContextInput): string {
  const { ctx, artifacts, intent } = input;
  const facts = [
    `Search: ${ctx.searchName}`,
    `Company: ${ctx.company || "unknown"}`,
    `Role title: ${ctx.roleTitle}`,
    `Geography: ${ctx.geography || "unspecified"} (${ctx.country || "country unspecified"})`,
    ctx.jurisdiction ? `Jurisdiction: ${ctx.jurisdiction}` : "",
    ctx.industry
      ? `Industry: ${ctx.industry}${ctx.subindustry ? ` / ${ctx.subindustry}` : ""}`
      : "",
    ctx.profession ? `Profession: ${ctx.profession}` : "",
    ctx.roleFamily ? `Role family: ${ctx.roleFamily}` : "",
    ctx.seniority ? `Seniority: ${ctx.seniority}` : "",
    ctx.employmentType ? `Employment type: ${ctx.employmentType}` : "",
    ctx.workplaceModel ? `Workplace model: ${ctx.workplaceModel}` : "",
    ctx.companyStage ? `Company stage: ${ctx.companyStage}` : "",
    ctx.companySize ? `Company size: ${ctx.companySize}` : "",
    ctx.companyBusinessModel
      ? `Business model: ${ctx.companyBusinessModel}`
      : "",
    ctx.compensationContext ? `Compensation: ${ctx.compensationContext}` : "",
    ctx.businessObjective ? `Business objective: ${ctx.businessObjective}` : "",
    ctx.hiringReason ? `Hiring reason: ${ctx.hiringReason}` : "",
    ctx.teamContext ? `Team: ${ctx.teamContext}` : "",
    ctx.urgency ? `Urgency: ${ctx.urgency}` : "",
    ctx.availableTimeframe ? `Timeframe: ${ctx.availableTimeframe}` : "",
    ctx.desiredStartDate ? `Desired start: ${ctx.desiredStartDate}` : "",
    ctx.constraints.length ? `Constraints: ${ctx.constraints.join("; ")}` : "",
    ctx.recruiterNotes ? `Recruiter notes: ${ctx.recruiterNotes}` : "",
    `Industry pack: ${ctx.selectedIndustryPack}`,
    `Search context version: ${ctx.searchVersion}`,
  ]
    .filter(Boolean)
    .join("\n");

  const sections = [`## Search project\n${facts}`];

  const pack = packById(ctx.selectedIndustryPack);
  if (pack.id !== "universal" || pack.cautions.length) {
    sections.push(renderPackSection(pack));
  }

  if (intent) {
    sections.push(
      `## Canonical hiring intelligence (IR) — SOURCE OF TRUTH
This is the search's single canonical interpretation. Consume these objects as-is: do NOT re-derive requirements from the job description below, which is reference material only. Treat open uncertainties as unknowns, never as facts; a requirement's verbatim statement and its definition are both binding.
${clip(
  JSON.stringify(
    {
      need: intent.need,
      requirements: intent.requirements,
      uncertainties: intent.uncertainties,
      contradictions: intent.contradictions,
      statements: intent.statements ?? [],
    },
    null,
    1,
  ),
  14000,
)}`,
    );
  }

  if (ctx.jobDescription) {
    sections.push(
      `## Job description (verbatim)\n${clip(ctx.jobDescription, 6000)}`,
    );
  }

  const art = (key: string, title: string, budget: number) => {
    const rec = artifacts[key];
    if (rec?.payload) {
      sections.push(
        `## ${title}\n${clip(JSON.stringify(rec.payload, null, 1), budget)}`,
      );
    }
  };

  if (!intent)
    art("role_intelligence", "Role intelligence (recruiter-reviewed)", 6000);

  const intake = artifacts.intake?.payload as IntakePayload | undefined;
  if (intake) {
    const answered: string[] = [];
    for (const cat of intake.categories ?? []) {
      for (const q of cat.questions ?? []) {
        if (q.answer && q.answer.trim()) {
          answered.push(`Q (${cat.title}): ${q.question}\nA: ${q.answer}`);
        }
      }
    }
    if (answered.length) {
      sections.push(
        `## Hiring-manager intake answers (typed by the recruiter — human statements, provenance "hiring_manager")\n${clip(answered.join("\n\n"), 6000)}`,
      );
    }
  }

  art("success_profile", "Success profile", 6000);
  art("market_intelligence", "Market intelligence", 5000);
  art("sourcing_strategy", "Sourcing strategy", 5000);

  sections.push(renderResearchSection(input.snapshot, input.nowIso));
  return sections.join("\n");
}

export function renderResearchSection(
  snapshot: ResearchSnapshot | undefined,
  nowIso: string,
): string {
  if (!snapshot) {
    return `## Research
NONE ATTACHED. This runtime has no web access and no research connector has been wired for this search. You have no current external evidence. Do not present anything as a current fact; label everything as model knowledge (estimate / inference / unknown) and put "as of" only on things the search brief itself states.`;
  }
  const usable = snapshot.sources.filter(
    (s) => s.accessStatus === "available" || s.accessStatus === "partial",
  );
  const lines = usable.map((s) => {
    const fresh = sourceFreshness(s, nowIso);
    return `- [${s.id}] ${s.title}${s.publisher ? ` — ${s.publisher}` : ""}${s.canonicalUrl ? ` <${s.canonicalUrl}>` : ""} (${s.sourceType}; kind ${s.kind}; retrieved ${s.retrievedAt.slice(0, 10)}; freshness ${fresh})${s.limitations.length ? ` — limitations: ${s.limitations.join("; ")}` : ""}${s.excerpt ? `\n  excerpt: ${clip(s.excerpt, 1200)}` : ""}`;
  });
  const claims = snapshot.claims.map(
    (c) =>
      `- (${c.kind}/${c.evidenceState}) ${c.text} [sources: ${c.sourceIds.join(", ") || "none"}]`,
  );
  return `## Research (snapshot ${snapshot.id}, status ${snapshot.status}, completed ${snapshot.completedAt ?? snapshot.startedAt}; brief: ${snapshot.researchBrief})
Sources you may cite by id:
${lines.join("\n") || "(none usable)"}
${claims.length ? `Claims already extracted:\n${claims.join("\n")}` : ""}
${snapshot.unavailableSources.length ? `Unavailable sources (do not pretend to know their contents): ${snapshot.unavailableSources.join("; ")}` : ""}
${snapshot.missingInformation.length ? `Known gaps: ${snapshot.missingInformation.join("; ")}` : ""}`;
}
