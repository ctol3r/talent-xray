/**
 * Keybase proofs (Wave H), on the D-032 registry pattern.
 *
 * Keybase is the only source in the researched set where the platform itself
 * checked something: a proof is a signed statement the person posted on the
 * other service, which Keybase then verified. That is why a Keybase proof —
 * and nothing else in this app today — earns the `platform_reciprocal` tier.
 *
 * Two honest caveats the label must carry:
 *  - Keybase has been largely dormant since its 2020 acquisition, so a proof
 *    may be years old and the account may be abandoned. The date is shown.
 *  - A proof shows the same person controlled both accounts when it was made.
 *    It is not evidence about anyone's work.
 *
 * One request, one person, per click. No key. Nothing is stored until the
 * recruiter keeps a specific row.
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

export const KEYBASE_API = "https://keybase.io/_/api/1.0/user/lookup.json";

export const KEYBASE_DORMANT_NOTE =
  "Keybase has been largely dormant since 2020; a proof may be years old.";

export function buildKeybaseLookupUrl(username: string): string {
  const params = new URLSearchParams({
    usernames: username,
    fields: "proofs_summary",
  });
  return `${KEYBASE_API}?${params.toString()}`;
}

/** The username in a keybase.io profile URL, or null. */
export function keybaseUsernameFromUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!/(^|\.)keybase\.io$/.test(parsed.hostname.toLowerCase())) return null;
  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length !== 1) return null;
  const username = segments[0];
  return /^[A-Za-z0-9_]{2,16}$/.test(username) ? username : null;
}

interface KeybaseProof {
  proof_type?: unknown;
  nametag?: unknown;
  service_url?: unknown;
  presentation_group?: unknown;
  state?: unknown;
}

/**
 * Map a proofs summary to declared links. Reads `service_url`, the service
 * name and the proof state; drops the bio, full name, picture, devices,
 * public keys and everything else the lookup can return.
 *
 * Only a state-1 proof (Keybase's "ok") is reciprocal. Anything else is
 * dropped rather than downgraded: a broken or revoked proof is not a link
 * the person is asserting today.
 */
export function mapKeybaseProofs(
  proofs: KeybaseProof[],
  username: string,
  checkedAt: string,
): DeclaredLink[] {
  const assertedBy = `keybase:${username}`;
  const out: DeclaredLink[] = [];
  const seen = new Set<string>();
  for (const proof of proofs) {
    if (typeof proof.state === "number" && proof.state !== 1) continue;
    const url = httpOnly(
      typeof proof.service_url === "string" ? proof.service_url : null,
    );
    if (!url) continue;
    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const service =
      typeof proof.proof_type === "string"
        ? proof.proof_type.slice(0, 120)
        : typeof proof.presentation_group === "string"
          ? proof.presentation_group.slice(0, 120)
          : "proof";
    out.push(
      declaredLinkSchema.parse({
        url,
        platform: "keybase",
        assertedBy,
        assertedAt: checkedAt,
        reciprocal: true,
        label: service,
      }),
    );
  }
  return out;
}

const MOCK_PROOFS = (username: string, checkedAt: string): DeclaredLink[] => [
  {
    url: `https://github.com/mock-${username}`,
    platform: "keybase" as const,
    assertedBy: `keybase:${username}`,
    assertedAt: checkedAt,
    reciprocal: true,
    label: "[Mock] github",
  },
  {
    url: `https://mock-${username}.dev`,
    platform: "keybase" as const,
    assertedBy: `keybase:${username}`,
    assertedAt: checkedAt,
    reciprocal: true,
    label: "[Mock] dns",
  },
];

export function resolveKeybaseMode(): DeclaredMode {
  return resolveDeclaredMode(process.env.TALENTOS_PROFILES_KEYBASE);
}

export function createKeybaseClient(
  fetchImpl: DeclaredFetch = fetch as unknown as DeclaredFetch,
  now: () => string = () => new Date().toISOString(),
): DeclaredClient {
  const mode = resolveKeybaseMode();
  return {
    platform: "keybase",
    mode,
    configured: mode !== "off",
    async read(account: string) {
      if (mode === "off") {
        throw new Error(
          "Reading proofs from Keybase is off. Set TALENTOS_PROFILES_KEYBASE=1 to enable it; nothing calls out otherwise.",
        );
      }
      const username = account.trim();
      if (!username) throw new Error("No Keybase account on this candidate.");
      const checkedAt = now();
      if (mode === "mock") return MOCK_PROOFS(username, checkedAt);

      const response = await fetchImpl(buildKeybaseLookupUrl(username), {
        headers: { "User-Agent": USER_AGENT },
      });
      if (!response.ok) {
        throw new Error(`Keybase answered HTTP ${response.status}.`);
      }
      const payload = (await response.json()) as {
        status?: { code?: unknown };
        them?: unknown;
      };
      const them = Array.isArray(payload.them) ? payload.them : [];
      const first = them[0] as
        { proofs_summary?: { all?: unknown } } | undefined;
      if (!first) return [];
      const all = first.proofs_summary?.all;
      return mapKeybaseProofs(
        Array.isArray(all) ? (all as KeybaseProof[]) : [],
        username,
        checkedAt,
      );
    },
  };
}
