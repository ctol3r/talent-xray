/**
 * Overview: the search brief (copy-on-write; every consequential change
 * creates a context revision and shows the dependency diff), the truthful
 * module-status table (P0-B), the crew panel driven by the execution plan
 * (P0-C), and the research panel.
 */
import { $, el, esc, asOf, nowIso, uid } from "../core/dom";
import type { SearchFacts } from "../core/search-context";
import { MODULES, MODULE_KEYS, STATE_LABELS } from "../core/dependencies";
import { ProgressTracker, formatElapsed } from "../core/execution-plan";
import {
  CREW_ORDER,
  crewPlan,
  crewRemaining,
  runCrewForSearch,
  errorCode,
  errorMessage,
} from "../ai/tasks";
import {
  moduleStates,
  recordContextRevision,
  saveFacts,
  selectSearch,
  state,
} from "../app/state";
import {
  aiAvailable,
  copyFor,
  hideAi,
  performAction,
  render,
  renderRail,
  registerModule,
} from "./shell";
import { INDUSTRY_PACKS, packById, suggestPack } from "../core/industry-packs";

const FIELDS: Array<[keyof SearchFacts, string, string?]> = [
  ["name", "Search name"],
  ["companyName", "Company"],
  ["roleTitle", "Role title"],
  ["geography", "Geography"],
  ["country", "Country"],
  ["jurisdiction", "Jurisdiction (legal/regulatory)"],
  ["industry", "Industry"],
  ["subindustry", "Sub-industry"],
  ["profession", "Profession"],
  ["roleFamily", "Role family"],
  ["seniority", "Seniority"],
  ["employmentType", "Employment type"],
  ["workplaceModel", "Workplace model (on-site / hybrid / remote)"],
  ["companyStage", "Company stage"],
  ["companySize", "Company size"],
  ["companyBusinessModel", "Business model"],
  ["compensationNote", "Compensation context"],
  ["businessObjective", "Business objective"],
  ["hiringReason", "Why this hire, now"],
  ["teamContext", "Team context"],
  ["openedAt", "Opened (YYYY-MM-DD)"],
  ["desiredStartDate", "Desired start (YYYY-MM-DD)"],
  ["urgency", "Urgency"],
  ["availableTimeframe", "Available timeframe"],
];

