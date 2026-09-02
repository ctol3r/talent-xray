/**
 * W12 adversarial evaluation CLI.
 *   pnpm eval:w12 --run baseline [--subset stratified | --only a-01,b-02]
 *                 [--replan-only a-01,b-02] [--judge] [--provider session|mock]
 *                 [--rescore]   re-measure stored snapshots, no model calls
 *                 [--project-hygiene] project the deterministic S-2/S-3/S-4
 *                               backstops onto stored snapshots (no model calls)
 * Resumable: re-run the same --run after fulfilling parked session requests.
 * Results: eval/w12/results/<run>/ (state.json, snapshots/, REPORT.md, summary.json).
 */
import path from "node:path";

const argv = process.argv.slice(2);
const arg = (name: string, fallback?: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};
const flag = (name: string) => argv.includes(`--${name}`);

const runName = arg("run", "adhoc")!;
const provider = arg(
  "provider",
  process.env.TALENTOS_MODEL_PROVIDER ?? "session",
)!;
const resultsDir = path.resolve(process.cwd(), "eval/w12/results", runName);

process.env.TALENTOS_MODEL_PROVIDER = provider;
process.env.TALENTOS_RESEARCH_PROVIDER = "mock"; // research is not under test
process.env.TALENTOS_DATABASE_PATH =
  process.env.TALENTOS_EVAL_DB ?? path.join(resultsDir, "eval.db");
process.env.TALENTOS_SESSION_OUTBOX = path.join(resultsDir, "outbox");

const { getDb } = await import("../src/lib/db/client");
const { loadCorpus } = await import("../eval/w12/corpus");
const { runAll, STRATIFIED_SUBSET } = await import("../eval/w12/run");
const { summarize, writeReport, renderReport } =
  await import("../eval/w12/report");

const corpus = loadCorpus();
const only = arg("only")
  ?.split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const subset = arg("subset");
const selected = only
  ? corpus.filter((c) => only.includes(c.id))
  : subset === "stratified"
    ? corpus.filter((c) => STRATIFIED_SUBSET.includes(c.id))
    : corpus;
if (selected.length === 0) throw new Error("no conversations selected");

// --project-hygiene answers "what would the deterministic half of the W12
// fixes have changed on the outputs we already have?" — no model calls, and
// no claim about the prompt rules, which need a fresh run.
if (flag("project-hygiene")) {
  const { projectHygiene } = await import("../eval/w12/project-hygiene");
  const { METRIC_ORDER } = await import("../eval/w12/report");
  const p = projectHygiene(selected, resultsDir);
  const pct = (t?: { pass: number; total: number }) =>
    t && t.total > 0
      ? `${t.pass}/${t.total} (${((t.pass / t.total) * 100).toFixed(1)} %)`
      : "—";
  console.log(`# W12 hygiene projection — ${runName}\n`);
  console.log("| Metric | Stored run | With backstops |");
  console.log("| --- | --- | --- |");
  for (const m of METRIC_ORDER) {
    const b = p.before[m];
    const a = p.after[m];
    if (!b && !a) continue;
    const moved = b && a && (b.pass !== a.pass || b.total !== a.total);
    console.log(`| ${m}${moved ? " **" : ""} | ${pct(b)} | ${pct(a)} |`);
  }
  console.log(`\n## Failures removed (${p.fixed.length})\n`);
  for (const f of p.fixed) console.log(`- ${f}`);
  console.log(`\n## Failures introduced (${p.introduced.length})\n`);
  for (const f of p.introduced) console.log(`- ${f}`);
  process.exit(p.introduced.length === 0 ? 0 : 1);
}

// --rescore re-measures a finished run's stored snapshots with the current
// checks and makes no model calls. Used after an instrument correction.
if (flag("rescore")) {
  const { loadState } = await import("../eval/w12/run");
  const { rescore } = await import("../eval/w12/rescore");
  const prior = loadState(resultsDir, runName, provider);
  const rescored = rescore(prior, corpus, resultsDir);
  const out = summarize(rescored, corpus);
  const paths = writeReport(resultsDir, out);
  console.log(renderReport(out));
  console.log(`\nreport: ${paths.md}`);
  process.exit(0);
}

const db = getDb();
const state = await runAll({
  db,
  runName,
  resultsDir,
  conversations: selected,
  judge: flag("judge"),
  providerLabel: provider,
  replanOnly: arg("replan-only")
    ?.split(",")
    .map((x) => x.trim())
    .filter(Boolean),
});
const summary = summarize(state, corpus);
const { md } = writeReport(resultsDir, summary);
console.log(renderReport(summary));
console.log(`\nreport: ${md}`);
if (summary.pending.length > 0) process.exit(3);
