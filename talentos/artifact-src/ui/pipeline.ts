/**
 * Pipeline and metrics (spec §13).
 *
 * Every event on this screen is something a person did and is recording
 * afterwards. Moving a stage asks for confirmation because it is a
 * decision about someone's application, and TalentOS does not make those.
 * Every metric shows its formula and its denominator; one that cannot be
 * computed says how much data it needs instead of showing a zero.
 */
import { el, esc, asOf, nowIso, uid } from "../core/dom";
import {
  EXITS,
  EXIT_LABELS,
  STAGES,
  STAGE_LABELS,
  computeMetrics,
  currentPosition,
  pipelineEventSchema,
  reachedCounts,
  type PipelineEvent,
  type Stage,
} from "../core/pipeline";
import type { MetricResult } from "../core/envelope";
import { appendEvent, currentContext, state } from "../app/state";
import { registerModule, render } from "./shell";

function formatMetric(m: MetricResult): string {
  if (m.status !== "measured" || m.value === null) {
    const have = m.denominator ?? 0;
    const need = m.minimumSample ?? 1;
    return `not enough data — ${have} of the ${need} needed`;
  }
  if (m.unit === "days") return `${m.value} days`;
  return `${Math.round(m.value * 1000) / 10}%`;
}

function metricRow(m: MetricResult): HTMLElement {
  const measured = m.status === "measured" && m.value !== null;
  return el(`<li>
    <b>${esc(m.label)}</b>
    <span class="chip ${measured ? "ok" : "unknown"}">${esc(formatMetric(m))}</span>
    ${measured && typeof m.numerator === "number" ? `<span class="chip num">${m.numerator}/${m.denominator}</span>` : ""}
    <div class="why">${esc(m.formula)}${m.note ? ` — ${esc(m.note)}` : ""}</div>
  </li>`);
}

