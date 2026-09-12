/**
 * The sourcing query language. One string, two compilation targets:
 *
 *  - `angles.ts` renders it into external engine syntax (web operators,
 *    OpenAlex filters, GitHub qualifiers), so one brief fans out across every
 *    connector at once;
 *  - `rank.ts` scores the people already in the workspace against it.
 *
 * Syntax
 *   robotics engineer "motion planning" filetype:pdf after:2022
 *   skill:perception -site:linkedin.com has:email loc:"bay area"
 *   (title:director OR title:"head of") org:stripe artifact:cv
 *
 * Bare words are keywords. `field:value` sets a filter; quote values with
 * spaces. A leading `-` negates any term or filter. Unknown fields fall back
 * to keywords rather than erroring, because a recruiter mid-flow should never
 * be stopped by a typo.
 *
 * Ported from Hu (`app/query/parser.py`).
 */
import {
  normalizeLocation,
  normalizeText,
  normalizeTitle,
  registrableDomain,
} from "@/lib/sourcing/normalize";
import {
  expand,
  matchCapabilities,
  matchLocations,
  resolveAlias,
  LOCATIONS as LOCATION_CONCEPTS,
  type Expansion,
} from "@/lib/sourcing/ontology";

/** Every spelling of every filter a recruiter might reach for. */
export const FIELD_ALIASES: Readonly<Record<string, string>> = {
  skill: "skill",
  skills: "skill",
  capability: "skill",
  capabilities: "skill",
  tech: "skill",
  expertise: "skill",
  title: "title",
  role: "title",
  job: "title",
  position: "title",
  org: "org",
  company: "org",
  employer: "org",
  institution: "org",
  affiliation: "org",
  school: "org",
  university: "org",
  loc: "loc",
  location: "loc",
  city: "loc",
  where: "loc",
  region: "loc",
  country: "loc",
  seniority: "seniority",
  level: "seniority",
  site: "site",
  domain: "site",
  host: "site",
  filetype: "filetype",
  ext: "filetype",
  format: "filetype",
  type: "artifact",
  artifact: "artifact",
  doc: "artifact",
  source: "source",
  connector: "source",
  after: "after",
  since: "after",
  from: "after",
  newer: "after",
  before: "before",
  until: "before",
  to: "before",
  older: "before",
  intitle: "intitle",
  inurl: "inurl",
  intext: "intext",
  has: "has",
  with: "has",
  lang: "lang",
  language: "lang",
  industry: "industry",
  sector: "industry",
  name: "name",
  person: "name",
};

/** Filetypes worth naming in a query, with the content types they imply. */
export const FILETYPE_CONTENT_TYPES: Readonly<
  Record<string, readonly string[]>
> = {
  pdf: ["application/pdf"],
  html: ["text/html", "application/xhtml+xml"],
  htm: ["text/html"],
  txt: ["text/plain"],
  doc: ["application/msword"],
  docx: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  ppt: ["application/vnd.ms-powerpoint"],
  pptx: [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ],
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  csv: ["text/csv"],
  json: ["application/json"],
  xml: ["application/xml", "text/xml"],
  rtf: ["application/rtf"],
};

export const HAS_FLAGS = new Set([
  "email",
  "contact",
  "phone",
  "publication",
  "paper",
  "repository",
  "repo",
  "patent",
  "cv",
  "resume",
  "portfolio",
  "talk",
  "orcid",
  "github",
  "website",
  "dataset",
  "personal_domain",
]);

/** `has:` synonyms collapse onto one canonical flag. */
const HAS_CANONICAL: Readonly<Record<string, string>> = {
  paper: "publication",
  repo: "repository",
  resume: "cv",
  website: "personal_domain",
};

export const ARTIFACT_ALIASES: Readonly<Record<string, string>> = {
  cv: "cv",
  resume: "resume",
  bio: "bio",
  profile: "bio",
  portfolio: "portfolio",
  repo: "repository",
  repository: "repository",
  paper: "publication",
  publication: "publication",
  pub: "publication",
  patent: "patent",
  talk: "talk",
  speaker: "conference_profile",
  conference: "conference_profile",
  team: "team_page",
  teampage: "team_page",
  directory: "directory_record",
  list: "directory_record",
  roster: "directory_record",
  dataset: "dataset",
  government: "government_record",
  social: "professional_social_profile",
};

