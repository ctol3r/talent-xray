/**
 * ResearchProvider — the GENERAL/public information environment (D-010):
 * profession research, company research, market intelligence, associations,
 * conferences, compensation, regulations, job boards, industry research,
 * current facts.
 *
 * This is NOT people search. Candidate discovery — profiles, portfolios,
 * publications, credential registries, rosters — goes through
 * CandidateDiscoveryProvider (./discovery-provider.ts). The Talent X-Ray
 * engines are people-only by construction and therefore live on that side
 * of the boundary, never here.
 */

export interface ResearchFinding {
  url: string;
  title?: string;
  snippet?: string;
  /** Which provider produced this finding (vendor-neutral label). */
  source: string;
  query: string;
  retrievedAt: string;
  /** 1-based position in the provider's result order. NOT a relevance score. */
  providerRank: number;
}

export interface ResearchProvider {
  readonly name: string;
  readonly configured: boolean;
  search(
    query: string,
    options?: { limit?: number },
  ): Promise<ResearchFinding[]>;
}

/** The honest default: no provider configured, no fabricated findings. */
export const noneResearchProvider: ResearchProvider = {
  name: "none",
  configured: false,
  async search() {
    throw new Error(
      "No general research provider configured. People/candidate search is a separate boundary (CandidateDiscoveryProvider) and cannot answer research questions.",
    );
  },
};

/**
 * Vendor-neutral registry. Future implementations (Exa, Tavily, Serper, a
 * full-web CSE) register here via TALENTOS_RESEARCH_PROVIDER. The Talent
 * X-Ray people-only engines are deliberately NOT accepted (D-010): a people
 * index must never be the general research path.
 */
export function getResearchProvider(): ResearchProvider {
  return noneResearchProvider;
}
