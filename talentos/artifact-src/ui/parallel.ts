/**
 * Parallel pages (W20.4): the text a recruiter pasted on the left, the
 * dossier on the right, and a ribbon between every verified quote and the
 * claim it supports. A ribbon is drawn only where `verifyEvidence` found the
 * quote in that source — an unsupported claim has no ribbon and says why.
 * The source pane is the recruiter's own text; nothing here is fetched.
 */
import { el, esc } from "../core/dom";
import {
  QUOTE_LABELS,
  STATUS_LABELS,
  type CandidateSource,
  type Dossier,
} from "../core/evidence";
import {
  locateQuote,
  ribbonPath,
  segmentSource,
  type Located,
} from "../core/parallel";

export function renderParallel(root: HTMLElement, dossier: Dossier): void {
  root.innerHTML = "";
  const textSources = dossier.sources.filter((s) => s.text.trim());
  const wrap = el(`<div class="parallel"></div>`);
  wrap.append(
    el(
      `<div class="pp-head"><h4>Parallel pages <span class="chip num">${dossier.supportedCount} RIBBON${dossier.supportedCount === 1 ? "" : "S"}</span></h4><span class="why">Left: the text you supplied. Right: what the dossier claims from it. A ribbon exists only where a verbatim quote was found; a claim with no ribbon says why.</span></div>`,
    ),
  );
  root.append(wrap);
  if (!textSources.length) {
    wrap.append(
      el(
        `<p class="notice warning">No supplied text to lay alongside. The sources on this record are links, and this page never fetches a page — paste the text you want checked.</p>`,
      ),
    );
    return;
  }

  let source: CandidateSource = textSources[0];
  if (textSources.length > 1) {
    const pick = el<HTMLSelectElement>(
      `<select aria-label="Which source to show"></select>`,
    );
    for (const s of textSources) {
      const opt = el<HTMLOptionElement>(
        `<option value="${esc(s.id)}">${esc(s.label)}</option>`,
      );
      pick.append(opt);
    }
    pick.onchange = () => {
      source = textSources.find((s) => s.id === pick.value) ?? source;
      paint();
    };
    wrap.append(pick);
  }

  const body = el(`<div class="pp-body"></div>`);
  wrap.append(body);

  let cleanup: (() => void) | null = null;
  const paint = () => {
    cleanup?.();
    body.innerHTML = "";
    const located: Located[] = [];
    dossier.items.forEach((item, i) => {
      if (!item.supported || item.sourceId !== source.id) return;
      const span = locateQuote(item.quote, source.text);
      if (span) located.push({ itemIndex: i, span });
    });
    const segments = segmentSource(source.text, located);

    const pane = el(
      `<div class="pp-source" tabindex="0" aria-label="${esc(source.label)}"><p class="pp-text"></p></div>`,
    );
    const p = pane.querySelector("p") as HTMLElement;
    for (const seg of segments) {
      if (seg.itemIndex === null) {
        p.append(document.createTextNode(seg.text));
      } else {
        const mark = el(
          `<mark class="pp-mark" data-item="${seg.itemIndex}" tabindex="0"></mark>`,
        );
        mark.textContent = seg.text;
        p.append(mark);
      }
    }

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "pp-ribbons");
    svg.setAttribute("aria-hidden", "true");

    const list = el(`<ol class="pp-items"></ol>`);
    dossier.items.forEach((item, i) => {
      const drawn = located.some((l) => l.itemIndex === i);
      const elsewhere = item.supported && item.sourceId !== source.id;
      const reason = drawn
        ? `Quoted here: “${item.quote}”`
        : elsewhere
          ? `Quoted from ${item.sourceLabel} — a different source; no ribbon on this page.`
          : item.supported
            ? "Verified, but the exact span could not be located to draw a ribbon."
            : `${QUOTE_LABELS[item.check]} — no ribbon. ${item.note}`;
      const li = el(
        `<li class="pp-item ${drawn ? "supported" : "unsupported"}" data-item="${i}" tabindex="0"><b>${esc(item.criterion)}</b> <span class="chip ${drawn ? "ok" : "unknown"}">${esc(STATUS_LABELS[item.status].toUpperCase())}</span><div class="why">${esc(reason)}</div></li>`,
      );
      list.append(li);
    });

    body.append(pane, svg, list);

    const draw = () => {
      if (!body.isConnected) return;
      const box = body.getBoundingClientRect();
      const paneBox = pane.getBoundingClientRect();
      svg.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
      svg.setAttribute("width", String(box.width));
      svg.setAttribute("height", String(box.height));
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      for (const l of located) {
        const mark = pane.querySelector<HTMLElement>(
          `mark[data-item="${l.itemIndex}"]`,
        );
        const li = list.querySelector<HTMLElement>(
          `li[data-item="${l.itemIndex}"]`,
        );
        if (!mark || !li) continue;
        const rects = Array.from(mark.getClientRects());
        if (!rects.length) continue;
        const top = Math.min(...rects.map((r) => r.top));
        const bottom = Math.max(...rects.map((r) => r.bottom));
        const right = Math.max(...rects.map((r) => r.right));
        const visibleTop = Math.max(top, paneBox.top);
        const visibleBottom = Math.min(bottom, paneBox.bottom);
        const offscreen = visibleBottom <= visibleTop;
        const y = offscreen
          ? bottom < paneBox.top
            ? paneBox.top
            : paneBox.bottom
          : (visibleTop + visibleBottom) / 2;
        const height = offscreen ? 2 : visibleBottom - visibleTop;
        const liBox = li.getBoundingClientRect();
        const path = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "path",
        );
        path.setAttribute("class", `ribbon${offscreen ? " offscreen" : ""}`);
        path.setAttribute("data-item", String(l.itemIndex));
        path.setAttribute(
          "d",
          ribbonPath(
            { x: right - box.left, y: y - box.top, height },
            {
              x: liBox.left - box.left,
              y: liBox.top + Math.min(liBox.height, 28) / 2 - box.top,
              height: Math.min(liBox.height, 28),
            },
          ),
        );
        svg.append(path);
      }
    };

    const hot = (i: string | null) => {
      body
        .querySelectorAll<HTMLElement>("[data-item]")
        .forEach((n) =>
          n.classList.toggle("hot", i !== null && n.dataset.item === i),
        );
      svg
        .querySelectorAll<SVGPathElement>("path")
        .forEach((n) =>
          n.classList.toggle("hot", i !== null && n.dataset.item === i),
        );
    };
    body.addEventListener("mouseover", (ev) => {
      const t = (ev.target as HTMLElement).closest<HTMLElement>("[data-item]");
      hot(t?.dataset.item ?? null);
    });
    body.addEventListener("mouseout", () => hot(null));
    body.addEventListener("focusin", (ev) => {
      const t = (ev.target as HTMLElement).closest<HTMLElement>("[data-item]");
      hot(t?.dataset.item ?? null);
    });
    body.addEventListener("focusout", () => hot(null));
    list.addEventListener("click", (ev) => {
      const li = (ev.target as HTMLElement).closest<HTMLElement>(
        "li[data-item]",
      );
      if (!li) return;
      const mark = pane.querySelector<HTMLElement>(
        `mark[data-item="${li.dataset.item}"]`,
      );
      if (mark) {
        pane.scrollTop = Math.max(0, mark.offsetTop - pane.clientHeight / 2);
        draw();
      }
    });

    pane.addEventListener("scroll", draw);
    list.addEventListener("scroll", draw);
    window.addEventListener("resize", draw);
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(draw);
      observer.observe(body);
    }
    cleanup = () => {
      window.removeEventListener("resize", draw);
      observer?.disconnect();
    };
    draw();
    requestAnimationFrame(draw);
    setTimeout(draw, 400); // once web fonts have settled
  };
  paint();
}
