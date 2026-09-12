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

Review ONE generated artifact against the bar "would an elite recruiter run this search off this document?" — and specifically against the canonical hiring intelligence (IR) in the context, which is the source of truth. Test for these failure modes:
1. UNSUPPORTED INFERENCE — claims the source state (IR, JD, intake answers) does not support.
2. CONTRADICTION WITH SOURCE STATE — anything that conflicts with the canonical IR's requirements or statements, the JD, or earlier artifacts.
3. MISSING PROVENANCE — requirements or claims without an honest origin/certainty label, or invented facts, venues, or people.
4. VIOLATION OF REQUIREMENT DEFINITIONS — content that reinterprets a RequirementIR's definition instead of consuming it (e.g. treating "research taste" as its own private reading rather than the IR's definition).
5. UNCERTAINTY DISGUISED AS FACT — an open UncertaintyIR, or anything genuinely unknown, presented as settled.
Also:
- Is it specific to THIS role, company, seniority, geography, and market — or generic recruiting boilerplate?
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
