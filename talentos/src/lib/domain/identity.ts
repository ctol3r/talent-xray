/**
 * Conservative entity resolution (spec §12), ported verbatim from
 * artifact-src/core/identity.ts for the app's own database (Wave D), plus
 * one additive strength (`same_name_same_location`). Similar names,
 * employers, topics or locations never merge records automatically; a
 * lookalike creates an identity-review flag and a human decides. The
 * result type carries no merge instruction by design.
 */
export interface IdentityCandidate {
  id: string;
  name: string;
  currentCompany?: string;
  currentTitle?: string;
  geography?: string;
  profileUrls?: string[];
}

export interface IdentityMatch {
  otherId: string;
  reason: string;
  /** "same_urls" is the only thing strong enough to suggest one person; still never auto-merged. */
  strength:
    | "same_urls"
    | "same_name_same_org"
    | "same_name_same_location"
    | "same_name_different_org"
    | "similar_name";
}

export const normName = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\b(dr|mr|mrs|ms|phd|md|rn|jr|sr|ii|iii)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normOrg = (s: string | undefined): string =>
  (s ?? "")
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|corp|corporation|company|co|plc|gmbh)\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normUrl = (u: string): string =>
  u
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "")
    .split("?")[0];

/** Location tokens worth comparing: city/state/country words of 3+ letters. */
const locationTokens = (s: string | undefined): Set<string> =>
  new Set(
    (s ?? "")
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((t) => t.length >= 3),
  );

/** Find existing records a new candidate might be the same person as. */
export function findIdentityMatches(
  incoming: IdentityCandidate,
  existing: IdentityCandidate[],
): IdentityMatch[] {
  const out: IdentityMatch[] = [];
  const name = normName(incoming.name);
  const org = normOrg(incoming.currentCompany);
  const urls = new Set(
    (incoming.profileUrls ?? []).map(normUrl).filter(Boolean),
  );
  const loc = locationTokens(incoming.geography);
  for (const other of existing) {
    if (other.id === incoming.id) continue;
    const oUrls = (other.profileUrls ?? []).map(normUrl).filter(Boolean);
    const sharedUrl = oUrls.find((u) => urls.has(u));
    if (sharedUrl) {
      out.push({
        otherId: other.id,
        strength: "same_urls",
        reason: `Same profile URL (${sharedUrl}).`,
      });
      continue;
    }
    const oName = normName(other.name);
    if (!name || !oName) continue;
    if (name === oName) {
      const oOrg = normOrg(other.currentCompany);
      const oLoc = locationTokens(other.geography);
      const sharedLoc = [...loc].find((t) => oLoc.has(t));
      if (org && oOrg && org === oOrg) {
        out.push({
          otherId: other.id,
          strength: "same_name_same_org",
          reason: `Same name and same organisation (${other.currentCompany}).`,
        });
      } else if (org && oOrg && org !== oOrg) {
        out.push({
          otherId: other.id,
          strength: "same_name_different_org",
          reason: `Same name, conflicting organisations (${incoming.currentCompany} vs ${other.currentCompany}) — may be two people.`,
        });
      } else if (sharedLoc) {
        out.push({
          otherId: other.id,
          strength: "same_name_same_location",
          reason: `Same name and a shared location (${sharedLoc}); organisation unknown on one side.`,
        });
      } else {
        out.push({
          otherId: other.id,
          strength: "similar_name",
          reason: "Same name; organisation unknown on one side.",
        });
      }
      continue;
    }
    // Last-name match plus first initial: worth a look, never a merge.
    const [a, b] = [name.split(" "), oName.split(" ")];
    if (
      a.length > 1 &&
      b.length > 1 &&
      a[a.length - 1] === b[b.length - 1] &&
      a[0][0] === b[0][0]
    ) {
      out.push({
        otherId: other.id,
        strength: "similar_name",
        reason: `Similar name (${other.name}).`,
      });
    }
  }
  return out;
}
