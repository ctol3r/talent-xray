import {
  intakeReasoningOutputSchema,
  type HiringIntentIR,
  type IntakeReasoningOutput,
  type ManagerStatement,
} from "@/lib/core/ir";
import { renderProjectContext, type ProjectContext } from "../context";
import { systemPrelude } from "../prompts";
import { defineAiTask } from "../run";

export interface IntakeReasonContext {
  project: ProjectContext;
  intent: HiringIntentIR;
  /** Absent = no new statement; propose the opening question. */
  statement?: ManagerStatement;
}

/**
 * The adaptive-intake reasoner (D-011): one turn of the loop
 * ManagerStatement → claims → requirement updates → ambiguity /
 * contradiction / consequential uncertainty → highest-information next
 * question. The service layer owns the verbatim statement log and the
 * revision counter; this task only returns updated requirement /
 * uncertainty / contradiction sets plus the next question.
 */
export const intakeReasonTask = defineAiTask<
  IntakeReasonContext,
  IntakeReasoningOutput
>({
  task: "intake_reasoning",
  schemaName: "IntakeReasoning",
  schema: intakeReasoningOutputSchema,
  maxTokens: 24000,
  system:
    () => `${systemPrelude("an elite recruiter running an adaptive hiring-manager intake")}

You are one turn of the intake loop over the canonical HiringIntentIR.

When a new hiring-manager statement is provided:
- extractedClaims: the discrete claims it contains, provenance "manager_statement". Quote closely; never paraphrase meaning away.
- Update the requirement set: clarify definitions the statement resolves (status → "explicit"), add requirements it introduces (origin "manager_statement"), re-classify kinds it corrects. Keep every requirement's "statement" field verbatim to its source.
- Update uncertainties: resolve the ones the statement answers (record the resolution), open new ones it raises. Do not open a second uncertainty about a question you have already opened — extend the existing one instead.
- Detect contradictions with the JD, earlier statements, or existing requirements — record both sides with provenance; do NOT silently pick a winner.

Status, agreement and attribution (these are three different things):
- "status" describes how well a requirement is DEFINED. Once the hiring manager has said what a requirement IS, it is "explicit" — even if its threshold, level or bar is still open. Put the open threshold in a linked UncertaintyIR; do NOT downgrade the whole requirement to "needs_clarification" because one dimension of it is unsettled. Reserve "needs_clarification" for requirements that are genuinely still vague.
- "contested": true when stakeholders disagree about a requirement and the disagreement is unresolved. Never encode disagreement as "needs_clarification", and never weaken or drop a requirement because a later speaker disagrees with it — both positions stand until the people reconcile them. Clear "contested" only when a statement actually settles it.
- "assertedBy": the speaker of the statement the requirement came from, copied from the statement's "speaker" field. Set it whenever origin is "manager_statement". With multiple stakeholders this is the only structured record of who wants what.
- When a stakeholder defines a term, resolve the uncertainty about it on their word — that is what asking them was for. If ANOTHER stakeholder then disputes it, re-open that uncertainty, mark the requirement contested, and keep it open until they agree. Do not hold a question open merely because other stakeholders have not spoken yet; record who said what and move.

False signals: when the hiring manager draws a contrast — "not people who've seen the machine", "not that they've had CFO on a call" — put THEIR wording in falseSignals, not a paraphrase. The contrast is the most screenable thing they said.

Always:
- nextQuestion: the single question with the highest information value — the one whose answer would most change sourcing or screening. Target open CONSEQUENTIAL uncertainties first; explain the information value honestly. Return null only when nothing consequential remains open.
- Never invent hiring-manager positions; unresolved stays unresolved.
- Return the FULL updated requirement/uncertainty/contradiction sets (they replace the previous ones); preserve existing ids.`,
  user: (ctx) => `${renderProjectContext(ctx.project)}
## Current HiringIntentIR (canonical)
${JSON.stringify(
  {
    need: ctx.intent.need,
    requirements: ctx.intent.requirements,
    uncertainties: ctx.intent.uncertainties,
    contradictions: ctx.intent.contradictions,
    priorStatements: ctx.intent.statements.filter(
      (s) => s.id !== ctx.statement?.id,
    ),
  },
  null,
  1,
)}
## New hiring-manager statement
${
  ctx.statement
    ? JSON.stringify(ctx.statement, null, 1)
    : "(none yet — propose the opening question)"
}
## Task
Run one turn of the intake loop now.`,
  mock: (ctx) => {
    const requirements = ctx.intent.requirements.map((r) => ({ ...r }));
    const uncertainties = ctx.intent.uncertainties.map((u) => ({ ...u }));
    const openConsequential = () =>
      uncertainties.filter((u) => u.status === "open" && u.consequential);

    const extractedClaims: IntakeReasoningOutput["extractedClaims"] = [];
    if (ctx.statement) {
      extractedClaims.push({
        text: ctx.statement.text,
        provenance: "manager_statement",
      });
      // Deterministic: the statement answers the first open consequential
      // uncertainty (the one the previously proposed question targeted).
      const answered = openConsequential()[0];
      if (answered) {
        answered.status = "resolved";
        answered.resolution = ctx.statement.text;
        for (const requirement of requirements) {
          if (
            answered.id &&
            requirement.linkedUncertaintyIds.includes(answered.id)
          ) {
            requirement.status = "explicit";
            requirement.origin = "manager_statement";
            requirement.definition = `[Mock] Clarified by HM: ${ctx.statement.text}`;
          }
        }
      }
    }

    const nextTarget = openConsequential()[0];
    return {
      extractedClaims,
      requirements,
      uncertainties,
      contradictions: ctx.intent.contradictions,
      nextQuestion: nextTarget
        ? {
            question: `[Mock] About ${nextTarget.about}: what would you concretely accept as evidence, and who represents that bar today?`,
            whyItMatters: nextTarget.consequence,
            targetsUncertaintyIds: nextTarget.id ? [nextTarget.id] : [],
            informationValue:
              "[Mock] Resolves the most consequential open uncertainty; changes sourcing and screening targets.",
          }
        : null,
    };
  },
});
