import {
  successProfilePayloadSchema,
  type SuccessProfilePayload,
} from "@/lib/core/payloads";
import { renderProjectContext, type ProjectContext } from "../context";
import { classifyOccupationForMock } from "../mock-knowledge";
import { EDITABILITY_REMINDER, systemPrelude } from "../prompts";
import { defineAiTask } from "../run";

export const successProfileTask = defineAiTask<
  ProjectContext,
  SuccessProfilePayload
>({
  task: "success_profile",
  schemaName: "SuccessProfile",
  schema: successProfilePayloadSchema,
  system:
    () => `${systemPrelude("an elite recruiter compiling a success profile")}

Compile the structured success profile from everything known: JD, role intelligence, and — above all — the hiring-manager intake answers. Where sources conflict, the hiring manager's answers win, and the conflict goes into unresolvedQuestions.

Provenance per item (mandatory): "jd" (from the JD), "hiring_manager" (from intake answers), "recruiter" (from recruiter notes), "market_research" (from market intelligence), "model_inference" (your synthesis). Do not launder inference into "hiring_manager".

- mustHave: only criteria with explicit backing; keep it short and real.
- trainable: what a strong hire can learn in-seat.
- evidenceSignals: observable, public, job-related proof points a sourcer can actually find.
- negativeSignals: patterns that predict failure for THIS role, never protected characteristics.
- exemplarPeople: only names present in the provided context; never invent people.
- unresolvedQuestions: whatever still needs the hiring manager.
${EDITABILITY_REMINDER}`,
  user: (ctx) => `${renderProjectContext(ctx)}
## Task
Compile the success profile for this search now.`,
  mock: (ctx) => {
    const occ = classifyOccupationForMock(
      `${ctx.project.roleTitle} ${ctx.project.industry ?? ""}`,
    );
    const hm = (text: string) => ({
      text,
      provenance: "hiring_manager" as const,
    });
    const inf = (text: string) => ({
      text,
      provenance: "model_inference" as const,
    });
    const jd = (text: string) => ({ text, provenance: "jd" as const });
    return {
      mission: `[Mock] Deliver ${ctx.project.businessObjective ?? "the hiring outcome"} as ${ctx.project.roleTitle}.`,
      outcomes: [hm("[Mock] Year-one outcome captured from intake")],
      responsibilities: occ.vocabulary.slice(0, 2).map((v) => jd(`Own ${v}`)),
      mustHave: occ.evidenceSignals.slice(0, 2).map(jd),
      preferred: occ.evidenceSignals.slice(2).map(jd),
      trainable: [inf(`[Mock] Trainable skill for ${occ.profession}`)],
      evidenceSignals: occ.evidenceSignals.map(inf),
      negativeSignals: [inf("[Mock] Pattern predicting failure in this role")],
      adjacentBackgrounds: occ.adjacentTitles.map(inf),
      exemplarPeople: [],
      exemplarCompanies: occ.channels.slice(0, 2).map((c) => inf(c.name)),
      targetIndustries: [jd(ctx.project.industry ?? "Unspecified")],
      targetCompanies: [],
      alternateTitles: occ.titles.map(inf),
      targetGeographies: [jd(ctx.project.geography ?? "Unspecified")],
      compensationNote: ctx.project.compensationNote ?? undefined,
      candidateMotivators: [
        inf(`[Mock] Motivator typical of ${occ.profession}`),
      ],
      sellingPoints: [hm("[Mock] Selling point from intake")],
      risks: [inf("[Mock] Search risk to monitor")],
      unresolvedQuestions: occ.domainQuestions.slice(0, 2).map(inf),
    };
  },
});
