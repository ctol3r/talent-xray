/**
 * The action queue and initiatives (spec §11).
 *
 * A module's envelope DRAFTS action items; they are suggestions until a
 * human adds them. Once in the queue an action has an owner, a status and,
 * when it is blocked, a stated reason. Completing one asks what actually
 * happened, because "done" with no note is how a queue stops meaning
 * anything. Nothing here contacts anyone.
 */
import { $, el, esc, asOf, nowIso, uid } from "../core/dom";
import {
  OWNERS,
  actionItemSchema,
  initiativeSchema,
  type ActionItem,
} from "../core/envelope";
import { MODULES, type ModuleKey } from "../core/dependencies";
import {
  putAction,
  putInitiative,
  state,
  suggestedActions,
} from "../app/state";
import { registerModule, render } from "./shell";

const STATUS_LABELS: Record<ActionItem["status"], string> = {
  open: "Open",
  in_progress: "In progress",
  blocked: "Blocked",
  completed: "Completed",
  dismissed: "Dismissed",
};
const STATUS_CLASS: Record<ActionItem["status"], string> = {
  open: "",
  in_progress: "inference",
  blocked: "bad",
  completed: "ok",
  dismissed: "unknown",
};
const OWNER_LABELS: Record<string, string> = {
  recruiter: "Recruiter",
  sourcer: "Sourcer",
  hiring_manager: "Hiring manager",
  interviewer: "Interviewer",
  talent_leader: "Talent leader",
  unassigned: "Unassigned",
};

const moduleLabel = (key: string): string =>
  key in MODULES ? MODULES[key as ModuleKey].label : key;

function actionRow(action: ActionItem): HTMLElement {
  const row =
    el(`<div class="qrow action-row" data-action-id="${esc(action.id)}">
    <div class="qmeta">
      <div class="plat">${esc(action.title)}</div>
      <span class="chip ${STATUS_CLASS[action.status]}">${esc(STATUS_LABELS[action.status].toUpperCase())}</span>
      <span class="chip">${esc(OWNER_LABELS[action.owner] ?? action.owner)}</span>
      ${action.targetDate ? `<span class="chip num">by ${esc(action.targetDate)}</span>` : ""}
    </div>
  </div>`);

  const body = el(`<div class="action-body"></div>`);
  if (action.description) {
    body.append(el(`<p class="why">${esc(action.description)}</p>`));
  }
  if (action.status === "blocked" && action.blockingReason) {
    body.append(
      el(`<p class="why"><b>Blocked:</b> ${esc(action.blockingReason)}</p>`),
    );
  }
  if (action.status === "completed") {
    body.append(
      el(
        `<p class="why">Completed ${esc(asOf(action.completedAt ?? ""))}${action.completionNote ? ` — ${esc(action.completionNote)}` : ""}</p>`,
      ),
    );
  }

  const controls = el(`<div class="action-controls"></div>`);
  const owner = el<HTMLSelectElement>(
    `<select aria-label="Owner for: ${esc(action.title)}">${OWNERS.map((o) => `<option value="${o}"${o === action.owner ? " selected" : ""}>${esc(OWNER_LABELS[o] ?? o)}</option>`).join("")}</select>`,
  );
  owner.onchange = () => {
    void save({ ...action, owner: owner.value as ActionItem["owner"] });
  };
  const status = el<HTMLSelectElement>(
    `<select aria-label="Status for: ${esc(action.title)}">${(
      Object.keys(STATUS_LABELS) as ActionItem["status"][]
    )
      .map(
        (s) =>
          `<option value="${s}"${s === action.status ? " selected" : ""}>${esc(STATUS_LABELS[s])}</option>`,
      )
      .join("")}</select>`,
  );
  status.onchange = () => {
    const next = status.value as ActionItem["status"];
    if (next === "completed") {
      const note = window.prompt(
        `Completing "${action.title}".\n\nWhat actually happened? (A queue where everything is "done" with no note stops meaning anything.)`,
        "",
      );
      if (note === null) {
        status.value = action.status;
        return;
      }
      void save({
        ...action,
        status: next,
        completedAt: nowIso(),
        completionNote: note.trim(),
      });
      return;
    }
    if (next === "blocked") {
      const why = window.prompt(
        `Blocking "${action.title}".\n\nWhat is it waiting on?`,
        action.blockingReason ?? "",
      );
      if (why === null) {
        status.value = action.status;
        return;
      }
      void save({ ...action, status: next, blockingReason: why.trim() });
      return;
    }
    void save({
      ...action,
      status: next,
      completedAt: undefined,
      completionNote: undefined,
    });
  };
  controls.append(owner, status);
  body.append(controls);
  row.append(body);
  return row;
}

