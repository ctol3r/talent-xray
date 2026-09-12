import { ZodError } from "zod";
import {
  GenerationFailedError,
  GenerationRefusedError,
  ProviderNotConfiguredError,
} from "@/lib/ai/provider";
import { SessionFulfillmentPendingError } from "@/lib/ai/session";
import { ResearchPendingError } from "@/lib/research/session-research";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: string;
      kind: "validation" | "provider" | "refused" | "error" | "pending";
      /**
       * Set when `kind` is "pending": the two file paths of the session
       * handoff. Nothing failed — the app is waiting for a Claude session to
       * answer, and the UI says so rather than showing a red error.
       */
      handoff?: { requestPath: string; responsePath: string };
    };

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
    // A session handoff is not a failure. It is the app asking for the one
    // thing it cannot do without a model key: an answer from a Claude
    // session. The UI renders this as a waiting state with the file to hand
    // over, because showing it in red taught the owner the feature was broken.
    if (
      error instanceof SessionFulfillmentPendingError ||
      error instanceof ResearchPendingError
    ) {
      return {
        ok: false,
        kind: "pending",
        error: error.message,
        handoff: {
          requestPath: error.requestPath,
          responsePath: error.responsePath,
        },
      };
    }
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, kind: "error", error: message };
  }
}
