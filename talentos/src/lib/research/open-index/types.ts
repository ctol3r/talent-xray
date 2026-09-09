/**
 * The open index: people search over public, licensed, structured APIs.
 *
 * This is not a crawl and not an index of scraped pages. Every source here
 * is an official API whose terms were read before the adapter was written,
 * and every call is one query made because a recruiter pressed a button.
 * Nothing is stored. Results are handed to the page and discarded; a row
 * becomes a record only when a human explicitly saves it, through the same
 * path a link-out save already uses.
 *
 * Why it exists: the hosted-engine link-out finds pages about people. This
 * finds people, with their identifiers, in populations where the public
 * record is genuinely rich — researchers, engineers, clinicians. It will
 * never have an aggregator's raw coverage, and it is not trying to. It has
 * something an aggregator does not: every row can be traced to a named
 * public record under a licence that permits this use.
 *
 * Every adapter obeys four rules:
 *  1. Read an explicit list of fields. Never spread a response object.
 *  2. Never read a field that names or proxies a protected characteristic.
 *  3. Never read contact details. An address is a link, not an inbox.
 *  4. Identify the caller as the source's own documentation asks.
 */
import type { DiscoveryResult } from "../discovery-provider";

export const OPEN_INDEX_SOURCES = [
  "wikidata",
  "openalex",
  "github",
  "crossref",
] as const;
export type OpenIndexSourceId = (typeof OPEN_INDEX_SOURCES)[number];

/** What a search is looking for, before any source has seen it. */
export interface OpenIndexSpec {
  /** Free-text description of the work: the terms that identify the field. */
  terms: string[];
  /** Employers or institutions worth pinning to, in the source's own words. */
  organisations: string[];
  /** Place words, when the source can filter on them. */
  geography: string[];
  /** Programming languages or named technologies, for code-hosting sources. */
  technologies: string[];
  /** A specific person, when the search is a lookup rather than a sweep. */
  name?: string;
  limit: number;
}

/** One request an adapter intends to make, shown before it is made. */
export interface OpenIndexRequest {
  source: OpenIndexSourceId;
  /** The full URL. Rendered to the recruiter: nothing is hidden (rule 6). */
  url: string;
  /** What this request is looking for, in a phrase. */
  purpose: string;
}

export interface OpenIndexSource {
  readonly id: OpenIndexSourceId;
  readonly label: string;
  /** The licence the data comes under, as its own terms state it. */
  readonly licence: string;
  /** Who this source can actually find. Honest, including who it cannot. */
  readonly population: string;
  /** False when the owner has switched this source off. */
  readonly enabled: boolean;
  /** The requests this spec would produce. Pure: makes no call. */
  plan(spec: OpenIndexSpec): OpenIndexRequest[];
  /** Run the plan. Returns transient results; stores nothing. */
  search(
    spec: OpenIndexSpec,
    fetchImpl?: OpenIndexFetch,
  ): Promise<DiscoveryResult[]>;
}

export type OpenIndexFetch = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

/**
 * Sources are off unless the owner turns them on, one at a time, because
 * each one carries its own licence question. `TALENTOS_OPEN_INDEX` takes a
 * comma-separated list of ids, or `all`, or `mock`.
 */
export function enabledSources(raw = process.env.TALENTOS_OPEN_INDEX): {
  ids: OpenIndexSourceId[];
  mock: boolean;
} {
  const value = (raw ?? "").trim().toLowerCase();
  if (!value || value === "none") return { ids: [], mock: false };
  if (value === "mock") return { ids: [...OPEN_INDEX_SOURCES], mock: true };
  if (value === "all") return { ids: [...OPEN_INDEX_SOURCES], mock: false };
  const ids = value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry): entry is OpenIndexSourceId =>
      (OPEN_INDEX_SOURCES as readonly string[]).includes(entry),
    );
  return { ids, mock: false };
}

/** Identifies this install to a source, as each one's documentation asks. */
export const CONTACT_ENV = "TALENTOS_OPEN_INDEX_CONTACT";

export function politeContact(): string | null {
  const value = (process.env[CONTACT_ENV] ?? "").trim();
  return value.length > 3 ? value : null;
}

/** Strip the highlight markup a source may embed in a snippet. */
export function plainSnippet(raw: string): string {
  return raw
    .replace(/<[^>]*>/gu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 300);
}
