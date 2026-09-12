/**
 * Re-score a completed run's stored snapshots with the current checks, with
 * no model calls. Used when the INSTRUMENT is corrected: the system's
 * outputs are fixed on disk, so the same run can be re-measured honestly
 * instead of being re-generated.
 */
import fs from "node:fs";
import path from "node:path";
import type {
  AudiencePersonaIR,
  HiringIntentIR,
  HiringNeedOutput,
  IntakeReasoningOutput,
  SearchPlanOutput,
} from "@/lib/core/ir";
import type { ComposedQuery } from "@/lib/domain/search-strings";
import { checkReplan, checkTurn } from "./checks";
import type { ParsedConversation } from "./schema";
import type { RunState } from "./run";

interface StepSnapshot {
  before?: HiringIntentIR;
  after: HiringIntentIR;
  output: IntakeReasoningOutput | HiringNeedOutput;
  plan?: SearchPlanOutput;
  composed?: {
    segmentLabel: string;
    queries: { platform: string; breadth: string; query: string }[];
  }[];
  personas?: AudiencePersonaIR[];
}

function read(dir: string, id: string, step: string): StepSnapshot | undefined {
  const p = path.join(dir, "snapshots", id, `${step}.json`);
  return fs.existsSync(p)
    ? (JSON.parse(fs.readFileSync(p, "utf8")) as StepSnapshot)
    : undefined;
}

export function rescore(
  state: RunState,
  corpus: ParsedConversation[],
  resultsDir: string,
): RunState {
  const byId = new Map(corpus.map((c) => [c.id, c]));
  for (const rec of Object.values(state.conversations)) {
    const c = byId.get(rec.id);
    if (!c) continue;
    const projectFacts = Object.values(c.project).filter(Boolean).join("\n");
    const initial = read(resultsDir, c.id, "initial");
    if (initial && rec.initial) {
      rec.initial.check = checkTurn({
        conversation: c,
        turnIndex: -1,
        expectation: c.initial,
        after: initial.after,
        output: initial.output,
        inputs: { jd: c.jd, projectFacts, statements: [] },
      });
    }
    c.turns.forEach((turn, i) => {
      const snap = read(resultsDir, c.id, `turn-${i}`);
      const rt = rec.turns[i];
      if (!snap || !rt) return;
      rt.check = checkTurn({
        conversation: c,
        turnIndex: i,
        expectation: turn.expect,
        before: snap.before,
        after: snap.after,
        output: snap.output,
        inputs: {
          jd: c.jd,
          projectFacts,
          statements: c.turns.slice(0, i + 1).map((t) => t.text),
        },
      });
      if (snap.plan && rt.replanRan) {
        rt.replan = checkReplan({
          expectation: turn.expect,
          plan: snap.plan,
          composed: (snap.composed ?? []).map((sgmt) => ({
            segmentLabel: sgmt.segmentLabel,
            queries: sgmt.queries as unknown as ComposedQuery[],
          })),
          personas: snap.personas,
          proxyTerms: turn.expect.requirements.flatMap(
            (r) => r.proxyTerms ?? [],
          ),
        });
      }
    });
  }
  return state;
}
