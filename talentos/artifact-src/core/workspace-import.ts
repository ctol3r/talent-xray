/**
 * Taking a workspace bundle into the portable build.
 *
 * The bundle is already in this store's own shape, so this is a merge and not
 * a translation — every field arrives as `saveSearch` and `saveCandidate`
 * already expect it. Going through the store rather than writing localStorage
 * directly is what makes the import work identically on both backends: with
 * the `db` capability granted the same call lands in the document store, and
 * without it, in localStorage.
 *
 * Merge, never replace-all. A job the bundle names is overwritten by the
 * bundle's version; a job it does not name is left exactly where it is. That
 * matters because the portable build is where work gets done on a phone with
 * no app running, and an import that cleared the desk would throw that away.
 * The bundled example search is left alone too — deleting anything is the
 * owner's call, not an import's side effect.
 */
import type { WorkspaceBundle } from "@/lib/core/workspace-bundle";
import type { SearchFacts } from "./search-context";
import type { StoredCandidate } from "./store";

/**
 * Structurally what `store` already offers, named so a test can hand this
 * function a fake instead of a browser.
 */
export interface WorkspaceStore {
  listSearches(): Promise<SearchFacts[]>;
  saveSearch(facts: SearchFacts): Promise<void>;
  saveCandidate(searchId: string, candidate: StoredCandidate): Promise<void>;
}

export interface ImportOutcome {
  /** Jobs written, whether they were new or overwritten. */
  searches: number;
  candidates: number;
  /** Of those jobs, how many were already here under the same id. */
  replaced: number;
  exportedAt: string;
}

export async function importWorkspace(
  bundle: WorkspaceBundle,
  store: WorkspaceStore,
): Promise<ImportOutcome> {
  const existing = new Set((await store.listSearches()).map((s) => s.id));
  let searches = 0;
  let candidates = 0;
  let replaced = 0;

  for (const [id, incoming] of Object.entries(bundle.searches)) {
    if (existing.has(id)) replaced += 1;
    // The id on the facts wins over the key, so a hand-edited bundle whose
    // key and id disagree cannot write a job that nothing can find again.
    await store.saveSearch({ ...incoming.facts, id });
    searches += 1;
    for (const candidate of Object.values(incoming.candidates)) {
      await store.saveCandidate(id, candidate);
      candidates += 1;
    }
  }

  return { searches, candidates, replaced, exportedAt: bundle.exportedAt };
}

/** What the import did, in one sentence somebody can read at a glance. */
export function describeOutcome(outcome: ImportOutcome): string {
  const jobs = `${outcome.searches} ${outcome.searches === 1 ? "job" : "jobs"}`;
  const people = `${outcome.candidates} ${outcome.candidates === 1 ? "person" : "people"}`;
  const again =
    outcome.replaced > 0
      ? ` — ${outcome.replaced} already here, overwritten`
      : "";
  return `Imported ${jobs} and ${people}${again}.`;
}
