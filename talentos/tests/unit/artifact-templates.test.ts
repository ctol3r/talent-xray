/**
 * `el()` throws on a template with more than one root element (W14), because
 * the old behaviour - keep the first, drop the rest - is how the research
 * adapter list shipped missing. That guard fires in the viewer's browser,
 * which is the wrong place to learn about it: W16 shipped a two-root
 * template on the "+ New search" screen and the first-run path went blank.
 *
 * This scans every el(`...`) template in the UI sources statically and fails
 * the build if one has more than one root, so the guard can never fire for
 * a literal template again.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const UI_DIR = path.resolve(__dirname, "../../artifact-src/ui");
const VOID = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr",
]);

/** Extract every template literal passed to el(...) - nested `${...}` included. */
export function templatesIn(
  source: string,
): Array<{ line: number; text: string }> {
  const out: Array<{ line: number; text: string }> = [];
  const re = /\bel(?:<[^>]*>)?\(\s*`/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    let i = m.index + m[0].length;
    let depth = 0; // ${ nesting
    let text = "";
    while (i < source.length) {
      const c = source[i];
      if (c === "\\") {
        text += source[i] + (source[i + 1] ?? "");
        i += 2;
        continue;
      }
      if (depth === 0 && c === "`") break;
      if (c === "$" && source[i + 1] === "{") {
        depth += 1;
        text += " I "; // neutral placeholder for an interpolation
        i += 2;
        continue;
      }
      if (depth > 0) {
        if (c === "`") {
          // a nested template literal inside ${...}: skip it whole
          i += 1;
          let inner = 0;
          while (i < source.length) {
            if (source[i] === "\\") {
              i += 2;
              continue;
            }
            if (source[i] === "$" && source[i + 1] === "{") {
              inner += 1;
              i += 2;
              continue;
            }
            if (source[i] === "}" && inner > 0) {
              inner -= 1;
              i += 1;
              continue;
            }
            if (source[i] === "`" && inner === 0) {
              i += 1;
              break;
            }
            i += 1;
          }
          continue;
        }
        if (c === "{") depth += 1;
        else if (c === "}") depth -= 1;
        i += 1;
        continue;
      }
      text += c;
      i += 1;
    }
    out.push({ line: source.slice(0, m.index).split("\n").length, text });
  }
  return out;
}

/** Count top-level elements in a static HTML snippet (placeholders are text). */
export function rootCount(html: string): number {
  let depth = 0;
  let roots = 0;
  const tag = /<\/?([a-zA-Z][a-zA-Z0-9-]*)[^>]*?(\/?)>/g;
  let m: RegExpExecArray | null;
  while ((m = tag.exec(html))) {
    const closing = m[0].startsWith("</");
    const name = m[1].toLowerCase();
    const selfClosing = m[2] === "/" || VOID.has(name);
    if (closing) {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth === 0) roots += 1;
    if (!selfClosing) depth += 1;
  }
  return roots;
}

describe("every el() template has exactly one root element", () => {
  const files = fs.readdirSync(UI_DIR).filter((f) => f.endsWith(".ts"));
  expect(files.length).toBeGreaterThan(5);
  for (const file of files) {
    it(file, () => {
      const source = fs.readFileSync(path.join(UI_DIR, file), "utf8");
      const templates = templatesIn(source);
      expect(
        templates.length,
        `${file} has no el() templates?`,
      ).toBeGreaterThan(0);
      const bad = templates
        .map((t) => ({ ...t, roots: rootCount(t.text) }))
        .filter((t) => t.roots !== 1);
      expect(
        bad.map(
          (t) =>
            `${file}:${t.line} has ${t.roots} root elements: ${t.text.slice(0, 80)}`,
        ),
      ).toEqual([]);
    });
  }
});

describe("the scanner itself", () => {
  it("counts roots the way el() does", () => {
    expect(rootCount("<div><p>a</p><p>b</p></div>")).toBe(1);
    expect(rootCount('<div class="mod-head"><h2>x</h2></div><p>y</p>')).toBe(2);
    expect(rootCount('<label><input type="text"><span>x</span></label>')).toBe(
      1,
    );
    expect(rootCount("<h4>a</h4><ul><li>b</li></ul>")).toBe(2);
  });
  it("skips interpolations, including nested template literals", () => {
    const src = 'el(`<div>${x ? `<b>${y}</b>` : ""}</div>`); el(`<p>${a}</p>`)';
    const found = templatesIn(src);
    expect(found).toHaveLength(2);
    expect(rootCount(found[0].text)).toBe(1);
    expect(rootCount(found[1].text)).toBe(1);
  });
});
