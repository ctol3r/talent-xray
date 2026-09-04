/**
 * The candidate deck (W20.3): every record you added, as a fanned stack of
 * cards. "+" brings a card forward; "Open record" jumps to the full panel.
 * The deck shows only what the record holds — nothing on it is ranked,
 * scored or fetched, and the order is yours (front card first, then the
 * order you added them in).
 */
import { $, el, esc } from "../core/dom";
import type { StoredCandidate } from "../core/store";
import type { EvidencePayload } from "../core/payloads";
import {
  DECK_DEPTH,
  cardPose,
  deckOrder,
  hueFor,
  nextInDeck,
} from "../core/deck";
import { EXIT_LABELS, STAGE_LABELS, currentPosition } from "../core/pipeline";
import { buildDossier, criteriaFromProfile } from "../core/evidence";
import { state } from "../app/state";

let front: string | null = null;

export function deckFront(): string | null {
  return front;
}

export function setDeckFront(id: string | null): void {
  front = id;
}

function evidenceChip(cand: StoredCandidate): string {
  const evidence = cand.evidence?.payload as EvidencePayload | undefined;
  if (!evidence) return `<span class="chip unknown">NOT ASSESSED</span>`;
  const dossier = buildDossier({
    candidate: cand,
    rawItems: evidence.items,
    criteria: criteriaFromProfile(state.artifacts.success_profile?.payload),
    questions: evidence.questionsToValidate,
  });
  return `<span class="chip ${dossier.downgraded ? "bad" : "num"}">${dossier.supportedCount} OF ${dossier.items.length} QUOTE-VERIFIED</span>`;
}

function positionChip(cand: StoredCandidate): string {
  const pos = currentPosition(cand.id, state.events);
  if (pos.kind === "stage")
    return `<span class="chip ok">${esc(STAGE_LABELS[pos.stage].toUpperCase())}</span>`;
  if (pos.kind === "exit")
    return `<span class="chip warn">${esc(EXIT_LABELS[pos.exit].toUpperCase())}</span>`;
  return `<span class="chip unknown">NO STAGE RECORDED</span>`;
}

export function renderDeck(root: HTMLElement): void {
  root.innerHTML = "";
  const all = state.candidates;
  if (!all.length) return;
  if (front && !all.some((c) => c.id === front)) front = null;
  const ordered = deckOrder(all, front ?? all[0].id);
  const hidden = Math.max(0, ordered.length - DECK_DEPTH);

  const panel = el(
    `<div class="panel deck-panel"><div class="mod-head tight"><h3>Deck <span class="chip num">${all.length}</span></h3><span class="why">Every record you added, front card first. + brings one forward; nothing here ranks anyone.</span><span class="spacer"></span></div></div>`,
  );
  const deck = el(
    `<div class="deck" role="listbox" aria-label="Candidate deck" tabindex="0"></div>`,
  );
  const repaint = () => renderDeck(root);

  ordered.forEach((cand, position) => {
    const pose = cardPose(position);
    const originalIndex = all.findIndex((c) => c.id === cand.id);
    const url = cand.profileUrls[0];
    const card = el(
      `<article class="deck-card ${position === 0 ? "front" : ""}" role="option" aria-selected="${position === 0}" data-id="${esc(cand.id)}" style="--hue:${hueFor(originalIndex)};z-index:${pose.z};transform:translate(${pose.x}px, ${pose.y}px) scale(${pose.scale})"${pose.visible ? "" : " hidden"}>
        <div class="deck-stripe"></div>
        <div class="deck-body">
          <div class="deck-name">${esc(cand.name)}</div>
          <div class="deck-line">${esc([cand.currentTitle, cand.currentCompany].filter(Boolean).join(" · ") || "No title recorded")}</div>
          <div class="deck-line">${esc(cand.geography || "No geography recorded")}</div>
          <div class="deck-line">${url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(url.replace(/^https?:\/\//, "").slice(0, 40))}</a> <span class="chip warn">LINK — NOT FETCHED</span>` : `<span class="why">No profile link</span>`}</div>
          <div class="deck-chips">${positionChip(cand)} ${evidenceChip(cand)}</div>
          <div class="deck-actions"></div>
        </div>
      </article>`,
    );
    const plus = el<HTMLButtonElement>(
      `<button type="button" class="deck-plus" aria-label="Bring ${esc(cand.name)} to the front">+</button>`,
    );
    plus.onclick = (ev) => {
      ev.stopPropagation();
      front = cand.id;
      repaint();
    };
    const open = el<HTMLAnchorElement>(
      `<a class="btn small deck-open" href="#cand-${esc(cand.id)}">Open record</a>`,
    );
    open.onclick = () => {
      const target = $(`#cand-${CSS.escape(cand.id)}`);
      target?.classList.add("flash");
    };
    card.append(plus);
    card.querySelector(".deck-actions")?.append(open);
    card.addEventListener("click", () => {
      if (front !== cand.id) {
        front = cand.id;
        repaint();
      }
    });
    deck.append(card);
  });

  deck.addEventListener("keydown", (ev) => {
    if (ev.key !== "ArrowRight" && ev.key !== "ArrowLeft") return;
    ev.preventDefault();
    front = nextInDeck(
      all,
      front ?? all[0].id,
      ev.key === "ArrowRight" ? 1 : -1,
    );
    repaint();
    $(".deck", root)?.focus();
  });

  panel.append(deck);
  panel.append(
    el(
      `<p class="why deck-more">${hidden ? `${hidden} more behind the fan. ` : ""}With the deck focused, ← and → cycle the front card.</p>`,
    ),
  );
  root.append(panel);
}
