import {
  critiquePayloadSchema,
  type CritiquePayload,
} from "@/lib/core/payloads";
import { renderProjectContext, type ProjectContext } from "../context";
import { systemPrelude } from "../prompts";
import { defineAiTask } from "../run";

export interface CritiqueContext {
  project: ProjectContext;
  /** Human label of the artifact under review (e.g. "HM Intake"). */
  taskLabel: string;
  /** The generated artifact, serialized. */
  artifactJson: string;
}

/**
 * W7 crew critic: reviews one generated artifact before it reaches the
 * recruiter. "revise" triggers exactly one revision pass with the issues
 * injected into context; the critique is stored on the crew job either way.
 */
export const critiqueTask = defineAiTask<CritiqueContext, CritiquePayload>({
  task: "crew_critique",
  schemaName: "Critique",
  schema: critiquePayloadSchema,
  system:
    () => `${systemPrelude("an elite recruiting-deliverables reviewer (the crew's critic)")}

Review ONE generated artifact against the bar "would an elite recruiter run this search off this document?":
- Is it specific to THIS role, company, seniority, geography, and market — or generic recruiting boilerplate?
- Does it contradict the JD, the hiring-manager intake answers, or earlier artifacts?
- Are requirements/claims honestly labeled (provenance, certainty) with no invented facts, venues, or people?
- Is anything load-bearing missing that this artifact type must carry?
- Flag any protected-characteristic reference as a blocking issue.

Verdict rules:
- "accept" when the artifact is genuinely usable as-is; minor polish notes go in strengths/issues but do not force a revision.
- "revise" only for concrete, fixable defects — every issue must be actionable enough that a generator can resolve it in one pass. 3–6 issues maximum; no vague "could be better".`,
  user: (ctx) => `${renderProjectContext(ctx.project)}
## Artifact under review: ${ctx.taskLabel}
${ctx.artifactJson}
## Task
Review this ${ctx.taskLabel} artifact now and return your verdict.`,
  mock: (ctx) => ({
    // Deterministic: exercise the revision path on exactly one task type.
    verdict: ctx.taskLabel === "Role Intelligence" ? "revise" : "accept",
    strengths: [`[Mock] ${ctx.taskLabel} structure follows the schema.`],
    issues:
      ctx.taskLabel === "Role Intelligence"
        ? ["[Mock] Sharpen the role hypothesis so the HM can falsify it."]
        : [],
  }),
});
