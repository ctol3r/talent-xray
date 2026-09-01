import {
  intakePayloadSchema,
  type IntakePayload,
} from "@/lib/core/payloads";
import { renderProjectContext, type ProjectContext } from "../context";
import { classifyOccupationForMock } from "../mock-knowledge";
import { EDITABILITY_REMINDER, systemPrelude } from "../prompts";
import { defineAiTask } from "../run";

export const intakeTask = defineAiTask<ProjectContext, IntakePayload>({
  task: "intake_generation",
  schemaName: "IntakeSession",
  schema: intakePayloadSchema,
  maxTokens: 32000,
  system: () => `${systemPrelude("an elite recruiter preparing a hiring-manager intake interview")}

You are generating the intake interview for THIS specific role — the flagship test of this product is that intakes for different professions are radically different. Generic recruiter questions ("tell me about the team") may appear only where they earn their place.

Requirements:
- Organize questions into categories that fit this role. Draw from: why the role exists, success definition (30/90/180/365), exemplars (internal, external, dream candidates), true requirements (must-have vs trainable vs nice-to-have, false positives/negatives), deep TECHNICAL/FUNCTIONAL questions specific to this profession, team, culture, candidate motivation, compensation, geography, competition for this talent, interview process, closing dynamics, sourcing inputs, risks, negative exemplars, and calibration.
- The technical/functional category must show real domain understanding of this profession (e.g., for ML research: publication quality, research taste, empirical vs theoretical orientation, first-author significance, training scale, research lineages, frontier-lab experience, mission alignment; for physicians: specialty, board status, licensing, call, patient volume, procedural mix; for sales: quota, attainment, ACV, cycle, hunting/farming). Derive the right equivalents for THIS role.
- Each question carries whyItMatters: what the answer changes about the search.
- End with the playback: "Let me summarize the search as I now understand it" — target, hard requirements, flexible requirements, ideal phenotype, adjacent phenotypes, disqualifiers, unresolved questions — so the recruiter can ask the hiring manager "What did I get wrong?".
- 6–10 categories, 3–7 questions each. Sharp, non-overlapping, answerable in a live conversation.
${EDITABILITY_REMINDER}`,
  user: (ctx) => `${renderProjectContext(ctx)}
## Task
Generate the complete hiring-manager intake interview for this search, ending with the playback summary.`,
  mock: (ctx) => {
    const occ = classifyOccupationForMock(
      `${ctx.project.roleTitle} ${ctx.project.industry ?? ""}`,
    );
    return {
      categories: [
        {
          title: "Why the role exists",
          rationale: "Anchors the search to the business problem.",
          questions: [
            {
              question: `Why does ${ctx.project.companyName ?? "the company"} need this ${ctx.project.roleTitle} now?`,
              whyItMatters: "Growth vs replacement changes urgency and profile.",
            },
            {
              question: "What happens if the role stays unfilled for two quarters?",
              whyItMatters: "Reveals true priority and internal alternatives.",
            },
          ],
        },
        {
          title: `${occ.profession} — technical/functional depth (mock)`,
          rationale: `Domain-specific bar for ${occ.profession}.`,
          questions: occ.domainQuestions.map((question) => ({
            question,
            whyItMatters: `Determines the ${occ.profession} evidence bar for screening.`,
          })),
        },
        {
          title: "Success definition",
          rationale: "Converts opinions into observable outcomes.",
          questions: [
            {
              question: `What must this ${ctx.project.roleTitle} accomplish in the first 90 and 365 days?`,
              whyItMatters: "Outcome anchors for the success profile.",
            },
            {
              question: "What separates good from exceptional in this seat?",
              whyItMatters: "Calibrates the top of the rubric.",
            },
          ],
        },
        {
          title: "Exemplars and anti-exemplars",
          rationale: "People are better calibration than adjectives.",
          questions: [
            {
              question: "Who represents the bar — internally or anywhere — and why?",
              whyItMatters: "Names become sourcing lookalikes and rubric anchors.",
            },
            {
              question: "Describe a past hire in this kind of role that did NOT work out. What was missing?",
              whyItMatters: "Negative exemplars expose hidden requirements.",
            },
          ],
        },
      ],
      playback: {
        target: `[Mock] ${ctx.project.roleTitle} for ${ctx.project.companyName ?? "the company"} in ${ctx.project.geography ?? "target geography"}`,
        hardRequirements: occ.evidenceSignals.slice(0, 2),
        flexibleRequirements: occ.evidenceSignals.slice(2),
        idealPhenotype: `[Mock] Strong ${occ.profession} practitioner matching the JD`,
        adjacentPhenotypes: occ.adjacentTitles,
        disqualifiers: ["[Mock] To be confirmed with hiring manager"],
        unresolvedQuestions: occ.domainQuestions.slice(0, 3),
      },
    };
  },
});
