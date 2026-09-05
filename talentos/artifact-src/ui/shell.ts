/**
 * Shell: rail, main dispatch, the module frame (generate / regenerate /
 * edit JSON / state badge with reason and recovery), the research panel,
 * and the A–H action router. Confirmation is required for every action
 * the registry flags; nothing here sends, advances or approves on its own.
 */
import { $, el, esc, asOf, nowIso, uid } from "../core/dom";
import {
  MODULE_KEYS,
  STATE_LABELS,
  type ModuleKey,
  type ModuleState,
} from "../core/dependencies";
import type { StoredRecord } from "../core/store";
import {
  PAYLOAD_SCHEMAS,
  deepCopy,
  downgradeVerified,
  type PayloadTaskKey,
} from "../core/payloads";
import { ensureIds } from "@/lib/core/payloads";
import { scanPayloadForProtectedTraits } from "@/lib/domain/fair-hiring";
import {
  requiresConfirmation,
  type OutputEnvelope,
  type SuggestedNextStep,
} from "../core/envelope";
import {
  gateDecision,
  buildSnapshot,
  userSource,
  viableAdapters,
  FRESHNESS_RULES,
  sourceFreshness,
  type SourceKind,
  sourceKindSchema,
} from "../core/research";
import {
  NAV,
  NAV_ORDER,
  PHASES,
  PHASE_KEYS,
  entriesFor,
  navEntry,
} from "../core/phases";
import { TASKS } from "../ai/prompts";
import {
  generateModule,
  hasSample,
  errorCode,
  errorMessage,
} from "../ai/tasks";
import {
  currentContext,
  currentStorageMode,
  entryStatuses,
  latestSnapshot,
  liveResearchStatus,
  moduleStates,
  putArtifact,
  putResearch,
  selectSearch,
  state,
} from "../app/state";
import {
  renderCanonicalIR,
  renderChannels,
  renderEnvelope,
  renderIntake,
  renderMarket,
  renderRoleIntelligence,
  renderStrategy,
  renderStrings,
  renderSuccessProfile,
} from "./renderers";

export const ERROR_COPY: Record<string, string> = {
  not_granted:
    "Claude access wasn't allowed for this page, so AI generation is off. Everything else still works.",
  sampling_disabled:
    "Claude isn't available on this account, so AI generation is off.",
  rate_limited:
    "Claude is rate-limited right now — wait a little and try again.",
  refused:
    "Claude declined this request. Edit the inputs and try a different framing.",
  invalid_json:
    "The reply didn't match the expected shape. Try again — if it keeps failing, trim the JD or notes.",
  prompt_too_large:
    "The assembled context is too large. Trim the JD or recruiter notes and retry.",
  empty_completion:
    "Claude produced no output. Try again with slightly different inputs.",
  cancelled: "Stopped.",
  research_gate:
    "The Research Gate is closed for this module until you acknowledge generating without current research, or add sources.",
  upstream_error: "A transient error interrupted the call. Try again.",
};
export const copyFor = (code: string): string =>
  ERROR_COPY[code] ?? ERROR_COPY.upstream_error;

export let aiHidden = false;
export function hideAi(): void {
  aiHidden = true;
}
export const aiAvailable = (): boolean => hasSample() && !aiHidden;

/** Route order is the nav's order — one list, five phases. */
export const MODULE_ORDER: string[] = NAV_ORDER;

type Renderer = (main: HTMLElement) => void;
const customRenderers: Partial<Record<string, Renderer>> = {};
export function registerModule(key: string, render: Renderer): void {
  customRenderers[key] = render;
}

let rerender: () => void = () => {};
export function setRenderer(fn: () => void): void {
  rerender = fn;
}
export function render(): void {
  state.now = nowIso();
  rerender();
}

// ── Rail ────────────────────────────────────────────────────────────────────

const STATE_CLASS: Record<ModuleState["state"], string> = {
  not_started: "",
  researching: "warn",
  generating: "warn",
  current: "ok",
  aging: "warn",
  stale: "bad",
  blocked: "bad",
  failed: "bad",
  needs_review: "warn",
};