/**
 * Words that carry no sourcing signal. Left in, they pollute keyword scoring
 * and surface as reasons like "mentions who" beside a candidate's name.
 */
export const QUERY_STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "of",
  "in",
  "on",
  "at",
  "to",
  "for",
  "with",
  "from",
  "by",
  "as",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "who",
  "whom",
  "whose",
  "which",
  "that",
  "this",
  "these",
  "those",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "can",
  "could",
  "would",
  "should",
  "will",
  "shall",
  "may",
  "might",
  "must",
  "find",
  "search",
  "looking",
  "look",
  "need",
  "want",
  "show",
  "get",
  "give",
  "me",
  "us",
  "my",
  "our",
  "you",
  "your",
  "i",
  "we",
  "they",
  "them",
  "someone",
  "somebody",
  "anyone",
  "people",
  "person",
  "candidate",
  "candidates",
  "professional",
  "professionals",
  "some",
  "any",
  "all",
  "whos",
  "there",
  "here",
  "it",
  "its",
  "their",
  "his",
  "her",
  "up",
  "out",
  "into",
  "over",
  "than",
  "then",
  "so",
  "such",
  "very",
  "good",
  "great",
  "best",
  "top",
  "strong",
  "ideal",
  "experience",
  "experienced",
  "background",
  "please",
  "help",
  "like",
  "about",
]);

export interface Term {
  text: string;
  phrase: boolean;
  negated: boolean;
  /** OR-group id; terms sharing an id are alternatives. */
  group: number;
}

export interface DateWindow {
  after: string | null;
  before: string | null;
}

/**
 * Verbs that turn what follows into the DOMAIN somebody works on rather than
 * a capability they must hold.
 *
 * "a technical recruiter who has hired robotics engineers" asks for a
 * recruiter. Reading robotics as a second requirement is how a search for the
 * people who hire engineers returns the engineers — the exact failure this
 * list exists to stop. It generalises past recruiting: "a sales leader selling
 * into hospitals" wants the seller, not the clinician.
 */
export const QUALIFYING_VERBS = [
  "hired",
  "hires",
  "hiring",
  "recruited",
  "recruits",
  "recruiting for",
  "sourced",
  "sources",
  "sourcing for",
  "placed",
  "places",
  "staffed",
  "sells to",
  "selling to",
  "sold to",
  "supports",
  "supporting",
  "serves",
  "serving",
  "advises",
  "advising",
  "works with",
  "worked with",
] as const;

export interface SourcingBrief {
  raw: string;
  terms: Term[];
  /** Ontology keys. */
  skills: string[];
  /** The same capabilities as the recruiter typed them. */
  skillTerms: string[];
  /**
   * Capabilities that name the domain worked ON rather than a capability held.
   * They add to a score and never subtract: their absence is not a gap.
   */
  qualifierSkills: string[];
  titles: string[];
  orgs: string[];
  locations: string[];
  seniority: string[];
  industries: string[];
  names: string[];
  includeSites: string[];
  excludeSites: string[];
  filetypes: string[];
  artifactTypes: string[];
  sources: string[];
  intitle: string[];
  inurl: string[];
  intext: string[];
  has: string[];
  languages: string[];
  window: DateWindow;
  expansions: Expansion[];
  /** Everything the parser could not honour, said plainly. */
  warnings: string[];
}

