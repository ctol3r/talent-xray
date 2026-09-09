/**
 * Does this string name a human, or is it page furniture?
 *
 * A public API's "title" field is whatever the record happened to carry, and a
 * search that turns "Our Team", "Field Robotics Summit" or "Q7259" into people
 * has invented candidates. That is worse than finding nobody: it puts rows on a
 * shortlist that cannot be contacted, corroborated or removed.
 *
 * Ported from Hu (`app/extract/normalize.py::looks_like_person_name`).
 */
import { collapseWs } from "@/lib/sourcing/normalize";

/** Words that name a body, an event or a page — never a human. */
export const NOT_A_NAME_TOKENS: ReadonlySet<string> = new Set([
  "the",
  "our",
  "team",
  "about",
  "contact",
  "read",
  "more",
  "view",
  "profile",
  "home",
  "search",
  "menu",
  "all",
  "we",
  "us",
  "you",
  "your",
  "learn",
  "privacy",
  "terms",
  "cookie",
  "copyright",
  "sign",
  "log",
  "skip",
  "main",
  "leadership",
  "people",
  "staff",
  "faculty",
  "directory",
  "members",
  "engineering",
  "research",
  "products",
  "careers",
  "jobs",
  "news",
  "blog",
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "university",
  "institute",
  "college",
  "school",
  "department",
  "center",
  "centre",
  "summit",
  "conference",
  "symposium",
  "congress",
  "workshop",
  "forum",
  "group",
  "chambers",
  "industries",
  "capital",
  "architects",
  "partners",
  "associates",
  "holdings",
  "limited",
  "ltd",
  "inc",
  "llc",
  "llp",
  "plc",
  "corporation",
  "company",
  "foundation",
  "trust",
  "society",
  "association",
  "council",
  "committee",
  "board",
  "programme",
  "program",
  "awards",
  "award",
  "medal",
  "prize",
  "recipients",
  "winners",
  "roster",
  "list",
  "solutions",
  "systems",
  "technologies",
  "labs",
  "laboratory",
  "studio",
  "consulting",
  "consultancy",
  "ventures",
  "advisors",
  "advisers",
  "agency",
  "clinic",
  "hospital",
  "surgery",
  "practice",
  "network",
  "alliance",
  "edition",
  "series",
  "session",
  "panel",
  "track",
  "journal",
  "proceedings",
  "volume",
  "issue",
  "abstract",
  "chapter",
  "wikipedia",
  "wikidata",
  // Day and part labels — "Day Two", "Session Three", "Part One" are headings.
  "day",
  "part",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
]);

/**
 * Words that end an ORGANISATION's name, never a person's.
 *
 * Legal forms and facility words. A capitalised two- or three-word phrase is
 * the commonest thing on a professional page that is not a person, and the
 * last word is usually what gives it away: "Vestfjell Kraft ASA", "Tanjung
 * Sari Terminal", "Harmattan Mills".
 */
const ORGANISATION_TAILS: ReadonlySet<string> = new Set([
  "asa",
  "as",
  "ab",
  "oy",
  "oyj",
  "bv",
  "nv",
  "sa",
  "sas",
  "srl",
  "spa",
  "plc",
  "ltd",
  "llc",
  "llp",
  "lp",
  "inc",
  "gmbh",
  "ag",
  "kg",
  "pty",
  "kk",
  "aps",
  "kft",
  "sarl",
  "sl",
  "co",
  "corp",
  "cic",
  "cio",
  "terminal",
  "mills",
  "works",
  "foundry",
  "refinery",
  "plant",
  "depot",
  "campus",
  "yard",
  "quay",
  "docks",
  "warehouse",
  "exchange",
  "chambers",
  "collective",
  "cooperative",
  "studio",
  "atelier",
  "taller",
  "data",
  "office",
  "authority",
  "agency",
  "bureau",
  "commission",
  "board",
  "council",
  "department",
  "division",
  "directorate",
  "ministry",
  "service",
  "services",
  "solutions",
  "industries",
  "logistics",
  "aggregates",
  "quarry",
  "mining",
  "ballast",
  "holdings",
  "ventures",
  "capital",
  "consulting",
  "consultancy",
]);

/**
 * Words that end a LABEL, never a person's name.
 *
 * Directory rows and CV section heads read as names otherwise — "Technical
 * Director", "Status Registered", "National Medical Register", "Advanced
 * Resuscitation Instructor Certificate".
 */
