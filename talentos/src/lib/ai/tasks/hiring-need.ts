import {
  hiringNeedOutputSchema,
  type HiringNeedOutput,
  type RequirementIR,
  type UncertaintyIR,
} from "@/lib/core/ir";
import { renderProjectContext, type ProjectContext } from "../context";
import { classifyOccupationForMock } from "../mock-knowledge";
import { systemPrelude } from "../prompts";
import { defineAiTask } from "../run";

/**
 * The FIRST interpretation step (D-011): raw JD + project facts →
 * HiringNeedIR + the initial requirement/uncertainty/contradiction sets of
 * the HiringIntentIR. Everything downstream consumes this IR — no other
 * agent re-derives requirements from the JD.
 */
export const hiringNeedTask = defineAiTask<ProjectContext, HiringNeedOutput>({
  task: "derive_hiring_need",
  schemaName: "HiringNeed",
  schema: hiringNeedOutputSchema,
  maxTokens: 24000,
  system:
    () => `${systemPrelude("an elite recruiter distilling a hiring need into a canonical, typed interpretation")}

You are producing the search's SINGLE canonical interpretation. Every later agent consumes your objects instead of re-reading the JD, so precision here compounds.

Rules:
- need.claims: extract the JD's actual claims verbatim-close, each with provenance "jd". What the JD does not say goes in need.unknowns — never invented.
- requirements: every requirement-shaped statement becomes a RequirementIR. The verbatim source phrase goes in "statement"; "definition" says what it concretely means for THIS search; "evidenceSpec" lists observable public evidence that would satisfy it; "falseSignals" lists lookalikes that do not.
- VAGUE EVALUATIVE LANGUAGE ("research taste", "scrappy", "strong communicator") is the critical case: it MUST become a RequirementIR with your best concrete definition, status "needs_clarification", and a linked consequential UncertaintyIR whose consequence explains what the search gets wrong if the phrase stays undefined. It must never survive as an unexplained string.
- uncertainties: every ambiguity, gap, conflict, or assumption — with an honest "consequential" flag (would resolving it change sourcing or screening?).
- contradictions: claims that cannot both hold, each side with provenance.
- Requirements you inferred but the JD does not state get status "assumed" and origin "model_inference".
- "status" describes how well a requirement is DEFINED, not whether every detail is settled. A requirement the JD states plainly is "explicit" even when its threshold or level is open — put that open threshold in a linked UncertaintyIR rather than downgrading the requirement itself. "needs_clarification" is for requirements that are genuinely vague.`,
  user: (ctx) => `${renderProjectContext(ctx)}
## Task
Derive the canonical HiringNeedIR and the initial requirement, uncertainty, and contradiction sets for this search now.`,
  mock: (ctx) => {
    const jd = ctx.jdText ?? "";
    const occ = classifyOccupationForMock(
      `${ctx.project.roleTitle} ${ctx.project.industry ?? ""}`,
    );
    const sentences = jd
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const sentenceWith = (re: RegExp) => sentences.find((s) => re.test(s));

    const requirements: RequirementIR[] = [];
    const uncertainties: UncertaintyIR[] = [];

    // Deterministic vague-phrase handling: known evaluative phrases become
    // explicit requirements with a linked consequential uncertainty.
    const vaguePhrases: [string, RegExp][] = [
      ["Research taste", /research taste/i],
      ["Strong communication", /strong communicat/i],
      ["Scrappiness", /\bscrappy\b/i],
    ];
    for (const [label, re] of vaguePhrases) {
      const source = sentenceWith(re);
      if (!source) continue;
      const uncertaintyId = `unc-${label.toLowerCase().replace(/\s+/g, "-")}`;
      uncertainties.push({
        id: uncertaintyId,
        about: `${label} — what the hiring manager concretely means`,
        kind: "ambiguity",
        consequence: `[Mock] Without a concrete definition of "${label.toLowerCase()}", sourcing and screening will each guess differently and the search optimizes for the wrong evidence.`,
        consequential: true,
        status: "open",
      });
      requirements.push({
        label,
        statement: source,
        definition: `[Mock] Working definition pending HM clarification: observable track record consistent with "${label.toLowerCase()}" in this profession.`,
        kind: "must_have",
        origin: "jd",
        evidenceSpec: occ.evidenceSignals.slice(0, 2),
        falseSignals: [
          `[Mock] Surface signals that mimic ${label.toLowerCase()} without the underlying track record`,
        ],
        status: "needs_clarification",
        linkedUncertaintyIds: [uncertaintyId],
      });
    }

    // Explicitly stated requirements from occupation knowledge.
    for (const signal of occ.evidenceSignals.slice(0, 2)) {
      requirements.push({
        label: signal,
        statement: sentenceWith(/looking for/i) ?? `[Mock] ${signal}`,
        definition: `[Mock] ${signal} as stated for a ${ctx.project.roleTitle}.`,
        kind: "must_have",
        origin: "jd",
        evidenceSpec: [signal],
        falseSignals: [],
        status: "explicit",
        linkedUncertaintyIds: [],
      });
    }

    uncertainties.push({
      about: "[Mock] Compensation band vs market",
      kind: "missing_information",
      consequence: "[Mock] Outreach positioning may misfire.",
      consequential: false,
      status: "open",
    });

    return {
      need: {
        businessProblem:
          ctx.project.businessObjective ??
          `[Mock] Staff the ${ctx.project.roleTitle} seat.`,
        roleSummary: `[Mock] ${ctx.project.roleTitle} at ${ctx.project.companyName ?? "the company"} (${occ.profession}).`,
        claims: sentences.slice(0, 3).map((text) => ({
          text,
          provenance: "jd" as const,
        })),
        unknowns: ["[Mock] Team size and reporting line not stated in the JD"],
      },
      requirements,
      uncertainties,
      contradictions: [],
    };
  },
});
