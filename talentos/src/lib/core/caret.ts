/**
 * Where the caret is, in pixels, inside a textarea.
 *
 * The browser will not tell you. There is no API for it, and there has never
 * been one: a textarea's contents are not in the DOM, so there is no node to
 * measure. The only way is to build a copy of the textarea out of a div,
 * styled identically, put the text up to the caret into it, and measure where
 * a marker lands.
 *
 * It is worth the trouble for exactly one reason: a menu that opens under the
 * box is a menu you have to look away to read, and a menu that opens at the
 * cursor is one you read without moving your eyes. In a one-line block those
 * are almost the same place; in a block that has wrapped to four lines they
 * are not.
 *
 * The mirror is created once and reused, because making and destroying a div
 * on every keystroke is the kind of thing that shows up as jank on a long note.
 */

/** Styles that change where text lands. Anything else does not matter here. */
const COPIED = [
  "boxSizing",
  "width",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "fontStyle",
  "fontVariant",
  "fontWeight",
  "fontStretch",
  "fontSize",
  "fontFamily",
  "lineHeight",
  "letterSpacing",
  "wordSpacing",
  "textIndent",
  "textTransform",
  "whiteSpace",
  "wordBreak",
  "overflowWrap",
  "tabSize",
] as const;

let mirror: HTMLDivElement | null = null;

function mirrorFor(element: HTMLTextAreaElement): HTMLDivElement {
  if (!mirror) {
    mirror = document.createElement("div");
    mirror.setAttribute("aria-hidden", "true");
    // Off-screen rather than `display: none`, which would stop it laying out
    // at all and make every measurement zero.
    mirror.style.position = "absolute";
    mirror.style.top = "-9999px";
    mirror.style.left = "-9999px";
    mirror.style.visibility = "hidden";
    document.body.appendChild(mirror);
  }
  const from = window.getComputedStyle(element);
  for (const property of COPIED) {
    mirror.style[property] = from[property];
  }
  // A textarea wraps; the mirror has to be told to, because a div does not
  // break long words the same way by default.
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.overflowWrap = "break-word";
  return mirror;
}

export interface CaretPoint {
  /** Pixels from the textarea's own top-left, scrolling accounted for. */
  x: number;
  y: number;
  /** The line's height, so a menu can be placed under the caret's line. */
  lineHeight: number;
}

export function caretPoint(
  element: HTMLTextAreaElement,
  caret: number,
): CaretPoint {
  const box = mirrorFor(element);
  box.textContent = element.value.slice(0, caret);

  const marker = document.createElement("span");
  // A zero-width space rather than nothing: an empty span has no box, and a
  // caret at the very end of the text would measure as being at the start.
  marker.textContent = "​";
  box.appendChild(marker);

  const style = window.getComputedStyle(element);
  const lineHeight =
    Number.parseFloat(style.lineHeight) ||
    Number.parseFloat(style.fontSize) * 1.4;

  const point = {
    x: marker.offsetLeft - element.scrollLeft,
    y: marker.offsetTop - element.scrollTop,
    lineHeight,
  };
  box.textContent = "";
  return point;
}