export function renderRail(): void {
  const list = $("#search-list");
  if (!list) return;
  list.innerHTML = "";
  for (const s of state.searches) {
    const active = state.current?.id === s.id;
    const item =
      el<HTMLButtonElement>(`<button class="search-item ${active ? "active" : ""}" type="button" aria-current="${active ? "true" : "false"}">
      <div class="si-name">${esc(s.roleTitle)} ${s.example ? '<span class="chip example">example</span>' : ""}</div>
      <div class="si-sub">${esc(s.companyName ?? "")} · ${esc(s.geography ?? "")}</div>
    </button>`);
    item.onclick = () => selectSearch(s.id).then(render);
    list.append(item);
  }
  const nav = $("#mod-nav");
  if (!nav) return;
  nav.innerHTML = "";
  if (!state.current) return;
  const statuses = entryStatuses();
  for (const phase of PHASE_KEYS) {
    const entries = entriesFor(phase, state.mode);
    if (!entries.length) continue;
    const group = el(
      `<div class="phase-group"><div class="rail-label" title="${esc(PHASES[phase].purpose)}">${esc(PHASES[phase].label)}</div></div>`,
    );
    for (const entry of entries) {
      const st = statuses[entry.key];
      const item = el<HTMLButtonElement>(
        `<button class="mod-item ${state.module === entry.key ? "active" : ""}" type="button" aria-current="${state.module === entry.key ? "page" : "false"}" title="${esc(st?.reason ?? entry.hint)}"><span class="dot ${st ? STATE_CLASS[st.state] : ""}" aria-hidden="true"></span><span class="mod-label">${esc(entry.label)}</span>${st ? `<span class="mod-state">${esc(STATE_LABELS[st.state])}</span>` : ""}</button>`,
      );
      item.onclick = () => {
        state.module = entry.key;
        render();
      };
      group.append(item);
    }
    nav.append(group);
  }
  const foot = $("#rail-foot");
  if (foot) {
    foot.textContent =
      currentStorageMode() === "db"
        ? "Saved to this artifact's private store. Agents draft. Humans decide. Nothing sends automatically."
        : "Saved in this browser only (offline mode). Agents draft. Humans decide. Nothing sends automatically.";
  }
}

// ── Main dispatch ───────────────────────────────────────────────────────────

export function renderMain(): void {
  const main = $("#main");
  if (!main) return;
  main.innerHTML = "";
  if (!state.current) {
    customRenderers.new_search?.(main);
    return;
  }
  const custom = customRenderers[state.module];
  if (custom) {
    custom(main);
    return;
  }
  if (state.module === "research") {
    renderResearchModule(main);
    return;
  }
  if (!NAV.some((e) => e.key === state.module)) {
    main.append(
      el(
        `<div class="notice warning">No module called "${esc(state.module)}". Pick one from the rail.</div>`,
      ),
    );
    return;
  }
  renderTaskModule(main, state.module as ModuleKey);
}

// ── Module frame ────────────────────────────────────────────────────────────

export function stateBadge(st: ModuleState): HTMLElement {
  return el(
    `<div class="state-line"><span class="chip ${STATE_CLASS[st.state]}">${esc(STATE_LABELS[st.state].toUpperCase())}</span> <span class="why">${esc(st.reason)}</span>${st.lastGeneratedAt ? ` <span class="why">· generated ${esc(asOf(st.lastGeneratedAt))}</span>` : ""}${st.inputVersion ? ` <span class="why">· input ${esc(st.inputVersion)}</span>` : ""}${st.researchSnapshotId ? ` <span class="why">· research ${esc(st.researchSnapshotId)}</span>` : ""}</div>`,
  );
}

