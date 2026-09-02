/**
 * ResearchProvider — the GENERAL/public information environment (D-010):
 * profession research, company research, market intelligence, associations,
 * conferences, compensation, regulations, job boards, industry research,
 * current facts — and, since D-013, AUDIENCE research for outreach personas.
 *
 * This is NOT people search. Candidate discovery — profiles, portfolios,
 * publications, credential registries, rosters — goes through
 * CandidateDiscoveryProvider (./discovery-provider.ts). The Talent X-Ray
 * engines are people-only by construction and therefore live on that side
 * of the boundary, never here.
 */
import { createMockResearchProvider } from "./mock-research";
import { createSessionResearchProvider } from "./session-research";

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
      "No general research provider configured (TALENTOS_RESEARCH_PROVIDER=session|mock|none). People/candidate search is a separate boundary (CandidateDiscoveryProvider) and cannot answer research questions.",
    );
  },
};

export type ResearchProviderKind = "none" | "session" | "mock";

/**
 * Explicit TALENTOS_RESEARCH_PROVIDER wins. Unset follows the model
 * provider's posture (session → session, mock → mock) so the same handoff
 * channel and the same test posture apply; anything else — including the
 * people-only engines (D-010) — resolves to none.
 */
export function resolveResearchProviderKind(): ResearchProviderKind {
  const configured = process.env.TALENTOS_RESEARCH_PROVIDER?.toLowerCase();
  if (configured === "session" || configured === "mock") return configured;
  if (configured) return "none";
  const model = process.env.TALENTOS_MODEL_PROVIDER?.toLowerCase();
  if (model === "session") return "session";
  if (model === "mock") return "mock";
  return "none";
}

export function getResearchProvider(): ResearchProvider {
  switch (resolveResearchProviderKind()) {
    case "session":
      return createSessionResearchProvider();
    case "mock":
      return createMockResearchProvider();
    default:
      return noneResearchProvider;
  }
}
