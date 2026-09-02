import {
  personasOutputSchema,
  type PersonasOutput,
  type TalentPopulationIR,
} from "@/lib/core/ir";
import type { ResearchFinding } from "@/lib/research/provider";
import { renderProjectContext, type ProjectContext } from "../context";
import { systemPrelude } from "../prompts";
import { defineAiTask } from "../run";

export type AudienceSegment = TalentPopulationIR["segments"][number];

export interface PersonasContext {
  project: ProjectContext;
  /** The talent segments to build personas for (IR population or fallback). */
  segments: AudienceSegment[];
  /** Research findings the personas must rest on — audience-level only. */
  findings: Pick<ResearchFinding, "url" | "title" | "snippet" | "query">[];
}

function renderFindings(findings: PersonasContext["findings"]): string {
  return findings
    .map(
      (f, i) =>
        `${i + 1}. ${f.url}${f.title ? ` — ${f.title}` : ""}${f.snippet ? `\n   "${f.snippet}"` : ""}\n   (query: ${f.query})`,
    )
    .join("\n");
}

/**
 * derive_personas (D-013): one AudiencePersonaIR per talent segment, each
 * grounded in the provided research findings. The service refuses to run
 * this without findings; the prompt refuses to cite anything else.
 */
export const personasTask = defineAiTask<PersonasContext, PersonasOutput>({
  task: "derive_personas",
  schemaName: "AudiencePersonas",
  schema: personasOutputSchema,
  maxTokens: 24000,
  system:
    () => `${systemPrelude("an elite recruiting-messaging strategist building audience personas from research")}

Build ONE persona per provided talent segment, for outreach to that audience. Personas are AUDIENCE-LEVEL: describe the segment, never an individual, and never infer anything about a specific person.

Grounding rules (mandatory):
- Every persona must rest on the provided research findings. researchCitations may contain ONLY URLs from the findings list, each with what that finding supports. A persona with no supporting finding must say so in whoTheyAre and carry provenance "model_inference"; otherwise provenance is "research".
- proofPoints come from the canonical IR / JD (mission, the work, the seat's real attributes) — never invented benefits.
- whereTheyRead: surfaces and venues the findings and IR support, in the words the audience uses.
- concerns: the objections this audience would plausibly raise about this move — grounded, not flattering.
- doNotSay: phrases, claims, or pressure tactics that would misfire with this audience or violate honesty (no false urgency, no manipulation).
- toneGuidance: concrete (register, length, what to lead with), fitted to seniority and the seat.
- NEVER put an internal compensation position in a persona: no band, no ceiling, no "they would go to X for the right person", no equity percentage. Those are the employer's negotiating position, and a persona is outreach material. Say what the seat offers in kind (the work, the terms, what is genuinely on the table) and leave numbers to the recruiter in conversation. Naming a figure in doNotSay to forbid it is fine; asserting one as a proof point is not.`,
  user: (ctx) => `${renderProjectContext(ctx.project)}
## Talent segments to build personas for
${JSON.stringify(ctx.segments, null, 1)}
## Research findings (the ONLY citable sources)
${renderFindings(ctx.findings)}
## Task
Build the audience personas now — one per segment, each citing the findings it rests on.`,
  mock: (ctx) => ({
    personas: ctx.segments.map((segment, index) => ({
      label: `[Mock] Persona: ${segment.label}`,
      segmentLabel: segment.label,
      whoTheyAre: `[Mock] ${segment.description}`,
      whatTheyValue: [
        "[Mock] Problems that matter",
        "[Mock] Ownership end to end",
      ],
      concerns: ["[Mock] Whether the work is real or a service function"],
      whereTheyRead: segment.whereTheyAre.slice(0, 2),
      toneGuidance:
        "[Mock] Direct, specific, peer-to-peer; lead with the work.",
      proofPoints: [
        `[Mock] ${ctx.project.project.businessObjective ?? ctx.project.project.roleTitle}`,
      ],
      doNotSay: ["[Mock] False urgency", "[Mock] Generic flattery"],
      researchCitations: ctx.findings
        .slice(index, index + 2)
        .map((f) => ({ url: f.url, whatItSupports: "[Mock] Where they read" })),
      provenance: "research" as const,
    })),
  }),
});
