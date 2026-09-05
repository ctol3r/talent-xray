import type { ResearchFinding, ResearchProvider } from "./provider";

/**
 * Mock research provider — tests only (D-013). Deterministic, watermarked
 * fixture findings on a reserved `.invalid` domain that can never resolve.
 * Never real research; never enabled unless TALENTOS_RESEARCH_PROVIDER=mock
 * or the model provider itself is the mock.
 */
export const MOCK_RESEARCH_SOURCE = "mock-research";

export function createMockResearchProvider(): ResearchProvider {
  return {
    name: "mock",
    configured: true,
    async search(query, options) {
      const limit = Math.min(options?.limit ?? 3, 3);
      const slug =
        query
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "")
          .slice(0, 48) || "query";
      const retrievedAt = new Date().toISOString();
      return Array.from({ length: limit }, (_, index): ResearchFinding => ({
        url: `https://mock-research.invalid/${slug}/${index + 1}`,
        title: `[Mock] Finding ${index + 1} for "${query}"`,
        snippet:
          "[Mock] Deterministic fixture finding — not real research; watermarked.",
        source: MOCK_RESEARCH_SOURCE,
        query,
        retrievedAt,
        providerRank: index + 1,
      }));
    },
  };
}
