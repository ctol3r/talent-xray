/**
 * CandidateDiscoveryProvider — searches specifically for potential
 * people/candidates (D-010): profiles, portfolios, publications, credential
 * registries, rosters. Deliberately a separate interface from
 * ResearchProvider (general information environment) so a people-only
 * engine can never be handed a market-research question by construction.
 *
 * Rules every implementation must honor:
 * - Never fetch, crawl, or scrape a result page. Link out only.
 * - Results are transient; persisting anything is a separate, per-result,
 *   user-explicit act (services/discovery.ts).
 * - Result order is reported as providerRank (1-based). No implementation
 *   may fabricate a relevance score from it.
 */
import { createMockDiscoveryProvider } from "./mock-discovery";
import { createTalentXRayDiscoveryProvider } from "./talent-xray";

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
  return createTalentXRayDiscoveryProvider();
}
