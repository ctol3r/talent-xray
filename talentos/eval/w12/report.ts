/**
 * W12 report: aggregates a run's state into scores, coverage, and the raw
 * material for the failure taxonomy. Coverage is printed first so a partial
 * run can never read as a full one.
 */
import fs from "node:fs";
import path from "node:path";
import { ADVERSARIAL_CATEGORIES, type ParsedConversation } from "./schema";
import {
  mergeTallies,
  ZERO_TARGET_METRICS,
  type Finding,
  type MetricId,
  type Tally,
} from "./checks";
import type { RunState } from "./run";

export interface Summary {
  runName: string;
  provider: string;
  corpusSize: number;
  attempted: string[];
  done: string[];
  pending: { id: string; request: string }[];
  errored: { id: string; error: string }[];
  categoriesCovered: number[];
  metrics: Record<
    string,
    { pass: number; total: number; rate: number | null; violations: number }
  >;
  judge: {
    conversations: number;
    averages: Record<string, number | null>;
    unsupportedInferences: number;
    modelsIntentAverage: number | null;
  };
  findings: (Finding & { conversation: string; turn: number | "replan" })[];
}

export function summarize(
  state: RunState,
  corpus: ParsedConversation[],
): Summary {
  const records = Object.values(state.conversations);
  const done = records.filter((r) => r.status === "done").map((r) => r.id);
  const pending = records
    .filter((r) => r.status === "pending")
    .map((r) => ({
      id: r.id,
      request:
        r.initial?.pendingRequest ??
        r.turns.find((t) => t.pendingRequest)?.pendingRequest ??
        r.judgePending ??
        "(unknown)",
    }));
  const errored = records
    .filter((r) => r.status === "error")
    .map((r) => ({ id: r.id, error: r.error ?? "" }));

  const tallies: Tally[] = [];
  const findings: Summary["findings"] = [];
  for (const r of records) {
    if (r.initial?.check) {
      tallies.push(r.initial.check.tally);
      findings.push(
        ...r.initial.check.findings.map((f) => ({
          ...f,
          conversation: r.id,
          turn: -1 as const,
        })),
      );
    }
    r.turns.forEach((t, i) => {
      if (t.check) {
        tallies.push(t.check.tally);
        findings.push(
          ...t.check.findings.map((f) => ({
            ...f,
            conversation: r.id,
            turn: i,
          })),
        );
      }
      if (t.replan) {
        tallies.push(t.replan.tally);
        findings.push(
          ...t.replan.findings.map((f) => ({
            ...f,
            conversation: r.id,
            turn: "replan" as const,
          })),
        );
      }
    });
  }
  const merged = mergeTallies(...tallies);
  const metrics: Summary["metrics"] = {};
  for (const [metric, v] of Object.entries(merged) as [
    MetricId,
    { pass: number; total: number },
  ][]) {
    metrics[metric] = {
      pass: v.pass,
      total: v.total,
      rate: v.total > 0 ? v.pass / v.total : null,
      violations: ZERO_TARGET_METRICS.includes(metric) ? v.total - v.pass : 0,
    };
  }

  const judged = records.filter((r) => r.judge);
  const dims = [
    "constructDefinition",
    "proxyIdentification",
    "nextQuestionValue",
    "challengeAppropriateness",
    "replanCorrectness",
  ] as const;
  const averages: Record<string, number | null> = {};
  for (const d of dims) {
    const values = judged.flatMap((r) =>
      r.judge!.turns.map((t) => t[d]).filter((v): v is number => v !== null),
    );
    averages[d] = values.length
      ? values.reduce((a, b) => a + b, 0) / values.length
      : null;
  }
  const unsupported = judged.reduce(
    (n, r) =>
      n +
      r.judge!.turns.reduce((m, t) => m + t.unsupportedInferences.length, 0),
    0,
  );
  const intentScores = judged.map((r) => r.judge!.overall.modelsIntent);

  const categoriesCovered = [
    ...new Set(
      records.filter((r) => r.status === "done").flatMap((r) => r.categories),
    ),
  ].sort((a, b) => a - b);

  return {
    runName: state.runName,
    provider: state.provider,
    corpusSize: corpus.length,
    attempted: records.map((r) => r.id),
    done,
    pending,
    errored,
    categoriesCovered,
    metrics,
    judge: {
      conversations: judged.length,
      averages,
      unsupportedInferences: unsupported,
      modelsIntentAverage: intentScores.length
        ? intentScores.reduce((a, b) => a + b, 0) / intentScores.length
        : null,
    },
    findings,
  };
}

