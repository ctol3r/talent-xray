/**
 * Golden Test: a registry of named checks whose result says EXACTLY which
 * ran. The ten deliberate-defect checks are deterministic and run on every
 * click; the CAIS benchmark (concept presence + guardrails) needs the
 * model and is one check among many, not the whole verdict.
 */
import { $, el, esc, asOf, nowIso, uid } from "../core/dom";
import {
  DEFECT_CHECKS,
  runDefectChecks,
  type CheckResult,
} from "../core/defect-checks";
import { MODULES, type ModuleKey } from "../core/dependencies";
import {
  planExecution,
  ProgressTracker,
  formatElapsed,
} from "../core/execution-plan";
import type {
  IntakePayload,
  SearchStringsPayload,
  EvidencePayload,
} from "../core/payloads";
import { withIntakeAnswer } from "../core/payloads";
import type { StoredCandidate, StoredRecord } from "../core/store";
import { EXAMPLE_SEARCH } from "../app/example";
import {
  generateModule,
  runCandidateTask,
  errorCode,
  errorMessage,
} from "../ai/tasks";
import { putArtifact, putCandidate, selectSearch, state } from "../app/state";
import { compiledFor } from "./renderers";
import {
  CORPUS_FIXTURES,
  metricRate,
  scoreCorpusRun,
  type CorpusReport,
  type CorpusTurnOutcome,
  type MetricId,
} from "../core/corpus";
import { runCorpusFixture } from "../ai/tasks";
import {
  aiAvailable,
  copyFor,
  hideAi,
  registerModule,
  render,
  renderRail,
} from "./shell";

