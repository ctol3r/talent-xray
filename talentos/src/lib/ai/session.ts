import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  GenerationFailedError,
  type ModelProvider,
  type StructuredRequest,
} from "./provider";

/**
 * Session provider: generations are fulfilled by a Claude session (Claude
 * Code, claude.ai) instead of an API call — no API key required; model usage
 * is covered by the user's Claude subscription.
 *
 * Mechanics — a file handoff:
 *   1. A generation call writes `<schemaName>-<hash>.request.json` to the
 *      outbox (system prompt, user prompt, JSON schema, response path) and
 *      throws SessionFulfillmentPendingError.
 *   2. The Claude session reads the request, composes the output, and writes
 *      the JSON object to the named response path.
 *   3. The caller re-runs the same generation; the provider returns the
 *      response, and the normal pipeline (zod validation, fair-hiring scan,
 *      audit, persist) proceeds exactly as with the API provider.
 *
 * The hash covers the prompts, so an unchanged request reuses an existing
 * response (idempotent re-runs); changing any input yields a fresh request.
 */
export class SessionFulfillmentPendingError extends Error {
  constructor(
    readonly requestPath: string,
    readonly responsePath: string,
  ) {
    super(
      `Generation pending: request written to ${requestPath}. ` +
        `A Claude session fulfills it by writing the output JSON to ${responsePath}; then re-run this generation.`,
    );
    this.name = "SessionFulfillmentPendingError";
  }
}

function outboxDir(): string {
  const configured =
    process.env.TALENTOS_SESSION_OUTBOX ?? "./data/session-outbox";
  return path.isAbsolute(configured)
    ? configured
    : path.join(process.cwd(), configured);
}

export function createSessionProvider(model: string): ModelProvider {
  return {
    name: "session",
    model,
    async generateStructured<T>(request: StructuredRequest<T>): Promise<T> {
      const dir = outboxDir();
      fs.mkdirSync(dir, { recursive: true });
      const hash = createHash("sha256")
        .update(request.system)
        .update("\n")
        .update(request.user)
        .digest("hex")
        .slice(0, 12);
      const base = `${request.schemaName}-${hash}`;
      const requestPath = path.join(dir, `${base}.request.json`);
      const responsePath = path.join(dir, `${base}.response.json`);

      if (fs.existsSync(responsePath)) {
        const rawText = fs.readFileSync(responsePath, "utf8");
        try {
          return JSON.parse(rawText) as T;
        } catch {
          throw new GenerationFailedError(
            `Response file ${responsePath} is not valid JSON — fix or delete it and retry.`,
          );
        }
      }

      let outputJsonSchema: unknown;
      try {
        outputJsonSchema = z.toJSONSchema(request.schema);
      } catch {
        outputJsonSchema = undefined;
      }
      fs.writeFileSync(
        requestPath,
        JSON.stringify(
          {
            schemaName: request.schemaName,
            instructions:
              "Compose the highest-quality output satisfying `system` and `user`, " +
              "then write ONLY the output JSON object (no markdown fences) to `respondTo`.",
            respondTo: responsePath,
            system: request.system,
            user: request.user,
            outputJsonSchema,
          },
          null,
          2,
        ),
      );
      throw new SessionFulfillmentPendingError(requestPath, responsePath);
    },
  };
}