export function renderTaskModule(main: HTMLElement, key: ModuleKey): void {
  const task = TASKS[key];
  if (!task) {
    main.append(
      el(`<div class="notice error">Unknown module ${esc(key)}.</div>`),
    );
    return;
  }
  const rec = state.artifacts[key];
  const st = moduleStates()[key];
  main.append(
    el(
      `<div class="mod-head"><h2>${esc(task.label)}</h2>${rec?.payload ? '<span class="chip inference">model inference</span>' : ""}<span class="spacer"></span></div>`,
    ),
  );
  main.append(el(`<p class="mod-desc">${esc(task.desc)}</p>`));
  const hint = navEntry(key)?.hint;
  if (state.mode === "guided" && hint) {
    main.append(el(`<p class="why guided-hint">${esc(hint)}</p>`));
  }
  main.append(stateBadge(st));
  if (st.recovery && st.state !== "current" && st.state !== "generating") {
    const rb = el<HTMLButtonElement>(
      `<button class="btn small" type="button">${esc(st.recovery.label)}</button>`,
    );
    rb.onclick = () =>
      performAction({
        label: "A",
        title: st.recovery?.label ?? "",
        description: "",
        actionType: st.recovery?.actionType ?? "navigate_module",
        targetId: st.recovery?.targetId,
      });
    main.append(rb);
  }

  const head = $(".mod-head", main);
  const body = el(`<div></div>`);
  main.append(body);

  if (!aiAvailable())
    main.append(
      el(`<div class="notice warning">${esc(copyFor("not_granted"))}</div>`),
    );

  const genBtn = el<HTMLButtonElement>(
    `<button class="btn ${rec?.payload ? "" : "primary"}" type="button">${rec?.payload ? "Regenerate" : "Generate"}</button>`,
  );
  const stopBtn = el<HTMLButtonElement>(
    `<button class="btn small" type="button" hidden>Stop</button>`,
  );
  if (aiAvailable()) head?.append(genBtn, stopBtn);

  let ctl: AbortController | null = null;
  stopBtn.onclick = () => ctl?.abort();
  genBtn.onclick = async () => {
    if (task.envelope) {
      const gate = gateDecision(
        latestSnapshot(),
        state.now,
        state.acknowledgedNoResearch.has(state.current?.id ?? ""),
      );
      if (!gate.allowed) {
        const ok = window.confirm(
          `${gate.banner}\n\nGenerate without current research?`,
        );
        if (!ok) return;
        state.acknowledgedNoResearch.add(state.current?.id ?? "");
      }
    }
    genBtn.disabled = true;
    stopBtn.hidden = false;
    body.innerHTML = "";
    const think = el(
      `<div class="panel" role="status" aria-live="polite"><div class="thinking">Generating ${esc(task.label.toLowerCase())} — Claude is thinking…</div><div class="stream"></div></div>`,
    );
    body.append(think);
    const streamEl = $(".stream", think);
    try {
      await generateModule(key, {
        bindStop: (c) => {
          ctl = c;
        },
        onText: ({ text }) => {
          if (streamEl) {
            streamEl.textContent = text.slice(-1500);
            streamEl.scrollTop = streamEl.scrollHeight;
          }
        },
        step: (name) => {
          const t = $(".thinking", think);
          if (t) t.textContent = name;
        },
      });
      render();
    } catch (e) {
      const code = errorCode(e);
      if (code === "not_granted" || code === "sampling_disabled") hideAi();
      body.innerHTML = "";
      body.append(
        el(
          `<div class="notice error" role="alert"><strong>Generation failed.</strong> ${esc(copyFor(code))} <span class="why">${esc(errorMessage(e))}</span></div>`,
        ),
      );
      if (rec?.payload) paintArtifact(body, key, rec);
      genBtn.disabled = false;
      stopBtn.hidden = true;
      // The failure is persisted state, not a flash: the rail must say so now.
      renderRail();
      const st2 = moduleStates()[key];
      const line = $(".state-line", main);
      if (line) line.replaceWith(stateBadge(st2));
    }
  };

  if (rec?.payload) paintArtifact(body, key, rec);
  else {
    body.append(
      el(
        `<div class="panel"><p class="why">Not generated yet. ${aiAvailable() ? "Generation runs on your Claude account — the first call asks for permission." : "AI generation is unavailable in this view."}</p></div>`,
      ),
    );
  }
}

const PAYLOAD_RENDERERS: Partial<
  Record<ModuleKey, (root: HTMLElement, p: never) => void>
> = {
  hiring_need: renderCanonicalIR as (root: HTMLElement, p: never) => void,
  role_intelligence: renderRoleIntelligence as (
    root: HTMLElement,
    p: never,
  ) => void,
  intake: ((root: HTMLElement, p: never) =>
    renderIntake(root, p, renderRail)) as (root: HTMLElement, p: never) => void,
  success_profile: renderSuccessProfile as (
    root: HTMLElement,
    p: never,
  ) => void,
  market_intelligence: renderMarket as (root: HTMLElement, p: never) => void,
  sourcing_strategy: renderStrategy as (root: HTMLElement, p: never) => void,
  channels: renderChannels as (root: HTMLElement, p: never) => void,
  search_strings: renderStrings as (root: HTMLElement, p: never) => void,
};

