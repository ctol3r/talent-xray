/**
 * Declared links (Wave H): the addresses a person listed on a profile they
 * control, read through that platform's own structured public API.
 *
 * The shape below is the ONLY thing a platform mapper may return. Every
 * mapper picks fields explicitly and never spreads a raw record, so a bio,
 * an avatar URL, an email, a follower count or a location cannot leave the
 * module even if the API starts returning them.
 *
 * This is not scraping and not enrichment: it is one structured request about
 * one person, made because the recruiter clicked, returning addresses the
 * person themselves published. Nothing is stored until the recruiter keeps a
 * specific row (D-032's pattern).
 */
import { z } from "zod";

export const DECLARED_PLATFORMS = ["github", "keybase"] as const;
export type DeclaredPlatform = (typeof DECLARED_PLATFORMS)[number];

export const declaredLinkSchema = z
  .object({
    url: z.string().url(),
    platform: z.enum(DECLARED_PLATFORMS),
    /** "github:octocat" — who says this address is theirs. */
    assertedBy: z.string().max(200),
    /** The platform's own timestamp for the assertion, when it has one. */
    assertedAt: z.string().nullable(),
    /**
     * True only when the platform itself checked that the target proves
     * ownership — a cryptographic proof or a verified back-link. A field
     * someone typed is declared, not reciprocal.
     */
    reciprocal: z.boolean(),
    /** The platform's own name for the field ("website", "twitter"). */
    label: z.string().max(120).optional(),
  })
  .strict();

export type DeclaredLink = z.infer<typeof declaredLinkSchema>;

/** A fetch that can carry request headers and read response headers. */
export type DeclaredFetch = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<{
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
}>;

export type DeclaredMode = "off" | "live" | "mock";

export interface DeclaredClient {
  readonly platform: DeclaredPlatform;
  readonly configured: boolean;
  readonly mode: DeclaredMode;
  /** Read one person's declared links. Never bulk, never a list of people. */
  read(account: string): Promise<DeclaredLink[]>;
}

export function resolveDeclaredMode(raw: string | undefined): DeclaredMode {
  const value = (raw ?? "").trim().toLowerCase();
  if (value === "1" || value === "live" || value === "true") return "live";
  if (value === "mock") return "mock";
  return "off";
}

/** Keep only http(s) addresses; a mapper never passes anything else through. */
export function httpOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  const candidate = value.trim();
  try {
    const url = new URL(candidate);
    return /^https?:$/.test(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}
