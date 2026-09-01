import { createHash } from "node:crypto";
import type { z } from "zod";
import type { GenerationMeta } from "@/lib/core/enums";
import { ensureIds } from "@/lib/core/payloads";
import {
  scanPayloadForProtectedTraits,
  type TraitScanHit,
} from "@/lib/domain/fair-hiring";
import type { Db } from "@/lib/db/client";
import { aiGenerations } from "@/lib/db/schema";
import { createAnthropicProvider } from "./anthropic";
import {
  createSessionProvider,
  SessionFulfillmentPendingError,
} from "./session";
import {
  GenerationRefusedError,
  ProviderNotConfiguredError,
  getProviderStatus,
  type ModelProvider,
} from "./provider";

/**
 * One generative capability. `mock` produces deterministic, watermarked
 * fixture output so tests and the e2e critical path run without secrets —
 * it is used ONLY when TALENTOS_MODEL_PROVIDER=mock.
 */
export interface AiTaskDef<C, T> {
  task: string;
  schemaName: string;
  schema: z.ZodType<T>;
  system: (ctx: C) => string;
  user: (ctx: C) => string;
  mock: (ctx: C) => T;
  maxTokens?: number;
}

export function defineAiTask<C, T>(def: AiTaskDef<C, T>): AiTaskDef<C, T> {
  return def;
}

export interface AiRunResult<T> {
  output: T;
  meta: GenerationMeta;
  /** Protected-trait references found in the output → mandatory review. */
  warnings: TraitScanHit[];
}

interface RunOptions {
  db: Db;
  searchProjectId?: string;
  candidateId?: string;
}

function contextHash(system: string, user: string): string {
  return createHash("sha256")
    .update(system)
    .update("\n")
    .update(user)
    .digest("hex")
    .slice(0, 16);
}

/**
 * The AI pipeline (ARCHITECTURE.md §3): context is already assembled by the
 * caller into `ctx`; this runs generation → schema validation → fair-hiring
 * scan → audit logging. Persisting the draft is the calling service's job.
 */
export async function runAiTask<C, T>(
  def: AiTaskDef<C, T>,
  ctx: C,
  options: RunOptions,
): Promise<AiRunResult<T>> {
  const status = getProviderStatus();
  if (!status.configured) {
    throw new ProviderNotConfiguredError(status.detail);
  }

  const system = def.system(ctx);
  const user = def.user(ctx);
  const hash = contextHash(system, user);
  const startedAt = Date.now();

  const audit = async (
    generationStatus: "ok" | "failed" | "refused",
    error?: string,
  ) => {
    await options.db.insert(aiGenerations).values({
      task: def.task,
      provider: status.kind,
      model: status.model,
      status: generationStatus,
      contextHash: hash,
      durationMs: Date.now() - startedAt,
      error,
      searchProjectId: options.searchProjectId,
      candidateId: options.candidateId,
    });
  };

  let raw: T;
  try {
    if (status.kind === "mock") {
      raw = def.mock(ctx);
    } else {
      const provider: ModelProvider =
        status.kind === "session"
          ? createSessionProvider(status.model)
          : createAnthropicProvider(status.model);
      raw = await provider.generateStructured({
        schema: def.schema,
        schemaName: def.schemaName,
        system,
        user,
        maxTokens: def.maxTokens,
      });
    }
  } catch (error) {
    // A pending session handoff is not a failed generation — no audit row.
    if (error instanceof SessionFulfillmentPendingError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    await audit(
      error instanceof GenerationRefusedError ? "refused" : "failed",
      message,
    );
    throw error;
  }

  // Validate even mock output — the schema is the contract for everyone.
  const parsed = def.schema.parse(raw);
  const output = ensureIds(parsed);
  const warnings = scanPayloadForProtectedTraits(output);
  await audit("ok");

  return {
    output,
    meta: {
      provider: status.kind,
      model: status.model,
      generatedAt: new Date().toISOString(),
      contextHash: hash,
    },
    warnings,
  };
}
