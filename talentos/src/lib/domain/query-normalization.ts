/**
 * Pre- and post-composer normalization shared by every caller of the
 * validated composer (`composeQueries`), which itself stays untouched
 * (root CLAUDE.md: do not redesign the query composer).
 *
 * Before composition: term de-duplication across the vocabulary tiers and
 * profession-aware platform pruning driven by the strategy's named channels.
 * After composition: per-platform term budgets (Google truncates silently
 * past ~32 terms) resolved by re-composing with a sliced OR group — never by
 * trimming a string — cross-surface de-duplication by normalized text, and
 * deterministic QA warnings. Every transformation leaves a note on the row
 * so the String Lab can say what happened; a warning never hides a string.
 */
import {
  composeQueries,
  PLATFORM_TARGETS,
  type ComposedQuery,
  type StringLabInput,
} from "./search-strings";

export type PlatformTarget = (typeof PLATFORM_TARGETS)[number];

export interface NormalizationNote {
  code:
    | "or_group_duplicate"
    | "cross_list_duplicate"
    | "platform_pruned"
    | "budget_split"
    | "cross_surface_duplicate"
    | "within_platform_duplicate";
  message: string;
}

export interface QaWarning {
  code:
    | "over_budget"
    | "unbalanced_parens"
    | "unbalanced_quotes"
    | "dangling_operator"
    | "empty_group"
    | "doubled_operator"
    | "empty_site";
  message: string;
}

/** Persisted on `search_queries.qa_meta`. */
export interface QueryQaMeta {
  termCount: number;
  /** Set when a budget split produced this row. */
  part?: { index: number; of: number };
  notes: NormalizationNote[];
}

export interface ChannelLike {
  name: string;
  kind: string;
  url?: string | null;
  status?: string | null;
}

export interface ChannelCoverage {
  channelName: string;
  covered: boolean;
  /** Platform names or extra-query text that cover the channel. */
  via: string[];
}

export type PreparedQuery = ComposedQuery & { qa: QueryQaMeta };

/** Google truncates queries past roughly this many terms. */
export const GOOGLE_TERM_BUDGET = 32;

const PLATFORM_LINKEDIN_XRAY = "Google (LinkedIn x-ray)";
const PLATFORM_LINKEDIN_NATIVE = "LinkedIn (native boolean)";
const PLATFORM_GITHUB = "Google (GitHub x-ray)";
const PLATFORM_SCHOLAR = "Google (Scholar/arXiv x-ray)";
const PLATFORM_PORTFOLIO = "Google (portfolio x-ray)";
const PLATFORM_OPEN_WEB = "Google (open web)";

/** Surfaces every profession gets, regardless of the strategy's channels. */
const ALWAYS_KEPT = new Set([
  PLATFORM_LINKEDIN_XRAY,
  PLATFORM_LINKEDIN_NATIVE,
  PLATFORM_OPEN_WEB,
]);

// ── Term-level normalization ────────────────────────────────────────────────

/** Case-insensitive de-duplication, also dropping anything in `against`. */
export function dedupeTerms(terms: string[], against: string[] = []): string[] {
  const seen = new Set(against.map((t) => t.trim().toLowerCase()));
  const out: string[] = [];
  for (const term of terms) {
    const key = term.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(term.trim());
  }
  return out;
}

function noteDrops(
  code: NormalizationNote["code"],
  list: string,
  before: string[],
  after: string[],
  notes: NormalizationNote[],
) {
  const dropped = before.length - after.length;
  if (dropped > 0) {
    notes.push({
      code,
      message: `${list}: dropped ${dropped} duplicate term${dropped === 1 ? "" : "s"}`,
    });
  }
}

/**
 * De-duplicate every vocabulary list, and drop cross-tier repeats:
 * alternates against primaries, adjacents against both, any-of against
 * must-have, credentials against both, exclusions against everything that
 * is required (a term cannot be both required and negated).
 */
