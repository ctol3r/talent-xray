/**
 * The adaptive intake loop: record what the hiring manager said, reason
 * over it once, show the next question worth asking. Every statement
 * becomes part of the versioned SearchContext.
 */
import { $, el, esc, nowIso, uid } from "../core/dom";
import type { ManagerStatement } from "@/lib/core/ir";
import {
  reasonOverStatement,
  recordFailure,
  errorCode,
  errorMessage,
} from "../ai/tasks";
import {
  currentIntent,
  putArtifact,
  recordContextRevision,
  state,
} from "../app/state";
import { renderCanonicalIR } from "./renderers";
import { aiAvailable, copyFor, hideAi, registerModule, render } from "./shell";

export function renderIntakeLoop(main: HTMLElement): void {
  main.append(
    el(
      `<div class="mod-head"><h2>Intake loop</h2><span class="spacer"></span></div>`,
    ),
  );
  main.append(
    el(
      `<p class="mod-desc">Record what the hiring manager actually said. Each statement is reasoned over once: requirements update with their provenance, uncertainties open and close, contradictions are recorded rather than resolved silently, and you get the single question worth asking next.</p>`,
    ),
  );
  const intent = currentIntent();
  if (!intent) {
    main.append(
      el(
        `<div class="panel"><p class="why">Generate the <strong>Canonical IR</strong> first — the loop reasons over it. Nothing here re-reads the job description.</p></div>`,
      ),
    );
    return;
  }
  const body = el(`<div></div>`);
  main.append(body);

  if (intent.nextQuestion) {
    const q = intent.nextQuestion;
    body.append(
      el(`<div class="panel decision"><h3>Ask this next</h3>
        <p class="qq">${esc(q.question)}</p>
        <p class="why">Why it matters: ${esc(q.whyItMatters ?? "")}</p>
        <p class="why">Information value: ${esc(q.informationValue ?? "")}</p></div>`),
    );
  }

  const form = el(
    `<div class="panel"><h3>Record a hiring-manager statement</h3><p class="why">Quote them. The verbatim text is kept as provenance and never rewritten.</p></div>`,
  );
  const speaker = el<HTMLInputElement>(
    `<input type="text" value="hiring_manager" aria-label="Speaker" placeholder="Speaker — hiring_manager, board_chair, superintendent…" />`,
  );
  const context = el<HTMLInputElement>(
    `<input type="text" aria-label="What prompted it" placeholder="What prompted it — usually the question you asked" />`,
  );
  const text = el<HTMLTextAreaElement>(
    `<textarea rows="4" aria-label="What they said" placeholder="What they said, in their own words…"></textarea>`,
  );
  const go = el<HTMLButtonElement>(
    `<button class="btn primary" type="button">Reason over this statement</button>`,
  );
  const stop = el<HTMLButtonElement>(
    `<button class="btn small" type="button" hidden>Stop</button>`,
  );
  form.append(speaker, context, text, el(`<div class="gap"></div>`), go, stop);
  body.append(form);

  if (!aiAvailable()) {
    go.disabled = true;
    form.append(
      el(`<div class="notice warning">${esc(copyFor("not_granted"))}</div>`),
    );
  }

  let ctl: AbortController | null = null;
  stop.onclick = () => ctl?.abort();
  go.onclick = async () => {
    const said = text.value.trim();
    if (!said) return;
    go.disabled = true;
    stop.hidden = false;
    const think = el(
      `<div class="panel" role="status" aria-live="polite"><div class="thinking">Reasoning over the statement — Claude is thinking…</div><div class="stream"></div></div>`,
    );
    body.append(think);
    const streamEl = $(".stream", think);
    const statement: ManagerStatement = {
      id: uid(),
      at: nowIso(),
      speaker: speaker.value.trim() || "hiring_manager",
      text: said,
      context: context.value.trim() || undefined,
    };
    state.inflight = { ...state.inflight, intake_loop: "generating" };
    try {
      const result = await reasonOverStatement(statement, {
        bindStop: (c) => {
          ctl = c;
        },
        onText: ({ text: t }) => {
          if (streamEl) {
            streamEl.textContent = t.slice(-1500);
            streamEl.scrollTop = streamEl.scrollHeight;
          }
        },
      });
      await putArtifact("intent", result);
      await recordContextRevision();
      render();
    } catch (e) {
      const code = errorCode(e);
      if (code === "not_granted" || code === "sampling_disabled") hideAi();
      await recordFailure("intent", e);
      think.remove();
      body.append(
        el(
          `<div class="notice error" role="alert"><strong>Reasoning failed.</strong> ${esc(copyFor(code))} <span class="why">${esc(errorMessage(e))}</span></div>`,
        ),
      );
      go.disabled = false;
      stop.hidden = true;
    } finally {
      const next = { ...state.inflight };
      delete next.intake_loop;
      state.inflight = next;
    }
  };

  const rec = state.artifacts.intent;
  if (rec?.traitWarnings.length) {
    body.append(
      el(
        `<div class="notice warning" role="alert"><strong>Review required:</strong> the updated intelligence mentions ${esc(rec.traitWarnings.join(", "))}. Protected characteristics must never drive evaluation — edit before use.</div>`,
      ),
    );
  }
  if (rec?.lastError && rec.lastError.at > (rec.meta.generatedAt ?? "")) {
    body.append(
      el(
        `<div class="notice error"><strong>Last turn failed</strong> (${esc(rec.lastError.at)}): ${esc(rec.lastError.message)}</div>`,
      ),
    );
  }

  const log = intent.statements ?? [];
  if (log.length) {
    body.append(
      el(
        `<div class="panel"><h3>Statement log <span class="why">— verbatim, in order, revision ${esc(String(intent.revision ?? 0))}</span></h3>${log
          .map(
            (st) => `<div class="stack">
          <span class="chip inference">${esc(st.speaker)}</span>
          ${st.context ? `<p class="why">Asked: ${esc(st.context)}</p>` : ""}
          <p>“${esc(st.text)}”</p></div>`,
          )
          .join("")}</div>`,
      ),
    );
  }
  const ir = el(`<div></div>`);
  body.append(ir);
  renderCanonicalIR(ir, intent);
}

registerModule("intake_loop", renderIntakeLoop);
