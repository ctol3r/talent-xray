"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { parseSaveLines } from "@/lib/domain/discovery";
import {
  acceptDeclaredLink,
  acceptDeclaredLinkInput,
  readDeclaredLinks,
  readDeclaredLinksInput,
  type DeclaredReadResult,
} from "@/lib/services/declared-links";
import {
  addProfileLink,
  addProfileLinkInput,
  clearSurfaceOptIn,
  findCandidatesByUrl,
  moveProfileLink,
  removeProfileLink,
  setJurisdiction,
  setJurisdictionInput,
  setSurfaceOptIn,
  surfaceOptInInput,
  suppressUrl,
  suppressUrlInput,
  FamilyOffError,
} from "@/lib/services/profile-links";
import { act, type ActionResult } from "./helpers";

const withPath = z.object({ searchProjectId: z.string().min(1) });

/**
 * Add one or more addresses. The box takes one URL per line so keeping ten
 * links is one act, not ten; a line that fails the guard is reported by
 * itself and the rest are still saved, because refusing the whole paste for
 * one bad line makes a long list unusable.
 */
export async function addProfileLinksAction(input: unknown): Promise<
  ActionResult<{
    added: number;
    duplicates: number;
    conflicts: { name: string; reason: string }[];
    refused: { url: string; message: string; family?: string }[];
  }>
> {
  return act(async () => {
    const parsed = z
      .object({
        searchProjectId: z.string().min(1),
        candidateId: z.string().min(1),
        text: z.string().min(1).max(20_000),
        whyNote: z.string().max(200).optional(),
        fromPerson: z.boolean().default(false),
      })
      .parse(input);
    const { saves, rejected } = parseSaveLines(parsed.text);
    const db = getDb();
    let added = 0;
    let duplicates = 0;
    const conflicts: { name: string; reason: string }[] = [];
    const refused: { url: string; message: string; family?: string }[] =
      rejected.map((line) => ({
        url: line,
        message: "Not a complete http(s) address.",
      }));

    for (const save of saves) {
      try {
        const result = addProfileLink(db, {
          candidateId: parsed.candidateId,
          url: save.url,
          ...(save.candidateName ? { label: save.candidateName } : {}),
          ...(parsed.whyNote ? { whyNote: parsed.whyNote } : {}),
          addedVia: "manual",
          provenance: parsed.fromPerson
            ? "candidate_provided"
            : "recruiter_added",
          ...(parsed.fromPerson
            ? { confirmedAt: new Date().toISOString() }
            : {}),
        });
        if (result.duplicate) duplicates += 1;
        else added += 1;
        conflicts.push(...result.conflicts);
      } catch (error) {
        refused.push({
          url: save.url,
          message: error instanceof Error ? error.message : String(error),
          ...(error instanceof FamilyOffError ? { family: error.family } : {}),
        });
      }
    }
    revalidatePath(`/searches/${parsed.searchProjectId}`, "layout");
    return { added, duplicates, conflicts, refused };
  });
}

export async function addOneProfileLinkAction(
  input: unknown,
): Promise<ActionResult<{ sourceId: string; duplicate: boolean }>> {
  return act(async () => {
    const parsed = addProfileLinkInput
      .extend({ searchProjectId: z.string().min(1) })
      .parse(input);
    const result = addProfileLink(getDb(), parsed);
    revalidatePath(`/searches/${parsed.searchProjectId}`, "layout");
    return { sourceId: result.sourceId, duplicate: result.duplicate };
  });
}

export async function removeProfileLinkAction(
  input: unknown,
): Promise<ActionResult<undefined>> {
  return act(async () => {
    const parsed = withPath
      .extend({
        candidateId: z.string().min(1),
        sourceId: z.string().min(1),
      })
      .parse(input);
    removeProfileLink(getDb(), parsed);
    revalidatePath(`/searches/${parsed.searchProjectId}`, "layout");
    return undefined;
  });
}

export async function moveProfileLinkAction(
  input: unknown,
): Promise<ActionResult<undefined>> {
  return act(async () => {
    const parsed = withPath
      .extend({
        sourceId: z.string().min(1),
        toCandidateId: z.string().min(1),
      })
      .parse(input);
    moveProfileLink(getDb(), parsed);
    revalidatePath(`/searches/${parsed.searchProjectId}`, "layout");
    return undefined;
  });
}

export async function setSurfaceOptInAction(
  input: unknown,
): Promise<ActionResult<undefined>> {
  return act(async () => {
    const parsed = surfaceOptInInput.parse(input);
    setSurfaceOptIn(getDb(), parsed);
    revalidatePath(`/searches/${parsed.searchProjectId}`, "layout");
    return undefined;
  });
}

export async function clearSurfaceOptInAction(
  input: unknown,
): Promise<ActionResult<undefined>> {
  return act(async () => {
    const parsed = z
      .object({
        searchProjectId: z.string().min(1),
        family: z.string().min(1),
      })
      .parse(input);
    clearSurfaceOptIn(getDb(), {
      searchProjectId: parsed.searchProjectId,
      family: parsed.family as never,
    });
    revalidatePath(`/searches/${parsed.searchProjectId}`, "layout");
    return undefined;
  });
}

export async function setJurisdictionAction(
  input: unknown,
): Promise<ActionResult<undefined>> {
  return act(async () => {
    const parsed = setJurisdictionInput.parse(input);
    setJurisdiction(getDb(), parsed);
    revalidatePath(`/searches/${parsed.searchProjectId}`, "layout");
    return undefined;
  });
}

/** Record that a person asked not to be held at an address, and delete it. */
export async function suppressUrlAction(
  input: unknown,
): Promise<ActionResult<undefined>> {
  return act(async () => {
    // A data request arrives from outside any one search, so the project is
    // optional here; the suppression applies everywhere either way.
    const parsed = suppressUrlInput
      .extend({ searchProjectId: z.string().min(1).optional() })
      .parse(input);
    suppressUrl(getDb(), parsed);
    if (parsed.searchProjectId) {
      revalidatePath(`/searches/${parsed.searchProjectId}`, "layout");
    }
    revalidatePath("/settings");
    return undefined;
  });
}

/** Who is held at this address, across every search. For a data request. */
export async function findCandidatesByUrlAction(input: unknown): Promise<
  ActionResult<{
    hits: { candidateId: string; name: string; searchProjectId: string }[];
  }>
> {
  return act(async () => {
    const parsed = z.object({ url: z.string().min(8).max(2048) }).parse(input);
    return { hits: findCandidatesByUrl(getDb(), parsed.url) };
  });
}

export async function readDeclaredLinksAction(
  input: unknown,
): Promise<ActionResult<DeclaredReadResult>> {
  return act(async () => {
    const parsed = readDeclaredLinksInput.parse(input);
    return readDeclaredLinks(getDb(), parsed);
  });
}

export async function acceptDeclaredLinkAction(
  input: unknown,
): Promise<ActionResult<{ sourceId: string; duplicate: boolean }>> {
  return act(async () => {
    const parsed = acceptDeclaredLinkInput
      .extend({ searchProjectId: z.string().min(1) })
      .parse(input);
    const result = acceptDeclaredLink(getDb(), parsed);
    revalidatePath(`/searches/${parsed.searchProjectId}`, "layout");
    return { sourceId: result.sourceId, duplicate: result.duplicate };
  });
}
