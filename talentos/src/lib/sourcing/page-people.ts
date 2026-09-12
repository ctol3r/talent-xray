/**
 * Reading people out of a professional page.
 *
 * The input is text somebody supplied — a page they pasted, a document they
 * uploaded, an import. The output is the people on it and what the page says
 * about each. Nothing here fetches anything.
 *
 * The whole difficulty is refusal. A page has furniture, headings, product
 * names and award names that all look like people, and a reader that takes
 * them puts rows on a shortlist that nobody can contact, corroborate or
 * remove — worse than finding nobody. So the shape of this module is: find
 * candidates cheaply, then spend the effort on throwing them out.
 *
 * Six failures it is built against, each one a trap in
 * `tests/fixtures/page-corpus.json`:
 *
 *  1. furniture read as a person ("Our Team", "Back To Top", a section head)
 *  2. the page's own organisation read as everybody's employer — the mistake
 *     that makes every conference speaker work for the conference
 *  3. a two- or three-person roster read as one person, or none
 *  4. people in a table missed entirely by a reader that only knows prose
 *  5. a job advert or a call for papers read as people who DO the work
 *  6. a single-person page read as empty because there is no list
 */
import {
  collapseLines,
  normalizeText,
  urlDomain,
} from "@/lib/sourcing/normalize";
import {
  conceptLabel,
  matchCapabilities,
  matchLocations,
} from "@/lib/sourcing/ontology";
import { looksLikePersonName } from "@/lib/sourcing/person-name";

export type PageKind = "roster" | "person" | "document" | "not_people";

export interface ExtractedPerson {
  name: string;
  title: string | null;
  organization: string | null;
  location: string | null;
  /** Only addresses printed on the page. Never a pattern. */
  emails: string[];
  /** Ontology keys the block's own words matched. */
  capabilities: string[];
  /** The lines this person was read from, so every claim can cite one. */
  quote: string;
}

export interface PageReading {
  kind: PageKind;
  /** Why it was read that way, in one line, for the recruiter to disagree with. */
  why: string;
  people: ExtractedPerson[];
  /** The organisation the page belongs to, when it has one it can lend. */
  pageOrganization: string | null;
}

// --------------------------------------------------------------------------
// furniture

/** Lines that are never about a person, however name-shaped they look. */
const FURNITURE = [
  /^back to top$/i,
  /^(home|menu|search|skip to|share|print|subscribe|sign in|log in|register)\b/i,
  /^(privacy|cookie|terms|accessibility|modern slavery|sitemap|legal)\b/i,
  /\bcookies?\b.*\b(essential|consent|preferences|stored|switch)/i,
  /^©|\ball rights reserved\b/i,
  /^\[photo[:\]]/i,
  /^(next|previous|page \d+|read more|view all|load more|show more)\b/i,
  /^(follow us|connect with us|newsletter)\b/i,
];

/** A navigation strip: several short segments split by a separator. */
function isNavigation(line: string): boolean {
  const parts = line.split(/\s+[·|›»]\s+|\s+\|\s+/).map((p) => p.trim());
  if (parts.length < 3) return false;
  return parts.every((p) => p.length > 0 && p.length < 26 && !/[.!?]$/.test(p));
}

function isFurniture(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (FURNITURE.some((pattern) => pattern.test(trimmed))) return true;
  if (isNavigation(trimmed)) return true;
  return false;
}

// --------------------------------------------------------------------------
// page kind

/** Words in a page's own title that say it belongs to an organisation. */
const ROSTER_TITLE =
  /\b(team|people|leadership|staff|faculty|directory|partners|members|board|our (people|team)|who we are|colleagues|practitioners|contributors|maintainers|squad|committee|roster)\b/i;
/**
 * Pages where the page's own organisation is NOT the people's employer. A
 * speaker works for their own employer; a winner works for their own employer.
 * Lending the page's name to them is the single most common extraction lie.
 */
const THIRD_PARTY =
  /\b(conference|summit|symposium|congress|programme|program|speakers?|keynote|awards?|winners?|honou?rees?|recipients?|shortlist|festival|meetup|workshop|panel|jury)\b/i;
