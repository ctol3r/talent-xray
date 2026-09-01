import { ZodError } from "zod";
import {
  GenerationFailedError,
  GenerationRefusedError,
  ProviderNotConfiguredError,
} from "@/lib/ai/provider";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; kind: "validation" | "provider" | "refused" | "error" };

/** Uniform error envelope so the UI can render failures honestly. */
export async function act<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        ok: false,
        kind: "validation",
        error: error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; "),
      };
    }
    if (error instanceof ProviderNotConfiguredError) {
      return { ok: false, kind: "provider", error: error.message };
    }
    if (error instanceof GenerationRefusedError) {
      return { ok: false, kind: "refused", error: error.message };
    }
    if (error instanceof GenerationFailedError) {
      return { ok: false, kind: "error", error: error.message };
    }
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, kind: "error", error: message };
  }
}