const TOKEN_RE =
  /(-)?(?:([A-Za-z_]+):(?:"([^"]*)"|([^\s()]+))|"([^"]*)"|(\()|(\))|([^\s()]+))/g;

/**
 * One token of the query language, exactly as typed.
 *
 * `parseQuery` folds these into a brief and throws the shape away. Callers
 * that need to know what the recruiter actually typed — whether a filter was
 * spelled out or merely inferred from prose — read the tokens instead, and
 * there is only ever the one tokenizer to disagree with.
 */
export interface QueryToken {
  /** Character offset in the raw string. */
  index: number;
  /** The token verbatim, leading `-` included. */
  raw: string;
  kind: "field" | "word" | "phrase" | "open" | "close" | "or" | "and" | "not";
  negated: boolean;
  /** The field alias as typed, for a `field` token; otherwise null. */
  field: string | null;
  /**
   * What that alias resolves to, or null when the grammar does not know it —
   * which is what separates a filter from a keyword with a colon in it.
   */
  canonicalField: string | null;
  /** A field token's value, or the body of a word or phrase. */
  value: string;
}

/** Split a query into tokens. Never throws; unknown syntax comes back as words. */
export function tokenizeQuery(text: string): QueryToken[] {
  const tokens: QueryToken[] = [];
  const raw = (text ?? "").trim();
  if (!raw) return tokens;

  TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TOKEN_RE.exec(raw)) !== null) {
    const fieldName = match[2];
    const fieldValue = match[3] ?? match[4];
    const phrase = match[5];
    const lparen = match[6];
    const rparen = match[7];
    const word = match[8];

    const base = {
      index: match.index,
      raw: match[0],
      negated: Boolean(match[1]),
      field: null,
      canonicalField: null,
    };

    if (word !== undefined) {
      const upper = word.toUpperCase();
      if (upper === "OR" || upper === "AND" || upper === "NOT") {
        tokens.push({
          ...base,
          kind: upper.toLowerCase() as "or" | "and" | "not",
          value: word,
        });
        continue;
      }
    }
    if (lparen !== undefined) {
      tokens.push({ ...base, kind: "open", value: "(" });
      continue;
    }
    if (rparen !== undefined) {
      tokens.push({ ...base, kind: "close", value: ")" });
      continue;
    }
    if (fieldName !== undefined) {
      tokens.push({
        ...base,
        kind: "field",
        field: fieldName,
        canonicalField: FIELD_ALIASES[fieldName.toLowerCase()] ?? null,
        value: fieldValue ?? "",
      });
      continue;
    }
    if (phrase !== undefined) {
      tokens.push({ ...base, kind: "phrase", value: phrase });
      continue;
    }
    if (word !== undefined) {
      tokens.push({ ...base, kind: "word", value: word });
    }
  }
  return tokens;
}

const REL_DATE_RE =
  /^(\d+)\s*(d|day|days|w|week|weeks|m|month|months|y|year|years)$/i;

function emptyBrief(raw: string): SourcingBrief {
  return {
    raw,
    terms: [],
    skills: [],
    skillTerms: [],
    qualifierSkills: [],
    titles: [],
    orgs: [],
    locations: [],
    seniority: [],
    industries: [],
    names: [],
    includeSites: [],
    excludeSites: [],
    filetypes: [],
    artifactTypes: [],
    sources: [],
    intitle: [],
    inurl: [],
    intext: [],
    has: [],
    languages: [],
    window: { after: null, before: null },
    expansions: [],
    warnings: [],
  };
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Accept YYYY, YYYY-MM, YYYY-MM-DD, DD/MM/YYYY, `2y`, `18months`, `today`. */
export function parseDate(value: string, now?: Date): string | null {
  const raw = (value ?? "").trim().replace(/^"|"$/g, "").toLowerCase();
  if (!raw) return null;
  const today = now ?? new Date();

  if (raw === "today" || raw === "now") return iso(today);
  if (raw === "yesterday") return iso(new Date(today.getTime() - 86_400_000));

  const rel = REL_DATE_RE.exec(raw);
  if (rel) {
    const n = Number(rel[1]);
    const perUnit: Record<string, number> = { d: 1, w: 7, m: 30, y: 365 };
    const days = perUnit[rel[2][0].toLowerCase()] * n;
    return iso(new Date(today.getTime() - days * 86_400_000));
  }

  let m = /^(\d{4})-(\d{2})-(\d{2})$|^(\d{4})\/(\d{2})\/(\d{2})$/.exec(raw);
  if (m) {
    const [y, mo, d] = m[1] ? [m[1], m[2], m[3]] : [m[4], m[5], m[6]];
    return `${y}-${mo}-${d}`;
  }
  m = /^(\d{2})[-/](\d{2})[-/](\d{4})$/.exec(raw);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = /^(\d{4})[-/](\d{2})$/.exec(raw);
  if (m) return `${m[1]}-${m[2]}-01`;
  m = /^(\d{4})$/.exec(raw);
  if (m) return `${m[1]}-01-01`;

  // Trailing-year fallback: "March 2021", "Published 2019".
  const year = /(19|20)\d{2}/.exec(raw);
  return year ? `${year[0]}-01-01` : null;
}

/**
 * True when `value` sits inside the window. Undated evidence is kept: a CV
 * with no date is still a CV. Recruiters filter to exclude known-stale
 * material, not to demand a date stamp.
 */
export function windowContains(
  window: DateWindow,
  value: string | null | undefined,
): boolean {
  if (!value || !String(value).trim()) return true;
  const parsed = parseDate(String(value));
  if (parsed === null) return true;
  if (window.after && parsed < window.after) return false;
  if (window.before && parsed > window.before) return false;
  return true;
}

export function windowIsSet(window: DateWindow): boolean {
  return window.after !== null || window.before !== null;
}

export function describeWindow(window: DateWindow): string {
  if (window.after && window.before)
    return `${window.after} .. ${window.before}`;
  if (window.after) return `since ${window.after}`;
  if (window.before) return `before ${window.before}`;
  return "any time";
}

/** `skill:robotics,perception` and `skill:robotics|perception` both work. */
function splitMulti(value: string): string[] {
  return value
    .split(/[,|]/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const key = v.toLowerCase().trim();
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(v.trim());
    }
  }
  return out;
}

