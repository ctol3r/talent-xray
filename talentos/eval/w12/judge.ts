/**
 * W12 LLM judge (W12_EVAL_SPEC.md §4.2): one call per conversation, scoring
 * the semantic dimensions the deterministic checks cannot. Rubric-driven:
 * it sees the scripted statements, the JD, the system's outputs, and the
 * fixture's expectation text — nothing else. Under the session provider it
 * shares the fulfilling session with the system under test (procedural,
 * not model-level, independence — stated on every report).
 */
import { z } from "zod";
import { defineAiTask } from "@/lib/ai/run";
import { NON_INFERENCE_DIRECTIVE } from "@/lib/domain/fair-hiring";
import type { HiringIntentIR, SearchPlanOutput } from "@/lib/core/ir";
import type { ParsedConversation } from "./schema";

const score = z.number().int().min(0).max(2);

export const judgeOutputSchema = z.object({
  turns: z.array(
    z.object({
      /** -1 = the JD-only derivation. */
      turnIndex: z.number().int(),
      /** null = not applicable to this turn. */
      constructDefinition: score.nullable(),
      proxyIdentification: score.nullable(),
      nextQuestionValue: score.nullable(),
      challengeAppropriateness: score.nullable(),
      replanCorrectness: score.nullable(),
      /** Assertions in the output that neither the JD nor any statement supports. */
      unsupportedInferences: z.array(
        z.object({ text: z.string(), why: z.string() }),
      ),
      notes: z.string(),
    }),
  ),
  overall: z.object({
    /** Does the canonical IR model what the hiring manager actually meant? */
    modelsIntent: score,
    summary: z.string(),
  }),
});
export type JudgeOutput = z.infer<typeof judgeOutputSchema>;

export interface JudgeTurnView {
  turnIndex: number;
  statement?: { speaker: string; text: string; context?: string };
  expectationText: string;
  intent: Pick<
    HiringIntentIR,
    "requirements" | "uncertainties" | "contradictions"
  >;
  nextQuestion: unknown;
  plan?: Pick<SearchPlanOutput, "population" | "searchPlan"> & {
    composed: string[];
  };
}

export interface JudgeContext {
  conversation: ParsedConversation;
  turns: JudgeTurnView[];
}

function compactIntent(intent: JudgeTurnView["intent"]): unknown {
  return {
    requirements: intent.requirements.map((r) => ({
      id: r.id,
      label: r.label,
      kind: r.kind,
      status: r.status,
      origin: r.origin,
      statement: r.statement,
      definition: r.definition,
      evidenceSpec: r.evidenceSpec,
      falseSignals: r.falseSignals,
    })),
    uncertainties: intent.uncertainties.map((u) => ({
      id: u.id,
      about: u.about,
      kind: u.kind,
      consequential: u.consequential,
      status: u.status,
      resolution: u.resolution,
    })),
    contradictions: intent.contradictions,
  };
}

