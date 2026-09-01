import { desc, eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import {
  hiringManagers,
  intakeSessions,
  jobDescriptions,
  marketResearch,
  roleIntelligence,
  searchProjects,
  sourceChannels,
  sourcingStrategies,
  successProfiles,
} from "@/lib/db/schema";
import type {
  IntakePayload,
  MarketResearchPayload,
  RoleIntelligencePayload,
  SourcingStrategyPayload,
  SuccessProfilePayload,
} from "@/lib/core/payloads";

export interface ProjectContext {
  project: typeof searchProjects.$inferSelect;
  jdText?: string;
  hiringManagerNames: string[];
  roleIntelligence?: RoleIntelligencePayload;
  intake?: IntakePayload;
  successProfile?: SuccessProfilePayload;
  marketResearch?: MarketResearchPayload;
  strategy?: SourcingStrategyPayload;
  channelNames: string[];
}

export async function loadProjectContext(
  db: Db,
  projectId: string,
): Promise<ProjectContext> {
  const [project] = await db
    .select()
    .from(searchProjects)
    .where(eq(searchProjects.id, projectId));
  if (!project) {
    throw new Error(`Search project ${projectId} not found`);
  }
  const [jd] = await db
    .select()
    .from(jobDescriptions)
    .where(eq(jobDescriptions.searchProjectId, projectId))
    .orderBy(desc(jobDescriptions.createdAt))
    .limit(1);
  const managers = await db
    .select()
    .from(hiringManagers)
    .where(eq(hiringManagers.searchProjectId, projectId));
  const [intel] = await db
    .select()
    .from(roleIntelligence)
    .where(eq(roleIntelligence.searchProjectId, projectId));
  const [intake] = await db
    .select()
    .from(intakeSessions)
    .where(eq(intakeSessions.searchProjectId, projectId))
    .orderBy(desc(intakeSessions.createdAt))
    .limit(1);
  const [profile] = await db
    .select()
    .from(successProfiles)
    .where(eq(successProfiles.searchProjectId, projectId));
  const [market] = await db
    .select()
    .from(marketResearch)
    .where(eq(marketResearch.searchProjectId, projectId));
  const [strategy] = await db
    .select()
    .from(sourcingStrategies)
    .where(eq(sourcingStrategies.searchProjectId, projectId));
  const channels = await db
    .select()
    .from(sourceChannels)
    .where(eq(sourceChannels.searchProjectId, projectId));

  return {
    project,
    jdText: jd?.rawText,
    hiringManagerNames: managers.map((m) =>
      m.title ? `${m.name} (${m.title})` : m.name,
    ),
    roleIntelligence: intel?.payload,
    intake: intake?.payload,
    successProfile: profile?.payload,
    marketResearch: market?.payload,
    strategy: strategy?.payload,
    channelNames: channels.map((c) => c.name),
  };
}

function section(title: string, body: string | undefined | null): string {
  if (!body || body.trim() === "") return "";
  return `## ${title}\n${body.trim()}\n`;
}

/** Answered intake questions only — unanswered ones aren't knowledge. */
function renderIntakeAnswers(intake: IntakePayload | undefined): string {
  if (!intake) return "";
  const lines: string[] = [];
  for (const category of intake.categories) {
    for (const question of category.questions) {
      if (question.answer && question.answer.trim() !== "") {
        lines.push(`Q (${category.title}): ${question.question}\nA: ${question.answer}`);
      }
    }
  }
  return lines.join("\n\n");
}

/**
 * Render the shared context document included in AI task prompts.
 * Sections render only when they exist — tasks see real state, never stubs.
 */
export function renderProjectContext(ctx: ProjectContext): string {
  const p = ctx.project;
  const facts = [
    `Search: ${p.name}`,
    `Company: ${p.companyName ?? "unknown"}`,
    `Role title: ${p.roleTitle}`,
    `Geography: ${p.geography ?? "unspecified"} (${p.country ?? "country unspecified"})`,
    p.industry ? `Industry: ${p.industry}` : "",
    p.seniority ? `Seniority: ${p.seniority}` : "",
    p.employmentType ? `Employment type: ${p.employmentType}` : "",
    p.workArrangement ? `Work arrangement: ${p.workArrangement}` : "",
    p.compensationNote ? `Compensation: ${p.compensationNote}` : "",
    p.businessObjective ? `Business objective: ${p.businessObjective}` : "",
    p.recruiterNotes ? `Recruiter notes: ${p.recruiterNotes}` : "",
    ctx.hiringManagerNames.length > 0
      ? `Hiring manager(s): ${ctx.hiringManagerNames.join(", ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  return [
    section("Search project", facts),
    section("Job description (verbatim)", ctx.jdText),
    section(
      "Role intelligence (recruiter-reviewed)",
      ctx.roleIntelligence ? JSON.stringify(ctx.roleIntelligence, null, 1) : "",
    ),
    section("Hiring-manager intake answers", renderIntakeAnswers(ctx.intake)),
    section(
      "Success profile",
      ctx.successProfile ? JSON.stringify(ctx.successProfile, null, 1) : "",
    ),
    section(
      "Market intelligence",
      ctx.marketResearch ? JSON.stringify(ctx.marketResearch, null, 1) : "",
    ),
    section(
      "Sourcing strategy",
      ctx.strategy ? JSON.stringify(ctx.strategy, null, 1) : "",
    ),
    section(
      "Existing sourcing channels",
      ctx.channelNames.length > 0 ? ctx.channelNames.join(", ") : "",
    ),
  ]
    .filter(Boolean)
    .join("\n");
}
