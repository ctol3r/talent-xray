/**
 * Mock candidate-discovery provider — tests and e2e only, enabled solely by
 * TALENTOS_DISCOVERY_PROVIDER=mock. Deterministic, watermarked ("[Mock]"
 * titles on an invalid-by-construction domain), never presented as real
 * people. Same convention as the mock model provider (D-004).
 */
import type {
  CandidateDiscoveryProvider,
  DiscoveryResult,
} from "./discovery-provider";

export const MOCK_DISCOVERY_PROVIDER_NAME = "mock-discovery";

export function createMockDiscoveryProvider(): CandidateDiscoveryProvider {
  return {
    name: MOCK_DISCOVERY_PROVIDER_NAME,
    configured: true,
    async search(query, options) {
      const engine = options?.engine === "reach" ? "reach" : "core";
      const limit = Math.min(Math.max(options?.limit ?? 3, 1), 3);
      const retrievedAt = new Date().toISOString();
      const results: DiscoveryResult[] = [];
      for (let n = 1; n <= limit; n += 1) {
        results.push({
          url: `https://example.invalid/mock/${engine}/${n}`,
          title: `[Mock] Result ${n} (${engine})`,
          snippet: `[Mock] deterministic fixture result ${n} for “${query.slice(0, 40)}” — not a real person.`,
          provider: MOCK_DISCOVERY_PROVIDER_NAME,
          engine,
          query,
          retrievedAt,
          providerRank: n,
        });
      }
      return results;
    },
  };
}
