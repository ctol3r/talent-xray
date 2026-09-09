/**
 * The envelope every server action returns.
 *
 * One case exists because of a real misreading: with no model key, generation
 * is fulfilled by a Claude session through a file handoff, and the app throws
 * a "pending" error while it waits. That was rendered in red like a crash,
 * and the owner concluded the evidence-alignment and outreach features were
 * broken. They were not — nobody had answered the request file.
 *
 * So a handoff must never map to the same kind as a failure, and it must
 * carry the two paths the UI needs to tell the owner what to do next.
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { act } from "@/lib/actions/helpers";
import {
  GenerationFailedError,
  GenerationRefusedError,
  ProviderNotConfiguredError,
} from "@/lib/ai/provider";
import { SessionFulfillmentPendingError } from "@/lib/ai/session";
import { ResearchPendingError } from "@/lib/research/session-research";

const REQUEST = "/tmp/outbox/EvidenceAlignment-abc.request.json";
const RESPONSE = "/tmp/outbox/EvidenceAlignment-abc.response.json";

async function envelope(error: unknown) {
  return act(async () => {
    throw error;
  });
}

describe("waiting is not failing", () => {
  it("gives a generation handoff its own kind and both paths", async () => {
    const result = await envelope(
      new SessionFulfillmentPendingError(REQUEST, RESPONSE),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe("pending");
    expect(result.handoff).toEqual({
      requestPath: REQUEST,
      responsePath: RESPONSE,
    });
  });

  it("gives a research handoff the same treatment", async () => {
    const result = await envelope(new ResearchPendingError(REQUEST, RESPONSE));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe("pending");
    expect(result.handoff?.responsePath).toBe(RESPONSE);
  });

  it("keeps every real failure distinguishable from waiting", async () => {
    const cases: [string, unknown, string][] = [
      ["provider", new ProviderNotConfiguredError("no key"), "provider"],
      ["refused", new GenerationRefusedError("refused"), "refused"],
      ["failed", new GenerationFailedError("bad JSON"), "error"],
      ["thrown", new Error("boom"), "error"],
      ["validation", new z.ZodError([]), "validation"],
    ];
    for (const [name, error, expected] of cases) {
      const result = await envelope(error);
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(`${name} → ${result.kind}`).toBe(`${name} → ${expected}`);
      expect(`${name} → ${result.handoff === undefined}`).toBe(
        `${name} → true`,
      );
    }
  });
});
