/**
 * A projection, not a run.
 *
 * The W12 fixes for S-1…S-5 are mostly rules in the intake reasoner's
 * prompt, and measuring those honestly needs a fresh corpus run with an
 * API key. Three of them (S-2, S-3, S-4) also have deterministic backstops
 * in `src/lib/domain/intake-hygiene.ts`, and those CAN be measured without
 * a model: apply them to the outputs the corpus already produced and
 * re-score.
 *
 * So this answers one narrow question — what would the code-level half of
 * the fixes have changed, on the exact stored outputs? It says nothing
 * about the prompt rules, which are the larger half.
 *
 * Turns are chained: each turn is scored against the PATCHED previous
 * turn, because that is what a real run would see. Scoring against an
 * unpatched predecessor reports a withdrawn requirement "disappearing"
 * on the turn after the one that removed it, which is an artifact of the
 * projection rather than a defect.
 */
import fs from "node:fs";
import path from "node:path";
import type {
  HiringIntentIR,
  HiringNeedOutput,
  IntakeReasoningOutput,
} from "@/lib/core/ir";
import { applyIntakeHygiene } from "@/lib/domain/intake-hygiene";
import { checkTurn, mergeTallies, type Finding, type Tally } from "./checks";
import type { ParsedConversation } from "./schema";

interface StepSnapshot {
  before?: HiringIntentIR;
  after: HiringIntentIR;
  output: IntakeReasoningOutput | HiringNeedOutput;
}

export interface HygieneProjection {
  before: Tally;
  after: Tally;
  /** Failures the backstops remove. */
  fixed: string[];
  /** Failures they introduce — must stay empty. */
  introduced: string[];
}

function read(dir: string, id: string, step: string): StepSnapshot | undefined {
  const p = path.join(dir, "snapshots", id, `${step}.json`);
  return fs.existsSync(p)
    ? (JSON.parse(fs.readFileSync(p, "utf8")) as StepSnapshot)
    : undefined;
}

const failKeys = (id: string, turn: number, findings: Finding[]): string[] =>
  findings
    .filter((f) => f.severity === "fail")
    .map((f) => `${id}#${turn} ${f.metric}: ${f.detail}`);

export function projectHygiene(
  corpus: ParsedConversation[],
  resultsDir: string,
): HygieneProjection {
  const before: Tally[] = [];
  const after: Tally[] = [];
  const fixed: string[] = [];
  const introduced: string[] = [];

  for (const c of corpus) {
    const projectFacts = Object.values(c.project).filter(Boolean).join("\n");

    // The JD-derivation step has no manager statement, so hygiene is a
    // no-op there. Scored into both columns so the totals are absolute.
    const initial = read(resultsDir, c.id, "initial");
    if (initial) {
      const t = checkTurn({
        conversation: c,
        turnIndex: -1,
        expectation: c.initial,
        after: initial.after,
        output: initial.output,
        inputs: { jd: c.jd, projectFacts, statements: [] },
      }).tally;
      before.push(t);
      after.push(t);
    }

    let carried: HiringIntentIR | undefined;
    c.turns.forEach((turn, i) => {
      const snap = read(resultsDir, c.id, `turn-${i}`);
      if (!snap) return;
      const inputs = {
        jd: c.jd,
        projectFacts,
        statements: c.turns.slice(0, i + 1).map((t) => t.text),
      };
      const base = checkTurn({
        conversation: c,
        turnIndex: i,
        expectation: turn.expect,
        before: snap.before,
        after: snap.after,
        output: snap.output,
        inputs,
      });

      const hygienic = applyIntakeHygiene(
        snap.after,
        { uncertainties: snap.before?.uncertainties ?? [] },
        c.jd,
        snap.after.statements,
      );
      const patchedAfter: HiringIntentIR = { ...snap.after, ...hygienic };
      const patchedOutput =
        "requirements" in snap.output
          ? { ...snap.output, ...hygienic }
          : snap.output;
      const next = checkTurn({
        conversation: c,
        turnIndex: i,
        expectation: turn.expect,
        before: carried ?? snap.before,
        after: patchedAfter,
        output: patchedOutput,
        inputs,
      });
      carried = patchedAfter;

      before.push(base.tally);
      after.push(next.tally);
      const wasFailing = new Set(failKeys(c.id, i, base.findings));
      const nowFailing = new Set(failKeys(c.id, i, next.findings));
      for (const k of wasFailing) if (!nowFailing.has(k)) fixed.push(k);
      for (const k of nowFailing) if (!wasFailing.has(k)) introduced.push(k);
    });
  }

  return {
    before: mergeTallies(...before),
    after: mergeTallies(...after),
    fixed,
    introduced,
  };
}