/** A page asking for people, not describing them. */
const WANTED =
  /\b(we are hiring|now hiring|join our team|apply now|job description|vacanc|call for (papers|abstracts|submissions)|deadline for submissions|how to apply|open roles?|current openings)\b/i;

const EMAIL_RE = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi;

function pageOrganizationFrom(title: string, url: string): string | null {
  // "Leadership — Vestfjell Kraft ASA" → the organisation is after the dash.
  const parts = title
    .split(/\s+[—–|·-]\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const named = parts.find((p) => !ROSTER_TITLE.test(p) && p.length > 2);
  if (named) return named;
  const host = urlDomain(url);
  return host ? host.replace(/^www\./, "") : null;
}

// --------------------------------------------------------------------------
// table rows

/** `Name | Practice | Office | email` — people in a table, not in prose. */
function readTableRow(line: string): { cells: string[] } | null {
  const cells = line.split(/\s*\|\s*/).map((c) => c.trim());
  if (cells.length < 3) return null;
  if (!looksLikePersonName(cells[0])) return null;
  return { cells };
}

// --------------------------------------------------------------------------
// blocks

interface Block {
  name: string;
  /** Everything the page says next to that name. */
  text: string;
}

/** A role label printed before the name on a programme or a minute. */
const LEADING_LABEL =
  /^(chair|co-?chair|speaker|presenter|discussant|moderator|panellist|panelist|host|author|inventor|maintainer|lead|pi|principal investigator|supervisor|contact|attendee|apologies|present|by)\s*[:\-–—]\s*/i;

/**
 * A form field's label, colon-separated or aligned with spaces.
 *
 * Tender annexes, register entries and application forms all lay a person out
 * as labelled rows rather than prose, and the label is not part of the name.
 */
const FIELD_LABEL =
  /^(name|full name|role|title|position|post|employer|organisation|organization|company|firm|contact|email|e-mail|telephone|phone)\b\s*[:\s]\s*/i;

/** A trailing post-nominal: initials or a fellowship, in capitals. */
const POST_NOMINAL =
  /\s+(?:[A-Z]{2,6}|[A-Z]\.(?:[A-Z]\.)+)(?:\s*,\s*(?:[A-Z]{2,6}|[A-Z]\.(?:[A-Z]\.)+))*$/;

/**
 * The name in a line, wherever the page put it.
 *
 * One line carries a name in a dozen shapes: bare, before a dash with the role
 * after it, AFTER a dash with a code-host handle before it, behind a "Chair:"
 * label, or trailing a fellowship. Trying only the first segment found the
 * first shape and missed the rest, which is most of a real corpus.
 */
function nameIn(line: string): { name: string; rest: string } | null {
  const cleaned = line
    .replace(LEADING_LABEL, "")
    // A field label on a form-shaped row, colon-separated or space-aligned:
    // "Name: Ndileka Zwane", "Name             Ndileka Zwane".
    .replace(/^[A-Z][a-z]{2,14}:\s*/, "")
    .replace(FIELD_LABEL, "")
    .trim();
  const segments = cleaned
    .split(/\s+[—–]\s+|\s+\|\s+|\s+\/\s+|:\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  for (let i = 0; i < segments.length; i += 1) {
    // Strip the post-nominal FIRST. "Dr Rukmini Balasubramanian FITT" is a
    // valid name shape with the fellowship left on, so trying the raw form
    // first accepted it and then failed to match the person by name.
    const stripped = segments[i].replace(POST_NOMINAL, "").trim();
    for (const candidate of [stripped, segments[i]]) {
      if (!candidate || candidate.length > 60) continue;
      if (!looksLikePersonName(candidate)) continue;
      const rest = [...segments.slice(0, i), ...segments.slice(i + 1)].join(
        " · ",
      );
      return { name: candidate, rest };
    }
  }

  // "Wanjiru Kamande, Co-founder" — a comma separates the name from the role
  // only when what follows is not another name.
  const comma = cleaned.split(/,\s+/);
  if (comma.length > 1 && looksLikePersonName(comma[0].trim())) {
    return { name: comma[0].trim(), rest: comma.slice(1).join(", ") };
  }
  return null;
}

/**
 * A person's name, and the words attached to it.
 *
 * A page presents a person as a name line — sometimes with the role on the
 * same line after a dash or a comma — followed by their sentences, until the
 * next name. Reading blocks rather than sentences is what lets a two-person
 * roster be two people and a single-person page be one.
 */
function blocksFrom(
  lines: string[],
  pageOrganization?: string | null,
): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const table = readTableRow(trimmed);
    if (table) {
      if (current) blocks.push(current);
      current = null;
      blocks.push({
        name: table.cells[0],
        text: table.cells.slice(1).join(" · "),
      });
      continue;
    }

    const named = nameIn(trimmed);
    if (named) {
      if (current) blocks.push(current);
      current = { name: named.name, text: named.rest };
      continue;
    }

    if (current) current.text = `${current.text}\n${trimmed}`.trim();
  }
  if (current) blocks.push(current);
  // The page's own name is on the page more than anybody's, and it is shaped
  // exactly like a name. It is never one of the people.
  const own = normalizeText(pageOrganization ?? "");
  return own
    ? blocks.filter((block) => normalizeText(block.name) !== own)
    : blocks;
}

