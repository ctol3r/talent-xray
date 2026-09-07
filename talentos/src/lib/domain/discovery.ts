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
