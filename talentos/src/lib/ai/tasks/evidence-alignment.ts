import {
  evidenceAlignmentPayloadSchema,
  type EvidenceAlignmentPayload,
} from "@/lib/core/payloads";
import type { candidates } from "@/lib/db/schema";
import { renderProjectContext, type ProjectContext } from "../context";
import { classifyOccupationForMock } from "../mock-knowledge";
import { systemPrelude } from "../prompts";
import { defineAiTask } from "../run";

export interface CandidateSourceEvidenceItem {
  sourceUrl: string;
  title?: string | null;
  snippet?: string | null;
  provider?: string | null;
  verificationStatus: string;
  retrievedAt: string;
}

export interface EvidenceContext {
  project: ProjectContext;
  candidate: typeof candidates.$inferSelect;
  sourceUrls: string[];
  /** Search-result evidence rows — snippets, not resume content (D-010). */
  sourceEvidence: CandidateSourceEvidenceItem[];
}

function renderSourceEvidence(items: CandidateSourceEvidenceItem[]): string {
  if (items.length === 0) return "";
  const lines = items.map((item) => {
    const status =
      item.verificationStatus === "recruiter_verified"
        ? "verified by recruiter"
        : "UNVERIFIED search-result snippet";
    return `- [${status}] ${item.sourceUrl}${item.title ? ` — ${item.title}` : ""}${item.snippet ? `\n  "${item.snippet}"` : ""}`;
  });
  return `Source evidence (snippets from search results — evidence about a source, NOT candidate-supplied resume content; treat unverified items as unconfirmed):\n${lines.join("\n")}`;
}

function renderCandidate(ctx: EvidenceContext): string {
  const c = ctx.candidate;
  return [
    `Name: ${c.name}`,
    c.currentTitle ? `Current title: ${c.currentTitle}` : "",
    c.currentCompany ? `Current company: ${c.currentCompany}` : "",
    c.geography ? `Geography: ${c.geography}` : "",
    ctx.sourceUrls.length > 0
      ? `Profile URLs: ${ctx.sourceUrls.join(", ")}`
      : "",
    c.recruiterNotes ? `Recruiter notes: ${c.recruiterNotes}` : "",
    c.resumeText ? `Resume / pasted profile text:\n${c.resumeText}` : "",
    renderSourceEvidence(ctx.sourceEvidence),
    `Structured profile: ${JSON.stringify(c.profile)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export const evidenceAlignmentTask = defineAiTask<
  EvidenceContext,
  EvidenceAlignmentPayload
>({
  task: "evidence_alignment",
  schemaName: "EvidenceAlignment",
  schema: evidenceAlignmentPayloadSchema,
  system:
    () => `${systemPrelude("a talent researcher performing evidence alignment")}

This is recruiter decision support, NOT candidate selection. Compare the candidate's observable, job-related professional evidence against the search's success-profile criteria.

For each relevant criterion produce an item:
- status: "strong" (clear supporting evidence in the provided material), "partial" (some but incomplete), "missing" (criterion matters, no evidence found — absence of evidence, not evidence of absence), "contradictory" (material conflicts with the criterion), "unknown" (cannot assess from what's provided).
- evidenceText: quote or precisely describe the evidence FROM THE PROVIDED MATERIAL ONLY. Never invent facts about this person. For "missing"/"unknown", say what was looked for and not found.
- criterionProvenance: carry over the criterion's provenance where known.
- An UNVERIFIED search-result snippet is evidence about a source, not confirmed fact: it supports at most "partial", and the evidenceText must say the snippet is unverified and needs checking on the source page.

Then:
- reviewPriority: advisory ONLY — "review_first" | "review_soon" | "review_later" | "insufficient_information" with a rationale grounded in the evidence items. Phrase it as review ordering, never as accept/reject.
- questionsToValidate: what a recruiter screen should confirm.
- outreachAngle: the most genuine, evidence-based hook for contacting this person (omit if none exists).`,
  user: (ctx) => `${renderProjectContext(ctx.project)}
## Candidate under review
${renderCandidate(ctx)}
## Task
Align this candidate's evidence against the success profile now.`,
  mock: (ctx) => {
    const occ = classifyOccupationForMock(
      `${ctx.project.project.roleTitle} ${ctx.project.project.industry ?? ""}`,
    );
    const hasResume = Boolean(ctx.candidate.resumeText?.trim());
    const hasSnippets = ctx.sourceEvidence.length > 0;
    const hasMaterial = hasResume || hasSnippets;
    return {
      items: occ.evidenceSignals.slice(0, 3).map((criterion, index) => ({
        criterion,
        criterionProvenance: "model_inference" as const,
        status:
          hasMaterial && index === 0
            ? ("partial" as const)
            : ("unknown" as const),
        evidenceText: hasResume
          ? `[Mock] Assessed against pasted material for ${ctx.candidate.name}.`
          : hasSnippets
            ? `[Mock] Only an unverified search-result snippet is available for ${ctx.candidate.name} — verify on the source page.`
            : "[Mock] No public evidence provided yet.",
      })),
      reviewPriority: {
        suggestion: hasMaterial
          ? ("review_soon" as const)
          : ("insufficient_information" as const),
        rationale:
          "[Mock] Advisory ordering only, based on currently available job-related evidence.",
      },
      questionsToValidate: occ.domainQuestions.slice(0, 2),
      outreachAngle: hasMaterial
        ? `[Mock] Reference their ${occ.vocabulary[0] ?? "recent"} work.`
        : undefined,
    };
  },
});