function dedupeTerms(terms: Term[]): Term[] {
  const seen = new Set<string>();
  const out: Term[] = [];
  for (const t of terms) {
    const norm = normalizeText(t.text);
    const key = `${norm}|${t.negated}`;
    if (!norm || seen.has(key)) continue;
    // Quoted phrases are deliberate and always kept; bare stopwords are
    // scaffolding the recruiter did not mean as a search term.
    if (!t.phrase && !norm.includes(" ") && QUERY_STOPWORDS.has(norm)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

function applyField(
  brief: SourcingBrief,
  name: string,
  value: string,
  negated: boolean,
): void {
  const values = splitMulti(value);
  if (values.length === 0) return;

  for (const item of values) {
    switch (name) {
      case "skill": {
        const key = resolveAlias(item);
        brief.skillTerms.push(item);
        if (key) brief.skills.push(key);
        // Not in the ontology: still searchable as a literal keyword.
        else
          brief.terms.push({
            text: item,
            phrase: item.includes(" "),
            negated,
            group: 0,
          });
        break;
      }
      case "title":
        if (negated)
          brief.terms.push({
            text: item,
            phrase: item.includes(" "),
            negated: true,
            group: 0,
          });
        else brief.titles.push(normalizeTitle(item) || item);
        break;
      case "org":
        if (negated)
          brief.terms.push({
            text: item,
            phrase: item.includes(" "),
            negated: true,
            group: 0,
          });
        else brief.orgs.push(item);
        break;
      case "loc":
        brief.locations.push(normalizeLocation(item) || item);
        break;
      case "seniority":
        brief.seniority.push(normalizeText(item));
        break;
      case "industry":
        brief.industries.push(normalizeText(item));
        break;
      case "name":
        brief.names.push(item);
        break;
      case "site": {
        const host =
          registrableDomain(item.toLowerCase().replace(/^\*\./, "")) ||
          item.toLowerCase();
        (negated ? brief.excludeSites : brief.includeSites).push(host);
        break;
      }
      case "filetype": {
        const ft = item.toLowerCase().replace(/^\.+/, "");
        if (!(ft in FILETYPE_CONTENT_TYPES)) {
          brief.warnings.push(
            `filetype '${ft}' is not one Talent can read; ignored`,
          );
        } else {
          brief.filetypes.push(ft);
        }
        break;
      }
      case "artifact": {
        const probe = item.toLowerCase().replace(/[\s_]/g, "");
        brief.artifactTypes.push(
          ARTIFACT_ALIASES[probe] ?? item.toLowerCase().replace(/\s/g, "_"),
        );
        break;
      }
      case "source":
        brief.sources.push(item.toLowerCase());
        break;
      case "after": {
        const parsed = parseDate(item);
        if (parsed === null)
          brief.warnings.push(`could not read date '${item}' for after:`);
        else brief.window.after = parsed;
        break;
      }
      case "before": {
        const parsed = parseDate(item);
        if (parsed === null)
          brief.warnings.push(`could not read date '${item}' for before:`);
        else brief.window.before = parsed;
        break;
      }
      case "intitle":
        brief.intitle.push(item);
        break;
      case "inurl":
        brief.inurl.push(item);
        break;
      case "intext":
        brief.intext.push(item);
        break;
      case "has": {
        const raw = item.toLowerCase();
        const flag = HAS_CANONICAL[raw] ?? raw;
        if (HAS_FLAGS.has(flag)) brief.has.push(flag);
        else brief.warnings.push(`unknown has: flag '${item}'`);
        break;
      }
      case "lang":
        brief.languages.push(item.toLowerCase());
        break;
      default:
        break;
    }
  }
}

/** Parse a sourcing string into a brief. Never throws on input. */
export function parseQuery(
  text: string,
  options: { expand?: boolean } = {},
): SourcingBrief {
  const brief = emptyBrief((text ?? "").trim());
  if (!brief.raw) return brief;

  let group = 0;
  let pendingOr = false;
  let lastTermIndex: number | null = null;

  for (const token of tokenizeQuery(brief.raw)) {
    if (token.kind === "or") {
      pendingOr = true;
      continue;
    }
    if (token.kind === "and" || token.kind === "not") continue;
    if (token.kind === "open" || token.kind === "close") continue;

    if (token.kind === "field") {
      if (token.canonicalField === null) {
        // Unknown field: treat `foo:bar` as the keyword "foo:bar".
        brief.warnings.push(
          `unknown filter '${token.field}:' treated as a keyword`,
        );
        brief.terms.push({
          text: `${token.field}:${token.value}`,
          phrase: false,
          negated: token.negated,
          group: 0,
        });
        continue;
      }
      applyField(brief, token.canonicalField, token.value, token.negated);
      continue;
    }

    const body = token.value;
    if (!body) continue;

    let term: Term;
    if (pendingOr && lastTermIndex !== null) {
      const anchor = brief.terms[lastTermIndex];
      if (anchor.group === 0) {
        group += 1;
        anchor.group = group;
      }
      term = {
        text: body,
        phrase: token.kind === "phrase",
        negated: token.negated,
        group: anchor.group,
      };
      pendingOr = false;
    } else {
      term = {
        text: body,
        phrase: token.kind === "phrase",
        negated: token.negated,
        group: 0,
      };
    }
    brief.terms.push(term);
    lastTermIndex = brief.terms.length - 1;
  }

  brief.terms = dedupeTerms(brief.terms);
  brief.skills = dedupe(brief.skills);
  brief.skillTerms = dedupe(brief.skillTerms);
  brief.titles = dedupe(brief.titles);
  brief.orgs = dedupe(brief.orgs);
  brief.locations = dedupe(brief.locations);
  brief.includeSites = dedupe(brief.includeSites);
  brief.excludeSites = dedupe(brief.excludeSites);
  brief.filetypes = dedupe(brief.filetypes);
  brief.artifactTypes = dedupe(brief.artifactTypes);
  brief.has = dedupe(brief.has);

  // Free keywords that name a known capability get promoted, so
  // `robotics engineer` behaves like `skill:robotics title:engineer`.
  for (const term of positiveTerms(brief)) {
    const key = resolveAlias(term.text);
    if (key && !brief.skills.includes(key)) {
      brief.skills.push(key);
      brief.skillTerms.push(term.text);
    }
  }

  // Most capabilities are named in more than one word — "technical recruiter",
  // "sensor fusion", "functional safety". Matching a term at a time finds
  // neither half, so the occupation actually asked for drops out of the brief.
  // Phrase-match the free text as well.
  //
  // `consumed` collects the words that only carried meaning as part of a
  // longer phrase. Left as standalone keywords they score on their own and
  // surface as reasons like "mentions Bay" beside a person's name, which is
  // the same noise the stopword list exists to prevent.
  const consumed = new Set<string>();
  const free = positiveTerms(brief)
    .map((t) => t.text)
    .join(" ");
  for (const [key, surfaces] of Object.entries(matchCapabilities(free))) {
    for (const surface of surfaces) {
      const words = surface.split(" ");
      if (words.length > 1) for (const w of words) consumed.add(w);
    }
    if (!brief.skills.includes(key)) {
      brief.skills.push(key);
      brief.skillTerms.push(surfaces[0]);
    }
  }

  // Places named in prose fill the same field `loc:` does, so natural language
  // and the structured syntax compile to one brief.
  if (brief.locations.length === 0) {
    for (const { key, label } of matchLocations(brief.raw)) {
      for (const alias of LOCATION_CONCEPTS[key]?.aliases ?? []) {
        const words = normalizeText(alias).split(" ");
        if (
          words.length > 1 &&
          ` ${normalizeText(brief.raw)} `.includes(` ${normalizeText(alias)} `)
        ) {
          for (const w of words) consumed.add(w);
        }
      }
      const normalized = normalizeLocation(label) || label;
      if (!brief.locations.includes(normalized))
        brief.locations.push(normalized);
    }
  }

  if (consumed.size > 0) {
    brief.terms = brief.terms.filter((t) => {
      if (t.phrase || t.negated) return true;
      const norm = normalizeText(t.text);
      // A word that resolves to a capability on its own stays: it is a term
      // the recruiter meant, not a fragment of a longer one.
      return !consumed.has(norm) || resolveAlias(norm) !== null;
    });
  }

  markQualifiers(brief);

  if (options.expand !== false) expandedSkills(brief);
  return brief;
}

/**
 * Split the brief's capabilities into what the person must be and what they
 * must work on, by looking at what follows a qualifying verb in the raw text.
 */
function markQualifiers(brief: SourcingBrief): void {
  const raw = normalizeText(brief.raw);
  if (!raw) return;

  let cut = -1;
  for (const verb of QUALIFYING_VERBS) {
    const at = raw.indexOf(` ${normalizeText(verb)} `);
    if (at !== -1 && (cut === -1 || at < cut)) cut = at;
  }
  if (cut === -1) return;

  const tail = raw.slice(cut);
  const head = raw.slice(0, cut);
  const inHead = new Set(Object.keys(matchCapabilities(head)));
  const inTail = new Set(Object.keys(matchCapabilities(tail)));

  // Only demote when something survives as a requirement. A brief that is all
  // tail ("who has hired robotics engineers") still has to search for
  // something, so the qualifier stands in as the requirement.
  const requirements = brief.skills.filter(
    (k) => inHead.has(k) || !inTail.has(k),
  );
  if (requirements.length === 0) return;

  brief.qualifierSkills = brief.skills.filter((k) => !requirements.includes(k));
  brief.skills = requirements;
}

export function positiveTerms(brief: SourcingBrief): Term[] {
  return brief.terms.filter((t) => !t.negated);
}

export function negativeTerms(brief: SourcingBrief): Term[] {
  return brief.terms.filter((t) => t.negated);
}

export function keywords(brief: SourcingBrief): string[] {
  return positiveTerms(brief).map((t) => t.text);
}

/** Direct skills plus ontology-adjacent ones, each carrying its reason. */
export function expandedSkills(
  brief: SourcingBrief,
  minWeight = 0.55,
): Expansion[] {
  if (brief.expansions.length > 0) return brief.expansions;
  if (brief.skills.length === 0) return [];
  brief.expansions = expand(brief.skills, 1, minWeight);
  return brief.expansions;
}

export function briefIsEmpty(brief: SourcingBrief): boolean {
  return (
    brief.terms.length === 0 &&
    brief.skills.length === 0 &&
    brief.titles.length === 0 &&
    brief.orgs.length === 0 &&
    brief.locations.length === 0 &&
    brief.names.length === 0 &&
    brief.intitle.length === 0 &&
    brief.inurl.length === 0 &&
    brief.intext.length === 0 &&
    brief.industries.length === 0
  );
}

/** Everything a plain keyword engine should see, as one string. */
export function freeText(brief: SourcingBrief): string {
  const parts = [
    ...positiveTerms(brief).map((t) => (t.phrase ? `"${t.text}"` : t.text)),
    ...brief.skillTerms,
    ...brief.titles,
    ...brief.orgs,
    ...brief.names,
  ];
  return dedupe(parts).join(" ");
}

/** Human-readable rows for the "what Talent is doing" panel. */
export function describeBrief(brief: SourcingBrief): string[] {
  const rows: string[] = [];
  const kw = keywords(brief);
  if (kw.length > 0) rows.push(`keywords: ${kw.join(", ")}`);
  if (brief.skillTerms.length > 0)
    rows.push(`skills: ${brief.skillTerms.join(", ")}`);
  if (brief.qualifierSkills.length > 0) {
    rows.push(
      `works on (not a requirement): ${brief.qualifierSkills.join(", ")}`,
    );
  }
  if (brief.titles.length > 0) rows.push(`titles: ${brief.titles.join(", ")}`);
  if (brief.orgs.length > 0)
    rows.push(`organisations: ${brief.orgs.join(", ")}`);
  if (brief.locations.length > 0)
    rows.push(`locations: ${brief.locations.join(", ")}`);
  if (brief.seniority.length > 0)
    rows.push(`seniority: ${brief.seniority.join(", ")}`);
  if (brief.filetypes.length > 0)
    rows.push(`filetypes: ${brief.filetypes.join(", ")}`);
  if (brief.artifactTypes.length > 0)
    rows.push(`artifact types: ${brief.artifactTypes.join(", ")}`);
  if (windowIsSet(brief.window))
    rows.push(`time window: ${describeWindow(brief.window)}`);
  if (brief.includeSites.length > 0)
    rows.push(`restricted to: ${brief.includeSites.join(", ")}`);
  if (brief.excludeSites.length > 0)
    rows.push(`excluding: ${brief.excludeSites.join(", ")}`);
  if (brief.has.length > 0) rows.push(`must have: ${brief.has.join(", ")}`);
  const negatives = negativeTerms(brief);
  if (negatives.length > 0)
    rows.push(`excluding terms: ${negatives.map((t) => t.text).join(", ")}`);
  return rows;
}

/** Render a brief back to its canonical query string. */
export function unparseBrief(brief: SourcingBrief): string {
  const parts: string[] = [];
  for (const t of positiveTerms(brief))
    parts.push(t.phrase ? `"${t.text}"` : t.text);
  for (const s of brief.skillTerms)
    parts.push(s.includes(" ") ? `skill:"${s}"` : `skill:${s}`);
  for (const t of brief.titles)
    parts.push(t.includes(" ") ? `title:"${t}"` : `title:${t}`);
  for (const o of brief.orgs)
    parts.push(o.includes(" ") ? `org:"${o}"` : `org:${o}`);
  for (const l of brief.locations)
    parts.push(l.includes(" ") ? `loc:"${l}"` : `loc:${l}`);
  for (const s of brief.seniority) parts.push(`seniority:${s}`);
  for (const i of brief.industries) parts.push(`industry:${i}`);
  for (const f of brief.filetypes) parts.push(`filetype:${f}`);
  for (const a of brief.artifactTypes) parts.push(`artifact:${a}`);
  for (const h of brief.has) parts.push(`has:${h}`);
  for (const s of brief.includeSites) parts.push(`site:${s}`);
  for (const s of brief.excludeSites) parts.push(`-site:${s}`);
  if (brief.window.after) parts.push(`after:${brief.window.after}`);
  if (brief.window.before) parts.push(`before:${brief.window.before}`);
  for (const t of negativeTerms(brief))
    parts.push(t.phrase ? `-"${t.text}"` : `-${t.text}`);
  return parts.join(" ");
}
