/**
 * ORCID researcher URLs (Wave H2), on the D-032 registry pattern.
 *
 * A researcher's ORCID record carries the links they chose to publish about
 * themselves: personal site, GitHub, Scopus, ResearchGate, a university page.
 * For research and clinical-academic people this is the richest single source
 * of other profiles that exists, and the person curated it.
 *
 * Terms, quoted rather than paraphrased: the ORCID Public API is offered
 * under terms that restrict it to non-commercial use. A recruiter's own local
 * use is not obviously commercial, and a product sold to recruiters obviously
 * is. That distinction is recorded as an owner decision in
 * `docs/WAVE-H-PROFILE-CONNECTIONS.md`, and this adapter stays off until it
 * is made: `configured` is false unless the owner sets the flag.
 *
 * Never read: `/educations` (an end-date year is an age proxy), `/emails`,
 * `/addresses`, `/biography`. The mapper picks two sections by name.
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

export const ORCID_API = "https://pub.orcid.org/v3.0";
export const ORCID_PROFILE = "https://orcid.org";

/** An ORCID iD is four groups of four, the last character possibly X. */
const ORCID_PATTERN = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;

export function orcidIdFromUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!/(^|\.)orcid\.org$/.test(parsed.hostname.toLowerCase())) return null;
  const segment = parsed.pathname.split("/").filter(Boolean)[0];
  return segment && ORCID_PATTERN.test(segment.toUpperCase())
    ? segment.toUpperCase()
    : null;
}

export function buildOrcidResearcherUrlsUrl(id: string): string {
  return `${ORCID_API}/${id}/researcher-urls`;
}

export function buildOrcidExternalIdsUrl(id: string): string {
  return `${ORCID_API}/${id}/external-identifiers`;
}

interface ResearcherUrlsPayload {
  "researcher-url"?: unknown;
}
interface ExternalIdsPayload {
  "external-identifier"?: unknown;
}

/**
 * Map the two sections to declared links. Reads the URL and the name the
 * researcher gave it; drops everything else, including every date the record
 * carries, because a career start year is an age proxy.
 */
export function mapOrcidLinks(
  researcherUrls: ResearcherUrlsPayload,
  externalIds: ExternalIdsPayload,
  id: string,
): DeclaredLink[] {
  const assertedBy = `orcid:${id}`;
  const out: DeclaredLink[] = [];
  const seen = new Set<string>();

  const push = (rawUrl: unknown, rawLabel: unknown) => {
    const value =
      typeof rawUrl === "string"
        ? rawUrl
        : typeof (rawUrl as { value?: unknown })?.value === "string"
          ? (rawUrl as { value: string }).value
          : null;
    const url = httpOnly(value);
    if (!url) return;
    const key = url.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(
      declaredLinkSchema.parse({
        url,
        platform: "orcid",
        assertedBy,
        assertedAt: null,
        reciprocal: false,
        label:
          typeof rawLabel === "string" && rawLabel.trim()
            ? rawLabel.trim().slice(0, 120)
            : "researcher URL",
      }),
    );
  };

  const urls = researcherUrls["researcher-url"];
  if (Array.isArray(urls)) {
    for (const entry of urls) {
      const row = entry as { url?: unknown; "url-name"?: unknown };
      push(row.url, row["url-name"]);
    }
  }

  const ids = externalIds["external-identifier"];
  if (Array.isArray(ids)) {
    for (const entry of ids) {
      const row = entry as {
        "external-id-url"?: unknown;
        "external-id-type"?: unknown;
      };
      push(row["external-id-url"], row["external-id-type"]);
    }
  }

  return out;
}

const MOCK_LINKS = (id: string): DeclaredLink[] => [
  {
    url: `https://github.com/mock-${id.slice(-4)}`,
    platform: "orcid" as const,
    assertedBy: `orcid:${id}`,
    assertedAt: null,
    reciprocal: false,
    label: "[Mock] GitHub",
  },
  {
    url: `https://www.researchgate.net/profile/mock-${id.slice(-4)}`,
    platform: "orcid" as const,
    assertedBy: `orcid:${id}`,
    assertedAt: null,
    reciprocal: false,
    label: "[Mock] ResearchGate",
  },
];

export function resolveOrcidMode(): DeclaredMode {
  return resolveDeclaredMode(process.env.TALENTOS_PROFILES_ORCID);
}

export function createOrcidClient(
  fetchImpl: DeclaredFetch = fetch as unknown as DeclaredFetch,
): DeclaredClient {
  const mode = resolveOrcidMode();
  return {
    platform: "orcid",
    mode,
    configured: mode !== "off",
    async read(account: string) {
      if (mode === "off") {
        throw new Error(
          "Reading researcher URLs from ORCID is off. The ORCID Public API is offered for non-commercial use; decide that question, then set TALENTOS_PROFILES_ORCID=1. Nothing calls out otherwise.",
        );
      }
      const id = account.trim().toUpperCase();
      if (!ORCID_PATTERN.test(id)) throw new Error("Not an ORCID iD.");
      if (mode === "mock") return MOCK_LINKS(id);

      const headers = {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      };
      const urlsResponse = await fetchImpl(buildOrcidResearcherUrlsUrl(id), {
        headers,
      });
      if (urlsResponse.status === 404) return [];
      if (!urlsResponse.ok) {
        throw new Error(`ORCID answered HTTP ${urlsResponse.status}.`);
      }
      const researcherUrls =
        (await urlsResponse.json()) as ResearcherUrlsPayload;

      const idsResponse = await fetchImpl(buildOrcidExternalIdsUrl(id), {
        headers,
      });
      const externalIds = idsResponse.ok
        ? ((await idsResponse.json()) as ExternalIdsPayload)
        : {};

      return mapOrcidLinks(researcherUrls, externalIds, id);
    },
  };
}
