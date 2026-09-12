import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { candidates, documentVersions, jobDescriptions } from "@/lib/db/schema";

/** Additive and idempotent. No original-file or extraction claims for old text. */
export function backfillLegacyDocuments(db: Db) {
  db.transaction((tx) => {
    for (const c of tx.select().from(candidates).all()) {
      if (!c.resumeText?.trim()) continue;
      const exists = tx
        .select()
        .from(documentVersions)
        .where(eq(documentVersions.candidateId, c.id))
        .get();
      if (!exists)
        tx.insert(documentVersions)
          .values({
            id: `legacy-cv-${c.id}`,
            searchProjectId: c.searchProjectId,
            candidateId: c.id,
            kind: "cv",
            text: c.resumeText,
            contentHash: createHash("sha256")
              .update(c.resumeText)
              .digest("hex"),
            extractionStatus: "legacy",
            createdAt: c.updatedAt,
          })
          .run();
    }
    const owners = new Set(
      tx
        .select()
        .from(documentVersions)
        .all()
        .filter((d) => d.kind === "jd")
        .map((d) => d.searchProjectId),
    );
    for (const jd of tx.select().from(jobDescriptions).all()) {
      if (!jd.rawText.trim() || owners.has(jd.searchProjectId)) continue;
      tx.insert(documentVersions)
        .values({
          id: `legacy-jd-${jd.id}`,
          searchProjectId: jd.searchProjectId,
          kind: "jd",
          text: jd.rawText,
          contentHash: createHash("sha256").update(jd.rawText).digest("hex"),
          extractionStatus: "legacy",
          createdAt: jd.createdAt,
        })
        .run();
    }
  });
}
