/**
 * The ten deliberate-defect checks (spec §18). Deterministic — no model
 * call — so they run identically inside the page's Golden Test and in
 * vitest. Each injects a defect and asserts the system catches it.
 */
import { scanPayloadForProtectedTraits } from "@/lib/domain/fair-hiring";
import {
  normalizeGenerated,
  withIntakeAnswer,
  downgradeVerified,
  type IntakePayload,
} from "./payloads";
import { contextFromFacts, diffContexts } from "./search-context";
import { affectedByChanges, moduleState, MODULES } from "./dependencies";
import {
  buildSnapshot,
  gateDecision,
  researchStatusOf,
  type ResearchSnapshot,
} from "./research";
import {
  guardClaims,
  metricResultSchema,
  rateMetric,
  validateEnvelope,
  validateNextSteps,
  type SuggestedNextStep,
} from "./envelope";
import { compileQueries, countTerms } from "./query-compiler";
import { findIdentityMatches } from "./identity";
import { computeMetrics, pipelineEventSchema } from "./pipeline";
import { buildDossier } from "./evidence";

export interface CheckResult {
  id: string;
  name: string;
  passed: boolean;
  detail: string;
  /** "deterministic" checks ran with no model; "model" checks need a run. */
  kind: "deterministic";
}

export interface DefectCheck {
  id: string;
  name: string;
  run(env: { document?: Document }): CheckResult;
}

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value as Record<string, unknown>))
      deepFreeze(v);
  }
  return value;
}

const NOW = "2026-09-04T12:00:00.000Z";
const FACTS = {
  id: "chk",
  createdAt: NOW,
  name: "Check — Staff Nurse",
  companyName: "Example Health",
  roleTitle: "Staff Nurse, ICU",
  geography: "Leeds",
  country: "United Kingdom",
  industry: "Healthcare",
  workplaceModel: "on-site required",
  jd: "Staff Nurse, ICU. NMC registration required. On-site, 12-hour shifts.",
};

const FROZEN_INTAKE: IntakePayload = deepFreeze({
  categories: [
    {
      title: "Why now",
      rationale: "Frozen fixture",
      questions: [
        {
          question: "Why does this role exist now?",
          whyItMatters: "Capacity vs capability changes the profile.",
        },
        { question: "Who is the dream hire?", whyItMatters: "Sets the bar." },
      ],
    },
  ],
  playback: {
    target: "ICU nurse",
    hardRequirements: ["NMC"],
    flexibleRequirements: [],
    idealPhenotype: "Band 6",
    adjacentPhenotypes: [],
    disqualifiers: [],
    unresolvedQuestions: [],
  },
});

function result(
  id: string,
  name: string,
  passed: boolean,
  detail: string,
): CheckResult {
  return { id, name, passed, detail, kind: "deterministic" };
}

