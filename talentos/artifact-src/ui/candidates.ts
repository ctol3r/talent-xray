/**
 * Candidates: paste what is publicly observable, compare it to the success
 * profile, draft outreach to copy out. Advisory only — nothing ranks,
 * rejects, advances or sends. Lookalike records raise an identity review
 * and are never merged automatically.
 */
import { $, el, esc, nowIso, uid } from "../core/dom";
import type { StoredCandidate } from "../core/store";
import type { EvidencePayload, OutreachPayload } from "../core/payloads";
import { findIdentityMatches } from "../core/identity";
import {
  candidatePlan,
  runCandidateAgents,
  runCandidateTask,
  errorCode,
  errorMessage,
} from "../ai/tasks";
import { putCandidate, state } from "../app/state";
import { chipFor } from "./renderers";
import { aiAvailable, copyFor, hideAi, registerModule, render } from "./shell";
import {
  QUOTE_LABELS,
  buildDossier,
  criteriaFromProfile,
  sourcesFor,
  type CandidateSource,
} from "../core/evidence";
import { copyText } from "../core/dom";
import { renderDeck } from "./deck";
import { renderParallel } from "./parallel";

export function renderCandidates(main: HTMLElement): void {
  main.append(el(`<div class="mod-head"><h2>Candidates</h2></div>`));
  main.append(
    el(
      `<p class="mod-desc">Find people by running a compiled query on Talent X-Ray (Search Strings), then paste what's publicly observable and compare it to the success profile. Evidence alignment is advisory decision support — you decide, and everything is editable. Profiles link out; nothing is fetched or scraped. Similar names are flagged for review, never merged.</p>`,
    ),
  );
  const deck = el(`<div class="deck-root"></div>`);
  renderDeck(deck);
  main.append(deck);
  const form = el(
    `<div class="panel"><h3>Add candidate</h3><div class="form-grid"></div></div>`,
  );
  const grid = $(".form-grid", form);
  const inputs: Record<string, HTMLInputElement> = {};
  for (const [key, label] of [
    ["name", "Name"],
    ["currentTitle", "Current title"],
    ["currentCompany", "Current company"],
    ["geography", "Geography"],
    ["profileUrl", "Profile URL"],
    ["notes", "Recruiter notes"],
  ] as const) {
    const w = el(`<label class="field"><b>${esc(label)}</b></label>`);
    inputs[key] = el<HTMLInputElement>(`<input type="text" name="${key}">`);
    w.append(inputs[key]);
    grid?.append(w);
  }
  const pw = el(
    `<label class="field span"><b>Pasted profile / resume text</b></label>`,
  );
  const pasted = el<HTMLTextAreaElement>(
    `<textarea rows="5" name="pastedText"></textarea>`,
  );
  pw.append(pasted);
  grid?.append(pw);
  const addBtn = el<HTMLButtonElement>(
    `<button class="btn primary" type="button">Add candidate</button>`,
  );
  const msg = el(`<span class="why" role="status"></span>`);
  addBtn.onclick = async () => {
    if (!inputs.name.value.trim()) {
      msg.textContent = "Name is required.";
      return;
    }
    const cand: StoredCandidate = {
      id: uid(),
      name: inputs.name.value.trim(),
      currentTitle: inputs.currentTitle.value.trim(),
      currentCompany: inputs.currentCompany.value.trim(),
      geography: inputs.geography.value.trim(),
      profileUrls: inputs.profileUrl.value.trim()
        ? [inputs.profileUrl.value.trim()]
        : [],
      notes: inputs.notes.value.trim(),
      pastedText: pasted.value,
      createdAt: nowIso(),
    };
    const matches = findIdentityMatches(cand, state.candidates);
    const withReview: StoredCandidate = matches.length
      ? {
          ...cand,
          identityReview: {
            status: "open",
            similarTo: matches.map((m) => m.otherId),
            note: matches.map((m) => m.reason).join(" "),
          },
        }
      : cand;
    await putCandidate(withReview);
    render();
  };
  form.append(addBtn, msg);
  main.append(form);
  const list = el(`<div class="cand-list"></div>`);
  for (const cand of state.candidates) list.append(renderCandidateCard(cand));
  main.append(list);
}