async function save(action: ActionItem): Promise<void> {
  const parsed = actionItemSchema.safeParse(action);
  if (!parsed.success) return;
  await putAction(parsed.data);
  render();
}

export function renderActions(main: HTMLElement): void {
  main.append(
    el(
      `<div class="mod-head"><h2>Actions</h2><span class="spacer"></span></div>`,
    ),
  );
  main.append(
    el(
      `<p class="mod-desc">What the search owes someone. Modules draft action items inside their output; nothing reaches this queue until you add it. Completing an action asks what happened — the note is the record.</p>`,
    ),
  );

  const suggestions = suggestedActions();
  const suggestPanel = el(
    `<div class="panel" id="suggested-actions"><h3>Drafted by your modules <span class="why num">${suggestions.length}</span></h3></div>`,
  );
  if (!suggestions.length) {
    suggestPanel.append(
      el(
        `<p class="why">Nothing outstanding. Generated modules propose actions in their output; they appear here until you add or ignore them.</p>`,
      ),
    );
  }
  for (const { action, fromModule } of suggestions) {
    const row = el(`<div class="qrow">
      <div class="qmeta"><div class="plat">${esc(action.title)}</div><span class="chip inference">from ${esc(moduleLabel(fromModule))}</span></div>
      <div class="why">${esc(action.description)}</div>
    </div>`);
    const add = el<HTMLButtonElement>(
      `<button class="btn small" type="button">Add to queue</button>`,
    );
    add.onclick = () => void save({ ...action, status: "open" });
    row.append(add);
    suggestPanel.append(row);
  }
  main.append(suggestPanel);

  // ── Initiatives ─────────────────────────────────────────────────────────
  const initPanel = el(
    `<div class="panel"><h3>Initiatives</h3><p class="why">A named intent several actions serve. Progress is counted from the actions, never set by hand.</p></div>`,
  );
  const title = el<HTMLInputElement>(
    `<input type="text" placeholder="Initiative title (e.g. 'Close the pay-band question')" aria-label="Initiative title">`,
  );
  const why = el<HTMLInputElement>(
    `<input type="text" placeholder="Why it exists" aria-label="Why this initiative exists">`,
  );
  const create = el<HTMLButtonElement>(
    `<button class="btn small" type="button">Create initiative</button>`,
  );
  const msg = el(`<span class="why" role="status"></span>`);
  create.onclick = async () => {
    if (!title.value.trim()) {
      msg.textContent = "A title is required.";
      return;
    }
    const parsed = initiativeSchema.safeParse({
      id: `init-${uid().slice(0, 8)}`,
      title: title.value.trim(),
      why: why.value.trim(),
      createdAt: nowIso(),
    });
    if (!parsed.success) return;
    await putInitiative(parsed.data);
    render();
  };
  initPanel.append(title, why, create, msg);
  main.append(initPanel);

  // ── The queue, grouped by initiative ────────────────────────────────────
  const groups: Array<{ id: string; label: string; note: string }> = [
    ...state.initiatives.map((i) => ({
      id: i.id,
      label: i.title,
      note: i.why,
    })),
    {
      id: "",
      label: "Unfiled",
      note: "Actions not attached to an initiative.",
    },
  ];
  for (const group of groups) {
    const items = state.actions.filter(
      (a) => (a.initiativeId ?? "") === group.id,
    );
    if (!items.length && group.id === "") continue;
    const done = items.filter((a) => a.status === "completed").length;
    const panel = el(
      `<div class="panel"><h3>${esc(group.label)} <span class="why num">${done}/${items.length} complete</span></h3>${group.note ? `<p class="why">${esc(group.note)}</p>` : ""}</div>`,
    );
    if (!items.length) {
      panel.append(
        el(`<p class="why">No actions filed under this initiative yet.</p>`),
      );
    }
    for (const action of items) panel.append(actionRow(action));
    main.append(panel);
  }

  if (!state.actions.length) {
    main.append(
      el(
        `<div class="panel"><p class="why">The queue is empty. That is a real state, not an error — it means nothing has been accepted from a draft yet.</p></div>`,
      ),
    );
  }
}

/** Scroll to and highlight one action (the A–H router's `open_action`). */
export function focusAction(id: string): void {
  const row = $(`[data-action-id="${id}"]`);
  if (!row) return;
  row.scrollIntoView({ block: "center" });
  row.classList.add("flash");
}

registerModule("actions", renderActions);