export function paintArtifact(
  body: HTMLElement,
  key: ModuleKey,
  rec: StoredRecord,
): void {
  if (rec.traitWarnings.length) {
    body.append(
      el(
        `<div class="notice warning" role="alert"><strong>Review required:</strong> the output mentions ${esc(rec.traitWarnings.join(", "))}. Protected characteristics must never drive evaluation — edit before use.</div>`,
      ),
    );
  }
  if (rec.lastError && rec.lastError.at > rec.meta.generatedAt) {
    body.append(
      el(
        `<div class="notice error"><strong>Last regeneration failed</strong> (${esc(asOf(rec.lastError.at))}): ${esc(rec.lastError.message)}. The previous output is shown below.</div>`,
      ),
    );
  }
  if (rec.critique) {
    const good = rec.critique.verdict === "accept";
    body.append(
      el(
        `<div class="notice ${good ? "" : "warning"}"><strong>Critic: ${good ? "accept" : "revise"}${rec.critique.revised ? " → revised once" : ""}.</strong>${rec.critique.issues.length ? `<ul>${rec.critique.issues.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : ""}</div>`,
      ),
    );
  }
  const rendered = el(`<div></div>`);
  try {
    if (rec.envelope) {
      renderEnvelope(rendered, rec.envelope as OutputEnvelope, rec, {
        onStep: performAction,
      });
      const full = el(
        `<details class="panel"><summary>Full analysis</summary></details>`,
      );
      const inner = el(`<div></div>`);
      PAYLOAD_RENDERERS[key]?.(inner, rec.payload as never);
      full.append(inner);
      rendered.append(full);
    } else {
      PAYLOAD_RENDERERS[key]?.(rendered, rec.payload as never);
    }
  } catch (e) {
    rendered.append(
      el(
        `<div class="notice error">Render failed (${esc(errorMessage(e))}) — use Edit JSON below.</div>`,
      ),
    );
  }
  body.append(rendered);

  const editWrap = el(
    `<details class="panel"><summary>Edit JSON <span class="why">— the draft is yours; edits are saved verbatim and validated</span></summary></details>`,
  );
  const ta = el<HTMLTextAreaElement>(
    `<textarea class="mono" rows="12" aria-label="Edit ${esc(key)} JSON"></textarea>`,
  );
  ta.value = JSON.stringify(rec.payload, null, 2);
  const saveBtn = el<HTMLButtonElement>(
    `<button class="btn small" type="button">Save edits</button>`,
  );
  const msg = el(`<span class="why" role="status"></span>`);
  saveBtn.onclick = async () => {
    try {
      const parsed = JSON.parse(ta.value) as unknown;
      const schema = PAYLOAD_SCHEMAS[key as PayloadTaskKey];
      const check = schema
        ? schema.safeParse(parsed)
        : { success: true as const, data: parsed };
      if (!check.success) {
        msg.textContent =
          "Not saved — " +
          check.error.issues
            .slice(0, 3)
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; ");
        return;
      }
      const cleaned = downgradeVerified(ensureIds(deepCopy(check.data)));
      await putArtifact(key, {
        ...rec,
        payload: cleaned.value,
        meta: { ...rec.meta, editedAt: nowIso(), editedBy: "recruiter" },
        traitWarnings: Array.from(
          new Set(
            scanPayloadForProtectedTraits(cleaned.value).map((h) => h.trait),
          ),
        ),
        previous: rec.payload
          ? { payload: rec.payload, meta: rec.meta }
          : rec.previous,
      });
      render();
    } catch {
      msg.textContent = "Not saved — invalid JSON.";
    }
  };
  editWrap.append(ta, saveBtn, msg);
  body.append(editWrap);
  body.append(
    el(
      `<p class="why num">Generated ${esc(asOf(rec.meta.generatedAt))}${rec.meta.editedAt ? ` · edited ${esc(asOf(rec.meta.editedAt))}` : ""} · provider ${esc(rec.meta.provider)}${rec.meta.inputVersion ? ` · input ${esc(rec.meta.inputVersion)}` : ""}${rec.meta.durationMs ? ` · ${Math.round(rec.meta.durationMs / 1000)}s` : ""}</p>`,
    ),
  );
}

const CONNECTOR_LABEL: Record<string, string> = {
  capability_unavailable: "NO CONNECTOR ACCESS",
  not_connected: "NOT CONNECTED",
  needs_reauth: "RECONNECT NEEDED",
  missing_tools: "TOOLS MISSING",
  connected_not_wired: "CONNECTED · NOT WIRED",
  ready: "READY",
};
const CONNECTOR_CLASS: Record<string, string> = {
  capability_unavailable: "unknown",
  not_connected: "unknown",
  needs_reauth: "bad",
  missing_tools: "warn",
  connected_not_wired: "warn",
  ready: "ok",
};

// ── Research module ─────────────────────────────────────────────────────────

/**
 * The Research phase's own screen. It is deliberately blunt about the fact
 * that this runtime cannot browse: everything here is either a source the
 * recruiter checked themselves, or a connector that is not wired yet.
 */
export function renderResearchModule(main: HTMLElement): void {
  main.append(
    el(
      `<div class="mod-head"><h2>Research</h2><span class="spacer"></span></div>`,
    ),
  );
  main.append(
    el(
      `<p class="mod-desc">Evidence with a date on it. This page never fetches anything: a source is either one you checked and pasted, or one a connector returned. An output can only be "current" or "aging" with a snapshot attached — without one it is generated on model knowledge and labelled that way.</p>`,
    ),
  );
  renderResearchPanel(main);
}

// ── Research panel ──────────────────────────────────────────────────────────

export function renderResearchPanel(root: HTMLElement): void {
  const ctx = currentContext();
  if (!ctx) return;
  const snap = latestSnapshot();
  const status = liveResearchStatus();
  const cls = status === "current" ? "ok" : status === "aging" ? "warn" : "bad";
  const panel = el(
    `<div class="panel" id="research-panel"><h3>Research <span class="chip ${cls}">${esc(status.toUpperCase())}</span> <span class="why">${snap ? `snapshot ${esc(snap.id)} · as of ${esc(asOf(snap.completedAt ?? snap.startedAt))}${snap.validUntil ? ` · valid until ${esc(asOf(snap.validUntil))}` : ""}` : "no snapshot — this runtime has no web access"}</span></h3></div>`,
  );
  const adapters = viableAdapters(ctx);
  panel.append(
    el(
      `<div><h4 class="first">Where evidence can come from for this search</h4><ul>${adapters
        .map(
          ({ adapter, applicability }) =>
            `<li><b>${esc(adapter.label)}</b> <span class="chip ${applicability.viable ? "ok" : "unknown"}">${applicability.viable ? "APPLIES" : "N/A"}</span> <span class="why">${esc(applicability.reason)}</span>${adapter.connectors.length ? ` <span class="conn" data-adapter="${esc(adapter.id)}"><span class="chip">CHECKING…</span></span>` : ""}</li>`,
        )
        .join("")}</ul></div>`,
    ),
  );
  // The connector's real state — per viewer, per connector — filled in
  // when it answers. Never asserted before it does.
  for (const { adapter } of adapters) {
    if (!adapter.connectors.length) continue;
    void adapter.availability().then((availability) => {
      const host = $(`.conn[data-adapter="${adapter.id}"]`, panel);
      if (!host) return;
      const statuses = availability.connectors ?? [];
      host.innerHTML = statuses.length
        ? statuses
            .map(
              (c) =>
                `<span class="chip ${CONNECTOR_CLASS[c.state] ?? "warn"}" title="${esc(c.reason)}">${esc(c.server)}: ${esc(CONNECTOR_LABEL[c.state] ?? c.state)}</span>`,
            )
            .join(" ")
        : `<span class="chip warn">NOT WIRED</span>`;
    });
  }
  if (snap) {
    panel.append(
      el(
        `<div><h4>Sources (${snap.sources.length})</h4>${
          snap.sources.length
            ? `<ul>${snap.sources
                .map((s) => {
                  const f = sourceFreshness(s, state.now);
                  return `<li>${s.canonicalUrl ? `<a href="${esc(s.canonicalUrl)}" target="_blank" rel="noopener">${esc(s.title)}</a>` : esc(s.title)} <span class="chip">${esc(s.sourceType.replace(/_/g, " "))}</span> <span class="chip ${f === "current" ? "ok" : f === "aging" ? "warn" : "bad"}">${esc(f.toUpperCase())}</span> <span class="why">${esc(s.kind)} · retrieved ${esc(asOf(s.retrievedAt))}${s.limitations.length ? ` · ${esc(s.limitations.join(" "))}` : ""}</span></li>`;
                })
                .join("")}</ul>`
            : `<p class="why">No usable sources.</p>`
        }${snap.unavailableSources.length ? `<p class="why">Unavailable: ${esc(snap.unavailableSources.join("; "))}</p>` : ""}</div>`,
      ),
    );
  }
  const form = el(
    `<details><summary>Add a source you have checked yourself</summary></details>`,
  );
  const title = el<HTMLInputElement>(
    `<input type="text" placeholder="Title (e.g. 'BLS OES May 2025, SOC 29-1141')" aria-label="Source title">`,
  );
  const url = el<HTMLInputElement>(
    `<input type="text" placeholder="URL (optional)" aria-label="Source URL">`,
  );
  const publisher = el<HTMLInputElement>(
    `<input type="text" placeholder="Publisher (optional)" aria-label="Publisher">`,
  );
  const kind = el<HTMLSelectElement>(
    `<select aria-label="Source kind">${sourceKindSchema.options.map((k) => `<option value="${k}">${esc(k.replace(/_/g, " "))} — aging after ${FRESHNESS_RULES[k as SourceKind].agingAfterDays}d, stale after ${FRESHNESS_RULES[k as SourceKind].staleAfterDays}d</option>`).join("")}</select>`,
  );
  kind.value = "user_supplied";
  const excerpt = el<HTMLTextAreaElement>(
    `<textarea rows="3" placeholder="Verbatim excerpt that supports a claim (optional)" aria-label="Excerpt"></textarea>`,
  );
  const add = el<HTMLButtonElement>(
    `<button class="btn small" type="button">Add source</button>`,
  );
  const msg = el(`<span class="why" role="status"></span>`);
  add.onclick = async () => {
    if (!title.value.trim()) {
      msg.textContent = "A title is required.";
      return;
    }
    const src = userSource({
      id: `src-${uid().slice(0, 8)}`,
      title: title.value.trim(),
      url: url.value.trim() || undefined,
      publisher: publisher.value.trim() || undefined,
      kind: kind.value as SourceKind,
      excerpt: excerpt.value.trim() || undefined,
      retrievedAt: nowIso(),
    });
    const sources = [...(snap?.sources ?? []), src];
    const next = buildSnapshot({
      id: `rs-${uid().slice(0, 8)}`,
      ctx,
      brief:
        snap?.researchBrief ??
        `Sources supplied by the recruiter for ${ctx.roleTitle} at ${ctx.company || "the company"}.`,
      sources,
      claims: snap?.claims ?? [],
      unavailableSources: snap?.unavailableSources ?? [],
      queries: snap?.queries ?? [],
      nowIso: nowIso(),
    });
    await putResearch(next);
    render();
  };
  form.append(title, url, publisher, kind, excerpt, add, msg);
  panel.append(form);
  root.append(panel);
}

// ── A–H action router ───────────────────────────────────────────────────────

function focusActionRow(id: string): void {
  const row = document.querySelector(`[data-action-id="${CSS.escape(id)}"]`);
  if (!row) return;
  row.scrollIntoView({ block: "center" });
  row.classList.add("flash");
}

export function performAction(step: SuggestedNextStep): void {
  if (requiresConfirmation(step)) {
    const ok = window.confirm(
      `${step.title}\n\nThis is a human decision. TalentOS will not send, advance, or approve anything on its own. Continue to the relevant screen?`,
    );
    if (!ok) return;
  }
  const target = step.targetId ?? "";
  const go = (mod: string) => {
    state.module = mod;
    render();
    $("#main")?.scrollTo({ top: 0 });
  };
  switch (step.actionType) {
    case "navigate_module":
    case "generate_module":
    case "regenerate_module":
      go(
        MODULE_KEYS.includes(target as ModuleKey)
          ? target
          : target === "overview"
            ? "overview"
            : state.module,
      );
      break;
    case "refresh_research":
    case "add_source":
      go("research");
      setTimeout(
        () => $("#research-panel")?.scrollIntoView({ block: "start" }),
        0,
      );
      break;
    case "answer_question":
      go("intake");
      break;
    case "record_statement":
      go("intake_loop");
      break;
    case "edit_context":
      go("overview");
      break;
    case "review_candidate":
    case "add_candidate":
    case "advance_stage":
    case "send_outreach":
      go("candidates");
      break;
    case "compile_queries":
    case "copy_query":
      go("search_strings");
      break;
    case "run_golden":
      go("golden_test");
      break;
    case "open_action":
    case "complete_action":
    case "create_initiative":
      go("actions");
      if (target) setTimeout(() => focusActionRow(target), 0);
      break;
    default:
      // Phase 4/5 actions (pivots, stage moves, recorded decisions) have no
      // module yet; land on the overview rather than pretending otherwise.
      go("overview");
  }
}
