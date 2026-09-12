/**
 * The next-steps wheel (W20.2): the eight lettered steps A–H of the freshest
 * module output, drawn as a ring around a hub that shows the derived next
 * best action. It is another view of the same two things the header and the
 * envelope already show — not a new source of suggestions. A segment click
 * goes through `performAction`, so the confirmation rules are unchanged.
 */
import { asOf, el, esc } from "../core/dom";
import { MODULES, type ModuleKey } from "../core/dependencies";
import {
  NEXT_STEP_LABELS,
  requiresConfirmation,
  type OutputEnvelope,
  type SuggestedNextStep,
} from "../core/envelope";
import { hubRadius, wheelSegments, type WheelSpec } from "../core/radial";
import { nextAction, state } from "../app/state";
import { aiAvailable, performAction } from "./shell";

export const WHEEL_SPEC: WheelSpec = { size: 360, thickness: 0.42, count: 8 };

export interface WheelSource {
  key: string;
  label: string;
  generatedAt: string;
  steps: SuggestedNextStep[];
}

/** The current module's envelope when it has one, else the freshest one. */
export function wheelSource(): WheelSource | null {
  const withSteps = Object.entries(state.artifacts).filter(([, rec]) => {
    const env = rec.envelope as OutputEnvelope | undefined;
    return Boolean(env && env.suggestedNextSteps?.length);
  });
  if (!withSteps.length) return null;
  const pick =
    withSteps.find(([k]) => k === state.module) ??
    [...withSteps].sort((a, b) =>
      (b[1].meta.generatedAt ?? "").localeCompare(a[1].meta.generatedAt ?? ""),
    )[0];
  const [key, rec] = pick;
  return {
    key,
    label: MODULES[key as ModuleKey]?.label ?? key,
    generatedAt: rec.meta.generatedAt,
    steps: (rec.envelope as OutputEnvelope).suggestedNextSteps,
  };
}

const URGENCY_CLASS: Record<string, string> = {
  blocked: "bad",
  attention: "warn",
  normal: "inference",
  done: "ok",
};

function shortTitle(title: string, max = 26): string {
  const t = title.trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
}

let overlay: HTMLElement | null = null;
let opener: HTMLElement | null = null;

export function closeWheel(): void {
  if (!overlay) return;
  overlay.remove();
  overlay = null;
  const back = opener;
  opener = null;
  back?.focus();
}

export function isWheelOpen(): boolean {
  return overlay !== null;
}

