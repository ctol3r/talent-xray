"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { readRequestPayload, submitResponse } from "@/lib/services/outbox";
import { type ActionResult } from "./helpers";

const submitInput = z.object({
  /** The filename stem of the request being answered. */
  id: z.string().min(3).max(120),
  /** The response JSON, as pasted. Checked against the schema before anything is written. */
  response: z.string().min(1).max(2_000_000),
});

export interface SubmitOutcome {
  /** True when the answer reached the place the app renders it, without another ask. */
  collected: boolean;
  /** Where it went, or what to do next if it did not go anywhere on its own. */
  where: string;
}

/**
 * Answer one request.
 *
 * A rejected paste comes back as a validation failure naming the field,
 * because that is the only feedback that shortens the loop — "invalid
 * response" sends somebody back to a thousand-line prompt with nothing to
 * look for. The service writes nothing at all unless the paste parses and
 * validates, so a rejection here means the outbox is exactly as it was.
 *
 * This does not use the `act` envelope. `act` turns a thrown error into a
 * result, and a response that does not match its schema is not an error —
 * it is this action's ordinary negative answer, and dressing it as an
 * exception to get it through a helper would obscure that.
 */
export async function submitOutboxResponseAction(
  input: unknown,
): Promise<ActionResult<SubmitOutcome>> {
  const parsed = submitInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      kind: "validation",
      error: parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; "),
    };
  }

  try {
    const result = await submitResponse(
      getDb(),
      parsed.data.id,
      parsed.data.response,
    );
    if (!result.ok) {
      return { ok: false, kind: "validation", error: result.error };
    }
    revalidatePath("/outbox");
    revalidatePath("/", "layout");
    return {
      ok: true,
      data: { collected: result.collected, where: result.where },
    };
  } catch (error) {
    return {
      ok: false,
      kind: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * The whole request, for the copy button.
 *
 * Read here rather than sent with the list because a prompt can be a hundred
 * kilobytes and the queue can be dozens of them; the page would otherwise
 * cost megabytes to render a handful of rows.
 */
export async function readOutboxRequestAction(
  input: unknown,
): Promise<ActionResult<{ payload: string }>> {
  const parsed = z.object({ id: z.string().min(3).max(120) }).safeParse(input);
  if (!parsed.success) {
    return { ok: false, kind: "validation", error: "Not a request id." };
  }
  const payload = readRequestPayload(parsed.data.id);
  if (payload === null) {
    return {
      ok: false,
      kind: "error",
      error: `No request called ${parsed.data.id} is in the outbox.`,
    };
  }
  return { ok: true, data: { payload } };
}
