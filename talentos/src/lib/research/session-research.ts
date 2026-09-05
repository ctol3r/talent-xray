import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { ResearchFinding, ResearchProvider } from "./provider";

/**
 * Session research provider (D-013): the general-research counterpart of
 * the session model provider (D-008). A search writes a request file to the
 * outbox and throws ResearchPendingError; a Claude session performs the web
 * search and writes the findings JSON to the response path; the caller
 * re-runs and receives the findings. Requests are keyed by a hash of
 * (query, limit), so unchanged queries reuse their response.
 *
 * Scope rule carried in every request: audience-level, public information
 * only — never a specific person's profile page.
 */
export class ResearchPendingError extends Error {
  constructor(
    readonly requestPath: string,
    readonly responsePath: string,
  ) {
    super(
      `Research pending: request written to ${requestPath}. ` +
        `A Claude session performs the web search and writes the findings JSON to ${responsePath}; then re-run.`,
    );
    this.name = "ResearchPendingError";
  }
}

export const SESSION_RESEARCH_SOURCE = "session-research";

export const researchResponseSchema = z.object({
  findings: z.array(
    z.object({
      url: z.string().min(4),
      title: z.string().optional(),
      snippet: z.string().optional(),
      retrievedAt: z.string().optional(),
    }),
  ),
});

function outboxDir(): string {
  const configured =
    process.env.TALENTOS_SESSION_OUTBOX ?? "./data/session-outbox";
  return path.isAbsolute(configured)
    ? configured
    : path.join(process.cwd(), configured);
}

export function createSessionResearchProvider(): ResearchProvider {
  return {
    name: "session",
    configured: true,
    async search(query, options) {
      const limit = options?.limit ?? 8;
      const dir = outboxDir();
      fs.mkdirSync(dir, { recursive: true });
      const hash = createHash("sha256")
        .update(query)
        .update("\n")
        .update(String(limit))
        .digest("hex")
        .slice(0, 12);
      const base = `Research-${hash}`;
      const requestPath = path.join(dir, `${base}.request.json`);
      const responsePath = path.join(dir, `${base}.response.json`);

      if (fs.existsSync(responsePath)) {
        const parsed = researchResponseSchema.safeParse(
          JSON.parse(fs.readFileSync(responsePath, "utf8")),
        );
        if (!parsed.success) {
          throw new Error(
            `Research response ${responsePath} does not match {findings:[{url,title?,snippet?,retrievedAt?}]} — fix or delete it and retry.`,
          );
        }
        const now = new Date().toISOString();
        return parsed.data.findings
          .slice(0, limit)
          .map((finding, index): ResearchFinding => ({
            url: finding.url,
            title: finding.title,
            snippet: finding.snippet,
            source: SESSION_RESEARCH_SOURCE,
            query,
            retrievedAt: finding.retrievedAt ?? now,
            providerRank: index + 1,
          }));
      }

      fs.writeFileSync(
        requestPath,
        JSON.stringify(
          {
            kind: "research",
            instructions:
              "Perform a web search for `query` (general, public, AUDIENCE-LEVEL information only — never a specific person's profile page). " +
              'Write ONLY a JSON object {"findings":[{"url","title","snippet","retrievedAt"}]} with at most `limit` entries to `respondTo`. ' +
              "Include only results the search actually returned; never fabricate a URL.",
            query,
            limit,
            respondTo: responsePath,
            responseSchema: z.toJSONSchema(researchResponseSchema),
          },
          null,
          2,
        ),
      );
      throw new ResearchPendingError(requestPath, responsePath);
    },
  };
}
