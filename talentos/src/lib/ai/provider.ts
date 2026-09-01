import type { z } from "zod";

/** One structured-generation request. The zod schema IS the contract. */
export interface StructuredRequest<T> {
  schema: z.ZodType<T>;
  schemaName: string;
  system: string;
  user: string;
  maxTokens?: number;
}

export interface ModelProvider {
  readonly name: string;
  readonly model: string;
  generateStructured<T>(request: StructuredRequest<T>): Promise<T>;
}

export class ProviderNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderNotConfiguredError";
  }
}

export class GenerationRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenerationRefusedError";
  }
}

export class GenerationFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenerationFailedError";
  }
}

export type ProviderKind = "anthropic" | "mock";

export function resolveProviderKind(): ProviderKind {
  const configured = process.env.TALENTOS_MODEL_PROVIDER?.toLowerCase();
  return configured === "mock" ? "mock" : "anthropic";
}

export function resolveModelId(): string {
  return process.env.TALENTOS_MODEL ?? "claude-opus-5";
}

export interface ProviderStatus {
  kind: ProviderKind;
  model: string;
  configured: boolean;
  detail: string;
}

/**
 * Whether AI features can run. With nothing configured the UI shows this
 * status instead of generating anything — output is never faked.
 */
export function getProviderStatus(): ProviderStatus {
  const kind = resolveProviderKind();
  if (kind === "mock") {
    return {
      kind,
      model: "mock",
      configured: true,
      detail:
        "Mock provider (TALENTOS_MODEL_PROVIDER=mock). Output is deterministic test fixture data, watermarked as mock — not real analysis.",
    };
  }
  const hasCredential = Boolean(
    process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN,
  );
  return {
    kind,
    model: resolveModelId(),
    configured: hasCredential,
    detail: hasCredential
      ? `Anthropic · ${resolveModelId()}`
      : "No Anthropic credential found. Set ANTHROPIC_API_KEY (or ANTHROPIC_AUTH_TOKEN) in .env — see .env.example.",
  };
}
