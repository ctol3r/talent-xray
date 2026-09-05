"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import { act } from "./helpers";
import {
  importDocument,
  saveDocument,
  saveDocumentInput,
} from "@/lib/services/documents";
import {
  prepareDocumentArtifact,
  importDocumentArtifact,
  addConnection,
  correctConnection,
  recordReview,
  saveConclusion,
  startComparison,
} from "@/lib/services/document-review";
import { addReviewRequirement } from "@/lib/services/intelligence";
import {
  MAX_FILE_BYTES,
  documentKind,
  linkInputSchema,
} from "@/lib/documents/contracts";
const owner = z.object({
  searchProjectId: z.string().min(1),
  candidateId: z.string().optional(),
  kind: documentKind,
});
function refresh() {
  revalidatePath("/searches", "layout");
}
export async function saveDocumentAction(raw: unknown) {
  return act(async () => {
    const doc = saveDocument(getDb(), saveDocumentInput.parse(raw));
    refresh();
    return doc.id;
  });
}
export async function importDocumentAction(form: FormData) {
  return act(async () => {
    const input = owner.parse({
      searchProjectId: form.get("searchProjectId"),
      candidateId: form.get("candidateId") || undefined,
      kind: form.get("kind"),
    });
    const file = form.get("file");
    if (!(file instanceof File) || !file.size)
      throw new Error("Choose a PDF or DOCX file.");
    if (file.size > MAX_FILE_BYTES) throw new Error("File exceeds 20 MiB.");
    const doc = await importDocument(
      getDb(),
      input,
      new Uint8Array(await file.arrayBuffer()),
      file.name,
    );
    refresh();
    return doc.id;
  });
}
export async function startComparisonAction(raw: unknown) {
  return act(async () => {
    const p = z
      .object({ searchProjectId: z.string(), candidateId: z.string() })
      .parse(raw);
    const c = startComparison(getDb(), p.searchProjectId, p.candidateId);
    refresh();
    return c.id;
  });
}
export async function addConnectionAction(raw: unknown) {
  return act(async () => {
    const p = z
      .object({
        comparisonId: z.string(),
        link: linkInputSchema,
        replacesId: z.string().optional(),
      })
      .parse(raw);
    const db = getDb();
    const link = p.replacesId
      ? correctConnection(db, p.comparisonId, p.replacesId, p.link)
      : addConnection(db, p.comparisonId, p.link);
    refresh();
    return link.id;
  });
}
export async function reviewConnectionAction(raw: unknown) {
  return act(async () => {
    const r = recordReview(getDb(), raw);
    refresh();
    return r.id;
  });
}
export async function addRequirementAction(raw: unknown) {
  return act(async () => {
    const r = await addReviewRequirement(getDb(), raw);
    refresh();
    return r.id;
  });
}
export async function saveReviewConclusionAction(raw: unknown) {
  return act(async () => {
    const p = z
      .object({ comparisonId: z.string(), conclusion: z.string().max(12000) })
      .parse(raw);
    saveConclusion(getDb(), p.comparisonId, p.conclusion);
    refresh();
    return p.comparisonId;
  });
}

export async function prepareReviewArtifactAction(raw: unknown) {
  return act(async () =>
    prepareDocumentArtifact(getDb(), z.string().min(1).parse(raw)),
  );
}
export async function importReviewArtifactAction(raw: unknown) {
  return act(async () => {
    const r = await importDocumentArtifact(getDb(), raw);
    refresh();
    return r;
  });
}

export async function saveShortlistDraftAction(raw: unknown) {
  return act(async () => {
    const { saveShortlistDraft } =
      await import("@/lib/services/review-shortlist");
    const r = saveShortlistDraft(getDb(), raw);
    refresh();
    return r;
  });
}
export async function exportShortlistDraftAction(raw: unknown) {
  return act(async () => {
    const { exportShortlistDraft } =
      await import("@/lib/services/review-shortlist");
    return exportShortlistDraft(getDb(), z.string().min(1).parse(raw));
  });
}
