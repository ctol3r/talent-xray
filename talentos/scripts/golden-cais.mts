/**
 * CAIS golden test (`pnpm golden:cais`) — the first deep LIVE benchmark
 * (PRODUCT_SPEC.md, "CAIS golden test"). Runs the real generation pipeline
 * for the Center for AI Safety Research Scientist / Research Engineer
 * fixture against the configured Anthropic model, then scores the generated
 * intake for the domain concepts the spec demands (research taste, RS vs RE,
 * first-author significance, distributed training, frontier labs, mission
 * alignment, …). Refuses to run on the mock provider: a benchmark of faked
 * output would violate the NO FAKE DATA rule.
 *
 * Requires ANTHROPIC_API_KEY (or ANTHROPIC_AUTH_TOKEN) — from the shell or
 * from ./.env. Writes a full human-review report to
 * ./data/golden-cais-report.md and exits non-zero on step failure or a
 * below-threshold intake score.
 */
import fs from "node:fs";
import path from "node:path";
import { getDb } from "../src/lib/db/client";
import { getProviderStatus } from "../src/lib/ai/provider";
import type { IntakePayload } from "../src/lib/core/payloads";
import {
  generateChannels,
  generateEvidenceAlignment,
  generateIntake,
  generateInterviewPlan,
  generateMarketIntelligence,
  generateOutreach,
  generateRoleIntelligence,
  generateScreenGuide,
  generateSearchStrings,
  generateSourcingStrategy,
  generateSuccessProfile,
} from "../src/lib/services/generation";
import {
  createCandidate,
  createCandidateInput,
} from "../src/lib/services/candidates";
import {
  answerIntakeQuestion,
  completeIntake,
  listChannels,
  listQueries,
} from "../src/lib/services/workflow";
import {
  createSearchProject,
  saveJobDescription,
} from "../src/lib/services/search-projects";
import { GOLDEN_FIXTURES } from "../src/lib/db/seed";

// ── Env + provider guardrails ───────────────────────────────────────────────

