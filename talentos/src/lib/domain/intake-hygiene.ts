/**
 * Deterministic backstops for the intake reasoner, from the W12 full-corpus
 * failure taxonomy (`eval/w12/REPORT.md` §12.1).
 *
 * The primary fix for each defect is a rule in the reasoner's prompt. These
 * functions are the part that can be enforced without a model, so they are
 * the part that can be tested. They are conservative by design: each one
 * corrects a specific, unambiguous shape and leaves everything else alone.
 *
 * Covers S-2 (origin drift), S-3 (market comparisons resolved from inside
 * the company) and S-4 (withdrawn requirements demoted instead of removed).
 * S-1 (false signals) and S-5 (rule-versus-example contradictions) are
 * judgement calls with no deterministic shape and are prompt-only.
 */
import type {
  HiringIntentIR,
  ManagerStatement,
  RequirementIR,
  UncertaintyIR,
} from "@/lib/core/ir";

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[“”"]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** A requirement statement is verbatim when it appears whole in a source. */
function isVerbatimFrom(statement: string, sources: string[]): boolean {
  const needle = norm(statement).replace(/^["'\s]+|["'\s]+$/g, "");
  if (needle.length < 12) return true; // too short to attribute either way
  return sources.some((s) => norm(s).includes(needle));
}

/**
 * S-2 · A requirement keeps `origin: "jd"` while its verbatim `statement` is
 * overwritten with the hiring manager's words. Provenance then lies in both
 * directions at once: the statement is not from the job description, and the
 * origin does not name the person who actually asserted it.
 *
 * When a requirement claims JD origin but its statement is verbatim from a
 * hiring-manager statement instead, the manager is the origin. Flip it and
 * record the speaker. Requirements whose statements are genuinely from the
 * job description are untouched, and so is anything already attributed.
 */
export function reconcileRequirementOrigins(
  requirements: RequirementIR[],
  jdText: string | undefined,
  statements: ManagerStatement[],
): RequirementIR[] {
  if (statements.length === 0) return requirements;
  const jdSources = jdText ? [jdText] : [];
  return requirements.map((r) => {
    if (r.origin !== "jd") return r;
    if (isVerbatimFrom(r.statement, jdSources)) return r;
    const speaker = statements.find((s) =>
      isVerbatimFrom(r.statement, [s.text]),
    );
    if (!speaker) return r;
    return {
      ...r,
      origin: "manager_statement" as const,
      assertedBy: r.assertedBy ?? speaker.speaker,
    };
  });
}

/**
 * S-4 · A withdrawn requirement is demoted to `preferred` and kept, usually
 * with "(withdrawn)" appended to its label. `preferred` legitimately raises
 * a candidate's review priority, so a withdrawn requirement kept that way
 * still shapes the search — the defect is behavioural, not cosmetic.
 *
 * The reasoner is told to remove them (the withdrawal survives in the claim
 * log and the verbatim statements, so nothing is lost). This drops the ones
 * that get through, matched narrowly on the label: no live requirement is
 * *named* "withdrawn".
 */
export function dropWithdrawnRequirements(
  requirements: RequirementIR[],
): RequirementIR[] {
  return requirements.filter((r) => !/\bwithdrawn\b/i.test(r.label));
}

/**
 * Uncertainties about how something here compares with the market outside.
 * Deliberately narrow: it must be a comparison, not merely a mention of pay.
 */
const MARKET_COMPARISON =
  /\bcompare[sd]?\b|\bcomparison\b|\bversus\b|\bagainst the (?:market|region)|\b(?:market|regional|prevailing|going) rate\b|\bmarket[- ]competitive\b/i;

/**
 * S-3 · A market-comparison uncertainty is marked resolved because the
 * hiring manager stated the company's own number. Nobody answered the
 * comparison, and an unknown has become a fact — the exact failure
 * `unknown_preserved` exists to catch.
 *
 * Only market evidence can close these, which is what the research provider
 * is for. A manager statement cannot, so a turn that resolves one is
 * reverted and the manager's answer is kept as context on the consequence.
 */
export function keepMarketComparisonsOpen(
  uncertainties: UncertaintyIR[],
  before: UncertaintyIR[],
): UncertaintyIR[] {
  const wasOpen = new Set(
    before.filter((u) => u.status === "open").map((u) => u.id ?? u.about),
  );
  return uncertainties.map((u) => {
    const key = u.id ?? u.about;
    if (u.status !== "resolved") return u;
    if (!wasOpen.has(key)) return u;
    if (!MARKET_COMPARISON.test(u.about)) return u;
    return {
      ...u,
      status: "open" as const,
      resolution: undefined,
      consequence: u.resolution
        ? `${u.consequence} The hiring manager has stated the internal figure ("${u.resolution.trim()}"), which is one side of the comparison; the market side is still unknown and only market evidence can close it.`
        : u.consequence,
    };
  });
}

/** All three backstops, applied to one reasoning turn's output. */
export function applyIntakeHygiene(
  next: Pick<HiringIntentIR, "requirements" | "uncertainties">,
  before: Pick<HiringIntentIR, "uncertainties">,
  jdText: string | undefined,
  statements: ManagerStatement[],
): Pick<HiringIntentIR, "requirements" | "uncertainties"> {
  return {
    requirements: dropWithdrawnRequirements(
      reconcileRequirementOrigins(next.requirements, jdText, statements),
    ),
    uncertainties: keepMarketComparisonsOpen(
      next.uncertainties,
      before.uncertainties,
    ),
  };
}
