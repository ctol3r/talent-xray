import {
  outreachSequencePayloadSchema,
  type OutreachSequencePayload,
} from "@/lib/core/payloads";
import type { EvidenceAlignmentPayload } from "@/lib/core/payloads";
import type { candidates } from "@/lib/db/schema";
import { renderProjectContext, type ProjectContext } from "../context";
import { classifyOccupationForMock } from "../mock-knowledge";
import { systemPrelude } from "../prompts";
import { defineAiTask } from "../run";

export interface OutreachContext {
  project: ProjectContext;
  candidate: typeof candidates.$inferSelect;
  evidence?: EvidenceAlignmentPayload;
  recruiterTone?: string;
}

export const outreachTask = defineAiTask<OutreachContext, OutreachSequencePayload>({
  task: "outreach_generation",
  schemaName: "OutreachSequence",
  schema: outreachSequencePayloadSchema,
  maxTokens: 24000,
  system: () => `${systemPrelude("an elite candidate-engagement writer")}

Draft a full outreach sequence for this candidate: email_1, follow_up_1, follow_up_2, follow_up_3, breakup, plus linkedin_connect (≤300 chars) and inmail. Nothing sends automatically — these are drafts the recruiter copies out.

Non-negotiables:
- NEVER invent facts about the candidate. Personalize ONLY from the provided evidence items and candidate material. Every personalization gets a citations entry: { personalization: the sentence/claim used, evidence: the exact provided evidence it rests on }. If there is no real evidence, write honest, direct outreach without fake familiarity — and say so in cadenceRationale.
- Subject lines: 2–3 variants per email step, none clickbait.
- Voice: direct, specific, peer-to-peer; match the seniority (an executive gets discretion and brevity; an hourly candidate gets clarity about pay, shift, and location up front where known).
- dayOffset per step. Default cadence 0/3/7/12/20 — but ADAPT it to seniority, scarcity, and channel, and explain the adaptation in cadenceRationale.
- No manipulation, no false urgency, no deceptive pressure. Include a respectful opt-out in the breakup step.`,
  user: (ctx) => `${renderProjectContext(ctx.project)}
## Candidate
${JSON.stringify(
    {
      name: ctx.candidate.name,
      currentTitle: ctx.candidate.currentTitle,
      currentCompany: ctx.candidate.currentCompany,
      geography: ctx.candidate.geography,
      notes: ctx.candidate.recruiterNotes,
    },
    null,
    1,
  )}
## Evidence available for personalization
${ctx.evidence ? JSON.stringify(ctx.evidence.items, null, 1) : "None recorded — do not fabricate any."}
${ctx.recruiterTone ? `## Recruiter tone preference\n${ctx.recruiterTone}` : ""}
## Task
Draft the complete outreach sequence for this candidate now.`,
  mock: (ctx) => {
    const occ = classifyOccupationForMock(
      `${ctx.project.project.roleTitle} ${ctx.project.project.industry ?? ""}`,
    );
    const firstEvidence = ctx.evidence?.items.find(
      (i) => i.status === "strong" || i.status === "partial",
    );
    const cite = firstEvidence
      ? [
          {
            personalization: `[Mock] Mention of ${firstEvidence.criterion}`,
            evidence: firstEvidence.evidenceText,
          },
        ]
      : [];
    const step = (
      kind: OutreachSequencePayload["steps"][number]["kind"],
      dayOffset: number,
      body: string,
    ) => ({
      kind,
      dayOffset,
      subjectVariants:
        kind.startsWith("email") || kind.startsWith("follow") || kind === "breakup"
          ? [`[Mock] ${ctx.project.project.roleTitle} — ${ctx.project.project.companyName ?? "opportunity"}`]
          : [],
      body,
      citations: cite,
    });
    return {
      steps: [
        step("email_1", 0, `[Mock] Hi ${ctx.candidate.name.split(" ")[0]} — outreach draft grounded in ${occ.profession} evidence.`),
        step("follow_up_1", 3, "[Mock] Follow-up 1."),
        step("follow_up_2", 7, "[Mock] Follow-up 2."),
        step("follow_up_3", 12, "[Mock] Follow-up 3."),
        step("breakup", 20, "[Mock] Closing the loop — happy to reconnect later; say the word and I won't follow up again."),
        step("linkedin_connect", 0, "[Mock] Short connection note."),
        step("inmail", 1, "[Mock] InMail draft."),
      ],
      cadenceRationale: `[Mock] Default 0/3/7/12/20 cadence for ${occ.profession}.`,
    };
  },
});
