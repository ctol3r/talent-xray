import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import { searchProjects, settings } from "@/lib/db/schema";
import {
  compensationInputSchema,
  recommendCompensation,
} from "@/lib/core/compensation";

const recordSchema = z.object({
  contextHash: z.string(),
  savedAt: z.iso.datetime(),
  input: compensationInputSchema,
});
export function compensationWorkspace(db: Db, projectId: string) {
  const project = db
    .select()
    .from(searchProjects)
    .where(eq(searchProjects.id, projectId))
    .get();
  if (!project) throw new Error("Search not found.");
  const context = {
    role: project.roleTitle,
    seniority: project.seniority,
    industry: project.industry,
    geography: project.geography,
    country: project.country,
    region: project.region,
    employmentType: project.employmentType,
    workArrangement: project.workArrangement,
  };
  const contextHash = createHash("sha256")
    .update(JSON.stringify(context))
    .digest("hex");
  const row = db
    .select()
    .from(settings)
    .where(eq(settings.key, `compensation:${projectId}`))
    .get();
  const saved = row ? recordSchema.parse(row.value) : null;
  const stale = Boolean(saved && saved.contextHash !== contextHash);
  return {
    context,
    contextHash,
    saved,
    stale,
    recommendation: saved && !stale ? recommendCompensation(saved.input) : null,
  };
}
export function saveCompensation(db: Db, raw: unknown) {
  const p = z
    .object({
      projectId: z.string().min(1),
      contextHash: z.string(),
      input: compensationInputSchema,
    })
    .parse(raw);
  const w = compensationWorkspace(db, p.projectId);
  if (w.contextHash !== p.contextHash)
    throw new Error(
      "The role context changed. Reload and review the compensation sources again.",
    );
  const value = {
    contextHash: w.contextHash,
    savedAt: new Date().toISOString(),
    input: p.input,
  };
  db.insert(settings)
    .values({ key: `compensation:${p.projectId}`, value })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value, updatedAt: value.savedAt },
    })
    .run();
  return compensationWorkspace(db, p.projectId);
}
