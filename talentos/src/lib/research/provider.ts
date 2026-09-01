/**
 * ResearchProvider abstraction (Phase 2 wires real implementations:
 * Exa, Tavily, Serper, Google Custom Search — including the Talent X-Ray
 * engines — or user-provided sources). The application is never
 * architected around one vendor; results always land in research_sources
 * with url/title/source/snippet/query/retrievedAt provenance.
 */

export interface ResearchResult {
  url: string;
  title?: string;
  source: string;
  snippet?: string;
  query: string;
  retrievedAt: string;
  relevance?: number;
}

export interface ResearchProvider {
  readonly name: string;
  readonly configured: boolean;
  search(query: string, options?: { limit?: number }): Promise<ResearchResult[]>;
}

/** The honest default: no provider configured, no fabricated results. */
export const noneResearchProvider: ResearchProvider = {
  name: "none",
  configured: false,
  async search() {
    throw new Error(
      "No research provider configured (TALENTOS_RESEARCH_PROVIDER=none). Live web research is a Phase 2 capability.",
    );
  },
};

export function getResearchProvider(): ResearchProvider {
  return noneResearchProvider;
}