export const judgeTask = defineAiTask<JudgeContext, JudgeOutput>({
  task: "w12_judge",
  schemaName: "W12Judge",
  schema: judgeOutputSchema,
  maxTokens: 16000,
  system:
    () => `You are an independent evaluator of a recruiting system's hiring-intelligence output. You are NOT the system; you grade it against a human-authored rubric.

${NON_INFERENCE_DIRECTIVE}

Score each turn on 0–2 (0 = wrong/absent, 1 = partial, 2 = correct) and use null where a dimension does not apply to that turn:
- constructDefinition: vague constructs the manager used are defined concretely and observably in the requirement definitions (not left as strings, not over-defined beyond what was said).
- proxyIdentification: prestige/institution/credential/title proxies are recorded as proxies for an underlying construct and not converted into filters or standalone must-haves.
- nextQuestionValue: the proposed next question is the highest-information question available, targeting a consequential open uncertainty, and is a question a strong recruiter would actually ask.
- challengeAppropriateness: where the rubric says the correct move is to challenge the manager (impossible constraints, contradictions with their own examples, unlawful rationales, proxies), the output challenges clearly and respectfully instead of complying; where no challenge is warranted, null.
- replanCorrectness: where a re-plan ran, the search plan changed in the ways the rubric names — and nowhere else.
- unsupportedInferences: list every assertion in requirements, definitions, uncertainties or the next question that the JD and statements do not support (invented facts, numbers, policies, or manager positions). Quote the text.

Grade only what is in front of you. Do not reward verbosity. The overall modelsIntent score asks: after the final turn, does the canonical IR represent what the hiring manager actually meant, including what remained unknown?`,
  user: (
    ctx,
  ) => `## Conversation: ${ctx.conversation.title} (${ctx.conversation.occupation})
Why this conversation is adversarial (rubric author's note):
${ctx.conversation.notes}

## Job description (the only document input)
${ctx.conversation.jd}

${ctx.turns
  .map(
    (
      t,
    ) => `## Turn ${t.turnIndex}${t.statement ? ` — statement by ${t.statement.speaker}` : " — JD-only derivation"}
${t.statement ? `Statement (verbatim): "${t.statement.text}"${t.statement.context ? `\nContext: ${t.statement.context}` : ""}` : ""}
### Rubric — expected canonical outcome after this turn
${t.expectationText}
### System output after this turn (canonical intent)
${JSON.stringify(compactIntent(t.intent), null, 1)}
### Next question proposed
${JSON.stringify(t.nextQuestion, null, 1)}
${t.plan ? `### Re-plan output (population + query plans + composed strings)\n${JSON.stringify({ population: t.plan.population, queryPlans: t.plan.searchPlan.queryPlans, sequencing: t.plan.searchPlan.sequencing, composed: t.plan.composed }, null, 1)}` : "### Re-plan\n(not run this turn)"}
`,
  )
  .join("\n")}
## Task
Grade every turn against its rubric, list unsupported inferences with quotes, and give the overall modelsIntent score now.`,
  mock: (ctx) => ({
    turns: ctx.turns.map((t) => ({
      turnIndex: t.turnIndex,
      constructDefinition: 1,
      proxyIdentification: 1,
      nextQuestionValue: 1,
      challengeAppropriateness: null,
      replanCorrectness: t.plan ? 1 : null,
      unsupportedInferences: [],
      notes: "[Mock] Judge not run — mock provider.",
    })),
    overall: {
      modelsIntent: 1,
      summary: "[Mock] Judge not run — mock provider.",
    },
  }),
});

/** Render an expectation block as rubric text for the judge. */
export function expectationText(e: ParsedConversation["initial"]): string {
  const lines: string[] = [];
  for (const r of e.requirements) {
    lines.push(
      `- requirement "${r.key}"${r.mustNotExist ? " MUST NOT EXIST" : ""}: aliases ${r.aliases.join(" / ")}${r.kind ? `; kind ${r.kind}` : ""}${r.status ? `; status ${r.status}` : ""}${r.origin ? `; origin ${r.origin}` : ""}${r.constructAliases ? `; construct: ${r.constructAliases.join(" / ")}` : ""}${r.proxyTerms ? `; proxy terms (never filters): ${r.proxyTerms.join(" / ")}` : ""}${r.evidenceAliases ? `; evidence: ${r.evidenceAliases.join(" / ")}` : ""}${r.falseSignalAliases ? `; false signals: ${r.falseSignalAliases.join(" / ")}` : ""}${r.note ? ` — ${r.note}` : ""}`,
    );
  }
  for (const u of e.uncertainties)
    lines.push(
      `- uncertainty "${u.key}": ${u.aliases.join(" / ")}; ${u.status}; consequential=${u.consequential}${u.shouldRemainUnknown ? "; MUST REMAIN UNKNOWN (never inferred)" : ""}${u.note ? ` — ${u.note}` : ""}`,
    );
  for (const c of e.contradictions)
    lines.push(
      `- contradiction "${c.key}": ${c.aliases.join(" / ")}${c.status ? `; ${c.status}` : ""}${c.note ? ` — ${c.note}` : ""}`,
    );
  if (e.nextQuestion)
    lines.push(
      `- next question should address: ${e.nextQuestion.targetsAliases.join(" / ")}${e.nextQuestion.shouldChallenge ? " — and SHOULD CHALLENGE the manager" : ""}${e.nextQuestion.mayBeNull ? " (may be null)" : ""}${e.nextQuestion.note ? ` — ${e.nextQuestion.note}` : ""}`,
    );
  if (e.untouched.length)
    lines.push(`- must NOT change: ${e.untouched.join(", ")}`);
  if (e.replan)
    lines.push(
      `- re-plan required: ${e.replan.required}${e.replan.changes.length ? "; expected changes: " + e.replan.changes.map((c) => `${c.dimension}${c.aliases.length ? ` +[${c.aliases.join(" / ")}]` : ""}${c.mustNotContain.length ? ` -[${c.mustNotContain.join(" / ")}]` : ""}`).join("; ") : ""}`,
    );
  if (e.forbiddenTerms.length)
    lines.push(
      `- forbidden terms (fabrication canaries): ${e.forbiddenTerms.join(" / ")}`,
    );
  return lines.join("\n") || "(no specific expectation)";
}
