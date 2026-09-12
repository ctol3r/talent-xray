/**
 * Shared CAIS golden-test pieces used by both runners:
 * `golden-cais.mts` (Anthropic API provider) and
 * `golden-cais-session.mts` (Claude session provider — no API key).
 * One source of truth for the concept checklist, the HM answers, the
 * synthetic candidate, and report helpers.
 */
import type { IntakePayload } from "../src/lib/core/payloads";

export interface ConceptProbe {
  concept: string;
  pattern: RegExp;
}

/** The spec's CAIS intake concept checklist (PRODUCT_SPEC.md). */
export const CAIS_INTAKE_CONCEPTS: ConceptProbe[] = [
  {
    concept: "Why the position exists now",
    pattern:
      /why (now|the role|the position|does this role exist)|exists now|why now/i,
  },
  {
    concept: "Capacity- vs capability-driven hiring",
    pattern:
      /capacit\w+[\s\S]{0,80}capabilit\w+|capabilit\w+[\s\S]{0,80}capacit\w+/i,
  },
  {
    concept: "Dream researchers / exemplars",
    pattern: /dream (candidate|researcher|hire)|exemplar|represents the bar/i,
  },
  {
    concept: "Research Scientist vs Research Engineer distinction",
    pattern:
      /research scientist[\s\S]{0,80}research engineer|scientist (vs\.?|versus|or) (research )?engineer|RS[\s\S]{0,20}RE\b/i,
  },
  { concept: "Publication quality", pattern: /publication|venue|paper/i },
  { concept: "First-author significance", pattern: /first[- ]author/i },
  {
    concept: "Empirical vs theoretical orientation",
    pattern: /empirical[\s\S]{0,120}theor|theor\w+[\s\S]{0,120}empirical/i,
  },
  {
    concept: "Research taste",
    pattern: /research taste|taste in (problems|research)|problem selection/i,
  },
  {
    concept: "Experimental execution",
    pattern:
      /experiment\w* (execution|velocity|design)|run\w* (experiments|ablations)|ablation/i,
  },
  {
    concept: "Distributed training / training scale",
    pattern:
      /distributed training|training scale|large[- ]scale (training|experiments?)|GPU|cluster/i,
  },
  {
    concept: "Frontier-lab experience",
    pattern: /frontier[- ](lab|scale|model)/i,
  },
  {
    concept: "Research lineages / labs / advisors",
    pattern: /lineage|advisor|(from|which|target) labs?\b|research group/i,
  },
  {
    concept: "Conferences (NeurIPS / ICML / ICLR)",
    pattern: /NeurIPS|ICML|ICLR/i,
  },
  {
    concept: "Mission alignment vs skepticism",
    pattern: /mission|safety motivation|skeptic/i,
  },
  {
    concept: "Candidate selling points / closing dynamics",
    pattern:
      /selling point|sell (the|this)|closing|why would (a|the|top)|counter[- ]?offer|compete for/i,
  },
  {
    concept: "Competitive labs / talent competitors",
    pattern:
      /compet\w+ (lab|employer|offer)|competing|lose (candidates|people) to|who else is hiring/i,
  },
];

export const PASS_THRESHOLD = 12;

export function intakeFullText(payload: IntakePayload): string {
  const parts: string[] = [];
  for (const category of payload.categories) {
    parts.push(category.title, category.rationale);
    for (const q of category.questions) {
      parts.push(q.question, q.whyItMatters);
    }
  }
  if (payload.playback) parts.push(JSON.stringify(payload.playback));
  return parts.join("\n");
}

/**
 * How a CAIS hiring manager plausibly answers, so downstream generations
 * have intake signal. Clearly labelled as test input.
 */
export const GOLDEN_HM_ANSWERS = [
  "[Golden-test HM answer] Capability-driven: we are standing up a dangerous-capability evaluations workstream and nobody on staff owns benchmark construction end to end.",
  "[Golden-test HM answer] The bar is a researcher who has shipped a first-author empirical paper AND built the infrastructure behind it themselves; engineering-heavy backgrounds welcome.",
  "[Golden-test HM answer] We lose finalists to frontier labs on compensation; we win on mission, autonomy, and publication freedom.",
];

export const SYNTHETIC_CANDIDATE = {
  name: "Synthetic Benchmark Candidate",
  currentTitle: "Member of Technical Staff",
  currentCompany: "Example AI Lab (synthetic)",
  resumeText:
    "SYNTHETIC PROFILE FOR BENCHMARKING — not a real person. " +
    "Two first-author workshop papers on adversarial robustness (NeurIPS SafeML workshop). " +
    "Built the distributed evaluation harness used across the lab (PyTorch, Ray, 256-GPU runs). " +
    "Maintains a popular open-source jailbreak-evaluation benchmark. " +
    "BS in CS; no PhD. Blogs about AI risk; previously a platform engineer at a fintech.",
  profileUrls: ["https://example.com/synthetic-profile"],
};

export function mdSection(title: string, body: string): string {
  return `## ${title}\n\n${body}\n`;
}

export function mdJson(value: unknown): string {
  return "```json\n" + JSON.stringify(value, null, 2) + "\n```";
}
