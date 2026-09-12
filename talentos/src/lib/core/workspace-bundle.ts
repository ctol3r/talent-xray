/**
 * The workspace bundle — one file that carries a desk between the app and
 * the portable build.
 *
 * The app keeps its workspace in 47 normalised SQLite tables; the portable
 * build keeps its own in a document store under `talentos-lite-v1`. They are
 * different shapes for good reasons, so something has to translate, and the
 * question is only which shape the file on disk should be.
 *
 * It is the portable build's shape, not a third invented one. `LocalShape` in
 * `artifact-src/core/store.ts` is already `{searches: {id: {facts,
 * candidates, artifacts}}}`, which means import is a merge rather than a
 * second mapper — and a mapper nobody wrote is a mapper that cannot drift.
 * The app exports *into* that shape; the portable build reads what it already
 * speaks.
 *
 * Why a file at all, when a hosted store would need no carrying: the
 * `.gitignore` beside the database says candidate data never leaves this
 * machine, and a bundle the owner saves and opens themselves is the only
 * version of "portable" that survives the first real candidate landing in it.
 *
 * `kind` and `version` are here so a wrong file is refused by name rather
 * than by stack trace. Everything in this module is pure: no filesystem, no
 * database, no DOM, so both shells and the tests can call it directly.
 */
import { z } from "zod";
import { PRODUCT_NAME } from "../product";
import { searchFactsSchema } from "../../../artifact-src/core/search-context";

/** The tell. A JSON file without this is not ours, whatever it is. */
export const WORKSPACE_BUNDLE_KIND = "talentos.workspace";

/**
 * Bumped only when an older bundle would be read wrongly rather than merely
 * incompletely — the store's own normalizers already fill in absent fields.
 */
export const WORKSPACE_BUNDLE_VERSION = 1;

/**
 * A candidate as the portable build stores one. Deliberately narrower than
 * the `candidates` table: stage, disposition, hiring-manager feedback and the
 * Article 14 notice trail stay in the app, because the portable build has no
 * surface that shows them and a field nothing renders is a field that rots.
 */
export const bundledCandidateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  currentTitle: z.string().optional(),
  currentCompany: z.string().optional(),
  geography: z.string().optional(),
  profileUrls: z.array(z.string()).default([]),
  notes: z.string().optional(),
  pastedText: z.string().optional(),
  createdAt: z.string(),
});
export type BundledCandidate = z.infer<typeof bundledCandidateSchema>;

export const bundledSearchSchema = z.object({
  facts: searchFactsSchema,
  candidates: z.record(z.string(), bundledCandidateSchema).default({}),
  /**
   * Generated modules travel as opaque records. The bundle does not validate
   * their payloads: the store's `normalizeRecord` already does, and
   * re-stating those shapes here would be a second copy to keep in step.
   */
  artifacts: z.record(z.string(), z.unknown()).default({}),
});
export type BundledSearch = z.infer<typeof bundledSearchSchema>;

export const workspaceBundleSchema = z.object({
  kind: z.literal(WORKSPACE_BUNDLE_KIND),
  version: z.literal(WORKSPACE_BUNDLE_VERSION),
  exportedAt: z.string(),
  /** Which shell wrote it, so a support question has an answer. */
  source: z.string().default("talentos-app"),
  /** The portable build's store version at export time. */
  storeVersion: z.number().int().positive(),
  searches: z.record(z.string(), bundledSearchSchema).default({}),
});
export type WorkspaceBundle = z.infer<typeof workspaceBundleSchema>;

export interface BundleCounts {
  searches: number;
  candidates: number;
}

export function countBundle(bundle: WorkspaceBundle): BundleCounts {
  const searches = Object.values(bundle.searches);
  return {
    searches: searches.length,
    candidates: searches.reduce(
      (total, search) => total + Object.keys(search.candidates).length,
      0,
    ),
  };
}

/**
 * A filename that says what the file is and when it was taken, because a
 * folder of `workspace.json` is a folder nobody can choose from.
 */
export function bundleFilename(exportedAt: string): string {
  const stamp = exportedAt.replace(/[:.]/g, "-").replace(/Z$/, "");
  return `talentos-workspace-${stamp}.json`;
}

export class BundleShapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BundleShapeError";
  }
}

/**
 * Parse whatever was opened, or say which field was wrong.
 *
 * The outbox already established the standard this follows: a malformed
 * paste is refused with the offending field named, never written half-way.
 * An import that silently dropped a malformed search would be worse here,
 * because the file is the only copy the portable build is ever handed.
 */
export function readBundle(raw: unknown): WorkspaceBundle {
  const parsed = workspaceBundleSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  const first = parsed.error.issues[0];
  const where = first?.path.join(".") || "(root)";
  const looksForeign =
    typeof raw === "object" &&
    raw !== null &&
    (raw as { kind?: unknown }).kind !== WORKSPACE_BUNDLE_KIND;
  throw new BundleShapeError(
    looksForeign
      ? `This is not a ${PRODUCT_NAME} workspace file — it has no "kind": "${WORKSPACE_BUNDLE_KIND}".`
      : `${where}: ${first?.message ?? "did not match the workspace shape"}`,
  );
}
