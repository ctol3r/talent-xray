import {
  outreachSequencePayloadSchema,
  type OutreachSequencePayload,
} from "@/lib/core/payloads";
import type { EvidenceAlignmentPayload } from "@/lib/core/payloads";
import type { AudiencePersonaIR } from "@/lib/core/ir";
import type { candidates } from "@/lib/db/schema";
import type { ResearchFinding } from "@/lib/research/provider";
import { renderProjectContext, type ProjectContext } from "../context";
import { classifyOccupationForMock } from "../mock-knowledge";
import { systemPrelude } from "../prompts";
import { defineAiTask } from "../run";

export interface OutreachContext {
  project: ProjectContext;
  candidate: typeof candidates.$inferSelect;
  evidence?: EvidenceAlignmentPayload;
  recruiterTone?: string;
  /** Research-backed audience personas (D-013); the service always supplies them. */
  personas?: AudiencePersonaIR[];
  /** The research findings those personas cite — citable by URL. */
  findings?: Pick<ResearchFinding, "url" | "title" | "snippet" | "query">[];
}

export const outreachTask = defineAiTask<
  OutreachContext,
  OutreachSequencePayload
>({
  task: "outreach_generation",
  schemaName: "OutreachSequence",
  schema: outreachSequencePayloadSchema,
  maxTokens: 24000,
  system: () => `${systemPrelude("an elite candidate-engagement writer")}

Draft a full outreach sequence for this candidate: email_1, follow_up_1, follow_up_2, follow_up_3, breakup, plus linkedin_connect (≤300 chars) and inmail. Nothing sends automatically — these are drafts the recruiter copies out.

Non-negotiables:
- NEVER invent facts about the candidate. Personalize ONLY from the provided evidence items and candidate material. Every personalization gets a citations entry: { personalization: the sentence/claim used, evidence: the exact provided evidence it rests on }. If there is no real evidence, write honest, direct outreach without fake familiarity — and say so in cadenceRationale.
- Write for the AUDIENCE PERSONA (research-backed, audience-level). Pick the one persona whose segment best fits this candidate's title and evidence, copy its label into personaLabel exactly, and let its values, concerns, tone guidance, proof points and doNotSay shape every step. A persona describes an audience, never this person: never assert a persona trait as a fact about the candidate ("I know you care about…"); frame it as what people doing this work tend to weigh. When an audience-level claim is used, cite the research finding URL it rests on in citations.evidence. Cite nothing outside the provided evidence items and findings.
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
## Audience personas (research-backed; choose one, set personaLabel)
${ctx.personas && ctx.personas.length > 0 ? JSON.stringify(ctx.personas, null, 1) : "None provided — write honest, direct outreach for the role's audience in general and leave personaLabel unset."}
## Research findings the personas rest on (citable by URL)
${
  ctx.findings && ctx.findings.length > 0
    ? ctx.findings
        .map(
          (f, i) =>
            `${i + 1}. ${f.url}${f.title ? ` — ${f.title}` : ""}${f.snippet ? `\n   "${f.snippet}"` : ""}`,
        )
        .join("\n")
    : "None."
}
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
    const persona = ctx.personas?.[0];
    const finding = ctx.findings?.[0];
    const cite = [
      ...(firstEvidence
        ? [
            {
              personalization: `[Mock] Mention of ${firstEvidence.criterion}`,
              evidence: firstEvidence.evidenceText,
            },
          ]
        : []),
      ...(persona && finding
        ? [
            {
              personalization: `[Mock] Audience framing for ${persona.segmentLabel}`,
              evidence: finding.url,
            },
          ]
        : []),
    ];
    const step = (
      kind: OutreachSequencePayload["steps"][number]["kind"],
      dayOffset: number,
      body: string,
    ) => ({
      kind,
      dayOffset,
      subjectVariants:
        kind.startsWith("email") ||
        kind.startsWith("follow") ||
        kind === "breakup"
          ? [
              `[Mock] ${ctx.project.project.roleTitle} — ${ctx.project.project.companyName ?? "opportunity"}`,
            ]
          : [],
      body,
      citations: cite,
    });
    return {
      steps: [
        step(
          "email_1",
          0,
          `[Mock] Hi ${ctx.candidate.name.split(" ")[0]} — outreach draft grounded in ${occ.profession} evidence.`,
        ),
        step("follow_up_1", 3, "[Mock] Follow-up 1."),
        step("follow_up_2", 7, "[Mock] Follow-up 2."),
        step("follow_up_3", 12, "[Mock] Follow-up 3."),
        step(
          "breakup",
          20,
          "[Mock] Closing the loop — happy to reconnect later; say the word and I won't follow up again.",
        ),
        step("linkedin_connect", 0, "[Mock] Short connection note."),
        step("inmail", 1, "[Mock] InMail draft."),
      ],
      cadenceRationale: `[Mock] Default 0/3/7/12/20 cadence for ${occ.profession}.`,
      personaLabel: persona?.label,
    };
  },
});
