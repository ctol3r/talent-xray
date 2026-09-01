/**
 * CAIS golden test — Claude session edition (`pnpm golden:session <cmd>`).
 * Same live benchmark as golden-cais.mts, but with the SESSION provider:
 * each generation is fulfilled by a Claude session (Claude Code / claude.ai)
 * through the file-handoff outbox — no Anthropic API key required. Model
 * usage is covered by the user's Claude subscription.
 *
 * Commands (all force provider=session and a dedicated benchmark DB):
 *   init                 create/reuse the CAIS project + JD; prints PROJECT_ID
 *   run <task> [--project id] [--candidate id]
 *                        run one generation. Prints PENDING with
 *                        REQUEST_FILE/RESPONSE_FILE on first call; the
 *                        fulfilling session writes the response JSON, then
 *                        re-runs the command until it prints OK.
 *   answers --project id answer 3 intake questions as the HM, complete intake
 *   candidate --project id
 *                        create/reuse the synthetic candidate; prints CANDIDATE_ID
 *   score --project id --candidate id
 *                        scorecard + guardrails + full report to
 *                        data/golden-cais-report.md; non-zero exit on FAIL
 *
 * Task names for `run`: role_intelligence, intake, success_profile,
 * market_intelligence, sourcing_strategy, channels, search_strings,
 * evidence (needs --candidate), outreach (needs --candidate), screen,
 * interview_plan.
 */
import fs from "node:fs";
import path from "node:path";

process.env.TALENTOS_MODEL_PROVIDER = "session";
process.env.TALENTOS_DATABASE_PATH ??= "./data/golden-session.db";
process.env.TALENTOS_SESSION_OUTBOX ??= "./data/session-outbox";

const { eq } = await import("drizzle-orm");
const { getDb } = await import("../src/lib/db/client");
const { searchProjects, candidates } = await import("../src/lib/db/schema");
const { SessionFulfillmentPendingError } =
  await import("../src/lib/ai/session");
const generation = await import("../src/lib/services/generation");
const { createCandidate, createCandidateInput } =
  await import("../src/lib/services/candidates");
const { answerIntakeQuestion, completeIntake, listChannels, listQueries } =
  await import("../src/lib/services/workflow");
const {
  getCandidateEvidence,
  getInterviewPlan,
  getLatestIntakeSession,
  getMarketResearch,
  getRoleIntelligence,
  getScreenGuide,
  getSourcingStrategy,
  getSuccessProfile,
} = await import("../src/lib/services/artifacts");
const { createSearchProject, saveJobDescription } =
  await import("../src/lib/services/search-projects");
const { scanPayloadForProtectedTraits } =
  await import("../src/lib/domain/fair-hiring");
const { GOLDEN_FIXTURES } = await import("../src/lib/db/seed");
const {
  CAIS_INTAKE_CONCEPTS,
  GOLDEN_HM_ANSWERS,
  PASS_THRESHOLD,
  SYNTHETIC_CANDIDATE,
  intakeFullText,
  mdJson,
  mdSection,
} = await import("./golden-shared.mts");

const db = getDb();
const cais = GOLDEN_FIXTURES[0];
const GOLDEN_PROJECT_NAME = `Golden (session) — ${cais.name}`;

const [command, ...rest] = process.argv.slice(2);
function flag(name: string): string | undefined {
  const index = rest.indexOf(`--${name}`);
  return index >= 0 ? rest[index + 1] : undefined;
}
function requireFlag(name: string): string {
  const value = flag(name);
  if (!value) {
    console.error(`Missing --${name}`);
    process.exit(1);
  }
  return value;
}

const PROJECT_TASKS: Record<
  string,
  (projectId: string) => Promise<{ warnings: unknown[] }>
> = {
  role_intelligence: (id) => generation.generateRoleIntelligence(db, id),
  intake: (id) => generation.generateIntake(db, id),
  success_profile: (id) => generation.generateSuccessProfile(db, id),
  market_intelligence: (id) => generation.generateMarketIntelligence(db, id),
  sourcing_strategy: (id) => generation.generateSourcingStrategy(db, id),
  channels: (id) => generation.generateChannels(db, id),
  search_strings: (id) => generation.generateSearchStrings(db, id),
  screen: (id) => generation.generateScreenGuide(db, id),
  interview_plan: (id) => generation.generateInterviewPlan(db, id),
};
const CANDIDATE_TASKS: Record<
  string,
  (candidateId: string) => Promise<{ warnings: unknown[] }>
> = {
  evidence: (id) => generation.generateEvidenceAlignment(db, id),
  outreach: (id) => generation.generateOutreach(db, id),
};

