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
 * the company), S-4 (withdrawn requirements demoted instead of removed),
 * S-10 (one turn's whole text pasted as every requirement's verbatim
 * statement) and S-11 (a prior contradiction lost because the reasoner
 * simply stopped emitting it). S-1 (false signals), S-5
 * (rule-versus-example contradictions),
 * S-6 (status overloading), S-7 (constructs and proxies) and S-9
 * (consequentiality) are judgement calls with no deterministic shape and are
 * prompt-only.
 */
import type {
  ContradictionIR,
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

/** Words distinctive enough to attribute a sentence to a requirement. */
function tokens(text: string): Set<string> {
  return new Set(
    norm(text)
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 4),
  );
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
 * S-10 · The reasoner pastes the whole manager turn into `statement` for
 * every requirement that turn touched — 197 of 803 requirements in the W12
 * full corpus shared a byte-identical statement with a sibling. Two
 * requirements cannot both have the same verbatim source phrase, so this is
 * always wrong: it destroys per-requirement provenance and makes any
 * downstream "which phrase asserted this?" question unanswerable.
 *
 * The reasoner is told to quote the fragment. This narrows the ones that get
 * through, and only when the answer is unambiguous: among requirements
 * sharing a statement, each takes the single sentence with the most
 * distinctive overlap with its own label, and only when exactly one sentence
 * wins. A narrowed statement is still a verbatim substring of the original,
 * so provenance stays intact; anything unclear is left alone.
 */
export function narrowSharedStatements(
  requirements: RequirementIR[],
): RequirementIR[] {
  const counts = new Map<string, number>();
  for (const r of requirements) {
    const k = norm(r.statement);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return requirements.map((r) => {
    if ((counts.get(norm(r.statement)) ?? 0) < 2) return r;
    const sentences = r.statement
      .split(/(?<=[.!?])\s+/)
      .map((x) => x.trim())
      .filter((x) => x.length >= 12);
    if (sentences.length < 2) return r;
    const wanted = tokens(r.label);
    if (wanted.size === 0) return r;
    const scored = sentences.map((sentence) => ({
      sentence,
      score: [...tokens(sentence)].filter((t) => wanted.has(t)).length,
    }));
    const best = Math.max(...scored.map((x) => x.score));
    if (best === 0) return r;
    const winners = scored.filter((x) => x.score === best);
    if (winners.length !== 1) return r;
    return { ...r, statement: winners[0].sentence };
  });
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

/**
 * Two contradictions are the same disagreement when both sides match, in
 * either order. Claim texts are matched loosely on purpose: the reasoner
 * routinely shortens or rewords a claim on the turn it resolves it (a-03,
 * h-02), and an exact-text key would read that as a different contradiction
 * and duplicate it.
 */
function sameClaim(a: string | undefined, b: string | undefined): boolean {
  const x = norm(a ?? "");
  const y = norm(b ?? "");
  if (x === "" || y === "") return false;
  if (x === y) return true;
  const [short, long] = x.length < y.length ? [x, y] : [y, x];
  if (short.length >= 20 && long.includes(short)) return true;
  const A = tokens(x);
  const B = tokens(y);
  if (A.size === 0 || B.size === 0) return false;
  const shared = [...A].filter((t) => B.has(t)).length;
  return shared / Math.min(A.size, B.size) >= 0.6;
}

function sameContradiction(p: ContradictionIR, q: ContradictionIR): boolean {
  return (
    (sameClaim(p.claimA?.text, q.claimA?.text) &&
      sameClaim(p.claimB?.text, q.claimB?.text)) ||
    (sameClaim(p.claimA?.text, q.claimB?.text) &&
      sameClaim(p.claimB?.text, q.claimA?.text))
  );
}

/** Appended once, so a carried contradiction reads as carried, not re-asserted. */
const CARRIED =
  "Carried forward: the intake loop did not re-state this contradiction on a later turn and nobody recorded it as resolved.";

/**
 * S-11 · The reasoner returns the full contradiction set each turn and it
 * replaces the previous one, so a contradiction it simply stops emitting is
 * gone — silently, and with no key to notice it by. Claims and statements
 * append; requirements and uncertainties are at least named (a label, an
 * id) so a disappearance is visible. A contradiction has neither.
 *
 * An unreconciled disagreement between stakeholders is exactly what must
 * not evaporate, so any prior contradiction with no counterpart in the new
 * set is carried forward with its own status intact and its note marked.
 * The corpus never lost one in 11 opportunities — this closes the shape,
 * not a measured failure.
 */
export function preserveContradictions(
  next: ContradictionIR[],
  before: ContradictionIR[],
): ContradictionIR[] {
  const carried = before
    .filter((prior) => !next.some((c) => sameContradiction(prior, c)))
    .map((prior) => ({
      ...prior,
      note: (prior.note ?? "").includes(CARRIED)
        ? prior.note
        : `${prior.note ? `${prior.note} ` : ""}${CARRIED}`,
    }));
  return [...next, ...carried];
}

/** All five backstops, applied to one reasoning turn's output. */
export function applyIntakeHygiene(
  next: Pick<
    HiringIntentIR,
    "requirements" | "uncertainties" | "contradictions"
  >,
  before: Pick<HiringIntentIR, "uncertainties" | "contradictions">,
  jdText: string | undefined,
  statements: ManagerStatement[],
): Pick<HiringIntentIR, "requirements" | "uncertainties" | "contradictions"> {
  return {
    requirements: narrowSharedStatements(
      dropWithdrawnRequirements(
        reconcileRequirementOrigins(next.requirements, jdText, statements),
      ),
    ),
    uncertainties: keepMarketComparisonsOpen(
      next.uncertainties,
      before.uncertainties,
    ),
    contradictions: preserveContradictions(
      next.contradictions,
      before.contradictions,
    ),
  };
}
