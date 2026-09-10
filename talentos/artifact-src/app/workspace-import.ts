/**
 * Opening a workspace file in the portable build.
 *
 * Everything here happens in the page: `FileReader` reads what the owner
 * picked, the bundle is validated, and the store writes it wherever the store
 * already writes. No request is made and nothing is uploaded — which is the
 * property the whole file-based design exists to preserve, and the reason the
 * rail says so in the copy rather than leaving it to be assumed.
 *
 * A refusal names the field that was wrong, the same way the outbox refuses a
 * malformed paste. Silence, or a generic "invalid file", would leave somebody
 * holding the only copy of their desk with no idea which line to look at.
 */
import { $ } from "../core/dom";
import { BundleShapeError, readBundle } from "@/lib/core/workspace-bundle";
import { describeOutcome, importWorkspace } from "../core/workspace-import";
import { store } from "../core/store";
import { reloadSearches, selectSearch, state } from "./state";
import { render } from "../ui/shell";

function say(message: string, tone: "" | "ok" | "bad"): void {
  const note = $("#import-workspace-status");
  if (!note) return;
  note.className = tone ? `rail-note ${tone}` : "rail-note";
  note.textContent = message;
}

async function take(file: File): Promise<void> {
  say(`Reading ${file.name}…`, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    say("That file is not JSON.", "bad");
    return;
  }
  try {
    const bundle = readBundle(parsed);
    const outcome = await importWorkspace(bundle, store);
    await reloadSearches();
    // Land on something that came out of the file, so the import is visible
    // rather than merely reported.
    const first = Object.keys(bundle.searches)[0];
    if (first) await selectSearch(first);
    else if (state.searches[0]) await selectSearch(state.searches[0].id);
    render();
    say(describeOutcome(outcome), "ok");
  } catch (error) {
    say(
      error instanceof BundleShapeError
        ? error.message
        : `Import failed: ${(error as Error).message}`,
      "bad",
    );
  }
}

export function installWorkspaceImport(): void {
  const button = $("#import-workspace-btn");
  const input = $("#import-workspace-file") as HTMLInputElement | null;
  if (!button || !input) return;
  button.addEventListener("click", () => input.click());
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    // Cleared so picking the same file twice fires `change` the second time —
    // which somebody will do after fixing a bundle by hand.
    input.value = "";
    if (file) void take(file);
  });
}