async function cmdInit(): Promise<void> {
  const [existing] = await db
    .select()
    .from(searchProjects)
    .where(eq(searchProjects.name, GOLDEN_PROJECT_NAME));
  if (existing) {
    console.log(`OK reusing existing project`);
    console.log(`PROJECT_ID=${existing.id}`);
    return;
  }
  const project = await createSearchProject(db, {
    name: GOLDEN_PROJECT_NAME,
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
  console.log(`OK project created`);
  console.log(`PROJECT_ID=${project.id}`);
}

async function cmdRun(): Promise<void> {
  const task = rest.find((arg) => !arg.startsWith("--"));
  if (!task || !(task in PROJECT_TASKS || task in CANDIDATE_TASKS)) {
    console.error(
      `Unknown task "${task ?? ""}". Tasks: ${[...Object.keys(PROJECT_TASKS), ...Object.keys(CANDIDATE_TASKS)].join(", ")}`,
    );
    process.exit(1);
  }
  try {
    const result =
      task in PROJECT_TASKS
        ? await PROJECT_TASKS[task](requireFlag("project"))
        : await CANDIDATE_TASKS[task](requireFlag("candidate"));
    console.log(`OK ${task} generated and persisted.`);
    if (result.warnings.length > 0) {
      console.log(
        `WARNINGS (protected-trait scan): ${JSON.stringify(result.warnings)}`,
      );
    }
  } catch (error) {
    if (error instanceof SessionFulfillmentPendingError) {
      console.log(`PENDING ${task}`);
      console.log(`REQUEST_FILE=${error.requestPath}`);
      console.log(`RESPONSE_FILE=${error.responsePath}`);
      process.exit(3);
    }
    // Most often a zod rejection of the response file — print the issues
    // compactly so the fulfilling session can fix the JSON and re-run.
    console.error(
      `ERROR ${task}: ${error instanceof Error ? error.message : String(error)}`,
    );
    console.error("Fix the RESPONSE_FILE JSON and re-run this command.");
    process.exit(1);
  }
}

async function cmdAnswers(): Promise<void> {
  const projectId = requireFlag("project");
  const session = await getLatestIntakeSession(db, projectId);
  if (!session) {
    console.error("No intake session — run the intake task first.");
    process.exit(1);
  }
  let answered = 0;
  for (const category of session.payload.categories) {
    if (answered >= GOLDEN_HM_ANSWERS.length) break;
    const question = category.questions[0];
    if (!question?.id) continue;
    await answerIntakeQuestion(db, {
      sessionId: session.id,
      questionId: question.id,
      answer: GOLDEN_HM_ANSWERS[answered],
    });
    answered += 1;
  }
  await completeIntake(db, session.id);
  console.log(`OK answered ${answered} intake questions, intake completed.`);
}

async function cmdCandidate(): Promise<void> {
  const projectId = requireFlag("project");
  const [existing] = await db
    .select()
    .from(candidates)
    .where(eq(candidates.name, SYNTHETIC_CANDIDATE.name));
  if (existing && existing.searchProjectId === projectId) {
    console.log(`OK reusing existing candidate`);
    console.log(`CANDIDATE_ID=${existing.id}`);
    return;
  }
  const candidate = await createCandidate(
    db,
    createCandidateInput.parse({
      searchProjectId: projectId,
      ...SYNTHETIC_CANDIDATE,
    }),
  );
  console.log(`OK candidate created`);
  console.log(`CANDIDATE_ID=${candidate.id}`);
}

async function cmdScore(): Promise<void> {
  const projectId = requireFlag("project");
  const candidateId = requireFlag("candidate");

  const [intel, intakeSession, profile, market, strategy, screen, plan] =
    await Promise.all([
      getRoleIntelligence(db, projectId),
      getLatestIntakeSession(db, projectId),
      getSuccessProfile(db, projectId),
      getMarketResearch(db, projectId),
      getSourcingStrategy(db, projectId),
      getScreenGuide(db, projectId),
      getInterviewPlan(db, projectId),
    ]);
  const evidence = await getCandidateEvidence(db, candidateId);
  const channels = await listChannels(db, projectId);
  const queries = await listQueries(db, projectId);

  const missing = Object.entries({
    role_intelligence: intel,
    intake: intakeSession,
    success_profile: profile,
    market_intelligence: market,
    sourcing_strategy: strategy,
    screen,
    interview_plan: plan,
    evidence,
  })
    .filter(([, value]) => value == null)
    .map(([key]) => key);
  if (
    missing.length > 0 ||
    !intel ||
    !intakeSession ||
    !profile ||
    !market ||
    !strategy ||
    !screen ||
    !plan ||
    !evidence
  ) {
    console.error(`Cannot score — missing artifacts: ${missing.join(", ")}`);
    process.exit(1);
  }

  const text = intakeFullText(intakeSession.payload);
  const hits = CAIS_INTAKE_CONCEPTS.map((probe) => ({
    ...probe,
    hit: probe.pattern.test(text),
  }));
  const hitCount = hits.filter((h) => h.hit).length;

  const payloads: Record<string, unknown> = {
    role_intelligence: intel.payload,
    intake: intakeSession.payload,
    success_profile: profile.payload,
    market_intelligence: market.payload,
    sourcing_strategy: strategy.payload,
    screen: screen.payload,
    interview_plan: plan.payload,
    evidence: evidence.payload,
  };
  const traitHits = Object.entries(payloads).flatMap(([task, payload]) =>
    scanPayloadForProtectedTraits(payload).map((hit) => ({ task, ...hit })),
  );

  const guardrails = [
    {
      name: "Intake ends with a playback summary",
      ok: intakeSession.payload.playback != null,
    },
    {
      name: "Market claims never fabricate certainty (none marked 'verified')",
      ok: market.payload.sections
        .flatMap((s) => s.claims)
        .every((c) => c.certainty !== "verified"),
    },
    {
      name: "X-ray queries composed (site: operators present)",
      ok: queries.some((q) => q.query.includes("site:")),
    },
    {
      name: "Evidence alignment includes gaps, not just matches",
      ok: evidence.payload.items.some(
        (i) => i.status === "missing" || i.status === "unknown",
      ),
    },
    {
      name: "No protected-trait references in any generated payload",
      ok: traitHits.length === 0,
    },
  ];

  const report: string[] = [
    `# CAIS Golden Test — live run (Claude session provider)\n`,
    `- Date: ${new Date().toISOString()}`,
    `- Provider: Claude session (generations fulfilled by a Claude Code session — no API key)`,
    `- Fixture: ${cais.name}`,
    `- Verdict: **${hitCount >= PASS_THRESHOLD ? "PASS" : "FAIL"}** — ${hitCount}/${CAIS_INTAKE_CONCEPTS.length} intake domain concepts present (threshold ${PASS_THRESHOLD})\n`,
    mdSection(
      "Intake concept scorecard",
      hits.map((h) => `- ${h.hit ? "✅" : "❌"} ${h.concept}`).join("\n"),
    ),
    mdSection(
      "Guardrails",
      guardrails.map((g) => `- ${g.ok ? "✅" : "❌"} ${g.name}`).join("\n"),
    ),
    mdSection(
      "Generated intake (full)",
      intakeSession.payload.categories
        .map(
          (c) =>
            `### ${c.title}\n\n_${c.rationale}_\n\n` +
            c.questions
              .map((q) => `- **${q.question}**\n  - Why: ${q.whyItMatters}`)
              .join("\n"),
        )
        .join("\n\n") +
        (intakeSession.payload.playback
          ? `\n\n### Playback — "What did I get wrong?"\n\n${mdJson(intakeSession.payload.playback)}`
          : ""),
    ),
    mdSection("Role intelligence", mdJson(intel.payload)),
    mdSection("Success profile", mdJson(profile.payload)),
    mdSection("Market intelligence", mdJson(market.payload)),
    mdSection("Sourcing strategy", mdJson(strategy.payload)),
    mdSection(
      "Channels",
      channels
        .map((c) => `- [${c.priority}] ${c.name} — ${c.whyRelevant ?? ""}`)
        .join("\n"),
    ),
    mdSection(
      "Search strings",
      queries.map((q) => `- \`${q.platform}\`: \`${q.query}\``).join("\n"),
    ),
    mdSection(
      "Evidence alignment (synthetic candidate)",
      mdJson(evidence.payload),
    ),
    mdSection("Recruiter screen guide", mdJson(screen.payload)),
    mdSection("Interview plan", mdJson(plan.payload)),
  ];

  const reportPath = path.join(process.cwd(), "data", "golden-cais-report.md");
  fs.writeFileSync(reportPath, report.join("\n"));

  console.log(
    `Intake concept scorecard: ${hitCount}/${CAIS_INTAKE_CONCEPTS.length}`,
  );
  for (const h of hits) console.log(`  ${h.hit ? "✅" : "❌"} ${h.concept}`);
  console.log("Guardrails:");
  for (const g of guardrails) console.log(`  ${g.ok ? "✅" : "❌"} ${g.name}`);
  console.log(`REPORT_FILE=${reportPath}`);

  const guardrailsOk = guardrails.every((g) => g.ok);
  if (hitCount >= PASS_THRESHOLD && guardrailsOk) {
    console.log("CAIS GOLDEN TEST: PASS");
  } else {
    console.log(
      `CAIS GOLDEN TEST: FAIL — ` +
        (hitCount < PASS_THRESHOLD
          ? `intake scored ${hitCount}/${CAIS_INTAKE_CONCEPTS.length} (threshold ${PASS_THRESHOLD}). `
          : "") +
        (guardrailsOk ? "" : "guardrail check failed."),
    );
    process.exit(1);
  }
}

switch (command) {
  case "init":
    await cmdInit();
    break;
  case "run":
    await cmdRun();
    break;
  case "answers":
    await cmdAnswers();
    break;
  case "candidate":
    await cmdCandidate();
    break;
  case "score":
    await cmdScore();
    break;
  default:
    console.error(
      "Usage: pnpm golden:session <init|run <task>|answers|candidate|score> [--project id] [--candidate id]",
    );
    process.exit(1);
}
