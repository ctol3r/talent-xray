/**
 * CandidateDiscoveryProvider — searches specifically for potential
 * people/candidates (D-010): profiles, portfolios, publications, credential
 * registries, rosters. Deliberately a separate interface from
 * ResearchProvider (general information environment) so a people-only
 * engine can never be handed a market-research question by construction.
 *
 * Rules every implementation must honor:
 * - A provider returns rows from a search API. It never fetches a result
 *   PAGE: opening one is `src/lib/fetch/read-page.ts`, behind the policy
 *   gate, and only for an address that got through it (D-082).
 * - Results are transient; persisting anything is a separate, per-result,
 *   user-explicit act (services/discovery.ts).
 * - Result order is reported as providerRank (1-based). No implementation
 *   may fabricate a relevance score from it.
 */
import { createMockDiscoveryProvider } from "./mock-discovery";
import { createTalentXRayDiscoveryProvider } from "./talent-xray";
import { createBraveDiscoveryProvider } from "./web-search/brave";

export interface DiscoveryResult {
  url: string;
  title?: string;
  snippet?: string;
  /** Provider name, vendor-neutral (e.g. "talent-xray"). */
  provider: string;
  /** Provider-specific index/engine the result came from (e.g. "core"). */
  engine?: string;
  query: string;
  retrievedAt: string;
  /** 1-based position in the provider's result order. NOT a relevance score. */
  providerRank: number;
}

export interface CandidateDiscoveryProvider {
  readonly name: string;
  readonly configured: boolean;
  search(
    query: string,
    options?: { limit?: number; engine?: string },
  ): Promise<DiscoveryResult[]>;
}

/** Explicit opt-out (TALENTOS_DISCOVERY_PROVIDER=none). */
export const noneDiscoveryProvider: CandidateDiscoveryProvider = {
  name: "none",
  configured: false,
  async search() {
    throw new Error(
      "Candidate discovery is disabled (TALENTOS_DISCOVERY_PROVIDER=none).",
    );
  },
};

/**
 * Vendor-neutral registry. Default is the Talent X-Ray provider (the two
 * live people-only engines); it reports configured=false until the owner's
 * Google key is present — nothing is faked.
 */
export function getCandidateDiscoveryProvider(): CandidateDiscoveryProvider {
  const configured = process.env.TALENTOS_DISCOVERY_PROVIDER?.toLowerCase();
  if (configured === "none") return noneDiscoveryProvider;
  if (configured === "mock") return createMockDiscoveryProvider();
  // Open-web search: the whole index, addressed with operators, rather than
  // the hundred people-only domains. Reports configured=false without a key.
  if (configured === "brave") return createBraveDiscoveryProvider();
  return createTalentXRayDiscoveryProvider();
}
