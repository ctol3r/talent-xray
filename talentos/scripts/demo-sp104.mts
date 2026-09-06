/**
 * pnpm demo:sp104 — the complete SP104 learning loop, end to end, against a
 * real HSAL gateway. No LLM, no API key.
 *
 * Uses HSAL_GATEWAY_URL + HSAL_TOKEN if set; otherwise spawns an ephemeral
 * gateway from the sibling HSAL repository with a temporary database.
 */
import {
  createTalentOSHSALAdapter,
  formatPct,
  HSALClient,
  InMemoryBindingStore,
  InMemoryLearningStore,
  computePipelineMetrics,
  largestDrop,
} from "@talentos/hsal-adapter";
import {
  sp104,
  sp104Learning,
  SP104_ID,
  SP104_RECRUITER,
  Sp104FixtureSource,
} from "../fixtures/sp104";
import {
  gatewayReachable,
  startHSAL,
  type RunningHSAL,
} from "./lib/hsal-gateway";

const RULE = "────────────────────────────────";
const pct = (n: number) => `${Math.round(n * 100)}%`;
const section = (title: string, ...lines: string[]) =>
  console.log(`\n${title}\n${RULE}\n${lines.join("\n")}`);

async function main() {
  let running: RunningHSAL | undefined;
  let baseUrl = process.env["HSAL_GATEWAY_URL"] ?? "http://127.0.0.1:4271";
  let token = process.env["HSAL_TOKEN"];
  if (!token || !(await gatewayReachable(baseUrl))) {
    console.log(
      "HSAL_TOKEN not set or gateway unreachable — starting an ephemeral HSAL gateway…",
    );
    running = await startHSAL();
    baseUrl = running.url;
    token = running.token;
  }
  const client = new HSALClient({ baseUrl, token });
  const source = new Sp104FixtureSource();
  const adapter = createTalentOSHSALAdapter({
    client,
    domain: source,
    bindings: new InMemoryBindingStore(),
    learnings: new InMemoryLearningStore(),
  });

  console.log(
    `\nHSAL SEARCH DIAGNOSIS — ${SP104_ID}\n${"=".repeat(32)}\nGateway ${baseUrl}`,
  );

  // 1–3
  const binding = await adapter.initializeSearchCase(sp104.searchProject);
  const baseline = await adapter.syncPipelineState(
    sp104.searchProject,
    sp104.pipelineW6,
  );
  // 4
  const belief = await adapter.captureRecruiterBelief(sp104.belief);
  section(
    "Current belief",
    `${belief.statement}`,
    "",
    `Human confidence: ${pct(belief.confidence)}`,
  );

  // observed bottleneck
  const drop = largestDrop(sp104.pipelineW6.counts)!;
  const m = computePipelineMetrics(sp104.pipelineW6.counts);
  section(
    "Observed bottleneck",
    `${drop.label}`,
    "",
    `${drop.fromCount} → ${drop.toCount}`,
    "",
    `reply ${formatPct(m.outreachReplyRate)} · positive ${formatPct(m.positiveReplyRate)} · screen→HM ${formatPct(m.recruiterScreenToHMRate)} · HM→onsite ${formatPct(m.hmToOnsiteRate, 0)}`,
    `HSAL: ${binding.hsalDecisionCaseId} · state ${baseline.id}`,
  );

  // 5–6
  let evidenceCount = 0;
  for (const c of sp104.candidates)
    evidenceCount += (await adapter.ingestCandidateEvidence(c)).length;
  for (const f of sp104.hmFeedback)
    evidenceCount += (await adapter.ingestHMFeedback(f)).length;

  // 7–9
  const diagnosis = await adapter.diagnoseSearch(SP104_ID);
  const strongest = diagnosis.models.find(
    (x) => x.id === diagnosis.strongestModelId,
  )!;
  section(
    "Strongest competing model",
    strongest.name,
    "",
    "Why:",
    "",
    strongest.assessment?.reasoning ?? strongest.explanation,
    "",
    ...diagnosis.models.map(
      (x) =>
        `  ${x.name.padEnd(30)} support: ${(x.assessment?.support ?? "?").toUpperCase()}`,
    ),
    "",
    `${evidenceCount} evidence records; belief still ${pct((await client.getBelief(belief.id)).confidence)}`,
  );
  const test = diagnosis.recommendedNextTest!;
  section(
    "Best Next Test",
    test.title,
    "",
    `Information gain: ${test.expectedInformationGain.toUpperCase()}`,
    `Cost: ${test.cost.toUpperCase()}`,
    `Reversibility: ${test.reversibility.toUpperCase()}`,
    `Duration: ${test.durationEstimate}`,
    "",
    ...test.protocol.map((p, i) => `  ${i + 1}. ${p}`),
  );

  // 10
  const selected = await adapter.selectIntervention(test.id, SP104_RECRUITER);
  console.log(
    `\n[ RUN TEST ] selected by ${selected.selectedByActorId} → status ${selected.status} (nothing executed by HSAL)`,
  );

  // 11–12
  await adapter.ingestExperimentResult(sp104.experimentResult);
  const stillHeld = await client.getBelief(belief.id);
  section(
    "Experiment Result",
    `${sp104.experimentResult.metrics["advanced"]} / ${sp104.experimentResult.metrics["reviewed"]} advanced`,
    "",
    ...sp104.experimentResult.observations.slice(1).map((o) => `  ${o}`),
    "",
    `Recruiter belief remains ${pct(stillHeld.confidence)} until explicitly revised.`,
  );

  // 13–15
  const revision = await adapter.reviseBelief({
    beliefId: belief.id,
    previousConfidence: stillHeld.confidence,
    newConfidence: sp104.revision.newConfidence,
    reason: sp104.revision.reason,
    evidenceIds: ["E-EXP-SP104-BLIND-1-1", "E-EXP-SP104-BLIND-1-2"],
    actorId: SP104_RECRUITER,
  });
  const profileBelief = await adapter.captureRecruiterBelief(
    sp104.revision.newBelief,
  );
  section(
    "Human belief revision",
    "Talent Supply",
    `${pct(revision.previousConfidence)} → ${pct(revision.newConfidence)}`,
    "",
    "New belief:",
    "",
    profileBelief.statement,
    pct(profileBelief.confidence),
  );

  // 16–17
  await adapter.recordSuccessProfileChange(
    SP104_ID,
    sp104.searchProject.successProfile,
    sp104.successProfileAfter,
    SP104_RECRUITER,
    test.id,
  );
  source.snapshotPhase = "w9";
  source.profilePhase = "after";
  const trajectory = await adapter.recordPostInterventionState(
    sp104.searchProject,
    sp104.pipelineW9,
    test.id,
  );
  const c9 = sp104.pipelineW9.counts;
  section(
    "Outcome",
    `${c9.onsite} onsites`,
    `${c9.offer} offers`,
    `${c9.hire} hire`,
    "",
    `Trajectory ${trajectory.id}: ${trajectory.originStateId} → ${trajectory.stateIds.join(", ")}`,
    ...trajectory.outcomes
      .filter((o) => o.interpretation && o.key.startsWith("rate."))
      .map((o) => `  ${o.interpretation}`),
  );

  // 18–19
  const learning = await adapter.createSearchLearning(
    sp104Learning({
      evidenceIds: ["E-EXP-SP104-BLIND-1-1", "E-EXP-SP104-BLIND-1-2"],
      originatingBeliefIds: [belief.id, profileBelief.id],
      originatingModelIds: [strongest.id],
    }),
  );
  section(
    "Search Learning",
    learning.title,
    "",
    learning.statement,
    "",
    `confidence ${pct(learning.confidence)} · applies to ${learning.applicability.roleFamilies?.join(", ")} (${learning.applicability.seniority?.join(", ")})`,
  );

  const events = await client.listEvents({ limit: 1000 });
  section(
    "Provenance",
    `${events.length} events in the HSAL log, e.g.`,
    ...[...new Set(events.map((e) => e.type))].sort().map((t) => `  ${t}`),
  );

  if (running) {
    console.log(
      `\n(ephemeral gateway stopped; database ${running.dbPath} discarded)`,
    );
    await running.stop();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
