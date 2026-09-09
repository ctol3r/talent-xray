/**
 * The talent expert, in the artifact.
 *
 * The same conversation the Next app has, with the difference that matters:
 * here it answers. The artifact runs inside Claude and borrows the viewer's
 * own Claude through the `sample` capability, so there is no API key, no
 * server and no file handed to anybody. The Next app cannot do that — a
 * server has no viewer to borrow — which is why the same feature over there
 * writes a request file for a Claude session to fulfil.
 *
 * One conversation, kept in `localStorage` rather than in the search store: it
 * belongs to the desk rather than to any one search, and it is a conversation
 * rather than a record.
 */
import { $, el, esc, nowIso, uid } from "../core/dom";
import {
  EXPERTS,
  expertById,
  routeQuestion,
  type Expert,
} from "../core/experts";
import { askExpert, errorMessage } from "../ai/tasks";
import { aiAvailable, registerModule, render } from "./shell";

const KEY = "talentos-expert-chat-v1";
/** Enough to scroll back through a sitting; past that it is a filing system. */
const MAX_TURNS = 120;

interface Turn {
  id: string;
  at: string;
  who: "you" | "expert";
  text: string;
  expert?: string;
  because?: string[];
  uncertain?: string[];
  next?: string[];
  declined?: boolean;
  flagged?: string[];
}

function read(): Turn[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Turn[]) : [];
  } catch {
    // A viewer that refuses storage still gets a working conversation, just
    // one that does not survive a reload.
    return [];
  }
}

function write(turns: Turn[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(turns.slice(-MAX_TURNS)));
  } catch {
    /* as above */
  }
}

let asking = false;
let trouble: string | null = null;
/** Named by the reader, overriding the routing. Empty means let it route. */
let chosen = "";
let draft = "";

async function send(question: string): Promise<void> {
  const asked = question.trim();
  if (!asked || asking) return;
  const routing = chosen
    ? { expert: expertById(chosen), because: [] as string[] }
    : routeQuestion(asked);

  const history = read();
  const turns: Turn[] = [
    ...history,
    { id: uid(), at: nowIso(), who: "you", text: asked },
  ];
  write(turns);
  draft = "";
  trouble = null;
  asking = true;
  render();

  try {
    const reply = await askExpert(
      routing.expert,
      asked,
      history.map((turn) => ({ who: turn.who, text: turn.text })),
    );
    write([
      ...turns,
      {
        id: uid(),
        at: nowIso(),
        who: "expert",
        text: reply.answer,
        expert: routing.expert.id,
        because: routing.because,
        uncertain: reply.uncertain,
        next: reply.next,
        declined: reply.declined,
        ...(reply.traitWarnings.length > 0
          ? { flagged: reply.traitWarnings }
          : {}),
      },
    ]);
  } catch (error) {
    // The question stays in the transcript. A chat that swallows a turn is
    // one nobody can tell from a slow one.
    trouble = errorMessage(error);
  } finally {
    asking = false;
    render();
  }
}

function turnEl(turn: Turn): HTMLElement {
  if (turn.who === "you") {
    return el(`<p class="expert-you">${esc(turn.text)}</p>`);
  }
  const who: Expert = expertById(turn.expert ?? "generalist");
  const because =
    turn.because && turn.because.length > 0
      ? ` · routed on “${esc(turn.because.join("”, “"))}”`
      : "";
  const node = el(`<div class="expert-said">
    <p class="who">${who.mark} <b>${esc(who.name)}</b> · ${esc(who.does)}${because}</p>
    <p class="body">${esc(turn.text)}</p>
  </div>`);
  if (turn.declined) {
    node.append(
      el(
        `<p class="warn">⚠️ This needed something about a real person, company or number that the model cannot see. Nothing above is a fact about your records.</p>`,
      ),
    );
  }
  for (const doubt of turn.uncertain ?? []) {
    node.append(el(`<p class="why">⚠️ not sure: ${esc(doubt)}</p>`));
  }
  if (turn.flagged && turn.flagged.length > 0) {
    node.append(
      el(
        `<p class="warn">⚖️ Mentions ${esc(turn.flagged.join(", "))} — worth a look before you use it.</p>`,
      ),
    );
  }
  for (const suggestion of turn.next ?? []) {
    const chip = el<HTMLButtonElement>(
      `<button class="btn small" type="button">${esc(suggestion)}</button>`,
    );
    chip.onclick = () => void send(suggestion);
    node.append(chip);
  }
  return node;
}

function renderExpert(main: HTMLElement): void {
  const turns = read();
  const root = el(`<section class="card">
    <h2>💬 Your talent expert</h2>
    <p class="why">One conversation, ${EXPERTS.length} specialists. The question goes to whichever it is about and the answer says which — and says what it does not know. It cannot see your records, so it never claims anything about a named person.</p>
  </section>`);

  if (!aiAvailable()) {
    root.append(
      el(
        `<p class="warn">Claude is not available in this view, so the expert cannot answer. Everything else on this page works without it.</p>`,
      ),
    );
    main.append(root);
    return;
  }

  const log = el(`<div class="expert-log"></div>`);
  if (turns.length === 0) {
    log.append(
      el(
        `<p class="why">Ask anything about the work — how to open an intake, why nobody is replying, what a counter-offer means here.</p>`,
      ),
    );
  } else {
    for (const turn of turns) log.append(turnEl(turn));
  }
  if (asking) log.append(el(`<p class="why">Asking…</p>`));
  if (trouble) log.append(el(`<p class="warn">${esc(trouble)}</p>`));
  root.append(log);

  const box = el<HTMLTextAreaElement>(
    `<textarea rows="2" aria-label="Ask the team" placeholder="Ask the team. Enter sends, shift-enter is a new line."></textarea>`,
  );
  box.value = draft;
  box.oninput = () => {
    draft = box.value;
    const preview = $(".expert-route", root);
    if (preview) {
      const going = chosen
        ? expertById(chosen)
        : draft.trim()
          ? routeQuestion(draft).expert
          : null;
      preview.textContent = going
        ? `${going.mark} ${going.name}`
        : "routed by what you ask";
    }
  };
  box.onkeydown = (event: KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send(box.value);
    }
  };
  root.append(box);

  const row = el(`<div class="row"></div>`);
  const ask = el<HTMLButtonElement>(
    `<button class="btn primary" type="button">${asking ? "Asking…" : "Ask"}</button>`,
  );
  ask.disabled = asking;
  ask.onclick = () => void send(box.value);
  row.append(ask);

  const picker = el<HTMLSelectElement>(
    `<select aria-label="Which specialist answers">
      <option value="">Routed by what you ask</option>
      ${EXPERTS.map((expert) => `<option value="${esc(expert.id)}">${expert.mark} ${esc(expert.name)}</option>`).join("")}
    </select>`,
  );
  picker.value = chosen;
  picker.onchange = () => {
    chosen = picker.value;
    render();
  };
  row.append(picker);
  row.append(
    el(`<span class="expert-route why">routed by what you ask</span>`),
  );

  if (turns.length > 0) {
    const clear = el<HTMLButtonElement>(
      `<button class="btn small" type="button">Clear</button>`,
    );
    clear.onclick = () => {
      write([]);
      trouble = null;
      render();
    };
    row.append(clear);
  }
  root.append(row);

  // The team, named. A "team of agents" whose members you cannot see is a
  // sentence rather than a feature.
  root.append(
    el(
      `<p class="why">${EXPERTS.map((expert) => `${expert.mark} ${esc(expert.name)}`).join(" · ")}</p>`,
    ),
  );
  main.append(root);
}

registerModule("expert", renderExpert);