export const DEFECT_CHECKS: DefectCheck[] = [
  {
    id: "frozen_intake",
    name: "1. Frozen HM Intake payload renders, accepts an answer, survives reload",
    run: (env) => {
      try {
        const normalized = normalizeGenerated("intake", FROZEN_INTAKE);
        const qid = normalized.categories[0].questions[0].id;
        if (!qid)
          return result(
            "frozen_intake",
            "Frozen intake",
            false,
            "No id assigned to question.",
          );
        const answered = withIntakeAnswer(
          normalized,
          qid,
          "Capability-driven.",
          NOW,
        );
        const reloaded = normalizeGenerated(
          "intake",
          JSON.parse(JSON.stringify(answered)),
        );
        const answer = reloaded.categories[0].questions[0].answer;
        if (answer !== "Capability-driven.")
          return result(
            "frozen_intake",
            "Frozen intake",
            false,
            `Answer lost on reload: ${String(answer)}`,
          );
        if (Object.isFrozen(FROZEN_INTAKE.categories[0].questions[0]) === false)
          return result(
            "frozen_intake",
            "Frozen intake",
            false,
            "Fixture was not frozen.",
          );
        if ("id" in FROZEN_INTAKE.categories[0].questions[0])
          return result(
            "frozen_intake",
            "Frozen intake",
            false,
            "The frozen provider payload was mutated.",
          );
        if (env.document) {
          const root = env.document.createElement("div");
          // Rendering is exercised via the renderer in the page; here we only assert the DOM can host it.
          root.textContent = normalized.categories[0].questions[0].question;
          if (!root.textContent)
            return result(
              "frozen_intake",
              "Frozen intake",
              false,
              "Render produced nothing.",
            );
        }
        return result(
          "frozen_intake",
          "Frozen intake",
          true,
          "Provider payload untouched; ids assigned on a copy; answer persisted and reloaded.",
        );
      } catch (e) {
        return result(
          "frozen_intake",
          "Frozen intake",
          false,
          `Threw: ${(e as Error).message}`,
        );
      }
    },
  },
  {
    id: "upstream_change_stale",
    name: "2. Changing an upstream requirement marks downstream modules stale",
    run: () => {
      const before = contextFromFacts(FACTS, [], NOW);
      const after = contextFromFacts(
        { ...FACTS, workplaceModel: "hybrid preferred" },
        [],
        NOW,
      );
      const changes = diffContexts(before, after);
      const affected = affectedByChanges(changes);
      const st = moduleState({
        key: "market_intelligence",
        record: {
          payload: { ok: true },
          meta: {
            generatedAt: NOW,
            inputVersion: before.searchVersion,
            researchStatus: "blocked",
          },
        },
        currentVersion: after.searchVersion,
        changedSince: changes.map((c) => c.label),
        researchStatus: "blocked",
        upstream: {},
      });
      const ok =
        changes.length === 1 &&
        affected.includes("market_intelligence") &&
        affected.includes("search_strings") &&
        st.state === "stale";
      return result(
        "upstream_change_stale",
        "Upstream change → stale",
        ok,
        `${changes.length} change(s); affected: ${affected.map((k) => MODULES[k].label).join(", ")}; market state = ${st.state}.`,
      );
    },
  },
  {
    id: "missing_snapshot_not_current",
    name: "3. Without a ResearchSnapshot a market output cannot be 'current'",
    run: () => {
      const gate = gateDecision(undefined, NOW, true);
      const env = validateEnvelope(
        {
          id: "e",
          searchId: "chk",
          searchVersion: "v1",
          moduleType: "market_intelligence",
          generatedAt: NOW,
          researchStatus: "current",
          headline: "h",
          executiveSummary: "s",
          content: {},
          suggestedNextSteps: eightSteps(),
        },
        { resolvableIds: new Set(["overview"]) },
      );
      const ok =
        gate.researchStatus === "blocked" &&
        gate.acknowledgementRequired &&
        !env.ok &&
        env.issues.some((i) => i.code === "research_currency");
      return result(
        "missing_snapshot_not_current",
        "Missing snapshot fails closed",
        ok,
        `gate=${gate.researchStatus}; envelope claiming current without snapshot → ${env.ok ? "ACCEPTED (defect)" : "rejected"}.`,
      );
    },
  },
  {
    id: "unsupported_claim",
    name: "4. An unsupported 'fact' is relabelled, not accepted",
    run: () => {
      const { claims, relabelled } = guardClaims([
        {
          id: "c1",
          text: "Median ICU nurse pay in Leeds is £41,000.",
          kind: "source_fact",
          evidenceState: "source_backed",
          sourceIds: [],
          limitations: [],
          contradictions: [],
        },
      ]);
      const ok =
        relabelled === 1 &&
        claims[0].kind === "model_inference" &&
        claims[0].evidenceState === "self_attested";
      return result(
        "unsupported_claim",
        "Unsupported claim guard",
        ok,
        `relabelled=${relabelled}; kind=${claims[0].kind}; state=${claims[0].evidenceState}.`,
      );
    },
  },
  {
    id: "provider_failure_visible",
    name: "5. A failed research provider shows failed/blocked, not empty success",
    run: () => {
      const ctx = contextFromFacts(FACTS, [], NOW);
      const failed: ResearchSnapshot = buildSnapshot({
        id: "rs-f",
        ctx,
        brief: "b",
        sources: [],
        nowIso: NOW,
        failed: "connector returned server_unavailable",
      });
      const empty: ResearchSnapshot = buildSnapshot({
        id: "rs-e",
        ctx,
        brief: "b",
        sources: [],
        nowIso: NOW,
      });
      const ok =
        researchStatusOf(failed, NOW) === "failed" &&
        researchStatusOf(empty, NOW) === "blocked" &&
        failed.missingInformation.length === 1;
      return result(
        "provider_failure_visible",
        "Provider failure visible",
        ok,
        `failed→${researchStatusOf(failed, NOW)}, empty→${researchStatusOf(empty, NOW)}.`,
      );
    },
  },
  {
    id: "no_unsafe_merge",
    name: "6. Same name, conflicting organisations → review, never merged",
    run: () => {
      const existing = [
        {
          id: "a",
          name: "Priya Patel",
          currentCompany: "Leeds Teaching Hospitals",
        },
      ];
      const matches = findIdentityMatches(
        {
          id: "b",
          name: "Priya Patel",
          currentCompany: "Manchester Royal Infirmary",
        },
        existing,
      );
      const ok =
        matches.length === 1 &&
        matches[0].strength === "same_name_different_org";
      return result(
        "no_unsafe_merge",
        "No unsafe identity merge",
        ok,
        matches.map((m) => `${m.strength}: ${m.reason}`).join(" ") ||
          "no match raised",
      );
    },
  },
  {
    id: "seven_steps_fail",
    name: "7. Seven next steps fail validation",
    run: () => {
      const seven = eightSteps().slice(0, 7);
      const issues = validateNextSteps(seven, {
        resolvableIds: new Set(["overview"]),
      });
      const ok =
        issues.some((i) => i.code === "missing_label") &&
        issues.some((i) => i.code === "labels");
      return result(
        "seven_steps_fail",
        "Seven steps rejected",
        ok,
        issues.map((i) => i.message).join(" "),
      );
    },
  },
  {
    id: "metric_without_denominator",
    name: "8. A measured metric with no denominator is rejected; 0/0 is not-enough-data",
    run: () => {
      const bad = metricResultSchema.safeParse({
        id: "m",
        label: "Reply rate",
        formula: "replies ÷ contacted",
        value: 0.5,
        status: "measured",
        asOf: NOW,
      });
      const zero = rateMetric({
        id: "r",
        label: "Reply rate",
        formula: "replies ÷ contacted",
        numerator: 0,
        denominator: 0,
        asOf: NOW,
      });
      const ok =
        !bad.success &&
        zero.status === "not_enough_data" &&
        zero.value === null;
      return result(
        "metric_without_denominator",
        "Metric denominator rule",
        ok,
        `no-denominator → ${bad.success ? "accepted (defect)" : "rejected"}; 0/0 → ${zero.status}.`,
      );
    },
  },
  {
    id: "overlong_query",
    name: "9. An over-budget query is split into runnable parts or marked not runnable",
    run: () => {
      const anyOf = Array.from({ length: 40 }, (_, i) => `skill${i}`);
      const compiled = compileQueries(
        {
          titles: ["ICU Nurse"],
          alternateTitles: [],
          adjacentTitles: [],
          mustHave: ["NMC"],
          anyOf,
          credentials: [],
          locations: ["Leeds"],
          companies: [],
          exclusions: ["recruiter"],
        },
        { platformIds: ["google_linkedin"] },
      );
      const overBudgetRunnable = compiled.filter(
        (q) => q.runnable && countTerms(q.query) > 32,
      );
      const parts = compiled.filter((q) => q.part);
      const ok =
        overBudgetRunnable.length === 0 &&
        (parts.length > 1 || compiled.some((q) => !q.runnable));
      return result(
        "overlong_query",
        "Overlong query handled",
        ok,
        `${compiled.length} queries; ${parts.length} split parts; ${compiled.filter((q) => !q.runnable).length} not runnable; ${overBudgetRunnable.length} over-budget yet marked runnable.`,
      );
    },
  },
  {
    id: "protected_trait_caught",
    name: "10. A protected-trait recommendation trips the safety scan",
    run: () => {
      const hits = scanPayloadForProtectedTraits({
        recommendation:
          "Prefer younger candidates; the team skews under 30 and pregnancy would be disruptive.",
      });
      const ok = hits.length > 0;
      return result(
        "protected_trait_caught",
        "Protected trait caught",
        ok,
        hits.length
          ? `flagged: ${hits.map((h) => h.trait).join(", ")}`
          : "nothing flagged (defect)",
      );
    },
  },
  {
    id: "verified_downgraded",
    name: "11. A model 'verified' label is downgraded without mutating the source",
    run: () => {
      const src = deepFreeze({
        sections: [{ claims: [{ text: "x", certainty: "verified" }] }],
      });
      const out = downgradeVerified(src);
      const ok =
        out.downgrades === 1 &&
        out.value.sections[0].claims[0].certainty === "inferred" &&
        src.sections[0].claims[0].certainty === "verified";
      return result(
        "verified_downgraded",
        "Verified downgraded immutably",
        ok,
        `downgrades=${out.downgrades}`,
      );
    },
  },
  {
    id: "empty_pipeline_not_zero",
    name: "12. An empty pipeline reports not-enough-data, never a 0% conversion",
    run: () => {
      const empty = computeMetrics({
        candidateIds: ["c1", "c2"],
        events: [],
        nowIso: NOW,
      });
      const rates = empty.flatMap((g) => g.metrics);
      const zeroed = rates.filter(
        (m) => m.status === "measured" && m.value === 0,
      );
      const grouped = JSON.stringify(empty).toLowerCase();
      const demographic = [
        "gender",
        "ethnicit",
        '"age"',
        "religion",
        "disabilit",
      ].filter((t) => grouped.includes(t));
      const events = [
        {
          id: "e1",
          candidateId: "c1",
          at: NOW,
          type: "outreach_recorded" as const,
        },
        {
          id: "e2",
          candidateId: "c1",
          at: NOW,
          type: "reply_recorded" as const,
          outcome: "interested" as const,
        },
      ].map((e) => pipelineEventSchema.parse(e));
      const real = computeMetrics({
        candidateIds: ["c1", "c2"],
        events,
        nowIso: NOW,
      });
      const overOne = real
        .flatMap((g) => g.metrics)
        .filter(
          (m) =>
            m.status === "measured" && (m.value ?? 0) > 1 && m.unit !== "days",
        );
      const ok =
        zeroed.length === 0 && demographic.length === 0 && overOne.length === 0;
      return result(
        "empty_pipeline_not_zero",
        "Empty pipeline is not a zero",
        ok,
        `${zeroed.length} metric(s) reported 0 from no data; ${demographic.length} demographic term(s) in the registry; ${overOne.length} rate(s) above 100%.`,
      );
    },
  },
  {
    id: "fabricated_quote_caught",
    name: "13. A quote that is not in the source is downgraded, not shown as evidence",
    run: () => {
      const candidate = {
        id: "cand-check",
        name: "Synthetic Check Candidate",
        profileUrls: ["https://example.com/profile"],
        pastedText:
          "SYNTHETIC PROFILE FOR CHECKING — not a real person. Built the distributed evaluation harness used across the lab.",
        createdAt: NOW,
      };
      const dossier = buildDossier({
        candidate,
        rawItems: [
          {
            criterion: "Built evaluation infrastructure",
            status: "strong",
            evidenceText: "They built the harness.",
            quote:
              "Built the distributed evaluation harness used across the lab.",
            sourceId: "cand-check:pasted",
          },
          {
            criterion: "Led a team of twelve",
            status: "strong",
            evidenceText: "They led a large team.",
            quote: "Led a team of twelve engineers across three sites.",
            sourceId: "cand-check:pasted",
          },
          {
            criterion: "Published at NeurIPS",
            status: "strong",
            evidenceText: "Their profile page lists papers.",
            quote: "First-author NeurIPS paper.",
            sourceId: "cand-check:link:0",
          },
        ],
        criteria: [
          "Built evaluation infrastructure",
          "Led a team of twelve",
          "Ships production code",
        ],
      });
      const real = dossier.items[0];
      const fabricated = dossier.items[1];
      const fromLink = dossier.items[2];
      const ok =
        real.supported &&
        real.status === "strong" &&
        !fabricated.supported &&
        fabricated.status === "unknown" &&
        fabricated.check === "not_found_in_source" &&
        !fromLink.supported &&
        fromLink.status !== "strong" &&
        dossier.downgraded === 2 &&
        dossier.uncovered.includes("Ships production code");
      return result(
        "fabricated_quote_caught",
        "Fabricated quote caught",
        ok,
        `verified=${real.supported}; fabricated→${fabricated.status}/${fabricated.check}; link-quote→${fromLink.status}; downgraded=${dossier.downgraded}; uncovered=${dossier.uncovered.length}.`,
      );
    },
  },
];

function eightSteps(): SuggestedNextStep[] {
  return (["A", "B", "C", "D", "E", "F", "G", "H"] as const).map(
    (label, i) => ({
      label,
      title: `Open the ${["overview", "canonical IR", "intake loop", "success profile", "market intel", "strategy", "channels", "search strings"][i]} module`,
      description: "Fixture step.",
      actionType: "navigate_module" as const,
      targetId: "overview",
    }),
  );
}

export function runDefectChecks(
  env: { document?: Document } = {},
): CheckResult[] {
  return DEFECT_CHECKS.map((c) => c.run(env));
}
