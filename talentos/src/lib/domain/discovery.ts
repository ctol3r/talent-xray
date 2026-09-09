/** Pure discovery helpers (client-safe — no db imports). */

/** Prefill a candidate name from a people-search result title. */
export function candidateNameFromTitle(title: string | undefined): string {
  if (!title) return "";
  return title
    .split(/\s+[-–—|·]\s+/)[0]
    .trim()
    .slice(0, 80);
}

/**
 * The engines' own hosted results page (Programmable Search Element). Google
 * keeps this free for engines that search 50 or fewer sites; both Talent
 * X-Ray engines are such engines (D-034). The app never reads this page —
 * the recruiter opens it in a new tab.
 */
export const HOSTED_SEARCH_PAGE = "https://cse.google.com/cse";

export function buildHostedSearchUrl(cx: string, query: string): string {
  const params = new URLSearchParams({ cx, q: query });
  return `${HOSTED_SEARCH_PAGE}?${params.toString()}`;
}

/**
 * A composed boolean query, opened in ordinary Google.
 *
 * The hosted engines are people-only by construction, which is the product —
 * but the angle library was written for the open web, and its negatives
 * (`-"job description"`, `-site:indeed.com` and the rest) are what make a plain
 * web search behave. So every angle can be opened here too, by hand, with no
 * key and no connector. The app never reads the result page: it hands over a
 * URL and the recruiter opens it (product rule 1).
 *
 * Three parameters, each of which a sourcer would set by hand:
 *  - `nfpr=1` stops Google "correcting" the query and searching for something
 *    else, which is fatal to a hand-built boolean string.
 *  - `filter=0` stops it collapsing near-duplicates, which on a site-restricted
 *    search silently hides most of the people you were looking for.
 *  - `udm=14` asks for plain web results rather than the assembled page. It is
 *    undocumented and widely used; if Google drops it the link still works,
 *    because an unknown parameter is ignored.
 */
export const WEB_SEARCH_PAGE = "https://www.google.com/search";

export function buildWebSearchUrl(query: string): string {
  const params = new URLSearchParams({
    q: query,
    nfpr: "1",
    filter: "0",
    udm: "14",
  });
  return `${WEB_SEARCH_PAGE}?${params.toString()}`;
}

/** An absolute http(s) URL with no embedded credentials, whitespace or control characters. */
export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const hasControl = [...value].some((c) => c.charCodeAt(0) <= 0x20);
    return (
      /^https?:$/.test(url.protocol) &&
      !url.username &&
      !url.password &&
      !hasControl
    );
  } catch {
    return false;
  }
}

export interface SaveLine {
  url: string;
  /** Set when the recruiter wrote `url | Name` — creates a candidate. */
  candidateName?: string;
}

export const MAX_SAVE_LINES = 50;

const dedupeKey = (url: string) =>
  url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "")
    .split("#")[0];

/**
 * Parse the "URLs to keep" box: one URL per line, optionally followed by
 * ` | Candidate Name`. Blank lines are ignored; anything that is not an
 * http(s) URL is reported back, never silently dropped; duplicates collapse
 * to the first occurrence.
 */
export function parseSaveLines(text: string): {
  saves: SaveLine[];
  rejected: string[];
} {
  const saves: SaveLine[] = [];
  const rejected: string[] = [];
  const seen = new Set<string>();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const [urlPart, ...rest] = line.split("|");
    const url = urlPart.trim();
    const candidateName = rest.join("|").trim().slice(0, 200) || undefined;
    if (!isHttpUrl(url)) {
      rejected.push(line);
      continue;
    }
    const key = dedupeKey(url);
    if (seen.has(key)) continue;
    seen.add(key);
    saves.push(candidateName ? { url, candidateName } : { url });
    if (saves.length >= MAX_SAVE_LINES) break;
  }
  return { saves, rejected };
}
