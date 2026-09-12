/**
 * Running a compiled query on the Talent X-Ray engines (W20.1).
 *
 * The two Programmable Search engines ARE the product: 50 domains each,
 * restricted by construction to surfaces where people describe themselves.
 * This page has no network of its own, so it does exactly what the reference
 * console does when its embedded results are blocked — it opens the engine's
 * own results page with the query, in a new tab (reference/talent-xray.html,
 * `fallbackLink`). Nothing here reads a result; a person does, and adds the
 * people they choose to keep under Candidates.
 *
 * The query that runs is the compiler's Google row, unchanged: the reference
 * composer sends a plain boolean and uses a `site:` group only to narrow the
 * already-restricted corpus, which is what the x-ray rows do.
 */
import {
  checkExtraQuery,
  countTerms,
  type CompiledQuery,
} from "./query-compiler";

export const TALENT_XRAY_ENGINES = [
  {
    id: "core",
    cx: "a157d37906e1141cc",
    label: "Talent X-Ray · Core",
    short: "Core",
    description:
      "The 50-domain universal spine: profiles, portfolios, CVs, bios.",
  },
  {
    id: "reach",
    cx: "918bc00e18d0c46e5",
    label: "Verified & Reach",
    short: "Verified & Reach",
    description: "Credential registries, contact records, rosters.",
  },
] as const;
export type EngineId = (typeof TALENT_XRAY_ENGINES)[number]["id"];

/** The reference console's link, verbatim: cse.google.com/cse?cx=…#gsc.q=… */
export function engineSearchUrl(engine: EngineId, query: string): string {
  const e =
    TALENT_XRAY_ENGINES.find((x) => x.id === engine) ?? TALENT_XRAY_ENGINES[0];
  return `https://cse.google.com/cse?cx=${encodeURIComponent(e.cx)}#gsc.q=${encodeURIComponent(query.trim())}`;
}

/**
 * Only a Google-dialect row can run on a Google engine. LinkedIn's native
 * boolean uses AND / NOT, which Google reads as words.
 */
export function engineRunnable(
  q: Pick<CompiledQuery, "platformId" | "runnable">,
): boolean {
  return q.runnable && q.platformId !== "linkedin_native";
}

export interface EngineQueryCheck {
  termCount: number;
  runnable: boolean;
  /** Empty when runnable. */
  violations: string[];
}

/** An edited query is re-checked against Google's limits before it is offered. */
export function checkEngineQuery(query: string): EngineQueryCheck {
  const trimmed = query.trim();
  if (!trimmed) {
    return { termCount: 0, runnable: false, violations: ["Empty query."] };
  }
  const check = checkExtraQuery("Google (open web)", trimmed);
  return {
    termCount: countTerms(trimmed),
    runnable: check.runnable,
    violations: check.violations,
  };
}

/** The row to pre-load: the everyday query on the engine's own dialect. */
export function defaultEngineRow(
  rows: CompiledQuery[],
): CompiledQuery | undefined {
  const runnable = rows.filter(engineRunnable);
  return (
    runnable.find(
      (r) => r.platformId === "google_web" && r.breadth === "balanced",
    ) ??
    runnable.find((r) => r.platformId === "google_web") ??
    runnable[0]
  );
}