export function normalizeStringLabInput(input: StringLabInput): {
  input: StringLabInput;
  notes: NormalizationNote[];
} {
  const notes: NormalizationNote[] = [];
  const nonEmpty = (list: string[]) => list.filter((t) => t.trim() !== "");

  const titles = dedupeTerms(nonEmpty(input.titles));
  noteDrops(
    "or_group_duplicate",
    "titles",
    nonEmpty(input.titles),
    titles,
    notes,
  );

  const alternateTitles = dedupeTerms(nonEmpty(input.alternateTitles), titles);
  noteDrops(
    "cross_list_duplicate",
    "alternate titles",
    nonEmpty(input.alternateTitles),
    alternateTitles,
    notes,
  );

  const adjacentTitles = dedupeTerms(nonEmpty(input.adjacentTitles), [
    ...titles,
    ...alternateTitles,
  ]);
  noteDrops(
    "cross_list_duplicate",
    "adjacent titles",
    nonEmpty(input.adjacentTitles),
    adjacentTitles,
    notes,
  );

  const mustHave = dedupeTerms(nonEmpty(input.mustHave));
  noteDrops(
    "or_group_duplicate",
    "must-have",
    nonEmpty(input.mustHave),
    mustHave,
    notes,
  );

  const anyOf = dedupeTerms(nonEmpty(input.anyOf), mustHave);
  noteDrops(
    "cross_list_duplicate",
    "any-of",
    nonEmpty(input.anyOf),
    anyOf,
    notes,
  );

  const credentials = dedupeTerms(nonEmpty(input.credentials), [
    ...mustHave,
    ...anyOf,
  ]);
  noteDrops(
    "cross_list_duplicate",
    "credentials",
    nonEmpty(input.credentials),
    credentials,
    notes,
  );

  const locations = dedupeTerms(nonEmpty(input.locations));
  noteDrops(
    "or_group_duplicate",
    "locations",
    nonEmpty(input.locations),
    locations,
    notes,
  );

  const companies = dedupeTerms(nonEmpty(input.companies));
  noteDrops(
    "or_group_duplicate",
    "companies",
    nonEmpty(input.companies),
    companies,
    notes,
  );

  const required = [
    ...titles,
    ...alternateTitles,
    ...adjacentTitles,
    ...mustHave,
    ...anyOf,
    ...credentials,
  ];
  const exclusions = dedupeTerms(nonEmpty(input.exclusions), required);
  const droppedExclusions =
    nonEmpty(input.exclusions).length - exclusions.length;
  if (droppedExclusions > 0) {
    notes.push({
      code: "cross_list_duplicate",
      message: `exclusions: dropped ${droppedExclusions} term${droppedExclusions === 1 ? "" : "s"} that ${droppedExclusions === 1 ? "is" : "are"} also required`,
    });
  }

  return {
    input: {
      titles,
      alternateTitles,
      adjacentTitles,
      mustHave,
      anyOf,
      credentials,
      locations,
      companies,
      exclusions,
    },
    notes,
  };
}

// ── String-level QA ─────────────────────────────────────────────────────────

/**
 * Term count as the engines see it: whitespace tokens minus bare operators
 * and parentheses. Identical to artifact-src/core/query-compiler.ts.
 */
export function countTerms(query: string): number {
  return query
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(
      (t) =>
        t && t !== "OR" && t !== "AND" && t !== "NOT" && t !== "(" && t !== ")",
    ).length;
}

/** Term budget per platform; null when the platform has no known limit. */
export function termBudgetFor(platform: string): number | null {
  return /^google\b/i.test(platform.trim()) ? GOOGLE_TERM_BUDGET : null;
}

/** Lowercase, collapse whitespace, trim — the cross-surface identity key. */
export function normalizeQueryKey(query: string): string {
  return query.toLowerCase().replace(/\s+/g, " ").trim();
}