export function openWheel(from?: HTMLElement): void {
  closeWheel();
  opener = from ?? null;
  const source = wheelSource();
  const nba = nextAction(aiAvailable());
  const segs = wheelSegments(WHEEL_SPEC);
  const slots = NEXT_STEP_LABELS.map((label) =>
    source?.steps.find((s) => s.label === label),
  );

  const backdrop = el(`<div class="wheel-backdrop"></div>`);
  const dialog = el(
    `<div class="wheel" role="dialog" aria-modal="true" aria-label="Next steps wheel"></div>`,
  );
  const svg = el(
    `<svg class="wheel-svg" viewBox="0 0 ${WHEEL_SPEC.size} ${WHEEL_SPEC.size}" aria-hidden="true">${segs
      .map(
        (s, i) =>
          `<path class="seg ${slots[i]?.recommended ? "recommended" : ""} ${slots[i] ? "" : "empty"}" data-i="${i}" d="${s.path}"></path>`,
      )
      .join(
        "",
      )}<circle class="hub-ring" cx="${WHEEL_SPEC.size / 2}" cy="${WHEEL_SPEC.size / 2}" r="${hubRadius(WHEEL_SPEC)}"></circle></svg>`,
  );
  dialog.append(svg);

  const hub = el(
    `<div class="wheel-hub"><span class="chip hub-kicker">NEXT</span><b class="hub-title"></b><span class="hub-why why"></span></div>`,
  );
  const hubBtn = el<HTMLButtonElement>(
    `<button class="btn small primary" type="button">Take me there</button>`,
  );
  hub.append(hubBtn);
  dialog.append(hub);

  const paths = Array.from(svg.querySelectorAll<SVGPathElement>("path.seg"));
  const kicker = hub.querySelector(".hub-kicker") as HTMLElement;
  const title = hub.querySelector(".hub-title") as HTMLElement;
  const why = hub.querySelector(".hub-why") as HTMLElement;

  let hubStep: SuggestedNextStep | null = null;
  const showNba = () => {
    hubStep = nba.urgency === "done" ? null : nba.step;
    kicker.textContent = "NEXT";
    kicker.className = `chip hub-kicker ${URGENCY_CLASS[nba.urgency]}`;
    title.textContent = nba.step.title;
    why.textContent = nba.why;
    hubBtn.hidden = hubStep === null;
    hubBtn.textContent = "Take me there";
    paths.forEach((p) => p.classList.remove("active"));
  };
  const showStep = (i: number, step: SuggestedNextStep) => {
    hubStep = step;
    kicker.textContent = step.label;
    kicker.className = `chip hub-kicker ${step.recommended ? "ok" : "num"}`;
    title.textContent = step.title;
    why.textContent =
      (step.description || "") +
      (requiresConfirmation(step) ? " (asks you to confirm first)" : "");
    hubBtn.hidden = false;
    hubBtn.textContent = step.recommended ? "Do this (recommended)" : "Do this";
    paths.forEach((p, j) => p.classList.toggle("active", j === i));
  };
  const go = (step: SuggestedNextStep) => {
    closeWheel();
    performAction(step);
  };
  hubBtn.onclick = () => {
    if (hubStep) go(hubStep);
  };

  const buttons: HTMLButtonElement[] = [];
  segs.forEach((seg, i) => {
    const slot = slots[i];
    const label = NEXT_STEP_LABELS[i];
    const btn = el<HTMLButtonElement>(
      `<button type="button" class="seg-btn ${slot ? "" : "empty"} ${slot?.recommended ? "recommended" : ""}" style="left:${(seg.anchor.x / WHEEL_SPEC.size) * 100}%;top:${(seg.anchor.y / WHEEL_SPEC.size) * 100}%" aria-label="${esc(label)} — ${esc(slot ? slot.title : "no step yet")}"${slot ? "" : ' aria-disabled="true"'}><span class="seg-letter">${esc(label)}</span><span class="seg-short">${esc(slot ? shortTitle(slot.title) : "—")}</span></button>`,
    );
    if (slot) {
      btn.addEventListener("mouseenter", () => showStep(i, slot));
      btn.addEventListener("focus", () => showStep(i, slot));
      btn.addEventListener("mouseleave", showNba);
      btn.addEventListener("blur", showNba);
      btn.addEventListener("click", () => go(slot));
    }
    buttons.push(btn);
    dialog.append(btn);
  });

  const close = el<HTMLButtonElement>(
    `<button type="button" class="wheel-close" aria-label="Close the wheel">×</button>`,
  );
  close.onclick = closeWheel;
  dialog.append(close);

  dialog.append(
    el(
      `<p class="wheel-foot why">${
        source
          ? `Steps A–H come from <b>${esc(source.label)}</b>, generated ${esc(asOf(source.generatedAt))}. The hub is the derived next best action. Nothing runs from here on its own; confirmations still apply.`
          : "No module output yet, so the eight lettered slots are empty. The hub still shows the derived next best action — generate a module and its A–H steps fill the ring."
      }</p>`,
    ),
  );

  dialog.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") {
      ev.preventDefault();
      closeWheel();
      return;
    }
    const focusable = buttons.filter((b) => !b.classList.contains("empty"));
    if (!focusable.length) return;
    const at = focusable.indexOf(document.activeElement as HTMLButtonElement);
    let next = -1;
    if (ev.key === "ArrowRight" || ev.key === "ArrowDown")
      next = (at + 1) % focusable.length;
    else if (ev.key === "ArrowLeft" || ev.key === "ArrowUp")
      next = (at - 1 + focusable.length) % focusable.length;
    else if (ev.key === "Home") next = 0;
    else if (ev.key === "End") next = focusable.length - 1;
    if (next >= 0) {
      ev.preventDefault();
      focusable[next].focus();
    }
  });
  backdrop.addEventListener("click", (ev) => {
    if (ev.target === backdrop) closeWheel();
  });

  backdrop.append(dialog);
  document.body.append(backdrop);
  overlay = backdrop;
  showNba();
  (buttons.find((b) => !b.classList.contains("empty")) ?? close).focus();
}
