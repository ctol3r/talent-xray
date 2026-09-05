import { z } from "zod";
import { learningKindSchema } from "@/lib/core/enums";
import { renderProjectContext, type ProjectContext } from "../context";
import { systemPrelude } from "../prompts";
import { defineAiTask } from "../run";

export interface LearningsContext {
  project: ProjectContext;
  rawLearnings: { kind: string; text: string; sampleSize: number | null }[];
}

export const learningsSynthesisOutputSchema = z.object({
  learnings: z.array(
    z.object({
      kind: learningKindSchema,
      text: z.string(),
      sampleSize: z.number().optional(),
      smallSampleWarning: z.boolean(),
    }),
  ),
  summary: z.string(),
});
export type LearningsSynthesisOutput = z.infer<
  typeof learningsSynthesisOutputSchema
>;

export const learningsSynthesisTask = defineAiTask<
  LearningsContext,
  LearningsSynthesisOutput
>({
  task: "learnings_synthesis",
  schemaName: "LearningsSynthesis",
  schema: learningsSynthesisOutputSchema,
  system: () => `${systemPrelude("a search-retrospective analyst")}

Synthesize the recorded per-candidate outcomes into generalized search learnings. Rules:
- Generalize only what the data supports. Every learning derived from fewer than 5 observations gets smallSampleWarning: true and hedged phrasing ("early signal", never a confident rate).
- Preserve the observation basis in the text ("3 of 4 declined candidates cited…") — no invented percentages.
- summary: what the next similar search should do differently, in a few sentences.`,
  user: (ctx) => `${renderProjectContext(ctx.project)}
## Recorded outcomes
${JSON.stringify(ctx.rawLearnings, null, 1)}
## Task
Synthesize the search learnings now.`,
  mock: (ctx) => ({
    learnings: ctx.rawLearnings.slice(0, 3).map((l) => ({
      kind: (learningKindSchema.options as readonly string[]).includes(l.kind)
        ? (l.kind as LearningsSynthesisOutput["learnings"][number]["kind"])
        : ("general" as const),
      text: `[Mock] Early signal: ${l.text}`,
      sampleSize: l.sampleSize ?? undefined,
      smallSampleWarning: (l.sampleSize ?? 1) < 5,
    })),
    summary: "[Mock] Synthesis placeholder from mock provider.",
  }),
});
