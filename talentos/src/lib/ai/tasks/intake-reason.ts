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
- An uncertainty about how something here COMPARES with the market outside — the rate against the regional market, the package against what this population is paid, whether the qualifying population exists locally — cannot be resolved by anyone inside the company (W12 S-3). The hiring manager stating their own number answers one side of the comparison and leaves the other side unknown; record their figure and keep the uncertainty OPEN. Only market evidence closes these.
- Detect contradictions with the JD, earlier statements, or existing requirements — record both sides with provenance; do NOT silently pick a winner.
- A hiring manager's own example that refutes their own stated rule IS a contradiction (W12 S-5). "Nobody without a PhD… well, my best engineer doesn't have one", "only big-name fabs… though the guy who fixed our etch came from a tiny shop": record a ContradictionIR with the rule as one side and the example as the other. Amending the requirement to fit the example is usually the right call in substance, but doing it QUIETLY hides the thing the recruiter has to take back into the room — that the stated rule and the manager's own experience disagree. Record the contradiction and amend.

Status, agreement and attribution (these are three different things):
- "status" describes how well a requirement is DEFINED. Once the hiring manager has said what a requirement IS, it is "explicit" — even if its threshold, level or bar is still open. Put the open threshold in a linked UncertaintyIR; do NOT downgrade the whole requirement to "needs_clarification" because one dimension of it is unsettled. Reserve "needs_clarification" for requirements that are genuinely still vague.
- "contested": true when stakeholders disagree about a requirement and the disagreement is unresolved. Never encode disagreement as "needs_clarification", and never weaken or drop a requirement because a later speaker disagrees with it — both positions stand until the people reconcile them. Clear "contested" only when a statement actually settles it.
- "assertedBy": the speaker of the statement the requirement came from, copied from the statement's "speaker" field. Set it whenever origin is "manager_statement". With multiple stakeholders this is the only structured record of who wants what.
- When a stakeholder defines a term, resolve the uncertainty about it on their word — that is what asking them was for. If ANOTHER stakeholder then disputes it, re-open that uncertainty, mark the requirement contested, and keep it open until they agree. Do not hold a question open merely because other stakeholders have not spoken yet; record who said what and move.

False signals (W12 S-1 — the weakest thing this reasoner does; 54.8 % recall across the full corpus):
- When the hiring manager draws a contrast — "not people who've seen the machine", "not that they've had CFO on a call" — put THEIR wording in falseSignals, not a paraphrase. The contrast is the most screenable thing they said.
- A false signal is the ONLY thing that stops a proxy being read as evidence, and its absence is invisible in the output — nothing downstream can tell "no false signals exist" from "nobody wrote them down". So for every must_have and every disqualifier, ask what a candidate could show that LOOKS like this requirement and is not it, and write it down. Examples the corpus caught being missed: "operator / pressed cycle start" against setting up a five-axis machine; "only ever went up and to the right" against having led finance through a downturn; the school name against a doctorate; "fine dining only, small covers" against high-volume banquet service; an accent or a foreign degree against a legal work-authorisation requirement.
- A requirement whose false signals are empty because none genuinely exist is fine. One whose false signals are empty because the work was skipped is a defect.

Withdrawn requirements (W12 S-4): when a hiring manager takes a requirement away — "drop native", "BSEE, no, take it off", "detail-oriented is filler" — REMOVE it from the requirement set entirely. Do not keep it as "preferred", and never append "(withdrawn)" to its label: "preferred" legitimately raises a candidate's review priority, so a withdrawn requirement kept that way still shapes the search. Nothing is lost by removing it — the withdrawal is in extractedClaims and in the verbatim statement log, and the job description is reference material that must never be re-derived from.

Provenance when a requirement is re-asserted (W12 S-2): a requirement's "statement" is verbatim to its source and "origin" names that source; they move together or not at all. When the hiring manager restates a job-description requirement in their own words, the statement becomes THEIR words, the origin becomes "manager_statement", and assertedBy becomes their speaker. Do not overwrite the statement while leaving origin "jd" — that leaves the provenance lying in both directions. If instead they only clarify what the JD phrase means, keep the JD statement verbatim and put their words in the definition.

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
