/**
 * Role-title normalization for cross-search rollups. No taxonomy: two titles
 * collide only when their remaining tokens are identical after stripping
 * seniority and filler words. "Senior Research Engineer" and "Research
 * Engineer" collide; "Research Scientist" does not.
 */
const DROPPED_TOKENS = new Set([
  "senior",
  "sr",
  "junior",
  "jr",
  "lead",
  "principal",
  "staff",
  "head",
  "of",
  "the",
  "and",
  "or",
  "a",
  "an",
  "i",
  "ii",
  "iii",
  "iv",
  "v",
]);

export function normalizeRoleTitle(title: string): string {
  const tokens = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !DROPPED_TOKENS.has(t));
  return [...new Set(tokens)].sort().join(" ");
}
