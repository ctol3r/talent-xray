import { createHash, randomUUID } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  realpathSync,
} from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import {
  candidates,
  documentVersions,
  jobDescriptions,
  searchProjects,
} from "@/lib/db/schema";
import { documentKind, MAX_DOCUMENT_CHARS } from "@/lib/documents/contracts";
import { checkedText, extractDocument } from "@/lib/documents/extract";

export const saveDocumentInput = z.object({
  searchProjectId: z.string().min(1),
  candidateId: z.string().optional(),
  kind: documentKind,
  text: z.string().max(MAX_DOCUMENT_CHARS),
  confirmed: z.boolean().default(false),
  previousId: z.string().optional(),
});
export const hashText = (text: string) =>
  createHash("sha256").update(text).digest("hex");
export function privateDocumentDirectory(): string {
  // Runtime-owned private files must never be included in the build trace.
  const dir = path.resolve(
    /* turbopackIgnore: true */
    process.env.TALENTOS_DOCUMENT_DIR ??
      path.join(homedir(), ".local", "share", "talentos", "documents"),
  );
  // Never serve or commit originals as application assets.
  const repo = path.resolve(process.cwd(), "..");
  if (dir === repo || dir.startsWith(repo + path.sep))
    throw new Error("Document storage must be outside the repository.");
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const actual = realpathSync(dir);
  const actualRepo = realpathSync(repo);
  if (actual === actualRepo || actual.startsWith(actualRepo + path.sep))
    throw new Error(
      "Document storage symlinks must not point into the repository.",
    );
  return actual;
}
export function readOriginal(fileId: string): Buffer {
  return readFileSync(
    path.join(privateDocumentDirectory(), z.uuid().parse(fileId)),
  );
}
export function removeOriginal(fileId: string): void {
  rmSync(path.join(privateDocumentDirectory(), z.uuid().parse(fileId)), {
    force: true,
  });
}
function scope(
  db: Db,
  projectId: string,
  candidateId: string | undefined,
  kind: "cv" | "jd",
) {
  if (
    !db
      .select()
      .from(searchProjects)
      .where(eq(searchProjects.id, projectId))
      .get()
  )
    throw new Error("Search not found.");
  if (kind === "cv") {
    const c = candidateId
      ? db.select().from(candidates).where(eq(candidates.id, candidateId)).get()
      : null;
    if (!c || c.searchProjectId !== projectId)
      throw new Error("Candidate does not belong to this search.");
  } else if (candidateId)
    throw new Error("A JD belongs to a search, not a candidate.");
}
export function listDocuments(
  db: Db,
  projectId: string,
  candidateId: string | undefined,
  kind: "cv" | "jd",
) {
  scope(db, projectId, candidateId, kind);
  return db
    .select()
    .from(documentVersions)
    .where(
      and(
        eq(documentVersions.searchProjectId, projectId),
        eq(documentVersions.kind, kind),
        candidateId
          ? eq(documentVersions.candidateId, candidateId)
          : isNull(documentVersions.candidateId),
      ),
    )
    .orderBy(desc(documentVersions.createdAt))
    .all();
}
type Original = { originalFileId: string; filename: string; mediaType: string };
export function saveDocument(
  db: Db,
  raw: z.input<typeof saveDocumentInput>,
  original?: Original,
  projection?: Pick<typeof jobDescriptions.$inferInsert, "source" | "url">,
) {
  const input = saveDocumentInput.parse(raw);
  const text = checkedText(input.text);
  scope(db, input.searchProjectId, input.candidateId, input.kind);
  return db.transaction((tx) => {
    const previous = listDocuments(
      tx,
      input.searchProjectId,
      input.candidateId,
      input.kind,
    )[0];
    if (input.previousId && previous?.id !== input.previousId)
      throw new Error("Document changed elsewhere. Reload before saving.");
    const inherited =
      input.previousId && previous?.originalFileId
        ? {
            originalFileId: previous.originalFileId,
            filename: previous.filename,
            mediaType: previous.mediaType,
          }
        : {};
    const createdAt = new Date(
      Math.max(Date.now(), previous ? Date.parse(previous.createdAt) + 1 : 0),
    ).toISOString();
    const saved = tx
      .insert(documentVersions)
      .values({
        searchProjectId: input.searchProjectId,
        candidateId: input.candidateId,
        kind: input.kind,
        text,
        contentHash: hashText(text),
        extractionStatus: input.confirmed ? "confirmed" : "needs_review",
        previousId: previous?.id,
        createdAt,
        ...inherited,
        ...original,
      })
      .returning()
      .get();
    // Only reviewed text is eligible for downstream generation.
    if (input.confirmed) {
      if (input.kind === "cv")
        tx.update(candidates)
          .set({ resumeText: text, updatedAt: createdAt })
          .where(eq(candidates.id, input.candidateId!))
          .run();
      else
        tx.insert(jobDescriptions)
          .values({
            searchProjectId: input.searchProjectId,
            rawText: text,
            source:
              original || inherited.originalFileId ? "uploaded" : "pasted",
            createdAt,
            ...projection,
          })
          .run();
    }
    return saved;
  });
}
export async function importDocument(
  db: Db,
  owner: { searchProjectId: string; candidateId?: string; kind: "cv" | "jd" },
  bytes: Uint8Array,
  filename: string,
) {
  scope(db, owner.searchProjectId, owner.candidateId, owner.kind);
  const result = await extractDocument(bytes, filename);
  const originalFileId = randomUUID();
  const dest = path.join(privateDocumentDirectory(), originalFileId);
  writeFileSync(dest, bytes, { mode: 0o600, flag: "wx" });
  try {
    return saveDocument(
      db,
      { ...owner, text: result.text },
      {
        originalFileId,
        filename: path.basename(filename),
        mediaType: result.mediaType,
      },
    );
  } catch (error) {
    rmSync(dest, { force: true });
    throw error;
  }
}