export function renderPipeline(main: HTMLElement): void {
  main.append(
    el(
      `<div class="mod-head"><h2>Pipeline</h2><span class="spacer"></span></div>`,
    ),
  );
  main.append(
    el(
      `<p class="mod-desc">A record of what already happened, written by you. Nothing here contacts anyone, advances anyone or rejects anyone — moving a stage is a decision, so it asks first. Metrics are computed from these events and nothing else: there is no seeded history and no estimate.</p>`,
    ),
  );

  const ctx = currentContext();
  const ids = state.candidates.map((c) => c.id);

  if (!state.candidates.length) {
    main.append(
      el(
        `<div class="panel"><p class="why">No candidates yet, so there is no pipeline and nothing to measure. Add candidates first — an empty funnel is not a zero conversion rate.</p></div>`,
      ),
    );
    return;
  }

  // ── The board ───────────────────────────────────────────────────────────
  const reached = reachedCounts(ids, state.events);
  const board = el(
    `<div class="panel"><h3>Where everyone is <span class="why num">${state.candidates.length} candidate${state.candidates.length === 1 ? "" : "s"}</span></h3></div>`,
  );
  const counts = el(
    `<p class="why">Reached: ${STAGES.map((s) => `${esc(STAGE_LABELS[s])} ${reached[s]}`).join(" · ")}</p>`,
  );
  board.append(counts);

  for (const cand of state.candidates) {
    const position = currentPosition(cand.id, state.events);
    const label =
      position.kind === "stage"
        ? STAGE_LABELS[position.stage]
        : position.kind === "exit"
          ? EXIT_LABELS[position.exit]
          : "Not recorded";
    const cls =
      position.kind === "exit"
        ? "unknown"
        : position.kind === "stage"
          ? "ok"
          : "";
    const row = el(`<div class="qrow">
      <div class="qmeta"><div class="plat">${esc(cand.name)}</div><span class="chip ${cls}">${esc(label.toUpperCase())}</span></div>
    </div>`);

    const controls = el(`<div class="action-controls"></div>`);
    const stageSelect = el<HTMLSelectElement>(
      `<select aria-label="Record a stage for ${esc(cand.name)}"><option value="">Record a stage…</option>${STAGES.map(
        (s) => `<option value="${s}">${esc(STAGE_LABELS[s])}</option>`,
      ).join("")}</select>`,
    );
    stageSelect.onchange = async () => {
      const to = stageSelect.value as Stage | "";
      if (!to) return;
      const from = position.kind === "stage" ? position.stage : undefined;
      const ok = window.confirm(
        `Record ${cand.name} as "${STAGE_LABELS[to]}".\n\nThis is your decision, not a suggestion — TalentOS never moves anyone on its own. Continue?`,
      );
      stageSelect.value = "";
      if (!ok) return;
      const note = window.prompt("What happened? (optional)", "") ?? "";
      await record({
        candidateId: cand.id,
        type: "stage_change",
        fromStage: from,
        toStage: to,
        note,
      });
    };

    const exitSelect = el<HTMLSelectElement>(
      `<select aria-label="Record an exit for ${esc(cand.name)}"><option value="">Record an exit…</option>${EXITS.map(
        (e) => `<option value="${e}">${esc(EXIT_LABELS[e])}</option>`,
      ).join("")}</select>`,
    );
    exitSelect.onchange = async () => {
      const exit = exitSelect.value as (typeof EXITS)[number] | "";
      if (!exit) return;
      const ok = window.confirm(
        `Record that ${cand.name} ${exit === "rejected" ? "was rejected" : exit === "withdrawn" ? "withdrew" : "is on hold"}.\n\nThis is your decision. Continue?`,
      );
      exitSelect.value = "";
      if (!ok) return;
      const note =
        window.prompt(
          "Why? The reason is the only part of this a later search can learn from.",
          "",
        ) ?? "";
      await record({ candidateId: cand.id, type: "exit", exit, note });
    };

    const reply = el<HTMLSelectElement>(
      `<select aria-label="Record a reply from ${esc(cand.name)}"><option value="">Record a reply…</option><option value="interested">Replied — interested</option><option value="not_interested">Replied — not interested</option><option value="unclear">Replied — unclear</option></select>`,
    );
    reply.onchange = async () => {
      const outcome = reply.value as PipelineEvent["outcome"] | "";
      reply.value = "";
      if (!outcome) return;
      await record({ candidateId: cand.id, type: "reply_recorded", outcome });
    };

    const contacted = el<HTMLButtonElement>(
      `<button class="btn small" type="button">I contacted them</button>`,
    );
    contacted.onclick = () =>
      void record({ candidateId: cand.id, type: "outreach_recorded" });

    controls.append(contacted, reply, stageSelect, exitSelect);
    const body = el(`<div class="action-body"></div>`);
    body.append(controls);

    const history = state.events.filter((e) => e.candidateId === cand.id);
    if (history.length) {
      body.append(
        el(
          `<details><summary class="why">${history.length} recorded event${history.length === 1 ? "" : "s"}</summary><ul>${history
            .map(
              (e) =>
                `<li class="why">${esc(asOf(e.at))} — ${esc(describeEvent(e))}${e.note ? `: ${esc(e.note)}` : ""}</li>`,
            )
            .join("")}</ul></details>`,
        ),
      );
    }
    row.append(body);
    board.append(row);
  }
  main.append(board);

  // ── The four metric groups ──────────────────────────────────────────────
  const groups = computeMetrics({
    candidateIds: ids,
    events: state.events,
    nowIso: state.now,
    openedAt: ctx?.openedAt || undefined,
  });
  for (const group of groups) {
    const measured = group.metrics.filter(
      (m) => m.status === "measured",
    ).length;
    const panel = el(
      `<div class="panel"><h3>${esc(group.label)} <span class="why num">${measured} of ${group.metrics.length} measurable</span></h3><p class="why">${esc(group.purpose)}</p></div>`,
    );
    const list = el(`<ul class="metrics"></ul>`);
    for (const m of group.metrics) list.append(metricRow(m));
    panel.append(list);
    main.append(panel);
  }

  main.append(
    el(
      `<p class="why">Every rate above states the population it is a share of. A metric with too few observations says so rather than showing a number that would move on the next candidate. No metric is broken down by any candidate attribute, and none can be.</p>`,
    ),
  );
}

function describeEvent(e: PipelineEvent): string {
  switch (e.type) {
    case "stage_change":
      return `moved${e.fromStage ? ` from ${STAGE_LABELS[e.fromStage]}` : ""} to ${e.toStage ? STAGE_LABELS[e.toStage] : "?"}`;
    case "outreach_recorded":
      return "outreach recorded";
    case "reply_recorded":
      return `reply recorded (${e.outcome ?? "unclear"})`;
    case "exit":
      return `exit recorded (${e.exit ? EXIT_LABELS[e.exit] : "?"})`;
    default:
      return "note";
  }
}

async function record(
  input: Omit<PipelineEvent, "id" | "at" | "recordedBy" | "note"> &
    Partial<Pick<PipelineEvent, "note">>,
): Promise<void> {
  const parsed = pipelineEventSchema.safeParse({
    id: `ev-${uid().slice(0, 8)}`,
    at: nowIso(),
    recordedBy: "recruiter",
    note: "",
    ...input,
  });
  if (!parsed.success) return;
  await appendEvent(parsed.data);
  render();
}

registerModule("pipeline", renderPipeline);