const envFile = path.join(process.cwd(), ".env");
if (fs.existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

if (process.env.TALENTOS_MODEL_PROVIDER === "mock") {
  console.error(
    "Refusing to run: TALENTOS_MODEL_PROVIDER=mock. This is the LIVE benchmark — " +
      "mock output scored as a benchmark would be fake data.",
  );
  process.exit(2);
}
if (!process.env.TALENTOS_DATABASE_PATH) {
  // Throwaway benchmark DB by default — never the real workspace DB.
  process.env.TALENTOS_DATABASE_PATH = "./data/golden-cais.db";
  for (const suffix of ["", "-wal", "-shm"]) {
    fs.rmSync(path.join(process.cwd(), `./data/golden-cais.db${suffix}`), {
      force: true,
    });
  }
}

const status = getProviderStatus();
if (!status.configured || status.kind !== "anthropic") {
  console.error(`Provider not configured: ${status.detail}`);
  console.error(
    "Set ANTHROPIC_API_KEY in talentos/.env (gitignored) or the shell, then re-run.",
  );
  process.exit(2);
}

// ── The spec's CAIS intake concept checklist ────────────────────────────────

interface ConceptProbe {
  concept: string;
  pattern: RegExp;
}

const CAIS_INTAKE_CONCEPTS: ConceptProbe[] = [
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

function intakeFullText(payload: IntakePayload): string {
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

// ── Runner ──────────────────────────────────────────────────────────────────

interface StepResult {
  step: string;
  ms: number;
  summary: string;
}

const steps: StepResult[] = [];
const report: string[] = [];

async function step<T>(
  name: string,
  fn: () => Promise<T>,
  summarize: (result: T) => string,
): Promise<T> {
  process.stdout.write(`▶ ${name} … `);
  const started = Date.now();
  const result = await fn();
  const ms = Date.now() - started;
  const summary = summarize(result);
  steps.push({ step: name, ms, summary });
  console.log(`${(ms / 1000).toFixed(1)}s — ${summary}`);
  return result;
}

function section(title: string, body: string): void {
  report.push(`## ${title}\n\n${body}\n`);
}

function json(value: unknown): string {
  return "```json\n" + JSON.stringify(value, null, 2) + "\n```";
}

const db = getDb();
const cais = GOLDEN_FIXTURES[0];
console.log(
  `CAIS golden test — LIVE run against ${status.detail}.\n` +
    `Fixture: ${cais.name}. Expect ~11 model calls over several minutes.\n`,
);

const project = await createSearchProject(db, {
  name: `Golden — ${cais.name}`,
  companyName: cais.company,
  roleTitle: cais.roleTitle,
  geography: cais.geography,
  country: cais.country,
  industry: cais.industry,
  seniority: cais.seniority,
  businessObjective: cais.businessObjective,
});
await saveJobDescription(db, {
  searchProjectId: project.id,
  rawText: cais.jd,
  source: "pasted",
});

const intel = await step(
  "Role intelligence",
  () => generateRoleIntelligence(db, project.id),
  (r) =>
    `${r.output.hardRequirements.length} hard reqs, ${r.output.assumptions.length} assumptions, ${r.output.unresolvedQuestions.length} open questions`,
);

const intake = await step(
  "Hiring-manager intake",
  () => generateIntake(db, project.id),
  (r) =>
    `${r.session.payload.categories.length} categories, ${r.session.payload.categories.reduce((n, c) => n + c.questions.length, 0)} questions`,
);

// Answer a few questions the way a CAIS hiring manager plausibly would, so
// downstream generations have intake signal. Clearly labelled as test input.
const hmAnswers = [
  "[Golden-test HM answer] Capability-driven: we are standing up a dangerous-capability evaluations workstream and nobody on staff owns benchmark construction end to end.",
  "[Golden-test HM answer] The bar is a researcher who has shipped a first-author empirical paper AND built the infrastructure behind it themselves; engineering-heavy backgrounds welcome.",
  "[Golden-test HM answer] We lose finalists to frontier labs on compensation; we win on mission, autonomy, and publication freedom.",
];
{
  const categories = intake.session.payload.categories;
  let answered = 0;
  for (const category of categories) {
    if (answered >= hmAnswers.length) break;
    const question = category.questions[0];
    if (!question?.id) continue;
    await answerIntakeQuestion(db, {
      sessionId: intake.session.id,
      questionId: question.id,
      answer: hmAnswers[answered],
    });
    answered += 1;
  }
  await completeIntake(db, intake.session.id);
  console.log(
    `  answered ${answered} intake questions as the HM, completed intake`,
  );
}

const profile = await step(
  "Success profile",
  () => generateSuccessProfile(db, project.id),
  (r) =>
    `${r.output.mustHave.length} must-haves, ${r.output.evidenceSignals.length} evidence signals`,
);

const market = await step(
  "Market intelligence",
  () => generateMarketIntelligence(db, project.id),
  (r) => `${r.output.sections.length} sections`,
);

const strategy = await step(
  "Sourcing strategy",
  () => generateSourcingStrategy(db, project.id),
  (r) => `${r.output.targetCompanies.length} target companies`,
);

await step(
  "Channel discovery",
  () => generateChannels(db, project.id),
  (r) => `${r.added} channels added`,
);
const channels = await listChannels(db, project.id);

await step(
  "Search strings",
  () => generateSearchStrings(db, project.id),
  (r) => `${r.added} queries added`,
);
const queries = await listQueries(db, project.id);

const candidate = await createCandidate(
  db,
  createCandidateInput.parse({
    searchProjectId: project.id,
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
  }),
);

const evidence = await step(
  "Evidence alignment",
  () => generateEvidenceAlignment(db, candidate.id),
  (r) =>
    `${r.output.items.length} evidence items, priority: ${r.output.reviewPriority.suggestion}`,
);

const outreach = await step(
  "Outreach sequence",
  () => generateOutreach(db, candidate.id),
  (r) => `${r.sequence.payload.steps.length} steps`,
);

const screen = await step(
  "Recruiter screen guide",
  () => generateScreenGuide(db, project.id),
  (r) => `${r.output.sections.length} sections`,
);

const plan = await step(
  "Interview plan",
  () => generateInterviewPlan(db, project.id),
  (r) =>
    `${r.output.stages.length} stages: ${r.output.stages.map((s) => s.name).join(" → ")}`,
);

// ── Scoring ─────────────────────────────────────────────────────────────────

const text = intakeFullText(intake.session.payload);
const hits = CAIS_INTAKE_CONCEPTS.map((probe) => ({
  ...probe,
  hit: probe.pattern.test(text),
}));
const hitCount = hits.filter((h) => h.hit).length;
const PASS_THRESHOLD = 12;

const guardrails = [
  {
    name: "Intake ends with a playback summary",
    ok: intake.session.payload.playback != null,
  },
  {
    name: "Market claims never fabricate certainty (none marked 'verified')",
    ok: market.output.sections
      .flatMap((s) => s.claims)
      .every((c) => c.certainty !== "verified"),
  },
  {
    name: "X-ray queries composed (site: operators present)",
    ok: queries.some((q) => q.query.includes("site:")),
  },
  {
    name: "Evidence alignment includes gaps, not just matches",
    ok: evidence.output.items.some(
      (i) => i.status === "missing" || i.status === "unknown",
    ),
  },
  {
    name: "No protected-trait warnings in any generation",
    ok: [
      intel,
      intake,
      profile,
      market,
      strategy,
      evidence,
      outreach,
      screen,
      plan,
    ].every((r) => r.warnings.length === 0),
  },
];

// ── Report ──────────────────────────────────────────────────────────────────

report.push(
  `# CAIS Golden Test — live run\n`,
  `- Date: ${new Date().toISOString()}`,
  `- Provider: ${status.detail}`,
  `- Fixture: ${cais.name}`,
  `- Verdict: **${hitCount >= PASS_THRESHOLD ? "PASS" : "FAIL"}** — ${hitCount}/${CAIS_INTAKE_CONCEPTS.length} intake domain concepts present (threshold ${PASS_THRESHOLD})\n`,
);

section(
  "Intake concept scorecard",
  hits.map((h) => `- ${h.hit ? "✅" : "❌"} ${h.concept}`).join("\n"),
);

section(
  "Guardrails",
  guardrails.map((g) => `- ${g.ok ? "✅" : "❌"} ${g.name}`).join("\n"),
);

section(
  "Step timings",
  steps
    .map((s) => `- ${s.step}: ${(s.ms / 1000).toFixed(1)}s — ${s.summary}`)
    .join("\n"),
);

section(
  "Generated intake (full)",
  intake.session.payload.categories
    .map(
      (c) =>
        `### ${c.title}\n\n_${c.rationale}_\n\n` +
        c.questions
          .map((q) => `- **${q.question}**\n  - Why: ${q.whyItMatters}`)
          .join("\n"),
    )
    .join("\n\n") +
    (intake.session.payload.playback
      ? `\n\n### Playback — "What did I get wrong?"\n\n${json(intake.session.payload.playback)}`
      : ""),
);

section("Role intelligence", json(intel.output));
section("Success profile", json(profile.output));
section("Market intelligence", json(market.output));
section("Sourcing strategy", json(strategy.output));
section(
  "Channels",
  channels
    .map((c) => `- [${c.priority}] ${c.name} — ${c.whyRelevant ?? ""}`)
    .join("\n"),
);
section(
  "Search strings",
  queries.map((q) => `- \`${q.platform}\`: \`${q.query}\``).join("\n"),
);
section("Evidence alignment (synthetic candidate)", json(evidence.output));
section("Outreach sequence", json(outreach.sequence.payload));
section("Recruiter screen guide", json(screen.output));
section("Interview plan", json(plan.output));

const reportPath = path.join(process.cwd(), "data", "golden-cais-report.md");
fs.writeFileSync(reportPath, report.join("\n"));

// ── Summary ─────────────────────────────────────────────────────────────────

console.log(
  `\nIntake concept scorecard: ${hitCount}/${CAIS_INTAKE_CONCEPTS.length}`,
);
for (const h of hits) console.log(`  ${h.hit ? "✅" : "❌"} ${h.concept}`);
console.log("\nGuardrails:");
for (const g of guardrails) console.log(`  ${g.ok ? "✅" : "❌"} ${g.name}`);
console.log(`\nFull report: ${reportPath}`);

const guardrailsOk = guardrails.every((g) => g.ok);
if (hitCount >= PASS_THRESHOLD && guardrailsOk) {
  console.log(`\nCAIS GOLDEN TEST: PASS`);
} else {
  console.log(
    `\nCAIS GOLDEN TEST: FAIL — ` +
      (hitCount < PASS_THRESHOLD
        ? `intake scored ${hitCount}/${CAIS_INTAKE_CONCEPTS.length} (threshold ${PASS_THRESHOLD}). `
        : "") +
      (guardrailsOk ? "" : "guardrail check failed."),
  );
  process.exit(1);
}