export const METRIC_ORDER: MetricId[] = [
  "provenance_preservation",
  "silent_mutation",
  "protected_traits",
  "fabrication",
  "must_not_exist",
  "proxy_as_filter",
  "requirement_recall",
  "construct_named",
  "proxy_identified",
  "evidence_signal_recall",
  "false_signal_recall",
  "contradiction_detection",
  "uncertainty_detection",
  "unknown_preserved",
  "next_question_targeting",
  "replan_signal",
  "replan_correctness",
  "heuristic_mutation",
];

const TARGETS: Partial<Record<MetricId, string>> = {
  provenance_preservation: "100 %",
  silent_mutation: "0",
  protected_traits: "0",
  fabrication: "0",
  must_not_exist: "0",
  proxy_as_filter: "0",
};

export function renderReport(s: Summary): string {
  const pct = (r: number | null) =>
    r === null ? "—" : `${(r * 100).toFixed(1)} %`;
  const lines: string[] = [];
  lines.push(`# W12 evaluation run — ${s.runName}`);
  lines.push("");
  lines.push(
    `Provider under test: **${s.provider}**. Judge: same provider (procedural independence only when the provider is \`session\`).`,
  );
  lines.push("");
  lines.push("## Coverage (read this first)");
  lines.push("");
  lines.push(
    `- Corpus: ${s.corpusSize} conversations. Attempted: ${s.attempted.length}. **Done: ${s.done.length}.** Pending: ${s.pending.length}. Errored: ${s.errored.length}.`,
  );
  lines.push(`- Done: ${s.done.join(", ") || "(none)"}`);
  lines.push(
    `- Adversarial categories exercised by done conversations: ${s.categoriesCovered.length}/20${
      s.categoriesCovered.length < 20
        ? ` (missing: ${Object.keys(ADVERSARIAL_CATEGORIES)
            .map(Number)
            .filter((n) => !s.categoriesCovered.includes(n))
            .join(", ")})`
        : ""
    }`,
  );
  if (s.pending.length)
    lines.push(
      `- Pending requests:\n${s.pending.map((p) => `  - ${p.id}: ${p.request}`).join("\n")}`,
    );
  if (s.errored.length)
    lines.push(
      `- Errors:\n${s.errored.map((e) => `  - ${e.id}: ${e.error}`).join("\n")}`,
    );
  lines.push("");
  lines.push("## Deterministic metrics");
  lines.push("");
  lines.push("| Metric | Pass / total | Rate | Violations | Target |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const m of METRIC_ORDER) {
    const v = s.metrics[m];
    if (!v) continue;
    lines.push(
      `| ${m} | ${v.pass} / ${v.total} | ${pct(v.rate)} | ${ZERO_TARGET_METRICS.includes(m) ? v.violations : "—"} | ${TARGETS[m] ?? "reported"} |`,
    );
  }
  lines.push("");
  lines.push("## Judge (semantic dimensions, 0–2)");
  lines.push("");
  lines.push(`- Conversations judged: ${s.judge.conversations}`);
  for (const [k, v] of Object.entries(s.judge.averages))
    lines.push(`- ${k}: ${v === null ? "—" : v.toFixed(2)}`);
  lines.push(
    `- unsupported inferences listed by the judge: ${s.judge.unsupportedInferences}`,
  );
  lines.push(
    `- modelsIntent average: ${s.judge.modelsIntentAverage === null ? "—" : s.judge.modelsIntentAverage.toFixed(2)}`,
  );
  lines.push("");
  lines.push("## Findings by metric");
  lines.push("");
  const byMetric = new Map<string, Summary["findings"]>();
  for (const f of s.findings) {
    const list = byMetric.get(f.metric) ?? [];
    list.push(f);
    byMetric.set(f.metric, list);
  }
  for (const m of METRIC_ORDER) {
    const list = byMetric.get(m);
    if (!list?.length) continue;
    lines.push(`### ${m} (${list.length})`);
    for (const f of list)
      lines.push(
        `- [${f.severity}] ${f.conversation} · turn ${f.turn}: ${f.detail}`,
      );
    lines.push("");
  }
  return lines.join("\n");
}

export function writeReport(
  resultsDir: string,
  summary: Summary,
): { md: string; json: string } {
  const md = path.join(resultsDir, "REPORT.md");
  const json = path.join(resultsDir, "summary.json");
  fs.writeFileSync(md, renderReport(summary));
  fs.writeFileSync(json, JSON.stringify(summary, null, 2));
  return { md, json };
}
