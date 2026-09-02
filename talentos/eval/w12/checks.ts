/**
 * W12 deterministic checks (W12_EVAL_SPEC.md §4.1). Pure functions over the
 * canonical IR before/after a turn, the reasoner's raw output, and the
 * human-authored expectation. No model calls; no I/O.
 */
import type {
  ContradictionIR,
  HiringIntentIR,
  HiringNeedOutput,
  IntakeReasoningOutput,
  AudiencePersonaIR,
  RequirementIR,
  SearchPlanOutput,
  UncertaintyIR,
} from "@/lib/core/ir";
import type { ComposedQuery } from "@/lib/domain/search-strings";
import {
  scanTextForProtectedTraits,
  type TraitScanHit,
} from "@/lib/domain/fair-hiring";
import type { Expectation, ParsedConversation } from "./schema";

export type MetricId =
  | "provenance_preservation"
  | "silent_mutation"
  | "heuristic_mutation"
  | "fabrication"
  | "protected_traits"
  | "requirement_recall"
  | "must_not_exist"
  | "proxy_identified"
  | "proxy_as_filter"
  | "construct_named"
  | "evidence_signal_recall"
  | "false_signal_recall"
  | "contradiction_detection"
  | "uncertainty_detection"
  | "unknown_preserved"
  | "next_question_targeting"
  | "replan_signal"
  | "replan_correctness";

/** Metrics whose target is an absolute count of zero (fail = violation). */
export const ZERO_TARGET_METRICS: MetricId[] = [
  "silent_mutation",
  "fabrication",
  "protected_traits",
  "must_not_exist",
  "proxy_as_filter",
];

export interface MetricTally {
  pass: number;
  total: number;
}
export type Tally = Partial<Record<MetricId, MetricTally>>;

export interface Finding {
  metric: MetricId;
  severity: "fail" | "warn";
  detail: string;
}

export interface CheckResult {
  tally: Tally;
  findings: Finding[];
  /** Advisory trait hits in verbatim material (claims, contradictions). */
  reviewWarnings: TraitScanHit[];
}

export interface TurnInputs {
  jd: string;
  projectFacts: string;
  /** Scripted statement texts up to and including this turn. */
  statements: string[];
}

// ── helpers ─────────────────────────────────────────────────────────────────

export function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[“”"]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function has(hay: string, needle: string): boolean {
  return norm(hay).includes(norm(needle));
}

function anyAlias(hay: string, aliases: string[] | undefined): boolean {
  if (!aliases || aliases.length === 0) return true;
  return aliases.some((a) => has(hay, a));
}

function reqText(r: RequirementIR): string {
  return `${r.label}\n${r.definition}\n${r.statement}`;
}

/**
 * Match an expected requirement to an actual one, most specific first: a
 * label hit beats a statement hit, which beats a definition hit. Without the
 * ranking a requirement that merely MENTIONS another concept in its
 * definition steals that concept's match — the cause of most false failures
 * in the first baseline run (W12 report, instrument corrections).
 */
function findRequirement(
  requirements: RequirementIR[],
  aliases: string[],
): RequirementIR | undefined {
  const tiers = [
    (r: RequirementIR) => r.label,
    (r: RequirementIR) => r.statement,
    (r: RequirementIR) => r.definition,
  ];
  for (const field of tiers) {
    const hit = requirements.find((r) => anyAlias(field(r), aliases));
    if (hit) return hit;
  }
  return undefined;
}

function findRequirementByLabel(
  requirements: RequirementIR[],
  aliases: string[],
): RequirementIR | undefined {
  return requirements.find((r) => anyAlias(r.label, aliases));
}

/** `about` is the uncertainty's identity; consequence and resolution are prose. */
function findUncertainty(
  uncertainties: UncertaintyIR[],
  aliases: string[],
): UncertaintyIR | undefined {
  return (
    uncertainties.find((u) => anyAlias(u.about, aliases)) ??
    uncertainties.find((u) =>
      anyAlias(`${u.consequence}\n${u.resolution ?? ""}`, aliases),
    )
  );
}

function findContradiction(
  contradictions: ContradictionIR[],
  aliases: string[],
): ContradictionIR | undefined {
  return contradictions.find((c) =>
    anyAlias(
      `${c.claimA.text}\n${c.claimB.text}\n${c.note ?? ""}\n${c.resolution ?? ""}`,
      aliases,
    ),
  );
}