// --------------------------------------------------------------------------
// what a block says

const TITLE_AT_ORG =
  /\b(?:is|as|the|,)?\s*([A-Z][\w&/'’.-]*(?:\s+[\w&/'’.-]+){0,5}?)\s+(?:at|of|with)\s+([A-Z][\w&'’.-]*(?:\s+[\w&'’.-]+){0,4})/;
const ROLE_WORDS =
  /\b(chief|head|director|manager|lead|principal|senior|partner|officer|engineer|scientist|researcher|consultant|analyst|designer|counsel|surveyor|nurse|physician|professor|lecturer|fellow|associate|assistant|coordinator|specialist|architect|developer|technician|president|founder|owner|chair|secretary|treasurer|editor|curator|registrar|inspector|auditor|actuary|underwriter|paramedic|midwife|therapist|practitioner|maintainer|contributor|advisor|adviser|controller|planner|buyer|supervisor|foreman|apprentice|sourcer|recruiter)\b/i;

/**
 * Is the page treating this name as a person?
 *
 * The one test that generalises past a vocabulary list. A heading, a product,
 * a department and an organisation are all shaped like a name; none of them
 * has an address, a role, a sentence about them, or an employer.
 */
function looksLikeAPerson(block: Block): boolean {
  const text = block.text.trim();
  if (!text) return false;
  if (EMAIL_RE.test(text)) {
    EMAIL_RE.lastIndex = 0;
    return true;
  }
  EMAIL_RE.lastIndex = 0;
  if (ROLE_WORDS.test(text)) return true;
  if (TITLE_AT_ORG.test(text)) return true;
  // "Marit Solheim Bakke has led the group since 2019" — the page writes about
  // them, which nothing does about a heading.
  const first = block.name.split(" ")[0];
  if (
    new RegExp(
      `\\b${first}\\b\\s+(?:is|was|has|leads?|runs?|works?|joined|writes?|holds?|serves?|maintains?|founded|built|teaches)\\b`,
      "i",
    ).test(text)
  ) {
    return true;
  }
  // A contributor row: a count of what they did.
  if (
    /\b\d[\d,]*\s+(commits?|contributions?|publications?|patents?|papers?|talks?)\b/i.test(
      text,
    )
  ) {
    return true;
  }
  return false;
}

function readTitle(text: string): string | null {
  const first = text.split("\n")[0]?.trim() ?? "";
  if (first && ROLE_WORDS.test(first) && first.length < 90) {
    // A whole sentence is a bio, not a title.
    if (!/[.!?]\s/.test(first)) return first.replace(/\.$/, "");
  }
  const match = TITLE_AT_ORG.exec(text);
  if (match && ROLE_WORDS.test(match[1])) return match[1].trim();
  return null;
}