export const GOLDEN_THRESHOLD = 12;
export const GOLDEN_CONCEPTS: Array<{ concept: string; pattern: RegExp }> = [
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
export const GOLDEN_HM_ANSWERS = [
  "[Golden-test HM answer] Capability-driven: we are standing up a dangerous-capability evaluations workstream and nobody on staff owns benchmark construction end to end.",
  "[Golden-test HM answer] The bar is a researcher who has shipped a first-author empirical paper AND built the infrastructure behind it themselves; engineering-heavy backgrounds welcome.",
  "[Golden-test HM answer] We lose finalists to frontier labs on compensation; we win on mission, autonomy, and publication freedom.",
];
export const GOLDEN_CANDIDATE: Omit<StoredCandidate, "id" | "createdAt"> = {
  name: "Synthetic Benchmark Candidate",
  currentTitle: "Member of Technical Staff",
  currentCompany: "Example AI Lab (synthetic)",
  geography: "",
  profileUrls: ["https://example.com/synthetic-profile"],
  notes: "",
  pastedText:
    "SYNTHETIC PROFILE FOR BENCHMARKING — not a real person. Two first-author workshop papers on adversarial robustness (NeurIPS SafeML workshop). Built the distributed evaluation harness used across the lab (PyTorch, Ray, 256-GPU runs). Maintains a popular open-source jailbreak-evaluation benchmark. BS in CS; no PhD. Blogs about AI risk; previously a platform engineer at a fintech.",
};

export const GOLDEN_STEPS: ModuleKey[] = [
  "hiring_need",
  "role_intelligence",
  "intake",
  "success_profile",
  "market_intelligence",
  "sourcing_strategy",
  "channels",
  "search_strings",
];

export function goldenPlan() {
  return planExecution({
    kind: "golden",
    modules: [
      ...GOLDEN_STEPS.map((k) => ({ key: k, label: MODULES[k].label })),
      { key: "evidence", label: "Evidence alignment" },
      { key: "outreach", label: "Outreach drafts" },
    ],
    withCritic: false,
  });
}

export interface GoldenReport {
  ranAt: string;
  executed: string[];
  notExecuted: Array<{ id: string; reason: string }>;
  checks: Array<
    | CheckResult
    | {
        id: string;
        name: string;
        passed: boolean;
        detail: string;
        kind: "model";
      }
  >;
  benchmark?: {
    hits: Array<{ concept: string; hit: boolean }>;
    hitCount: number;
    total: number;
    threshold: number;
  };
  timings: Array<{ step: string; ms: number }>;
  verdict: "PASS" | "FAIL" | "PARTIAL";
}

function intakeFullText(payload: IntakePayload): string {
  const parts: string[] = [];
  for (const cat of payload.categories) {
    parts.push(cat.title, cat.rationale ?? "");
    for (const q of cat.questions) parts.push(q.question, q.whyItMatters ?? "");
  }
  if (payload.playback) parts.push(JSON.stringify(payload.playback));
  return parts.join("\n");
}

/** The model-driven checks, scored from stored records. Each says what it looked at. */
function modelChecks(
  artifacts: Record<string, StoredRecord>,
  cand: StoredCandidate | undefined,
): GoldenReport["checks"] {
  const out: GoldenReport["checks"] = [];
  const intake = artifacts.intake?.payload as IntakePayload | undefined;
  const strings = artifacts.search_strings?.payload as
    SearchStringsPayload | undefined;
  const records = [
    ...GOLDEN_STEPS.map((k) => artifacts[k]),
    cand?.evidence,
    cand?.outreach,
  ].filter((r): r is StoredRecord => Boolean(r));
  const downgrades = records.reduce((n, r) => n + (r.meta.downgrades ?? 0), 0);
  const traits = records.flatMap((r) => r.traitWarnings);
  out.push({
    id: "playback",
    name: "Intake ends with a playback summary",
    passed: Boolean(intake?.playback),
    detail: intake
      ? intake.playback
        ? "playback present"
        : "no playback"
      : "intake not generated",
    kind: "model",
  });
  out.push({
    id: "no_verified",
    name: "Model never emitted a 'verified' certainty label",
    passed: downgrades === 0,
    detail: `${downgrades} downgrade(s) across ${records.length} records`,
    kind: "model",
  });
  const compiled = strings ? compiledFor(strings) : [];
  out.push({
    id: "runnable_xray",
    name: "At least one runnable x-ray query (site: operator, within platform budget)",
    passed: compiled.some((q) => q.runnable && q.query.includes("site:")),
    detail: `${compiled.filter((q) => q.runnable).length} runnable of ${compiled.length}`,
    kind: "model",
  });
  const evidence = cand?.evidence?.payload as EvidencePayload | undefined;
  out.push({
    id: "evidence_gaps",
    name: "Evidence alignment includes gaps, not just matches",
    passed: Boolean(
      evidence?.items.some(
        (i) => i.status === "missing" || i.status === "unknown",
      ),
    ),
    detail: evidence
      ? `${evidence.items.length} items`
      : "evidence not generated",
    kind: "model",
  });
  out.push({
    id: "no_traits",
    name: "No protected-trait references in any generated payload",
    passed: traits.length === 0,
    detail: traits.length ? traits.join(", ") : "none flagged",
    kind: "model",
  });
  const envelopes = [
    "market_intelligence",
    "sourcing_strategy",
    "channels",
    "search_strings",
  ]
    .map((k) => artifacts[k])
    .filter((r): r is StoredRecord => Boolean(r?.payload));
  const withEnv = envelopes.filter((r) => r.envelope);
  const clean = withEnv.filter((r) => !r.validationIssues?.length);
  out.push({
    id: "envelopes_valid",
    name: "Every substantive output carries a research status and exactly eight A–H next steps",
    passed: envelopes.length > 0 && clean.length === envelopes.length,
    detail: `${clean.length} of ${envelopes.length} substantive outputs valid`,
    kind: "model",
  });
  const currentWithoutSnapshot = envelopes.filter(
    (r) =>
      (r.meta.researchStatus === "current" ||
        r.meta.researchStatus === "aging") &&
      !r.meta.researchSnapshotId,
  );
  out.push({
    id: "no_false_current",
    name: "No output claims 'current' without a research snapshot",
    passed: currentWithoutSnapshot.length === 0,
    detail: `${currentWithoutSnapshot.length} violation(s)`,
    kind: "model",
  });
  const ir = artifacts.hiring_need?.payload as
    { requirements?: Array<{ statement?: string }> } | undefined;
  const statements = (ir?.requirements ?? [])
    .map((r) => (r.statement ?? "").trim())
    .filter(Boolean);
  const dupes = statements.length - new Set(statements).size;
  out.push({
    id: "one_source_phrase",
    name: "Canonical IR: one requirement, one source phrase (no shared statements)",
    passed: Boolean(ir) && dupes === 0,
    detail: ir
      ? `${statements.length} statements, ${dupes} duplicated`
      : "IR not generated",
    kind: "model",
  });
  return out;
}

export function scoreGolden(
  artifacts: Record<string, StoredRecord>,
  cand: StoredCandidate | undefined,
  timings: GoldenReport["timings"],
  executedModel: boolean,
): GoldenReport {
  const deterministic = runDefectChecks({
    document: typeof document !== "undefined" ? document : undefined,
  });
  const executed = deterministic.map((c) => c.id);
  const notExecuted: GoldenReport["notExecuted"] = [];
  const checks: GoldenReport["checks"] = [...deterministic];
  let benchmark: GoldenReport["benchmark"];
  if (executedModel) {
    const model = modelChecks(artifacts, cand);
    checks.push(...model);
    executed.push(...model.map((c) => c.id));
    const intake = artifacts.intake?.payload as IntakePayload | undefined;
    if (intake) {
      const text = intakeFullText(intake);
      const hits = GOLDEN_CONCEPTS.map((c) => ({
        concept: c.concept,
        hit: c.pattern.test(text),
      }));
      const hitCount = hits.filter((h) => h.hit).length;
      benchmark = {
        hits,
        hitCount,
        total: GOLDEN_CONCEPTS.length,
        threshold: GOLDEN_THRESHOLD,
      };
      checks.push({
        id: "cais_concepts",
        name: `CAIS intake concept benchmark (≥${GOLDEN_THRESHOLD} of ${GOLDEN_CONCEPTS.length})`,
        passed: hitCount >= GOLDEN_THRESHOLD,
        detail: `${hitCount}/${GOLDEN_CONCEPTS.length}`,
        kind: "model",
      });
      executed.push("cais_concepts");
    } else {
      notExecuted.push({
        id: "cais_concepts",
        reason: "HM Intake was not generated.",
      });
    }
  } else {
    notExecuted.push({
      id: "model_checks",
      reason:
        "Model-driven checks need a generation run (Run the full benchmark).",
    });
    notExecuted.push({
      id: "cais_concepts",
      reason: "Needs the generation run.",
    });
  }
  const allPassed = checks.every((c) => c.passed);
  const verdict: GoldenReport["verdict"] = allPassed
    ? notExecuted.length
      ? "PARTIAL"
      : "PASS"
    : "FAIL";
  return {
    ranAt: nowIso(),
    executed,
    notExecuted,
    checks,
    benchmark,
    timings,
    verdict,
  };
}

export async function runGoldenTest(
  ui: {
    bindStop: (fn: () => void) => void;
    step: (name: string) => void;
    onText?: (e: { text: string }) => void;
  },
  withModel: boolean,
): Promise<GoldenReport> {
  if (!state.current || state.current.id !== EXAMPLE_SEARCH.id) {
    if (!state.searches.some((s) => s.id === EXAMPLE_SEARCH.id))
      state.searches = [EXAMPLE_SEARCH, ...state.searches];
    await selectSearch(EXAMPLE_SEARCH.id);
    renderRail();
  }
  state.module = "golden_test";
  const timings: GoldenReport["timings"] = [];
  let cand: StoredCandidate | undefined;
  if (withModel) {
    const plan = goldenPlan();
    const tracker = new ProgressTracker(plan);
    let currentCtl: AbortController | null = null;
    ui.bindStop(() => currentCtl?.abort());
    const stepUi = {
      bindStop: (c: AbortController) => {
        currentCtl = c;
      },
      onText: ui.onText,
    };
    state.acknowledgedNoResearch.add(EXAMPLE_SEARCH.id);
    for (const key of GOLDEN_STEPS) {
      ui.step(MODULES[key].label);
      tracker.start(key, "generate");
      const t0 = Date.now();
      await generateModule(key, stepUi);
      tracker.done(key, "generate");
      timings.push({ step: key, ms: Date.now() - t0 });
      if (key === "intake") {
        ui.step(
          "Answering intake as the hiring manager (test input, labelled)",
        );
        const rec = state.artifacts.intake;
        let payload = rec?.payload as IntakePayload | undefined;
        if (rec && payload) {
          let answered = 0;
          for (const cat of payload.categories) {
            if (answered >= GOLDEN_HM_ANSWERS.length) break;
            const q = cat.questions[0];
            if (!q?.id) continue;
            payload = withIntakeAnswer(
              payload,
              q.id,
              GOLDEN_HM_ANSWERS[answered],
              nowIso(),
            );
            answered += 1;
          }
          await putArtifact("intake", { ...rec, payload });
        }
      }
    }
    ui.step(
      "Creating synthetic benchmark candidate (clearly labelled synthetic)",
    );
    cand = state.candidates.find((c) => c.name === GOLDEN_CANDIDATE.name) ?? {
      id: uid(),
      createdAt: nowIso(),
      ...GOLDEN_CANDIDATE,
    };
    for (const key of ["evidence", "outreach"] as const) {
      ui.step(key === "evidence" ? "Evidence alignment" : "Outreach drafts");
      tracker.start(key, "generate");
      const t0 = Date.now();
      cand = { ...cand, [key]: await runCandidateTask(key, cand, stepUi) };
      tracker.done(key, "generate");
      timings.push({ step: key, ms: Date.now() - t0 });
    }
    await putCandidate(cand);
    tracker.finish();
  } else {
    cand = state.candidates.find((c) => c.name === GOLDEN_CANDIDATE.name);
  }
  ui.step("Scoring");
  const report = scoreGolden(
    state.artifacts,
    cand,
    timings,
    withModel || Boolean(state.artifacts.intake?.payload),
  );
  await putArtifact("golden_test", {
    payload: report,
    meta: { provider: "claude-artifact", generatedAt: report.ranAt },
    traitWarnings: [],
  });
  return report;
}

export function renderGolden(main: HTMLElement): void {
  const plan = goldenPlan();
  main.append(
    el(
      `<div class="mod-head"><h2>Golden Test</h2><span class="spacer"></span></div>`,
    ),
  );
  main.append(
    el(
      `<p class="mod-desc">Two kinds of checks. <b>${DEFECT_CHECKS.length} deliberate-defect checks</b> run instantly with no model: each injects a defect and asserts the system catches it. The <b>CAIS benchmark</b> generates every module for the bundled example search on your Claude account (${esc(plan.summary)}; expect 5–15 minutes) and scores concept presence plus honesty and fair-hiring guardrails. A PASS lists exactly which checks executed.</p>`,
    ),
  );
  const rec = state.artifacts.golden_test;
  const head = $(".mod-head", main);
  const quick = el<HTMLButtonElement>(
    `<button class="btn" type="button">Run defect checks (no model)</button>`,
  );
  head?.append(quick);
  const full = el<HTMLButtonElement>(
    `<button class="btn ${rec ? "" : "primary"}" type="button">${rec ? "Run full benchmark again" : "Run full benchmark"}</button>`,
  );
  const stopBtn = el<HTMLButtonElement>(
    `<button class="btn small" type="button" hidden>Stop</button>`,
  );
  if (aiAvailable()) head?.append(full, stopBtn);
  else
    main.append(
      el(
        `<div class="notice warning">${esc(copyFor("not_granted"))} The defect checks still run.</div>`,
      ),
    );

  const runIt = async (withModel: boolean, btn: HTMLButtonElement) => {
    btn.disabled = true;
    stopBtn.hidden = !withModel;
    const progress = el(
      `<div class="panel" role="status" aria-live="polite"><h3>Running…</h3><ul class="run-log"></ul><div class="stream"></div></div>`,
    );
    main.insertBefore(progress, main.children[2] ?? null);
    const log = $(".run-log", progress);
    const streamEl = $(".stream", progress);
    let stopFn: (() => void) | null = null;
    stopBtn.onclick = () => stopFn?.();
    const t0 = Date.now();
    try {
      await runGoldenTest(
        {
          bindStop: (fn) => {
            stopFn = fn;
          },
          step: (name) =>
            log?.append(
              el(
                `<li>${esc(name)} <span class="why num">${formatElapsed(Date.now() - t0)}</span></li>`,
              ),
            ),
          onText: ({ text }) => {
            if (streamEl) {
              streamEl.textContent = text.slice(-1200);
              streamEl.scrollTop = streamEl.scrollHeight;
            }
          },
        },
        withModel,
      );
      render();
    } catch (e) {
      const code = errorCode(e);
      if (code === "not_granted" || code === "sampling_disabled") hideAi();
      progress.append(
        el(
          `<div class="notice error" role="alert"><strong>Run stopped.</strong> ${esc(copyFor(code))} <span class="why">${esc(errorMessage(e))}</span> Completed steps are saved.</div>`,
        ),
      );
      btn.disabled = false;
      stopBtn.hidden = true;
    }
  };
  quick.onclick = () => runIt(false, quick);

  // ── W18: score the artifact's own prompts against the corpus ──────────
  const corpusPanel = el(
    `<div class="panel"><h3>Score the brain against the W12 corpus <span class="chip inference">${CORPUS_FIXTURES.length} fixtures</span></h3><p class="why">Runs ${CORPUS_FIXTURES.length} adversarial conversations from <code>eval/w12/corpus</code> through this page's OWN prompts on your Claude, then scores them with the harness's own deterministic checkers — imported, not re-implemented. <b>The generating model never sees the expectations</b>; they stay here and are applied afterwards in code. That independence is what the file-handoff runs could not have. It is still a handful of conversations out of 53, the LLM judge does not run, and no number here supports a claim about the corpus as a whole.</p></div>`,
  );
  const corpusBtn = el<HTMLButtonElement>(
    `<button class="btn" type="button">Run the corpus benchmark</button>`,
  );
  if (aiAvailable()) corpusPanel.append(corpusBtn);
  else
    corpusPanel.append(
      el(`<p class="why">Needs Claude in this view; unavailable here.</p>`),
    );
  const corpusOut = el(`<div></div>`);
  corpusPanel.append(corpusOut);
  corpusBtn.onclick = async () => {
    corpusBtn.disabled = true;
    corpusOut.innerHTML = "";
    const progress = el(
      `<div class="panel" role="status" aria-live="polite"><h4 class="first">Running…</h4><ul class="run-log"></ul></div>`,
    );
    corpusOut.append(progress);
    const log = $(".run-log", progress);
    const outcomes: CorpusTurnOutcome[] = [];
    const t0 = Date.now();
    for (const fixture of CORPUS_FIXTURES) {
      try {
        await runCorpusFixture(
          fixture,
          {
            step: (name) =>
              log?.append(
                el(
                  `<li>${esc(name)} <span class="why num">${formatElapsed(Date.now() - t0)}</span></li>`,
                ),
              ),
          },
          (outcome) => {
            outcomes.push(outcome);
            log?.append(
              el(
                `<li class="why">${esc(outcome.conversationId)} ${esc(outcome.label)} — ${outcome.executed ? `${outcome.findings.filter((f) => f.severity === "fail").length} failure(s)` : `NOT EXECUTED (${esc(outcome.notExecutedReason)})`}</li>`,
              ),
            );
          },
        );
      } catch (e) {
        log?.append(
          el(
            `<li class="why">${esc(fixture.id)} stopped: ${esc(errorMessage(e))}</li>`,
          ),
        );
      }
    }
    corpusOut.innerHTML = "";
    corpusOut.append(renderCorpusReport(scoreCorpusRun(outcomes, nowIso())));
    corpusBtn.disabled = false;
  };
  main.append(corpusPanel);
  full.onclick = () => runIt(true, full);

  if (rec?.payload) {
    const r = rec.payload as GoldenReport;
    const cls =
      r.verdict === "PASS" ? "ok" : r.verdict === "PARTIAL" ? "warn" : "bad";
    main.append(
      el(
        `<div class="notice"><strong>Verdict: <span class="chip ${cls}">${esc(r.verdict)}</span></strong> — ${r.checks.filter((c) => c.passed).length} of ${r.checks.length} checks passed; ${r.executed.length} executed, ${r.notExecuted.length} not executed. Finished ${esc(asOf(r.ranAt))}.</div>`,
      ),
    );
    main.append(
      el(
        `<div class="panel"><h3>Checks executed <span class="why num">${r.executed.length}</span></h3><ul>${r.checks
          .map(
            (c) =>
              `<li><span class="chip ${c.passed ? "ok" : "bad"}">${c.passed ? "PASS" : "FAIL"}</span> <span class="chip num">${esc(c.kind)}</span> ${esc(c.name)} <span class="why">${esc(c.detail)}</span></li>`,
          )
          .join(
            "",
          )}</ul>${r.notExecuted.length ? `<h4>Not executed</h4><ul>${r.notExecuted.map((n) => `<li><span class="chip unknown">SKIPPED</span> ${esc(n.id)} <span class="why">${esc(n.reason)}</span></li>`).join("")}</ul>` : ""}</div>`,
      ),
    );
    if (r.benchmark) {
      main.append(
        el(
          `<div class="panel"><h3>CAIS intake concept scorecard <span class="why num">${r.benchmark.hitCount}/${r.benchmark.total} (threshold ${r.benchmark.threshold})</span></h3><ul>${r.benchmark.hits.map((h) => `<li><span class="chip ${h.hit ? "ok" : "bad"}">${h.hit ? "HIT" : "MISS"}</span> ${esc(h.concept)}</li>`).join("")}</ul></div>`,
        ),
      );
    }
    if (r.timings.length)
      main.append(
        el(
          `<div class="panel"><h3>Step timings</h3><ul class="num">${r.timings.map((t) => `<li>${esc(t.step)}: ${(t.ms / 1000).toFixed(1)}s</li>`).join("")}</ul></div>`,
        ),
      );
  } else if (aiAvailable()) {
    main.append(
      el(
        `<div class="panel"><p class="why">Not run yet. The full benchmark generates ${GOLDEN_STEPS.map((k) => MODULES[k].label).join(" → ")} for the bundled CAIS search (auto-answering three intake questions with labelled test input), adds a clearly-synthetic candidate, runs Evidence and Outreach, then scores everything. Your Claude account does the generating; the first call asks permission.</p></div>`,
      ),
    );
  }
}

const REPORTED_METRICS: MetricId[] = [
  "provenance_preservation",
  "silent_mutation",
  "fabrication",
  "protected_traits",
  "requirement_recall",
  "must_not_exist",
  "construct_named",
  "false_signal_recall",
  "contradiction_detection",
  "uncertainty_detection",
  "proxy_identified",
];

export function renderCorpusReport(report: CorpusReport): HTMLElement {
  const cls =
    report.verdict === "PASS"
      ? "ok"
      : report.verdict === "PARTIAL"
        ? "warn"
        : "bad";
  const root = el(`<div></div>`);
  root.append(
    el(
      `<div class="notice"><strong>Corpus benchmark: <span class="chip ${cls}">${esc(report.verdict)}</span></strong> — ${report.executed} turn${report.executed === 1 ? "" : "s"} executed, ${report.notExecuted} not executed, across ${report.fixtureIds.length} fixture${report.fixtureIds.length === 1 ? "" : "s"}. Finished ${esc(asOf(report.ranAt))}.</div>`,
    ),
  );
  root.append(el(`<p class="why">${esc(report.caveat)}</p>`));

  if (report.zeroTargetViolations.length) {
    root.append(
      el(
        `<div class="notice error" role="alert"><strong>Zero-target violations.</strong> ${report.zeroTargetViolations
          .map((v) => `${esc(v.metric)}: ${v.count}`)
          .join(
            ", ",
          )}. These metrics must be zero; any count is a failure whatever else passed.</div>`,
      ),
    );
  }

  const rows = REPORTED_METRICS.map((metric) => {
    const { pass, total, rate } = metricRate(report.tally, metric);
    return `<tr><td>${esc(metric)}</td><td class="num">${total === 0 ? "not exercised" : `${pass}/${total}`}</td><td class="num">${rate === null ? "—" : `${Math.round(rate * 1000) / 10}%`}</td></tr>`;
  }).join("");
  root.append(
    el(
      `<div class="panel"><h4 class="first">Metrics</h4><div class="table-wrap"><table class="status"><thead><tr><th>Metric</th><th>Passed</th><th>Rate</th></tr></thead><tbody>${rows}</tbody></table></div><p class="why">"Not exercised" means these fixtures never put that metric to the test — it is not a pass.</p></div>`,
    ),
  );

  const failures = report.outcomes
    .filter((o) => o.executed)
    .flatMap((o) =>
      o.findings
        .filter((f) => f.severity === "fail")
        .map(
          (f) =>
            `<li><b>${esc(o.conversationId)} ${esc(o.label)}</b> <span class="chip bad">${esc(f.metric)}</span> <span class="why">${esc(f.detail)}</span></li>`,
        ),
    );
  root.append(
    el(
      `<div class="panel"><h4 class="first">Failures <span class="why num">${failures.length}</span></h4>${failures.length ? `<ul>${failures.join("")}</ul>` : `<p class="why">None in what executed.</p>`}</div>`,
    ),
  );

  const skipped = report.outcomes.filter((o) => !o.executed);
  if (skipped.length) {
    root.append(
      el(
        `<div class="panel"><h4 class="first">Not executed <span class="why num">${skipped.length}</span></h4><ul>${skipped
          .map(
            (o) =>
              `<li><span class="chip unknown">SKIPPED</span> ${esc(o.conversationId)} ${esc(o.label)} <span class="why">${esc(o.notExecutedReason)}</span></li>`,
          )
          .join("")}</ul></div>`,
      ),
    );
  }
  return root;
}

registerModule("golden_test", renderGolden);
