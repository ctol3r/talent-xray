/**
 * Tiny DOM helpers. The artifact renders with string templates + `el()`;
 * every interpolated value goes through `esc()`.
 */

export const $ = <T extends Element = HTMLElement>(
  sel: string,
  root: ParentNode = document,
): T | null => root.querySelector<T>(sel);

export const $$ = <T extends Element = HTMLElement>(
  sel: string,
  root: ParentNode = document,
): T[] => Array.from(root.querySelectorAll<T>(sel));

export function esc(value: unknown): string {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c] ?? c,
  );
}

/**
 * One template, one element. A template with two roots used to lose
 * everything after the first, silently — that is how the research panel
 * shipped with its adapter list missing. Wrap multi-root markup in a
 * container; this throws rather than dropping content.
 */
export function el<T extends HTMLElement = HTMLElement>(html: string): T {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  const node = t.content.firstElementChild;
  if (!node) throw new Error("el(): template produced no element");
  if (t.content.children.length > 1) {
    throw new Error(
      `el(): template has ${t.content.children.length} root elements; wrap them in one container. Starts with <${node.tagName.toLowerCase()}>.`,
    );
  }
  return node as T;
}

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export const nowIso = (): string => new Date().toISOString();

export function clip(s: unknown, n: number): string {
  const text = String(s ?? "");
  return text.length > n ? text.slice(0, n) + "\n…[truncated]" : text;
}

export async function copyText(
  text: string,
  btn?: HTMLButtonElement | null,
): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    if (btn) {
      const old = btn.textContent;
      btn.textContent = "Copied";
      setTimeout(() => {
        btn.textContent = old;
      }, 1200);
    }
  } catch {
    if (btn) btn.textContent = "Copy failed";
  }
}

/** Human "as of" rendering: ISO → "2026-09-04 12:30 UTC". */
export function asOf(iso: string | undefined | null): string {
  if (!iso) return "unknown";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

/** Whole-day difference, floored; never negative. */
export function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso).getTime();
  const b = new Date(toIso).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.floor((b - a) / 86_400_000));
}