function readOrganization(text: string): string | null {
  const match = TITLE_AT_ORG.exec(text);
  if (match && ROLE_WORDS.test(match[1]))
    return match[2].trim().replace(/[.,]$/, "");
  return null;
}

function readEmails(text: string): string[] {
  const found = text.match(EMAIL_RE) ?? [];
  return [...new Set(found.map((e) => e.toLowerCase()))];
}

// --------------------------------------------------------------------------
// the reading

export function classifyPage(
  text: string,
  title: string,
  url: string,
): {
  kind: PageKind;
  why: string;
} {
  // A vacancy or a call for papers describes work being offered, not people
  // doing it. But a team page with a careers link in its footer is still a team
  // page, so this only decides the question when nobody is actually named —
  // which is checked below, after the blocks are read.
  const wanted = WANTED.test(`${title}\n${text}`);
  const lines = collapseLines(text)
    .split("\n")
    .filter((l) => !isFurniture(l));
  const names = blocksFrom(lines, pageOrganizationFrom(title, url));
  if (names.length === 0) {
    return {
      kind: "not_people",
      why: "no line on the page reads as a person's name",
    };
  }
  // A vacancy that names its hiring manager still names a person. Only a page
  // that names nobody is settled by the wanted language alone.
  if (wanted && names.length === 0) {
    return {
      kind: "not_people",
      why: "asks for people rather than describing them — a vacancy or a call, not a roster",
    };
  }
  if (names.length === 1) {
    return {
      kind: "person",
      why: "one person is named, and the page is about them",
    };
  }
  if (ROSTER_TITLE.test(title) || names.length > 2) {
    return { kind: "roster", why: `${names.length} people are named` };
  }
  return { kind: "roster", why: `${names.length} people are named` };
}

export function extractPeopleFromPage(input: {
  text: string;
  title?: string;
  url?: string;
}): PageReading {
  const title = input.title ?? "";
  const url = input.url ?? "";
  const { kind, why } = classifyPage(input.text, title, url);
  if (kind === "not_people") {
    return { kind, why, people: [], pageOrganization: null };
  }

  const lines = collapseLines(input.text)
    .split("\n")
    .filter((l) => !isFurniture(l));
  const pageOrganization = pageOrganizationFrom(title, url);
  // On a conference programme or an award list the page's own name is NOT the
  // employer of anybody on it. Lending it is the mistake that makes every
  // speaker work for the conference.
  const mayLendOrg =
    !THIRD_PARTY.test(title) &&
    !THIRD_PARTY.test(url) &&
    ROSTER_TITLE.test(title);

  const people: ExtractedPerson[] = [];
  for (const block of blocksFrom(lines, pageOrganization)) {
    // A name shape is not a person. A page of headings, product names and
    // department labels is full of capitalised two-word phrases, and taking
    // them is how a shortlist fills with rows nobody can contact. Something on
    // the page has to treat this as somebody: an address, a role, a sentence
    // about them, or an affiliation.
    if (!looksLikeAPerson(block)) continue;
    const text = `${block.name} ${block.text}`;
    const capabilities = Object.keys(matchCapabilities(text));
    const place = matchLocations(text)[0];
    people.push({
      name: block.name,
      title: readTitle(block.text),
      organization:
        readOrganization(block.text) ?? (mayLendOrg ? pageOrganization : null),
      location: place ? place.label : null,
      emails: readEmails(block.text),
      capabilities,
      quote: block.text.split("\n")[0]?.slice(0, 240) ?? "",
    });
  }

  return { kind, why, people, pageOrganization };
}

/** The ontology's words for what a reading found, for a summary line. */
export function capabilityLabels(person: ExtractedPerson): string[] {
  return person.capabilities.map(conceptLabel);
}

/** True when the text mentions the term as a whole phrase. */
export function pageMentions(text: string, term: string): boolean {
  return ` ${normalizeText(text)} `.includes(` ${normalizeText(term)} `);
}
