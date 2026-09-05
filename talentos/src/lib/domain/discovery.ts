/** Pure discovery helpers (client-safe — no db imports). */

/** Prefill a candidate name from a people-search result title. */
export function candidateNameFromTitle(title: string | undefined): string {
  if (!title) return "";
  return title
    .split(/\s+[-–—|·]\s+/)[0]
    .trim()
    .slice(0, 80);
}