export function factsForm(
  s: SearchFacts,
  onSave: (next: SearchFacts) => Promise<void>,
  isNew: boolean,
): HTMLElement {
  const f = el(
    `<div class="panel"><h3>${isNew ? "Search brief" : "Search brief"} <span class="why">— every consequential change becomes a new context version and marks affected outputs stale</span></h3><div class="form-grid"></div></div>`,
  );
  const grid = $(".form-grid", f);
  const inputs: Partial<Record<keyof SearchFacts, HTMLInputElement>> = {};
  for (const [key, label] of FIELDS) {
    const w = el(`<label class="field"><b>${esc(label)}</b></label>`);
    const input = el<HTMLInputElement>(
      `<input type="text" name="${esc(String(key))}">`,
    );
    const v = s[key];
    input.value = typeof v === "string" ? v : "";
    inputs[key] = input;
    w.append(input);
    grid?.append(w);
  }
  const packW = el(`<label class="field"><b>Industry pack</b></label>`);
  const pack = el<HTMLSelectElement>(
    `<select name="selectedIndustryPack" aria-label="Industry pack">${INDUSTRY_PACKS.map(
      (p) =>
        `<option value="${esc(p.id)}"${(s.selectedIndustryPack ?? "universal") === p.id ? " selected" : ""}>${esc(p.label)}</option>`,
    ).join("")}</select>`,
  );
  const packWhy = el(
    `<span class="why">${esc(packById(s.selectedIndustryPack).summary)}</span>`,
  );
  pack.onchange = () => {
    packWhy.textContent = packById(pack.value).summary;
  };
  packW.append(pack, packWhy);
  grid?.append(packW);

  const constraintsW = el(
    `<label class="field span"><b>Constraints (one per line)</b></label>`,
  );
  const constraints = el<HTMLTextAreaElement>(
    `<textarea rows="2" name="constraints"></textarea>`,
  );
  constraints.value = (s.constraints ?? []).join("\n");
  constraintsW.append(constraints);
  grid?.append(constraintsW);
  const jdW = el(
    `<label class="field span"><b>Job description (paste)</b></label>`,
  );
  const jd = el<HTMLTextAreaElement>(
    `<textarea rows="8" name="jd"></textarea>`,
  );
  jd.value = s.jd ?? "";
  jdW.append(jd);
  grid?.append(jdW);
  const notesW = el(`<label class="field span"><b>Recruiter notes</b></label>`);
  const notes = el<HTMLTextAreaElement>(
    `<textarea rows="2" name="recruiterNotes"></textarea>`,
  );
  notes.value = s.recruiterNotes ?? "";
  notesW.append(notes);
  grid?.append(notesW);
  const save = el<HTMLButtonElement>(
    `<button class="btn primary" type="button">${isNew ? "Create search" : "Save brief"}</button>`,
  );
  const msg = el(`<span class="why" role="status"></span>`);
  save.onclick = async () => {
    const next: SearchFacts = { ...s };
    for (const [key] of FIELDS) {
      const v = inputs[key]?.value.trim() ?? "";
      (next as Record<string, unknown>)[key] = v;
    }
    next.jd = jd.value;
    next.selectedIndustryPack = pack.value;
    next.recruiterNotes = notes.value.trim();
    next.constraints = constraints.value
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);
    if (!next.roleTitle) {
      msg.textContent = "Role title is required.";
      return;
    }
    if (!next.name)
      next.name = `${next.companyName || "Search"} — ${next.roleTitle}`;
    await onSave(next);
  };
  f.append(save, msg);
  return f;
}

export function renderNewSearchForm(
  main: HTMLElement,
  standalone: boolean,
): void {
  main.append(el(`<div class="mod-head"><h2>New search</h2></div>`));
  main.append(
    el(
      `<p class="mod-desc">One search = one hiring need. The brief you enter here is versioned; every generated module records the version it consumed.</p>`,
    ),
  );
  const s: SearchFacts = { id: uid(), createdAt: nowIso(), roleTitle: "" };
  main.append(
    factsForm(
      s,
      async (saved) => {
        await saveFacts(saved);
        await selectSearch(saved.id);
        render();
      },
      true,
    ),
  );
  if (standalone && state.searches.length)
    main.append(
      el(`<p class="why">…or pick an existing search from the left rail.</p>`),
    );
}

