import type { PacketKind } from "@/lib/core/enums";
import {
  candidatePacketPayloadSchema,
  type CandidatePacketPayload,
} from "@/lib/core/payloads";
import type { candidates } from "@/lib/db/schema";
import { renderProjectContext, type ProjectContext } from "../context";
import { systemPrelude } from "../prompts";
import { defineAiTask } from "../run";

export interface CandidatePacketContext {
  project: ProjectContext;
  candidate: typeof candidates.$inferSelect;
  kind: PacketKind;
}

const KIND_RULES: Record<PacketKind, string> = {
  process_guide:
    "A process-transparency guide: every stage of this search's interview process, what each evaluates, who they'll meet, expected timelines, and how decisions are communicated. Honest about what is undecided.",
  interview_prep:
    "Interview preparation for the UPCOMING stages: what each interviewer is looking for, how to show real evidence of their work (not scripted answers), logistics, and encouragement to ask hard questions back. Never coach deception; help them show their genuine work well.",
  offer_explainer:
    "An offer explainer: how to read the offer's components, what is negotiable and how to raise it, decision timeline without pressure, and who to ask what. No urgency tactics, no discouraging competing processes — respectful of their decision.",
};

/**
 * W9 — candidate-facing packets the recruiter shares manually. Written TO
 * the candidate (second person). Drafts only; nothing sends automatically.
 */
export const candidatePacketTask = defineAiTask<
  CandidatePacketContext,
  CandidatePacketPayload
>({
  task: "candidate_packet",
  schemaName: "CandidatePacket",
  schema: candidatePacketPayloadSchema,
  system: () => `${systemPrelude("a candidate-experience writer")}

Write a candidate-facing document the recruiter will share manually. Rules:
- Address the candidate directly, warm and concrete; respect their time.
- Use ONLY facts from the provided context — never invent process details, names, compensation figures, or claims about the candidate. Where something is not yet decided, say so plainly.
- No manipulation, no false urgency, no pressure. The candidate keeping other options is normal and stays unremarked or respected.
- 3–6 sections with clear titles; scannable in two minutes.`,
  user: (ctx) => `${renderProjectContext(ctx.project)}
## Candidate
Name: ${ctx.candidate.name}
Current stage: ${ctx.candidate.stage}
## Packet requested: ${ctx.kind}
${KIND_RULES[ctx.kind]}
## Task
Write this packet now.`,
  mock: (ctx) => ({
    title: `[Mock] ${ctx.kind.replace("_", " ")} — ${ctx.project.project.roleTitle}`,
    sections: [
      {
        title: "What happens next",
        body: `[Mock] Candidate-facing ${ctx.kind} content for ${ctx.candidate.name}; stage ${ctx.candidate.stage}.`,
      },
      {
        title: "Who to ask",
        body: "[Mock] Your recruiter is your single point of contact for anything unclear.",
      },
    ],
  }),
});
