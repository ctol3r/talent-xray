/**
 * The persistent header (spec §5): who this search is, what version of the
 * brief the outputs were built from, whether research is current, the five
 * phases with their derived state, the mode switch, and ONE next best
 * action — derived, never a model call, and always routed through the same
 * confirmation rules as any other suggested step.
 */
import { $, el, esc } from "../core/dom";
import {
  PHASES,
  PHASE_KEYS,
  PHASE_STATE_LABELS,
  activePhase,
  entriesFor,
  phaseOf,
  phaseStatuses,
  type PhaseKey,
} from "../core/phases";
import { packFor } from "../core/industry-packs";
import {
  currentContext,
  entryStatuses,
  liveResearchStatus,
  nextAction,
  setMode,
  state,
} from "../app/state";
import { aiAvailable, performAction, render } from "./shell";

const PHASE_CLASS: Record<string, string> = {
  not_started: "",
  in_progress: "warn",
  needs_attention: "bad",
  complete: "ok",
};

const URGENCY_CLASS: Record<string, string> = {
  blocked: "bad",
  attention: "warn",
  normal: "inference",
  done: "ok",
};

export function renderHeader(): void {
  const bar = $("#topbar");
  if (!bar) return;
  bar.innerHTML = "";
  if (!state.current) {
    bar.append(
      el(
        `<div class="tb-row"><div class="tb-title">TalentOS <span class="why">— pick a search on the left, or start a new one.</span></div></div>`,
      ),
    );
    return;
  }

  const ctx = currentContext();
  const research = liveResearchStatus();
  const researchClass =
    research === "current" ? "ok" : research === "aging" ? "warn" : "bad";
  const pack = packFor(ctx ?? ({ selectedIndustryPack: "universal" } as never));

  const identity = el(`<div class="tb-row tb-identity">
    <div class="tb-title">${esc(state.current.roleTitle)}<span class="why"> · ${esc(state.current.companyName ?? "")}${state.current.geography ? ` · ${esc(state.current.geography)}` : ""}</span></div>
    <span class="chip num" title="Content-addressed version of the search brief. Outputs record the version they consumed.">BRIEF ${esc(ctx?.searchVersion ?? "—")}</span>
    <span class="chip ${researchClass}" title="The live research status — what the gate reads.">RESEARCH ${esc(research.toUpperCase())}</span>
    <span class="chip" title="${esc(pack.summary)}">PACK ${esc(pack.label.toUpperCase())}</span>
    <span class="spacer"></span>
  </div>`);

  const modes = el(
    `<div class="modes" role="group" aria-label="Detail level"></div>`,
  );
  for (const m of ["guided", "expert"] as const) {
    const btn = el<HTMLButtonElement>(
      `<button type="button" class="mode-btn ${state.mode === m ? "active" : ""}" aria-pressed="${state.mode === m}">${m === "guided" ? "Guided" : "Expert"}</button>`,
    );
    btn.title =
      m === "guided"
        ? "The core path, in order. Advanced and legacy modules are hidden."
        : "Everything, including the legacy role read and the Golden Test.";
    btn.onclick = () => {
      setMode(m);
      render();
    };
    modes.append(btn);
  }
  identity.append(modes);
  bar.append(identity);

  const statuses = phaseStatuses({ statuses: entryStatuses() });
  const active = phaseOf(state.module) ?? activePhase(statuses);
  const strip = el(
    `<div class="tb-row phases" role="list" aria-label="Phases"></div>`,
  );
  for (const p of statuses) {
    const phase = PHASES[p.key];
    const btn = el<HTMLButtonElement>(
      `<button type="button" role="listitem" class="phase ${p.key === active ? "active" : ""}" aria-current="${p.key === active ? "step" : "false"}">
        <span class="ph-label">${esc(phase.label)}</span>
        <span class="chip ${PHASE_CLASS[p.state]}">${esc(PHASE_STATE_LABELS[p.state].toUpperCase())}</span>
        <span class="ph-count num">${p.done}/${p.total}</span>
      </button>`,
    );
    btn.title = p.ready
      ? `${phase.question} — ${p.reason}`
      : `${phase.question} — ${p.earlyReason}`;
    btn.onclick = () => goToPhase(p.key);
    strip.append(btn);
  }
  bar.append(strip);

  const current = statuses.find((p) => p.key === active);
  bar.append(
    el(
      `<p class="tb-question why">${esc(PHASES[active].question)}${current && !current.ready ? ` <span class="chip warn">EARLY</span> ${esc(current.earlyReason)}` : ""}</p>`,
    ),
  );

  const nba = nextAction(aiAvailable());
  const row = el(`<div class="tb-row nba">
    <span class="chip ${URGENCY_CLASS[nba.urgency]}">NEXT</span>
    <div class="nba-text"><b>${esc(nba.step.title)}</b><span class="why">${esc(nba.why)}</span></div>
    <span class="spacer"></span>
  </div>`);
  if (nba.urgency !== "done") {
    const go = el<HTMLButtonElement>(
      `<button class="btn small primary" type="button">Take me there</button>`,
    );
    go.onclick = () => performAction(nba.step);
    row.append(go);
  }
  bar.append(row);
}

/** Open the first entry of a phase that this mode shows. */
export function goToPhase(key: PhaseKey): void {
  const entries = entriesFor(key, state.mode);
  if (!entries.length) return;
  state.module = entries[0].key;
  render();
}

export { PHASE_KEYS };