function renderStatusTable(main: HTMLElement): void {
  const states = moduleStates();
  const rows = MODULE_KEYS.map((k) => {
    const st = states[k];
    const cls =
      st.state === "current"
        ? "ok"
        : st.state === "not_started"
          ? ""
          : st.state === "aging" ||
              st.state === "needs_review" ||
              st.state === "generating" ||
              st.state === "researching"
            ? "warn"
            : "bad";
    return `<tr><th scope="row">${esc(MODULES[k].label)}</th><td><span class="chip ${cls}">${esc(STATE_LABELS[st.state].toUpperCase())}</span></td><td class="why">${esc(st.reason)}</td><td class="why num">${st.lastGeneratedAt ? esc(asOf(st.lastGeneratedAt)) : "—"}</td><td class="why num">${esc(st.inputVersion ?? "—")}</td><td>${st.recovery ? `<button class="btn small" type="button" data-module="${k}">${esc(st.recovery.label)}</button>` : ""}</td></tr>`;
  }).join("");
  const counts = MODULE_KEYS.reduce(
    (acc, k) => {
      acc[states[k].state] = (acc[states[k].state] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const summary = Object.entries(counts)
    .map(
      ([k, n]) =>
        `${n} ${STATE_LABELS[k as keyof typeof STATE_LABELS].toLowerCase()}`,
    )
    .join(" · ");
  const panel =
    el(`<div class="panel"><h3>Module status <span class="why">— ${esc(summary)}; ${state.candidates.length} candidate${state.candidates.length === 1 ? "" : "s"}</span></h3>
    <div class="table-wrap"><table class="status"><thead><tr><th>Module</th><th>State</th><th>Why</th><th>Last generated</th><th>Input version</th><th>Recovery</th></tr></thead><tbody>${rows}</tbody></table></div></div>`);
  panel
    .querySelectorAll<HTMLButtonElement>("button[data-module]")
    .forEach((b) => {
      b.onclick = () => {
        const k = b.dataset.module as keyof typeof states;
        const st = states[k];
        if (st.recovery)
          performAction({
            label: "A",
            title: st.recovery.label,
            description: "",
            actionType: st.recovery.actionType,
            targetId: st.recovery.targetId,
          });
      };
    });
  main.append(panel);
}

function renderCrewPanel(main: HTMLElement): void {
  if (!aiAvailable()) return;
  // W17: a run only covers what still needs work. A module already current
  // for THIS input version is skipped — regenerating it would spend a call
  // to produce the same thing.
  const states = moduleStates();
  const remaining = crewRemaining(states);
  const done = CREW_ORDER.filter((k) => !remaining.includes(k));
  const plan = crewPlan(remaining.length ? remaining : CREW_ORDER);
  const resuming = done.length > 0 && remaining.length > 0;
  const crewPanel = el(`<div class="panel"><h3>Crew</h3>
    <p class="why">Run the agent crew: each module generated by a role-scoped specialist, reviewed by a critic, and revised once when the critic finds concrete defects. Derived from the execution plan: <b>${esc(plan.summary)}</b> (${plan.modelCalls.min} if every critic accepts, ${plan.modelCalls.max} if every module is revised). Substantive modules pass the Research Gate. Intake answers stay yours. Agents draft — you decide.</p></div>`);
  if (resuming) {
    crewPanel.append(
      el(
        `<p class="why"><b>Resuming.</b> ${done.length} module${done.length === 1 ? " is" : "s are"} already current for this brief version and will be skipped: ${esc(done.map((k) => MODULES[k].label).join(", "))}. To redo one, regenerate it from its own screen.</p>`,
      ),
    );
  }
  if (!remaining.length) {
    crewPanel.append(
      el(
        `<p class="why">Every crew module is current for this brief version. There is nothing for a run to do — change the brief, or regenerate a module from its own screen.</p>`,
      ),
    );
  }
  const crewBtn = el<HTMLButtonElement>(
    `<button class="btn primary" type="button"${remaining.length ? "" : " disabled"}>${resuming ? `Resume crew — ${remaining.length} module${remaining.length === 1 ? "" : "s"} left` : "Run crew on this search"}</button>`,
  );
  const crewStop = el<HTMLButtonElement>(
    `<button class="btn small" type="button" hidden>Stop</button>`,
  );
  crewPanel.append(crewBtn, crewStop);
  let stopCtl: AbortController | null = null;
  crewStop.onclick = () => stopCtl?.abort();
  crewBtn.onclick = async () => {
    crewBtn.disabled = true;
    crewStop.hidden = false;
    const tracker = new ProgressTracker(plan);
    const progress = el(
      `<div class="progress" role="status" aria-live="polite"><div class="progress-line"></div><ul class="run-log"></ul><div class="stream"></div></div>`,
    );
    crewPanel.append(progress);
    const line = $(".progress-line", progress);
    const log = $(".run-log", progress);
    const streamEl = $(".stream", progress);
    const tick = () => {
      const s = tracker.snapshot();
      if (line)
        line.textContent = `${s.completed} of ${s.total} steps done · ${s.skipped} skipped · ${s.retries} retries · ${s.failures} failures · ${formatElapsed(s.elapsedMs)} elapsed${s.running ? ` · running: ${s.running.label}` : ""}${s.resumable ? " · resumable" : ""}`;
    };
    const timer = window.setInterval(tick, 1000);
    tick();
    try {
      await runCrewForSearch(
        {
          bindStop: (c) => {
            stopCtl = c;
          },
          step: (name) => {
            log?.append(el(`<li>${esc(name)}</li>`));
            tick();
          },
          onText: ({ text }) => {
            if (streamEl) {
              streamEl.textContent = text.slice(-1000);
              streamEl.scrollTop = streamEl.scrollHeight;
            }
          },
        },
        tracker,
        remaining.length ? remaining : CREW_ORDER,
      );
      window.clearInterval(timer);
      render();
    } catch (e) {
      window.clearInterval(timer);
      const code = errorCode(e);
      if (code === "not_granted" || code === "sampling_disabled") hideAi();
      tracker.finish();
      tick();
      progress.append(
        el(
          `<div class="notice error" role="alert"><strong>Crew stopped.</strong> ${esc(copyFor(code))} <span class="why">${esc(errorMessage(e))}</span> Finished modules are saved; the failure is recorded on the module.</div>`,
        ),
      );
      crewBtn.disabled = false;
      crewStop.hidden = true;
      renderRail();
    }
  };
  main.append(crewPanel);
}

export function renderOverview(main: HTMLElement): void {
  const s = state.current;
  if (!s) return;
  main.append(
    el(
      `<div class="mod-head"><h2>${esc(s.name ?? s.roleTitle)}</h2>${s.example ? '<span class="chip example">example data</span>' : ""}</div>`,
    ),
  );
  const ctx = state.contexts[state.contexts.length - 1];
  main.append(
    el(
      `<p class="mod-desc">Everything below is the shared context for generation. Context version <b class="num">${esc(ctx?.searchVersion ?? "—")}</b> (${state.contexts.length} revision${state.contexts.length === 1 ? "" : "s"}). Start with the Canonical IR, then the intake loop, then onward down the rail.</p>`,
    ),
  );
  if (s.example) {
    main.append(
      el(
        `<div class="notice">This is a bundled example search (a public CAIS job description) so the workroom isn't empty on first open. Create your own search from the rail — nothing here is your data.</div>`,
      ),
    );
  }
  const suggestion = ctx ? suggestPack(ctx) : null;
  if (suggestion) {
    const notice = el(
      `<div class="notice" role="status"><strong>This reads like a ${esc(suggestion.pack.label)} search.</strong> <span class="why">${esc(suggestion.reason)} ${esc(suggestion.pack.summary)}</span> </div>`,
    );
    const use = el<HTMLButtonElement>(
      `<button class="btn small" type="button">Switch to ${esc(suggestion.pack.label)}</button>`,
    );
    use.onclick = async () => {
      await saveFacts({ ...s, selectedIndustryPack: suggestion.pack.id });
      const rev = await recordContextRevision();
      render();
      if (rev?.message) console.info(rev.message);
    };
    notice.append(use);
    main.append(notice);
  }

  const diffHost = el(`<div></div>`);
  main.append(diffHost);
  main.append(
    factsForm(
      s,
      async (saved) => {
        await saveFacts(saved);
        const rev = await recordContextRevision();
        render();
        if (rev?.message) {
          const host = $("#main");
          host?.insertBefore(
            el(
              `<div class="notice warning" role="status"><strong>Context changed → ${esc(rev.ctx.searchVersion)}.</strong> ${esc(rev.message)}</div>`,
            ),
            host.children[2] ?? null,
          );
        }
      },
      false,
    ),
  );
  renderStatusTable(main);
  renderCrewPanel(main);
}

registerModule("overview", renderOverview);
registerModule("new_search", (main) => renderNewSearchForm(main, true));