const LABEL_TAILS: ReadonlySet<string> = new Set([
  "director",
  "manager",
  "officer",
  "engineer",
  "scientist",
  "consultant",
  "analyst",
  "specialist",
  "coordinator",
  "supervisor",
  "administrator",
  "register",
  "registry",
  "registered",
  "registration",
  "certificate",
  "certification",
  "licence",
  "license",
  "membership",
  "grade",
  "status",
  "indemnity",
  "duties",
  "responsibilities",
  "qualifications",
  "experience",
  "education",
  "publications",
  "references",
  "summary",
  "profile",
  "skills",
  "training",
  "awards",
  "interests",
  "affiliations",
  "appointments",
]);

/** Plural common nouns a heading ends with. A surname is not one of these. */
const PLURAL_LABELS: ReadonlySet<string> = new Set([
  "notes",
  "resources",
  "questions",
  "answers",
  "details",
  "records",
  "results",
  "reports",
  "documents",
  "downloads",
  "updates",
  "changes",
  "highlights",
  "sessions",
  "tracks",
  "topics",
  "themes",
  "areas",
  "sites",
  "locations",
  "regions",
  "contacts",
  "enquiries",
  "inquiries",
  "hours",
  "policies",
  "standards",
  "guidelines",
  "procedures",
  "conditions",
  "requirements",
  "criteria",
  "benefits",
  "features",
  "options",
  "packages",
  "prices",
  "fees",
  "rates",
  "terms",
  "faqs",
  "links",
  "tools",
  "guides",
]);

/** Joining words a label uses and a name does not. */
const LABEL_JOINERS: ReadonlySet<string> = new Set([
  "and",
  "or",
  "of",
  "for",
  "in",
  "on",
  "with",
  "to",
  "at",
  "by",
]);

/** True when the string reads as a personal name rather than page furniture. */
export function looksLikePersonName(candidate: string): boolean {
  const cleaned = collapseWs(candidate ?? "");
  if (!cleaned) return false;
  // Commas, slashes and pipes mean a list or a header row, not a name.
  if (/[,;|/\\]/.test(cleaned)) return false;
  // A question is a heading. "Who Maintains This Register?" is not somebody.
  if (/[?!]/.test(cleaned)) return false;

  const tokens = cleaned.split(" ");
  if (tokens.length < 2 || tokens.length > 4) return false;

  // A heading shouts; a name does not. "VERSION HISTORY" passes every other
  // test here because each token does start with a capital.
  if (cleaned === cleaned.toUpperCase() && /[A-Z]{2,}/.test(cleaned))
    return false;

  const lower = tokens.map((t) =>
    t.replace(/^[.,]+|[.,]+$/g, "").toLowerCase(),
  );
  const last = lower[lower.length - 1];
  if (ORGANISATION_TAILS.has(last)) return false;
  if (LABEL_TAILS.has(last)) return false;
  // "Site Managers", "Design Notes", "Human Resources" — a heading names a
  // category in the plural. A surname almost never is one of these words.
  if (last.endsWith("s") && !last.endsWith("ss")) {
    const singular = last.slice(0, -1);
    if (LABEL_TAILS.has(singular) || ORGANISATION_TAILS.has(singular))
      return false;
    if (PLURAL_LABELS.has(last)) return false;
  }
  // "Registration And Indemnity" joins with a capitalised conjunction; a name
  // does not. Particles like "van" and "de" stay lowercase in the original and
  // are allowed through below.
  for (let i = 1; i < tokens.length - 1; i += 1) {
    if (LABEL_JOINERS.has(lower[i]) && /^[A-Z]/.test(tokens[i])) return false;
  }

  for (const token of tokens) {
    const bare = token.replace(/^[.,]+|[.,]+$/g, "");
    if (!bare) return false;
    if (NOT_A_NAME_TOKENS.has(bare.toLowerCase())) return false;
    if (/\d/.test(token)) return false;
    // A name's every part starts with a capital. Particles are the exception a
    // Western-shaped rule gets wrong most often, so they are allowed through.
    const particle = [
      "van",
      "von",
      "de",
      "der",
      "den",
      "del",
      "della",
      "di",
      "da",
      "dos",
      "du",
      "la",
      "le",
      "bin",
      "ibn",
      "al",
      "el",
      "ter",
      "op",
    ];
    if (!/^[A-ZÀ-Þ]/.test(token) && !particle.includes(bare.toLowerCase()))
      return false;
  }
  return true;
}
