/**
 * TalentOS — single-file artifact entry. Built by scripts/build-artifact.mts
 * into artifact/talentos-lite.html. AI via the `sample` capability (the
 * viewer's own Claude — no API key); persistence via `db` with a
 * localStorage fallback under the same key every previous version used.
 *
 * Agents draft. Humans decide. Nothing sends automatically.
 */
import "./ui/overview";
import "./ui/intake-loop";
import "./ui/candidates";
import "./ui/golden";
import "./ui/actions";
import "./ui/pipeline";
import { $ } from "./core/dom";
import { EXAMPLE_SEARCH } from "./app/example";
import { attachDb, reloadSearches, selectSearch, state } from "./app/state";
import { store, type DbLike } from "./core/store";
import { setSample, type SampleApi } from "./ai/tasks";
import { setMcp, type McpApi } from "./core/connectors";
import {
  hideAi,
  render,
  renderMain,
  renderRail,
  setRenderer,
  aiAvailable,
} from "./ui/shell";
import { renderHeader } from "./ui/header";

declare const __TALENTOS_ARTIFACT_VERSION__: string;
export const ARTIFACT_VERSION =
  typeof __TALENTOS_ARTIFACT_VERSION__ === "string"
    ? __TALENTOS_ARTIFACT_VERSION__
    : "dev";

interface ClaudeRuntime {
  use(name: "db"): Promise<DbLike | null>;
  use(name: "sample"): Promise<SampleApi | null>;
  use(name: "mcp"): Promise<McpApi | null>;
  use(name: string): Promise<unknown>;
}
declare global {
  interface Window {
    claude?: ClaudeRuntime;
    __talentos?: { version: string; state: typeof state; render: () => void };
  }
}

setRenderer(() => {
  renderRail();
  renderHeader();
  renderMain();
});

$("#new-search-btn")?.addEventListener("click", () => {
  state.current = null;
  state.module = "overview";
  render();
});

async function boot(): Promise<void> {
  const versionEl = $("#artifact-version");
  if (versionEl) versionEl.textContent = ARTIFACT_VERSION;
  window.__talentos = { version: ARTIFACT_VERSION, state, render };

  // Render immediately from local data; light capabilities up as they resolve.
  await reloadSearches();
  if (!state.searches.length) {
    await store.saveSearch(EXAMPLE_SEARCH);
    state.searches = [EXAMPLE_SEARCH];
  }
  await selectSearch(state.searches[0].id);
  render();

  const runtime = window.claude;
  const [db, sample, mcp] = await Promise.all([
    runtime ? runtime.use("db").catch(() => null) : Promise.resolve(null),
    runtime ? runtime.use("sample").catch(() => null) : Promise.resolve(null),
    runtime ? runtime.use("mcp").catch(() => null) : Promise.resolve(null),
  ]);
  setSample(sample);
  setMcp(mcp);
  if (db) {
    attachDb(db);
    const existing = await store.listSearches();
    if (!existing.length) await store.saveSearch(EXAMPLE_SEARCH);
    await reloadSearches();
    await selectSearch(
      state.current && state.searches.some((s) => s.id === state.current?.id)
        ? state.current.id
        : state.searches[0].id,
    );
  }
  if (!sample) hideAi();
  render();
  if (!aiAvailable())
    console.info(
      "TalentOS: AI generation unavailable in this view; everything else works.",
    );
}

void boot();
