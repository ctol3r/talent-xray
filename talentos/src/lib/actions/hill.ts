"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { readHill, writeHill } from "@/lib/services/hill";
import {
  addScope,
  finishScope,
  moveScope,
  removeScope,
  renameScope,
  snapshot,
  splitScope,
} from "../../../artifact-src/core/hill";
import { act, type ActionResult } from "./helpers";

/**
 * Every change to a chart goes through one action, because every change is the
 * same shape: read the chart, apply one edit, take a snapshot, write it back.
 *
 * The snapshot is not optional and is not a separate button. A move nobody
 * recorded is a move the trail cannot show, and the trail is the whole reason
 * the chart is worth more than a status field — so recording is what moving
 * means here.
 */
const move = z.object({
  kind: z.literal("move"),
  scopeId: z.string().min(1),
  position: z.number().min(0).max(1),
});
const note = z.object({ kind: z.literal("note"), note: z.string().max(600) });
const add = z.object({
  kind: z.literal("add"),
  name: z.string().min(1).max(120),
  unknown: z.string().max(400).default(""),
});
const rename = z.object({
  kind: z.literal("rename"),
  scopeId: z.string().min(1),
  name: z.string().min(1).max(120),
  unknown: z.string().max(400).optional(),
});
const split = z.object({
  kind: z.literal("split"),
  scopeId: z.string().min(1),
  firstName: z.string().min(1).max(120),
  secondName: z.string().min(1).max(120),
});
const finish = z.object({
  kind: z.literal("finish"),
  scopeId: z.string().min(1),
  done: z.boolean(),
});
const drop = z.object({ kind: z.literal("drop"), scopeId: z.string().min(1) });

const input = z.object({
  jobId: z.string().min(1),
  /** Whose judgement this is. A chart with no author is one nobody will argue with. */
  by: z.string().max(80).default("you"),
  edit: z.discriminatedUnion("kind", [
    move,
    note,
    add,
    rename,
    split,
    finish,
    drop,
  ]),
});

export async function editHillAction(
  raw: unknown,
): Promise<ActionResult<undefined>> {
  return act(async () => {
    const { jobId, by, edit } = input.parse(raw);
    const db = getDb();
    const before = readHill(db, jobId);
    const now = new Date().toISOString();

    let chart = before;
    let why = "";
    switch (edit.kind) {
      case "move":
        chart = moveScope(before, edit.scopeId, edit.position);
        break;
      case "note":
        why = edit.note;
        break;
      case "add":
        chart = addScope(before, edit.name, edit.unknown);
        why = `added "${edit.name}"`;
        break;
      case "rename":
        chart = renameScope(before, edit.scopeId, edit.name, edit.unknown);
        break;
      case "split":
        chart = splitScope(
          before,
          edit.scopeId,
          edit.firstName,
          edit.secondName,
        );
        why = `split into "${edit.firstName}" and "${edit.secondName}"`;
        break;
      case "finish":
        chart = finishScope(before, edit.scopeId, edit.done ? now : null);
        why = edit.done ? "finished" : "back on the hill";
        break;
      case "drop":
        chart = removeScope(before, edit.scopeId);
        why = "dropped a scope";
        break;
    }

    writeHill(db, jobId, snapshot(chart, by, why, now));
    revalidatePath(`/searches/${jobId}/hill`);
    revalidatePath(`/searches/${jobId}`);
    return undefined;
  });
}