function bump(tally: Tally, metric: MetricId, pass: boolean): void {
  const t = tally[metric] ?? { pass: 0, total: 0 };
  t.total += 1;
  if (pass) t.pass += 1;
  tally[metric] = t;
}

/**
 * Verbatim-substring test tolerant of elision: a requirement statement may
 * join several verbatim fragments with an ellipsis; every fragment of
 * meaningful length must appear in some source.
 */
export function isVerbatimFrom(statement: string, sources: string[]): boolean {
  const fragments = statement
    .split(/…|\.\.\./)
    .map((f) => norm(f).replace(/^["'\s]+|["'\s]+$/g, ""))
    .filter((f) => f.length >= 12);
  if (fragments.length === 0) return norm(statement).length < 12;
  const normalized = sources.map(norm);
  return fragments.every((f) => normalized.some((s) => s.includes(f)));
}

const NUMBER_RE =
  /(?:\$\s?)?\b\d[\d,]*(?:\.\d+)?\s?(?:%|k\b|nm\b|kv\b|mm\b)?/gi;

function numbersIn(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(NUMBER_RE)) {
    const raw = m[0].replace(/[\s$,]/g, "").toLowerCase();
    const digits = raw.replace(/[^\d.]/g, "");
    // Single digits and list ordinals are noise; anything ≥ 10 or with a unit counts.
    if (digits.length >= 2 || /[%k]$|nm$|kv$|mm$/.test(raw)) out.add(digits);
  }
  return out;
}

function significantTokens(text: string): Set<string> {
  return new Set(
    norm(text)
      .split(/[^a-z0-9&+-]+/)
      .filter((t) => t.length >= 4),
  );
}

interface OutputText {
  defining: string; // label + definition + evidenceSpec (what is sought)
  falseSignals: string;
  uncertainties: string;
  /** What each uncertainty says it IS — assertive, unlike consequence prose. */
  uncertaintyAbouts: string;
  nextQuestion: string;
  claims: string;
  contradictions: string;
}

function outputText(
  intent: HiringIntentIR,
  output: IntakeReasoningOutput | HiringNeedOutput,
): OutputText {
  const nq = "nextQuestion" in output ? output.nextQuestion : null;
  return {
    defining: intent.requirements
      .map((r) => `${r.label}\n${r.definition}\n${r.evidenceSpec.join("\n")}`)
      .join("\n"),
    falseSignals: intent.requirements
      .map((r) => r.falseSignals.join("\n"))
      .join("\n"),
    uncertainties: intent.uncertainties
      .map((u) => `${u.about}\n${u.consequence}\n${u.resolution ?? ""}`)
      .join("\n"),
    uncertaintyAbouts: intent.uncertainties
      .map((u) => `${u.about}\n${u.resolution ?? ""}`)
      .join("\n"),
    nextQuestion: nq
      ? `${nq.question}\n${nq.whyItMatters}\n${nq.informationValue}`
      : "",
    claims: ("extractedClaims" in output
      ? output.extractedClaims
      : output.need.claims
    )
      .map((c) => c.text)
      .join("\n"),
    contradictions: intent.contradictions
      .map(
        (c) =>
          `${c.claimA.text}\n${c.claimB.text}\n${c.note ?? ""}\n${c.resolution ?? ""}`,
      )
      .join("\n"),
  };
}

/** Alias map for `untouched` keys: every expectation seen so far. */
export function aliasMap(
  conversation: ParsedConversation,
  uptoTurn: number,
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const add = (e: Expectation) => {
    for (const r of e.requirements) {
      if (!map.has(r.key)) map.set(r.key, r.aliases);
    }
  };
  add(conversation.initial);
  for (let i = 0; i < uptoTurn; i += 1) add(conversation.turns[i].expect);
  return map;
}

// ── the turn check ──────────────────────────────────────────────────────────

export interface TurnCheckArgs {
  conversation: ParsedConversation;
  /** -1 for the hiring-need derivation; otherwise the turn index. */
  turnIndex: number;
  expectation: Expectation;
  before?: HiringIntentIR;
  after: HiringIntentIR;
  output: IntakeReasoningOutput | HiringNeedOutput;
  inputs: TurnInputs;
}

export function checkTurn(args: TurnCheckArgs): CheckResult {
  const {
    conversation,
    turnIndex,
    expectation,
    before,
    after,
    output,
    inputs,
  } = args;
  const tally: Tally = {};
  const findings: Finding[] = [];
  const fail = (metric: MetricId, detail: string) =>
    findings.push({ metric, severity: "fail", detail });
  const warn = (metric: MetricId, detail: string) =>
    findings.push({ metric, severity: "warn", detail });
  const isIntake = turnIndex >= 0;
  const statementText = isIntake ? inputs.statements[turnIndex] : "";

  // provenance_preservation ---------------------------------------------------
  {
    const logOk =
      after.statements.length === inputs.statements.length &&
      after.statements.every((s, i) => s.text === inputs.statements[i]);
    bump(tally, "provenance_preservation", logOk);
    if (!logOk)
      fail(
        "provenance_preservation",
        `statement log (${after.statements.length}) does not match the scripted statements (${inputs.statements.length}) verbatim/in order`,
      );
    if ("extractedClaims" in output) {
      const claimsOk = output.extractedClaims.every(
        (c) => c.provenance === "manager_statement",
      );
      bump(tally, "provenance_preservation", claimsOk);
      if (!claimsOk)
        fail(
          "provenance_preservation",
          "an extracted claim lacks manager_statement provenance",
        );
    }
    for (const r of after.requirements) {
      if (r.origin === "manager_statement") {
        const ok = isVerbatimFrom(r.statement, inputs.statements);
        bump(tally, "provenance_preservation", ok);
        if (!ok)
          fail(
            "provenance_preservation",
            `requirement "${r.label}" (origin manager_statement) has a statement that is not verbatim from any hiring-manager statement: "${r.statement.slice(0, 80)}"`,
          );
      } else if (r.origin === "jd") {
        const ok = isVerbatimFrom(r.statement, [
          inputs.jd,
          inputs.projectFacts,
        ]);
        bump(tally, "provenance_preservation", ok);
        if (!ok)
          fail(
            "provenance_preservation",
            `requirement "${r.label}" (origin jd) has a statement that is not verbatim from the JD: "${r.statement.slice(0, 80)}"`,
          );
      }
    }
  }

  // silent_mutation / heuristic_mutation --------------------------------------
  if (before) {
    const aliases = aliasMap(conversation, turnIndex);
    const resolvedThisTurn = new Set(
      after.uncertainties
        .filter((u) => u.status === "resolved")
        .filter(
          (u) =>
            before.uncertainties.find((p) => p.id === u.id)?.status !==
            "resolved",
        )
        .map((u) => u.id)
        .filter((id): id is string => Boolean(id)),
    );
    const mustNotExistAliases = expectation.requirements
      .filter((r) => r.mustNotExist)
      .flatMap((r) => r.aliases);
    const changedFields = (a: RequirementIR, b: RequirementIR): string[] => {
      const fields: string[] = [];
      if (a.kind !== b.kind) fields.push(`kind ${a.kind}→${b.kind}`);
      if (a.status !== b.status) fields.push(`status ${a.status}→${b.status}`);
      if (norm(a.definition) !== norm(b.definition)) fields.push("definition");
      if (norm(a.label) !== norm(b.label)) fields.push("label");
      if (a.evidenceSpec.join("|") !== b.evidenceSpec.join("|"))
        fields.push("evidenceSpec");
      if (a.falseSignals.join("|") !== b.falseSignals.join("|"))
        fields.push("falseSignals");
      return fields;
    };
    for (const key of expectation.untouched) {
      const keyAliases = aliases.get(key);
      if (!keyAliases) {
        warn(
          "silent_mutation",
          `untouched key "${key}" has no earlier expectation to resolve it`,
        );
        continue;
      }
      const prev =
        findRequirementByLabel(before.requirements, keyAliases) ??
        findRequirement(before.requirements, keyAliases);
      if (!prev) continue; // it never existed — recall will have caught that earlier
      const next =
        after.requirements.find((r) => r.id === prev.id) ??
        findRequirementByLabel(after.requirements, keyAliases);
      if (!next) {
        bump(tally, "silent_mutation", false);
        fail(
          "silent_mutation",
          `untouched requirement "${prev.label}" was dropped this turn`,
        );
        continue;
      }
      const changed = changedFields(prev, next);
      bump(tally, "silent_mutation", changed.length === 0);
      if (changed.length > 0)
        fail(
          "silent_mutation",
          `untouched requirement "${prev.label}" changed (${changed.join(", ")}) on a statement that did not address it`,
        );
    }
    // Any pre-existing requirement that disappeared without an expected removal.
    for (const prev of before.requirements) {
      const stillThere = after.requirements.some((r) => r.id === prev.id);
      if (stillThere) continue;
      const expectedRemoval =
        anyAlias(reqText(prev), mustNotExistAliases) &&
        mustNotExistAliases.length > 0;
      const mergedElsewhere = after.requirements.some(
        (r) =>
          has(r.definition, prev.label) ||
          has(r.statement, prev.statement.slice(0, 40)),
      );
      if (expectedRemoval || mergedElsewhere) continue;
      bump(tally, "silent_mutation", false);
      fail(
        "silent_mutation",
        `requirement "${prev.label}" disappeared without the statement removing it`,
      );
    }
    // Heuristic (advisory): kind flipped on a requirement the statement never mentions.
    const stTokens = significantTokens(statementText);
    for (const prev of before.requirements) {
      const next = after.requirements.find((r) => r.id === prev.id);
      if (!next || next.kind === prev.kind) continue;
      const overlap = [...significantTokens(prev.label)].some((t) =>
        stTokens.has(t),
      );
      const linked = prev.linkedUncertaintyIds.some((id) =>
        resolvedThisTurn.has(id),
      );
      bump(tally, "heuristic_mutation", overlap || linked);
      if (!overlap && !linked)
        warn(
          "heuristic_mutation",
          `kind of "${prev.label}" changed ${prev.kind}→${next.kind} with no token overlap with the statement`,
        );
    }
  }

  // fabrication ---------------------------------------------------------------
  {
    const text = outputText(after, output);
    // A number is a fabrication only when ASSERTED. A figure inside the next
    // question is a proposal put to the hiring manager for confirmation
    // ("is 7nm-class the line?"), and a figure inside an uncertainty's
    // consequence is illustrative analysis prose. Both are legitimate work.
    // The assertive surfaces are definitions, evidence specs, false signals,
    // extracted claims, and what an uncertainty says it is about.
    // forbiddenTerms still scan everything, so a leaked band is caught
    // wherever it lands.
    const assertive = `${text.defining}\n${text.falseSignals}\n${text.uncertaintyAbouts}\n${text.claims}`;
    const outputAll = `${text.defining}\n${text.uncertainties}\n${text.nextQuestion}\n${text.claims}\n${text.falseSignals}`;
    const inputAll = [
      inputs.jd,
      inputs.projectFacts,
      ...inputs.statements,
      before ? JSON.stringify(before) : "",
    ].join("\n");
    const inputNumbers = numbersIn(inputAll);
    for (const n of numbersIn(assertive)) {
      const ok = inputNumbers.has(n);
      bump(tally, "fabrication", ok);
      if (!ok)
        fail(
          "fabrication",
          `number "${n}" appears in the output but in no input`,
        );
    }
    for (const term of expectation.forbiddenTerms) {
      const present = has(outputAll, term) || has(text.contradictions, term);
      bump(tally, "fabrication", !present);
      if (present)
        fail("fabrication", `forbidden term "${term}" appears in the output`);
    }
  }

  // protected_traits ----------------------------------------------------------
  const reviewWarnings: TraitScanHit[] = [];
  {
    const text = outputText(after, output);
    const hits = scanTextForProtectedTraits(text.defining);
    bump(tally, "protected_traits", hits.length === 0);
    for (const h of hits)
      fail(
        "protected_traits",
        `${h.trait} referenced in a requirement's defining text: "${h.excerpt}"`,
      );
    for (const source of [
      text.falseSignals,
      text.uncertainties,
      text.nextQuestion,
      text.claims,
      text.contradictions,
    ]) {
      reviewWarnings.push(...scanTextForProtectedTraits(source));
    }
  }

  // requirement_recall / attributes / construct / evidence / false signals ----
  for (const exp of expectation.requirements) {
    if (exp.mustNotExist) {
      const offender = findRequirementByLabel(after.requirements, exp.aliases);
      bump(tally, "must_not_exist", !offender);
      if (offender)
        fail(
          "must_not_exist",
          `"${offender.label}" exists as a ${offender.kind} requirement but must not (${exp.note ?? exp.key})`,
        );
      continue;
    }
    const r = findRequirement(after.requirements, exp.aliases);
    if (!r) {
      bump(tally, "requirement_recall", false);
      fail(
        "requirement_recall",
        `expected requirement "${exp.key}" (${exp.aliases[0]}) is missing`,
      );
      continue;
    }
    const attrProblems: string[] = [];
    if (exp.kind && r.kind !== exp.kind)
      attrProblems.push(`kind ${r.kind} (expected ${exp.kind})`);
    if (exp.status && r.status !== exp.status)
      attrProblems.push(`status ${r.status} (expected ${exp.status})`);
    if (exp.origin && r.origin !== exp.origin)
      attrProblems.push(`origin ${r.origin} (expected ${exp.origin})`);
    bump(tally, "requirement_recall", attrProblems.length === 0);
    if (attrProblems.length > 0)
      fail("requirement_recall", `"${r.label}": ${attrProblems.join("; ")}`);
    if (exp.constructAliases) {
      const ok = anyAlias(r.definition, exp.constructAliases);
      bump(tally, "construct_named", ok);
      if (!ok)
        fail(
          "construct_named",
          `"${r.label}" definition does not name the construct (${exp.constructAliases.join(" / ")})`,
        );
    }
    if (exp.proxyTerms) {
      const identified =
        exp.proxyTerms.some((p) => anyAlias(r.falseSignals.join("\n"), [p])) ||
        (exp.constructAliases
          ? anyAlias(r.definition, exp.constructAliases)
          : false) ||
        /\bproxy\b|stand[- ]in|hint, not|not a filter|not the bar/i.test(
          r.definition,
        );
      bump(tally, "proxy_identified", identified);
      if (!identified)
        fail(
          "proxy_identified",
          `"${r.label}": proxy (${exp.proxyTerms.join(" / ")}) is neither a false signal nor contextualized by the construct`,
        );
    }
    if (exp.evidenceAliases) {
      const ok = anyAlias(r.evidenceSpec.join("\n"), exp.evidenceAliases);
      bump(tally, "evidence_signal_recall", ok);
      if (!ok)
        fail(
          "evidence_signal_recall",
          `"${r.label}" evidenceSpec lacks ${exp.evidenceAliases.join(" / ")}`,
        );
    }
    if (exp.falseSignalAliases) {
      const ok = anyAlias(r.falseSignals.join("\n"), exp.falseSignalAliases);
      bump(tally, "false_signal_recall", ok);
      if (!ok)
        fail(
          "false_signal_recall",
          `"${r.label}" falseSignals lack ${exp.falseSignalAliases.join(" / ")}`,
        );
    }
  }

  // contradictions ------------------------------------------------------------
  for (const exp of expectation.contradictions) {
    const c = findContradiction(after.contradictions, exp.aliases);
    const ok = Boolean(c) && (!exp.status || c?.status === exp.status);
    bump(tally, "contradiction_detection", ok);
    if (!c)
      fail(
        "contradiction_detection",
        `expected contradiction "${exp.key}" not recorded`,
      );
    else if (!ok)
      fail(
        "contradiction_detection",
        `contradiction "${exp.key}" is ${c.status}, expected ${exp.status}`,
      );
  }

  // uncertainties -------------------------------------------------------------
  for (const exp of expectation.uncertainties) {
    const u = findUncertainty(after.uncertainties, exp.aliases);
    if (!u) {
      bump(tally, "uncertainty_detection", false);
      fail(
        "uncertainty_detection",
        `expected uncertainty "${exp.key}" (${exp.aliases[0]}) not recorded`,
      );
      continue;
    }
    const problems: string[] = [];
    if (u.status !== exp.status)
      problems.push(`status ${u.status} (expected ${exp.status})`);
    if (u.consequential !== exp.consequential)
      problems.push(
        `consequential=${u.consequential} (expected ${exp.consequential})`,
      );
    bump(tally, "uncertainty_detection", problems.length === 0);
    if (problems.length > 0)
      fail("uncertainty_detection", `"${u.about}": ${problems.join("; ")}`);
    if (exp.shouldRemainUnknown) {
      const inferred = after.requirements.find(
        (r) =>
          r.status === "explicit" &&
          (r.kind === "must_have" || r.kind === "disqualifier") &&
          anyAlias(r.label, exp.aliases),
      );
      const ok = u.status === "open" && !inferred;
      bump(tally, "unknown_preserved", ok);
      if (!ok)
        fail(
          "unknown_preserved",
          `"${exp.key}" should remain unknown but ${inferred ? `requirement "${inferred.label}" asserts it` : "it was resolved"}`,
        );
    }
  }

  // next question -------------------------------------------------------------
  if (expectation.nextQuestion && "nextQuestion" in output) {
    const nq = output.nextQuestion;
    if (!nq) {
      const ok = Boolean(expectation.nextQuestion.mayBeNull);
      bump(tally, "next_question_targeting", ok);
      if (!ok)
        fail(
          "next_question_targeting",
          "no next question was proposed although consequential questions remain",
        );
    } else {
      const targeted = nq.targetsUncertaintyIds
        .map((id) => after.uncertainties.find((u) => u.id === id))
        .filter((u): u is UncertaintyIR => Boolean(u))
        .map((u) => `${u.about}\n${u.consequence}`)
        .join("\n");
      const text = `${nq.question}\n${nq.whyItMatters}\n${nq.informationValue}\n${targeted}`;
      const ok = anyAlias(text, expectation.nextQuestion.targetsAliases);
      bump(tally, "next_question_targeting", ok);
      if (!ok)
        fail(
          "next_question_targeting",
          `next question does not address ${expectation.nextQuestion.targetsAliases.join(" / ")}: "${nq.question.slice(0, 100)}"`,
        );
    }
  }

  // replan_signal -------------------------------------------------------------
  if (before && expectation.replan) {
    const requirementsChanged =
      before.requirements.length !== after.requirements.length ||
      before.requirements.some((p) => {
        const n = after.requirements.find((r) => r.id === p.id);
        return (
          !n ||
          n.kind !== p.kind ||
          norm(n.definition) !== norm(p.definition) ||
          n.status !== p.status
        );
      });
    const consequentialResolved = after.uncertainties.some(
      (u) =>
        u.consequential &&
        u.status === "resolved" &&
        before.uncertainties.find((p) => p.id === u.id)?.status !== "resolved",
    );
    const implied = requirementsChanged || consequentialResolved;
    const ok = implied === expectation.replan.required;
    bump(tally, "replan_signal", ok);
    if (!ok)
      fail(
        "replan_signal",
        expectation.replan.required
          ? "a re-plan was expected but the turn changed no requirement and resolved no consequential uncertainty"
          : "no re-plan was expected but the turn changed requirements / resolved a consequential uncertainty (spurious churn)",
      );
  }

  return { tally, findings, reviewWarnings };
}

// ── re-plan check ───────────────────────────────────────────────────────────

export interface ReplanCheckArgs {
  expectation: Expectation;
  plan: SearchPlanOutput;
  composed: { segmentLabel: string; queries: ComposedQuery[] }[];
  personas?: AudiencePersonaIR[];
  /** Proxy terms from this turn's expected requirements — never search filters. */
  proxyTerms: string[];
}

/** Remove `-term` and `-"multi word"` negations from a composed query. */
export function stripExclusions(query: string): string {
  return query.replace(/-(?:"[^"]*"|\S+)/g, " ");
}

export function checkReplan(args: ReplanCheckArgs): CheckResult {
  const { expectation, plan, composed, personas, proxyTerms } = args;
  const tally: Tally = {};
  const findings: Finding[] = [];
  const fail = (metric: MetricId, detail: string) =>
    findings.push({ metric, severity: "fail", detail });

  const queryPlans = plan.searchPlan.queryPlans;
  const dims: Record<string, string> = {
    occupation: [
      ...queryPlans.flatMap((q) => [
        ...q.titles,
        ...q.alternateTitles,
        ...q.adjacentTitles,
      ]),
      ...plan.population.segments.map((s) => s.label),
    ].join("\n"),
    population: plan.population.segments
      .map((s) => `${s.label}\n${s.description}\n${s.whereTheyAre.join("\n")}`)
      .join("\n"),
    adjacent: plan.population.adjacentSegments
      .map((s) => `${s.label}\n${s.description}\n${s.tradeoff}`)
      .join("\n"),
    geography: [
      ...queryPlans.flatMap((q) => q.locations),
      ...plan.population.segments.map((s) => s.description),
      ...composed.flatMap((c) => c.queries.map((q) => q.query)),
    ].join("\n"),
    channels: [
      ...plan.population.segments.flatMap((s) => s.whereTheyAre),
      ...plan.evidence.items.flatMap((i) => i.whereToLook),
    ].join("\n"),
    evidence: plan.evidence.items
      .map(
        (i) =>
          `${i.observable}\n${i.strongLooksLike}\n${i.weakLooksLike}\n${i.whereToLook.join("\n")}`,
      )
      .join("\n"),
    // Positive search surface only. A term that appears solely as an
    // exclusion (`-perfusionist`) is the opposite of searching for it, so
    // negations are stripped before the mustNotContain test.
    strings: [
      ...composed.flatMap((c) =>
        c.queries.map((q) => stripExclusions(q.query)),
      ),
      ...queryPlans.flatMap((q) => [
        ...q.titles,
        ...q.alternateTitles,
        ...q.adjacentTitles,
        ...q.mustHaveTerms,
        ...q.anyOfTerms,
        ...q.credentials,
      ]),
    ].join("\n"),
    screening: [
      ...plan.searchPlan.sequencing,
      ...plan.evidence.items.map(
        (i) => `${i.observable}\n${i.strongLooksLike}`,
      ),
      ...plan.success.outcomes.map((o) => o.text),
      plan.success.goodVsExceptional,
    ].join("\n"),
    // doNotSay is excluded: that field exists precisely to name phrases the
    // outreach must avoid, so a forbidden term appearing there is the persona
    // working, not leaking it.
    persona: (personas ?? [])
      .map((p) => JSON.stringify({ ...p, doNotSay: [] }))
      .join("\n"),
  };

  for (const change of expectation.replan?.changes ?? []) {
    if (change.dimension === "persona" && !personas) continue; // not run
    const text = dims[change.dimension];
    if (change.aliases.length > 0) {
      const ok = anyAlias(text, change.aliases);
      bump(tally, "replan_correctness", ok);
      if (!ok)
        fail(
          "replan_correctness",
          `${change.dimension}: none of ${change.aliases.join(" / ")} present after re-plan`,
        );
    }
    for (const term of change.mustNotContain) {
      const present = has(text, term);
      bump(tally, "replan_correctness", !present);
      if (present)
        fail(
          "replan_correctness",
          `${change.dimension}: "${term}" is present but must not be`,
        );
    }
  }

  // Proxies must never become filters.
  const filterText = [
    ...queryPlans.flatMap((q) => [
      ...q.titles,
      ...q.mustHaveTerms,
      ...q.credentials,
    ]),
    ...composed.flatMap((c) =>
      c.queries
        .filter((q) => q.breadth === "narrow")
        .map((q) => stripExclusions(q.query)),
    ),
  ].join("\n");
  for (const proxy of proxyTerms) {
    const present = has(filterText, proxy);
    bump(tally, "proxy_as_filter", !present);
    if (present)
      fail("proxy_as_filter", `proxy "${proxy}" appears as a search filter`);
  }

  // Protected traits in the plan's defining text.
  const planText = [
    dims.population,
    dims.adjacent,
    dims.evidence,
    dims.strings,
    dims.screening,
  ].join("\n");
  const hits = scanTextForProtectedTraits(planText);
  bump(tally, "protected_traits", hits.length === 0);
  for (const h of hits)
    fail(
      "protected_traits",
      `${h.trait} referenced in the search plan: "${h.excerpt}"`,
    );

  return { tally, findings, reviewWarnings: [] };
}

/** Merge tallies (sum). */
export function mergeTallies(...tallies: Tally[]): Tally {
  const out: Tally = {};
  for (const t of tallies) {
    for (const [metric, v] of Object.entries(t) as [MetricId, MetricTally][]) {
      const cur = out[metric] ?? { pass: 0, total: 0 };
      cur.pass += v.pass;
      cur.total += v.total;
      out[metric] = cur;
    }
  }
  return out;
}
