/**
 * Link-out that says so when it is blocked (W20.1 hotfix).
 *
 * Every outbound link on this page opens in a new tab with rel="noopener"
 * (product rule 5). The artifact viewer frames the page in a sandbox, and
 * on the owner's first real click the engine link opened nothing at all:
 * a sandboxed frame may refuse to open windows, and an `<a target="_blank">`
 * then fails silently. So a click on any outbound link is handled here:
 * try `window.open` inside the click gesture; if the viewer refuses, show
 * the URL in a selectable field with the two things that always work —
 * copy and paste it, or right-click the link and open it from the browser's
 * own menu. Nothing here fetches anything; it only hands over a URL.
 */
import { $, el, esc } from "../core/dom";
import { copyText } from "../core/dom";

/** Try to open a URL in a new tab. True only if the viewer let us. */
export function openOut(url: string): boolean {
  try {
    // Not "noopener" in the feature string: that makes window.open return
    // null even on success, which would hide a block from us. The opener is
    // severed by hand instead.
    const w = window.open(url, "_blank");
    if (!w) return false;
    try {
      w.opener = null;
    } catch {
      /* cross-origin proxies can refuse; the tab is open either way */
    }
    return true;
  } catch {
    return false;
  }
}

let toast: HTMLElement | null = null;

export function hideLinkFallback(): void {
  toast?.remove();
  toast = null;
}

/** The honest fallback: the URL, selectable, with a copy button. */
export function showLinkFallback(url: string, reason?: string): void {
  hideLinkFallback();
  toast = el(
    `<div class="linkout" role="alertdialog" aria-label="Open this link yourself" id="linkout-fallback">
      <div class="linkout-text"><b>${esc(reason ?? "The viewer blocked the new tab.")}</b> <span class="why">Copy the link and paste it into a new tab — or right-click the button you pressed and choose “Open link in new tab”. Nothing on this page reads what opens.</span></div>
      <div class="linkout-row"></div>
    </div>`,
  );
  const row = $(".linkout-row", toast) as HTMLElement;
  const field = el<HTMLInputElement>(
    `<input type="text" readonly aria-label="Link to open" spellcheck="false">`,
  );
  field.value = url;
  field.onfocus = () => field.select();
  field.onclick = () => field.select();
  const copy = el<HTMLButtonElement>(
    `<button class="btn small primary" type="button">Copy link</button>`,
  );
  copy.onclick = () => copyText(url, copy);
  const close = el<HTMLButtonElement>(
    `<button class="btn small" type="button" aria-label="Dismiss">×</button>`,
  );
  close.onclick = hideLinkFallback;
  row.append(field, copy, close);
  toast.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") hideLinkFallback();
  });
  document.body.append(toast);
  field.focus();
  field.select();
}

function isPlainLeftClick(ev: MouseEvent): boolean {
  return (
    ev.button === 0 && !ev.metaKey && !ev.ctrlKey && !ev.shiftKey && !ev.altKey
  );
}

/**
 * Delegate every plain left-click on an outbound `target="_blank"` link.
 * Modified clicks and middle-clicks are left to the browser, which handles
 * them itself and is not subject to the page's sandbox in the same way.
 */
export function installLinkOut(root: Document = document): void {
  root.addEventListener("click", (ev) => {
    if (!isPlainLeftClick(ev)) return;
    const a = (ev.target as Element | null)?.closest?.("a");
    if (!a || a.target !== "_blank") return;
    if (a.getAttribute("aria-disabled") === "true") return;
    const href = a.href;
    if (!/^https?:/i.test(href)) return;
    ev.preventDefault();
    if (!openOut(href)) showLinkFallback(href);
  });
}