function renderCandidateCard(cand: StoredCandidate): HTMLElement {
  const card = el(`<div class="panel" id="cand-${esc(cand.id)}"></div>`);
  const head = el(
    `<div class="mod-head tight"><h3>${esc(cand.name)}</h3><span class="why">${esc([cand.currentTitle, cand.currentCompany, cand.geography].filter(Boolean).join(" · "))}</span><span class="spacer"></span></div>`,
  );
  card.append(head);
  if (cand.identityReview?.status === "open") {
    const review = el(
      `<div class="notice warning" role="alert"><strong>Identity review needed.</strong> ${esc(cand.identityReview.note ?? "")} This record has NOT been merged with ${cand.identityReview.similarTo.map((id) => `<a href="#cand-${esc(id)}">${esc(state.candidates.find((c) => c.id === id)?.name ?? id)}</a>`).join(", ")}. Decide: </div>`,
    );
    const same = el<HTMLButtonElement>(
      `<button class="btn small" type="button">Same person</button>`,
    );
    const diff = el<HTMLButtonElement>(
      `<button class="btn small" type="button">Different people</button>`,
    );
    same.onclick = async () => {
      if (
        !window.confirm(
          "Record that these are the same person? Records stay separate; only the note changes — merging is a manual edit.",
        )
      )
        return;
      await putCandidate({
        ...cand,
        identityReview: { ...cand.identityReview!, status: "same_person" },
      });
      render();
    };
    diff.onclick = async () => {
      await putCandidate({
        ...cand,
        identityReview: { ...cand.identityReview!, status: "different_person" },
      });
      render();
    };
    review.append(same, diff);
    card.append(review);
  } else if (cand.identityReview) {
    card.append(
      el(
        `<p class="why">Identity review: ${esc(cand.identityReview.status.replace(/_/g, " "))}.</p>`,
      ),
    );
  }
  const body = el(`<div></div>`);
  card.append(body);
  const paint = () => {
    body.innerHTML = "";
    const evidence = cand.evidence?.payload as EvidencePayload | undefined;

    const sources = sourcesFor(cand);
    if (sources.length) {
      body.append(
        el(
          `<div><h4>Sources <span class="chip num">${sources.length}</span></h4><ul>${sources
            .map((src: CandidateSource) =>
              src.kind === "link"
                ? `<li><a href="${esc(src.url ?? "")}" target="_blank" rel="noopener">${esc(src.label)}</a> <span class="chip warn">LINK — NOT FETCHED</span> <span class="why">Nothing on this page reads that page. Open it yourself.</span></li>`
                : `<li><b>${esc(src.label)}</b> <span class="chip ok">${src.text.trim().length} chars supplied</span></li>`,
            )
            .join("")}</ul></div>`,
        ),
      );
    }

    if (evidence) {
      const profile = state.artifacts.success_profile?.payload;
      const dossier = buildDossier({
        candidate: cand,
        rawItems: evidence.items,
        criteria: criteriaFromProfile(profile),
        questions: evidence.questionsToValidate,
      });
      body.append(
        el(
          `<div><h4>Evidence vs success profile <span class="chip inference">model inference</span> <span class="chip ${dossier.downgraded ? "bad" : "num"}">${dossier.supportedCount} of ${dossier.items.length} quote-verified</span></h4><p class="why">${esc(dossier.summary)}</p></div>`,
        ),
      );
      if (dossier.downgraded > 0) {
        body.append(
          el(
            `<div class="notice error" role="alert"><strong>${dossier.downgraded} claim${dossier.downgraded === 1 ? "" : "s"} downgraded.</strong> A quote was named that is not in the source it cited. Those rows are marked below and must not be used — this is exactly the failure that would put words in a real person's mouth.</div>`,
          ),
        );
      }
      const list = el(`<ul class="dossier"></ul>`);
      for (const item of dossier.items) {
        list.append(
          el(
            `<li class="dossier-item ${item.supported ? "" : "unsupported"}">
              <div><b>${esc(item.criterion)}</b> ${chipFor(item.status)} <span class="chip ${item.supported ? "ok" : item.check === "not_found_in_source" ? "bad" : "unknown"}">${esc(QUOTE_LABELS[item.check].toUpperCase())}</span>${item.sourceLabel ? ` <span class="chip">${esc(item.sourceLabel.slice(0, 40))}</span>` : ""}</div>
              ${item.quote ? `<blockquote class="quote">${esc(item.quote)}</blockquote>` : ""}
              <div class="why">${esc(item.evidenceText)}</div>
              <div class="why">${esc(item.note)}</div>
            </li>`,
          ),
        );
      }
      body.append(list);
      if (dossier.uncovered.length) {
        body.append(
          el(
            `<div><h4>Not assessed <span class="chip warn">${dossier.uncovered.length}</span></h4><ul>${dossier.uncovered
              .map((c) => `<li class="why">${esc(c)}</li>`)
              .join(
                "",
              )}</ul><p class="why">These criteria are in the success profile and the assessment did not mention them. Absence here is absence of an answer, not absence of the skill.</p></div>`,
          ),
        );
      }
      const ppWrap = el(`<div class="pp-wrap"></div>`);
      const ppBtn = el<HTMLButtonElement>(
        `<button class="btn small" type="button" aria-expanded="false" title="Lay the pasted text beside the dossier, with a ribbon from every verified quote to its claim">Parallel pages</button>`,
      );
      ppBtn.onclick = () => {
        const open = ppBtn.getAttribute("aria-expanded") === "true";
        if (open) {
          ppWrap.innerHTML = "";
          ppBtn.setAttribute("aria-expanded", "false");
        } else {
          renderParallel(ppWrap, dossier);
          ppBtn.setAttribute("aria-expanded", "true");
        }
      };
      body.append(ppBtn, ppWrap);
      body.append(
        el(
          `<p class="why"><b>Suggested review priority (advisory):</b> ${esc(evidence.reviewPriority.suggestion ?? "")} — ${esc(evidence.reviewPriority.reasoning ?? "")}</p>`,
        ),
      );
      if (dossier.questions.length)
        body.append(
          el(
            `<p class="why"><b>Validate with a human:</b> ${esc(dossier.questions.join(" · "))}</p>`,
          ),
        );
    }
    const outreach = cand.outreach?.payload as OutreachPayload | undefined;
    if (outreach) {
      body.append(
        el(
          `<h4>Outreach drafts <span class="chip inference">model inference</span> <span class="why">nothing sends automatically — copy out what you approve</span></h4>`,
        ),
      );
      for (const step of outreach.steps) {
        const stepEl =
          el(`<div class="qrow"><div class="qmeta"><div class="plat">${esc(step.kind)}</div><span class="chip num">day ${esc(String(step.dayOffset ?? 0))}</span></div>
          <div class="grow">${step.subjectVariants.length ? `<div class="why">Subj: ${esc(step.subjectVariants.join(" / "))}</div>` : ""}<pre class="mono">${esc(step.body)}</pre></div></div>`);
        const btn = el<HTMLButtonElement>(
          `<button class="btn small" type="button">Copy</button>`,
        );
        btn.onclick = () => copyText(step.body, btn);
        stepEl.append(btn);
        body.append(stepEl);
      }
      body.append(
        el(`<p class="why">Cadence: ${esc(outreach.cadenceRationale)}</p>`),
      );
    }
  };
  paint();

  if (aiAvailable()) {
    const status = el(`<span class="why" role="status"></span>`);
    const evBtn = el<HTMLButtonElement>(
      `<button class="btn small" type="button">${cand.evidence ? "Re-run evidence" : "Evidence alignment"}</button>`,
    );
    const orBtn = el<HTMLButtonElement>(
      `<button class="btn small" type="button">${cand.outreach ? "Re-draft outreach" : "Draft outreach"}</button>`,
    );
    const crewBtn = el<HTMLButtonElement>(
      `<button class="btn small" type="button" title="${esc(candidatePlan().summary)}">Run agents (${candidatePlan().modelCalls.max} calls)</button>`,
    );
    head.append(crewBtn, evBtn, orBtn, status);
    const run = async (
      key: "evidence" | "outreach",
      btn: HTMLButtonElement,
    ) => {
      if (key === "evidence" && !state.artifacts.success_profile?.payload) {
        status.textContent = "Generate the Success Profile first.";
        return;
      }
      btn.disabled = true;
      status.textContent = "Thinking…";
      try {
        const result = await runCandidateTask(key, cand, {});
        cand = { ...cand, [key]: result };
        await putCandidate(cand);
        status.textContent = "";
        btn.disabled = false;
        btn.textContent =
          key === "evidence" ? "Re-run evidence" : "Re-draft outreach";
        paint();
      } catch (e) {
        const code = errorCode(e);
        if (code === "not_granted" || code === "sampling_disabled") hideAi();
        status.textContent = `${copyFor(code)} ${errorMessage(e)}`;
        btn.disabled = false;
      }
    };
    evBtn.onclick = () => run("evidence", evBtn);
    orBtn.onclick = () => run("outreach", orBtn);
    crewBtn.onclick = async () => {
      if (!state.artifacts.success_profile?.payload) {
        status.textContent = "Generate the Success Profile first.";
        return;
      }
      crewBtn.disabled = true;
      try {
        cand = await runCandidateAgents(cand, {
          step: (name) => {
            status.textContent = name + "…";
          },
        });
        status.textContent = "";
        crewBtn.disabled = false;
        paint();
      } catch (e) {
        const code = errorCode(e);
        if (code === "not_granted" || code === "sampling_disabled") hideAi();
        status.textContent = `${copyFor(code)} ${errorMessage(e)}`;
        crewBtn.disabled = false;
      }
    };
  }
  return card;
}

registerModule("candidates", renderCandidates);