export function qaQuery(query: string, platform: string): QaWarning[] {
  const warnings: QaWarning[] = [];
  const opens = (query.match(/\(/g) ?? []).length;
  const closes = (query.match(/\)/g) ?? []).length;
  if (opens !== closes) {
    warnings.push({
      code: "unbalanced_parens",
      message: `${opens} opening vs ${closes} closing parentheses`,
    });
  }
  const quotes = (query.match(/"/g) ?? []).length;
  if (quotes % 2 !== 0) {
    warnings.push({
      code: "unbalanced_quotes",
      message: `${quotes} quotation marks (odd count)`,
    });
  }
  const trimmed = query.trim();
  if (/^(OR|AND)\b/.test(trimmed) || /\b(OR|AND)$/.test(trimmed)) {
    warnings.push({
      code: "dangling_operator",
      message: "query starts or ends with an operator",
    });
  }
  if (
    /\b(OR|AND)\s+(OR|AND)\b/.test(trimmed) ||
    /\(\s*(OR|AND)\b/.test(trimmed) ||
    /\b(OR|AND)\s*\)/.test(trimmed)
  ) {
    warnings.push({
      code: "doubled_operator",
      message: "operator next to another operator or a parenthesis",
    });
  }
  if (/\(\s*\)/.test(trimmed)) {
    warnings.push({ code: "empty_group", message: "empty parentheses" });
  }
  if (/\bsite:(\s|$|\))/.test(trimmed)) {
    warnings.push({ code: "empty_site", message: "site: with no domain" });
  }
  const budget = termBudgetFor(platform);
  const terms = countTerms(query);
  if (budget !== null && terms > budget) {
    warnings.push({
      code: "over_budget",
      message: `${terms} terms exceeds the ${budget}-term budget for ${platform}`,
    });
  }
  return warnings;
}

// ── Profession-aware platform pruning ──────────────────────────────────────

function channelText(channel: ChannelLike): string {
  return `${channel.name} ${channel.url ?? ""}`.toLowerCase();
}

function activeChannels(channels: ChannelLike[]): ChannelLike[] {
  return channels.filter((c) => c.status !== "rejected");
}

/** Specific surfaces a channel implies (beyond the always-kept three). */
function impliedPlatforms(channel: ChannelLike): string[] {
  const text = channelText(channel);
  const kind = channel.kind.toLowerCase();
  const out = new Set<string>();
  if (kind === "open_source" || /github/.test(text)) out.add(PLATFORM_GITHUB);
  if (
    ["publication", "conference", "database", "university"].includes(kind) ||
    /scholar|arxiv|openreview/.test(text)
  ) {
    out.add(PLATFORM_SCHOLAR);
  }
  if (kind === "portfolio" || /behance|dribbble/.test(text)) {
    out.add(PLATFORM_PORTFOLIO);
  }
  if (/linkedin/.test(text)) {
    out.add(PLATFORM_LINKEDIN_XRAY);
    out.add(PLATFORM_LINKEDIN_NATIVE);
  }
  return [...out];
}

const PRUNE_REASONS: Record<string, string> = {
  [PLATFORM_GITHUB]: "no open-source or GitHub channel in the strategy",
  [PLATFORM_SCHOLAR]:
    "no publication, conference, database or university channel in the strategy",
  [PLATFORM_PORTFOLIO]: "no portfolio channel in the strategy",
};

/**
 * Filter the platform matrix by the profession's channel ecosystem. The
 * three universal surfaces always stay. With no channels at all every
 * surface is emitted and a note says why.
 */
export function platformsForChannels(channels: ChannelLike[]): {
  kept: PlatformTarget[];
  pruned: { platform: string; reason: string }[];
  notes: NormalizationNote[];
} {
  const active = activeChannels(channels);
  if (active.length === 0) {
    return {
      kept: [...PLATFORM_TARGETS],
      pruned: [],
      notes: [
        {
          code: "platform_pruned",
          message: "no channels yet, all surfaces emitted",
        },
      ],
    };
  }
  const implied = new Set(active.flatMap(impliedPlatforms));
  const kept: PlatformTarget[] = [];
  const pruned: { platform: string; reason: string }[] = [];
  for (const target of PLATFORM_TARGETS) {
    if (ALWAYS_KEPT.has(target.platform) || implied.has(target.platform)) {
      kept.push(target);
    } else {
      pruned.push({
        platform: target.platform,
        reason: PRUNE_REASONS[target.platform] ?? "not implied by any channel",
      });
    }
  }
  return {
    kept,
    pruned,
    notes: pruned.map((p) => ({
      code: "platform_pruned",
      message: `${p.platform} skipped: ${p.reason}`,
    })),
  };
}

// ── Budget fitting ──────────────────────────────────────────────────────────

const SLICEABLE: Array<keyof StringLabInput> = [
  "anyOf",
  "alternateTitles",
  "locations",
];

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/**
 * Re-compose an over-budget query as parts by slicing its largest OR list
 * (never must-have terms). Every part is produced by the composer itself
 * with the same platform and breadth, so the site group and every required
 * term survive. When no slicing fits, the original row is kept with an
 * `over_budget` warning — a string is never truncated.
 */
export function fitToBudget(
  composed: ComposedQuery[],
  input: StringLabInput,
  platforms: PlatformTarget[],
): PreparedQuery[] {
  const out: PreparedQuery[] = [];
  for (const row of composed) {
    const budget = termBudgetFor(row.platform);
    const termCount = countTerms(row.query);
    if (budget === null || termCount <= budget) {
      out.push({ ...row, qa: { termCount, notes: [] } });
      continue;
    }
    const target = platforms.find((p) => p.platform === row.platform);
    const parts = target ? splitRow(row, input, target, budget) : null;
    if (!parts) {
      out.push({
        ...row,
        qa: {
          termCount,
          notes: [
            {
              code: "budget_split",
              message: `${termCount} terms over the ${budget}-term budget and no OR group could be sliced to fit; kept whole`,
            },
          ],
        },
      });
      continue;
    }
    parts.forEach((part, index) => {
      out.push({
        ...part,
        qa: {
          termCount: countTerms(part.query),
          part: { index: index + 1, of: parts.length },
          notes: [
            {
              code: "budget_split",
              message: `split into ${parts.length} parts to fit the ${budget}-term budget (part ${index + 1} of ${parts.length})`,
            },
          ],
        },
      });
    });
  }
  return out;
}

function splitRow(
  row: ComposedQuery,
  input: StringLabInput,
  target: PlatformTarget,
  budget: number,
): ComposedQuery[] | null {
  const candidates = SLICEABLE.map((key) => ({ key, terms: input[key] }))
    .filter((c) => c.terms.length > 1)
    .sort((a, b) => b.terms.length - a.terms.length);
  for (const candidate of candidates) {
    for (let size = candidate.terms.length - 1; size >= 1; size -= 1) {
      const parts: ComposedQuery[] = [];
      let fits = true;
      let changed = false;
      for (const slice of chunk(candidate.terms, size)) {
        const recomposed = composeQueries(
          { ...input, [candidate.key]: slice },
          [target],
        ).find((q) => q.breadth === row.breadth);
        if (!recomposed) {
          fits = false;
          break;
        }
        if (recomposed.query !== row.query) changed = true;
        if (countTerms(recomposed.query) > budget) {
          fits = false;
          break;
        }
        parts.push(recomposed);
      }
      if (!changed) break; // this list does not appear in this breadth
      if (fits && parts.length > 1) return parts;
    }
  }
  return null;
}

// ── Cross-surface de-duplication ───────────────────────────────────────────

/** First occurrence wins in input order (platform order, then breadth). */
export function dedupeAcrossSurfaces<
  T extends { platform: string; query: string },
>(
  queries: T[],
): {
  kept: T[];
  dropped: { platform: string; query: string; duplicateOf: string }[];
} {
  const seen = new Map<string, T>();
  const kept: T[] = [];
  const dropped: { platform: string; query: string; duplicateOf: string }[] =
    [];
  for (const q of queries) {
    const key = normalizeQueryKey(q.query);
    const first = seen.get(key);
    if (first) {
      dropped.push({
        platform: q.platform,
        query: q.query,
        duplicateOf: first.platform,
      });
      continue;
    }
    seen.set(key, q);
    kept.push(q);
  }
  return { kept, dropped };
}

// ── Coverage ───────────────────────────────────────────────────────────────

const TOKEN_STOPLIST = new Set([
  "google",
  "program",
  "programs",
  "directory",
  "directories",
  "industry",
  "official",
  "online",
  "search",
  "network",
  "networks",
  "community",
  "communities",
  "group",
  "groups",
  "https",
  "http",
  "www",
]);

function channelTokens(channel: ChannelLike): string[] {
  const words = channel.name.toLowerCase().split(/[^a-z0-9]+/);
  let host = "";
  if (channel.url) {
    try {
      host = new URL(channel.url).hostname.toLowerCase();
    } catch {
      host = "";
    }
  }
  const hostLabels = host.split(".").filter((l) => l.length >= 4);
  return [...words, ...hostLabels].filter(
    (t) => t.length >= 4 && !TOKEN_STOPLIST.has(t),
  );
}

/**
 * A channel is covered when a surface it implies has at least one query, or
 * when a query's text mentions a token from its name or host. Rejected
 * channels are skipped.
 */
export function channelCoverage(
  channels: ChannelLike[],
  queries: { id?: string; platform: string; query: string }[],
): ChannelCoverage[] {
  const platformsWithQueries = new Set(queries.map((q) => q.platform));
  return activeChannels(channels).map((channel) => {
    const via = new Set<string>();
    for (const platform of impliedPlatforms(channel)) {
      if (platformsWithQueries.has(platform)) via.add(platform);
    }
    const tokens = channelTokens(channel);
    for (const q of queries) {
      const text = q.query.toLowerCase();
      if (tokens.some((t) => text.includes(t))) via.add(q.platform);
    }
    return { channelName: channel.name, covered: via.size > 0, via: [...via] };
  });
}

// ── Orchestrator ───────────────────────────────────────────────────────────

export interface PrepareResult {
  rows: PreparedQuery[];
  pruned: { platform: string; reason: string }[];
  droppedDuplicates: { platform: string; query: string; duplicateOf: string }[];
  inputNotes: NormalizationNote[];
}

/**
 * The one path both callers use: normalize the vocabulary, prune platforms
 * by channel ecosystem, compose, fit to budget, drop cross-surface
 * duplicates, attach QA metadata. Extras (platform-specific strings the
 * model wrote directly) are QA'd and de-duplicated but never re-composed.
 */
export function prepareQueries(args: {
  input: StringLabInput;
  extras?: ComposedQuery[];
  channels: ChannelLike[];
}): PrepareResult {
  const { input, notes: inputNotes } = normalizeStringLabInput(args.input);
  const platforms = platformsForChannels(args.channels);
  const composed = composeQueries(input, platforms.kept);
  const fitted = fitToBudget(composed, input, platforms.kept);
  const extras: PreparedQuery[] = (args.extras ?? [])
    .filter((q) => q.query.trim() !== "")
    .map((q) => ({ ...q, qa: { termCount: countTerms(q.query), notes: [] } }));
  const { kept, dropped } = dedupeAcrossSurfaces([...fitted, ...extras]);
  return {
    rows: kept,
    pruned: platforms.pruned,
    droppedDuplicates: dropped,
    inputNotes: [...inputNotes, ...platforms.notes],
  };
}
