/**
 * Wikidata identifiers (Wave H2), on the D-032 registry pattern.
 *
 * Wikidata is the one place that holds, in one record, the identifiers a
 * notable person has across dozens of platforms: X, GitHub, ORCID, Mastodon,
 * Scopus, IMDb, VIAF and more. The data is CC0 and the API needs no key.
 *
 * What it is not: authoritative. Every value was entered by a volunteer
 * editor, not by the person, and not checked by the platform it names. So a
 * Wikidata link is the weakest tier this app renders — `community_entered` —
 * and its label says so. It is a lead to open, never a claim.
 *
 * Only people are read: an entity without `P31 = Q5` (instance of: human) is
 * refused, so a company or a band cannot arrive as a candidate's profile.
 * The mapper reads a fixed list of identifier properties and builds each URL
 * from that property's own formatter. Nothing else in the entity is touched,
 * which is what keeps the demographic statements Wikidata holds about people
 * out of this app entirely — they are never read, so they cannot leak.
 */
import {
  declaredLinkSchema,
  httpOnly,
  resolveDeclaredMode,
  USER_AGENT,
  type DeclaredClient,
  type DeclaredFetch,
  type DeclaredLink,
  type DeclaredMode,
} from "./declared";

export const WIKIDATA_API = "https://www.wikidata.org/w/api.php";

/**
 * Identifier properties worth following, with the URL each one builds. Every
 * entry points at a page about a person. Every property that describes the
 * person rather than locating them is deliberately absent: this list is an
 * allow-list, so a property has to be added by hand to be read at all, and
 * the ones a hiring decision must never weigh are not here and must not be.
 */
const IDENTIFIER_PROPERTIES: {
  property: string;
  label: string;
  url: (value: string) => string;
}[] = [
  { property: "P2002", label: "X", url: (v) => `https://x.com/${v}` },
  { property: "P2037", label: "GitHub", url: (v) => `https://github.com/${v}` },
  { property: "P496", label: "ORCID", url: (v) => `https://orcid.org/${v}` },
  {
    property: "P4033",
    label: "Mastodon",
    url: (v) => {
      const [handle, host] = v.split("@").filter(Boolean);
      return host ? `https://${host}/@${handle}` : "";
    },
  },
  {
    property: "P2003",
    label: "Instagram",
    url: (v) => `https://www.instagram.com/${v}`,
  },
  {
    property: "P2013",
    label: "Facebook",
    url: (v) => `https://www.facebook.com/${v}`,
  },
  {
    property: "P1153",
    label: "Scopus",
    url: (v) => `https://www.scopus.com/authid/detail.uri?authorId=${v}`,
  },
  {
    property: "P2456",
    label: "DBLP",
    url: (v) => `https://dblp.org/pid/${v}`,
  },
  {
    property: "P6634",
    label: "LinkedIn",
    url: (v) => `https://www.linkedin.com/in/${v}`,
  },
  {
    property: "P3899",
    label: "Medium",
    url: (v) => `https://medium.com/@${v}`,
  },
  {
    property: "P856",
    label: "official website",
    url: (v) => v,
  },
];

export function wikidataIdFromUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!/(^|\.)wikidata\.org$/.test(parsed.hostname.toLowerCase())) return null;
  const segments = parsed.pathname.split("/").filter(Boolean);
  const id = segments[segments.length - 1];
  return id && /^Q\d+$/.test(id) ? id : null;
}

export function buildWikidataEntityUrl(id: string): string {
  const params = new URLSearchParams({
    action: "wbgetentities",
    ids: id,
    props: "claims",
    format: "json",
    origin: "*",
  });
  return `${WIKIDATA_API}?${params.toString()}`;
}

interface Claim {
  mainsnak?: { datavalue?: { value?: unknown } };
}
interface EntityPayload {
  entities?: Record<string, { claims?: Record<string, Claim[]> }>;
}

function claimValues(
  claims: Record<string, Claim[]>,
  property: string,
): string[] {
  const rows = claims[property];
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => row.mainsnak?.datavalue?.value)
    .filter((value): value is string => typeof value === "string");
}

/** True when the entity says it is a human. Anything else is refused. */
export function isHuman(claims: Record<string, Claim[]>): boolean {
  const rows = claims.P31;
  if (!Array.isArray(rows)) return false;
  return rows.some((row) => {
    const value = row.mainsnak?.datavalue?.value as
      { id?: unknown } | undefined;
    return value?.id === "Q5";
  });
}

export function mapWikidataLinks(
  payload: EntityPayload,
  id: string,
): DeclaredLink[] {
  const entity = payload.entities?.[id];
  const claims = entity?.claims ?? {};
  if (!isHuman(claims)) return [];
  const assertedBy = `wikidata:${id}`;
  const out: DeclaredLink[] = [];
  const seen = new Set<string>();
  for (const property of IDENTIFIER_PROPERTIES) {
    for (const value of claimValues(claims, property.property)) {
      const url = httpOnly(property.url(value));
      if (!url) continue;
      const key = url.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(
        declaredLinkSchema.parse({
          url,
          platform: "wikidata",
          assertedBy,
          assertedAt: null,
          reciprocal: false,
          label: property.label,
        }),
      );
    }
  }
  return out;
}

const MOCK_LINKS = (id: string): DeclaredLink[] => [
  {
    url: `https://github.com/mock-${id.toLowerCase()}`,
    platform: "wikidata" as const,
    assertedBy: `wikidata:${id}`,
    assertedAt: null,
    reciprocal: false,
    label: "[Mock] GitHub",
  },
  {
    url: `https://orcid.org/0000-0002-1825-0097`,
    platform: "wikidata" as const,
    assertedBy: `wikidata:${id}`,
    assertedAt: null,
    reciprocal: false,
    label: "[Mock] ORCID",
  },
];

export function resolveWikidataMode(): DeclaredMode {
  return resolveDeclaredMode(process.env.TALENTOS_PROFILES_WIKIDATA);
}

export function createWikidataClient(
  fetchImpl: DeclaredFetch = fetch as unknown as DeclaredFetch,
): DeclaredClient {
  const mode = resolveWikidataMode();
  return {
    platform: "wikidata",
    mode,
    configured: mode !== "off",
    async read(account: string) {
      if (mode === "off") {
        throw new Error(
          "Reading identifiers from Wikidata is off. Set TALENTOS_PROFILES_WIKIDATA=1 to enable it; nothing calls out otherwise.",
        );
      }
      const id = account.trim().toUpperCase();
      if (!/^Q\d+$/.test(id)) throw new Error("Not a Wikidata item id.");
      if (mode === "mock") return MOCK_LINKS(id);

      const response = await fetchImpl(buildWikidataEntityUrl(id), {
        headers: {
          Accept: "application/json",
          // Wikimedia asks every client to identify itself descriptively.
          "User-Agent": `${USER_AGENT} (local recruiting workstation)`,
        },
      });
      if (!response.ok) {
        throw new Error(`Wikidata answered HTTP ${response.status}.`);
      }
      return mapWikidataLinks((await response.json()) as EntityPayload, id);
    },
  };
}
