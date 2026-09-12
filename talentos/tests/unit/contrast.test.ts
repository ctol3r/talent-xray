/**
 * Nothing in the product is written in a colour you cannot read.
 *
 * The palette is checked by arithmetic rather than by eye, because a token
 * nudged one shade is a change nobody notices in review and everybody notices
 * at 10px — and because "white text on a white background" is exactly the
 * class of mistake that survives a manual sweep and reappears in the next
 * component somebody writes.
 *
 * Two halves. The first computes real WCAG ratios for every pairing the app
 * uses. The second is the guard: it greps the source for the ways a component
 * can step outside the palette and land somewhere illegible.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ratioOf, say, verdictFor } from "../../artifact-src/core/contrast";

const ROOT = path.join(__dirname, "..", "..");
const SRC = path.join(ROOT, "src");

function files(dir: string, ext: string[]): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return files(full, ext);
    return ext.some((e) => entry.name.endsWith(e)) ? [full] : [];
  });
}

/** The tokens, read from the stylesheet rather than copied into the test. */
const TOKENS: Record<string, string> = Object.fromEntries(
  [
    ...readFileSync(path.join(SRC, "app", "globals.css"), "utf8").matchAll(
      /--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})/g,
    ),
  ].map((m) => [m[1], m[2]]),
);

/** The grounds text is actually drawn on. */
const GROUNDS = ["canvas", "panel", "panel2"] as const;

/** Inks used for words. Every one has to be readable on every ground. */
const BODY_INKS = [
  "ink",
  "ink-muted",
  "ink-faint",
  "accent",
  "ok",
  "warn",
  "bad",
];

/** Inks used for line-work and marks, which WCAG holds to 3:1, not 4.5. */
const LINE_INKS = ["line"];

describe("the palette", () => {
  it("has every token the test needs", () => {
    for (const name of [...GROUNDS, ...BODY_INKS, ...LINE_INKS]) {
      expect(TOKENS[name], name).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it("keeps every ink readable on every ground", () => {
    const bad: string[] = [];
    for (const ink of BODY_INKS) {
      for (const ground of GROUNDS) {
        const ratio = ratioOf(TOKENS[ink], TOKENS[ground]);
        if (ratio < 4.5) {
          bad.push(
            `${ink} on ${ground} is ${say(ratio)} (${verdictFor(ratio)})`,
          );
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("keeps line-work visible without pretending it is text", () => {
    for (const ink of LINE_INKS) {
      for (const ground of GROUNDS) {
        const ratio = ratioOf(TOKENS[ink], TOKENS[ground]);
        expect(ratio, `${ink} on ${ground}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("writes on the accent in the colour that can be read on it", () => {
    // White on the accent is 2.68:1 and fails. The canvas colour is 7.27:1.
    expect(ratioOf("#ffffff", TOKENS.accent)).toBeLessThan(4.5);
    expect(ratioOf(TOKENS.canvas, TOKENS.accent)).toBeGreaterThan(4.5);
  });

  it("keeps the soft grounds readable under their own ink", () => {
    for (const [ink, ground] of [
      ["ok", "ok-soft"],
      ["warn", "warn-soft"],
      ["bad", "bad-soft"],
      ["accent", "accent-soft"],
    ] as const) {
      const ratio = ratioOf(TOKENS[ink], TOKENS[ground]);
      expect(ratio, `${ink} on ${ground}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("nothing steps outside the palette into the dark", () => {
  const components = files(path.join(SRC, "components"), [".tsx"]).concat(
    files(path.join(SRC, "app"), [".tsx"]),
  );

  it("never writes white on the accent", () => {
    // 2.68:1. Every other primary button in the product uses text-canvas.
    const offenders = components.filter((file) => {
      const source = readFileSync(file, "utf8");
      return /bg-accent[^"'`]*text-white|text-white[^"'`]*bg-accent/.test(
        source,
      );
    });
    expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
  });

  it("never paints a light ground without saying what colour the text is", () => {
    // The failure this catches is literal: a card with `background: "#f5faf7"`
    // and no `color`, so the near-white ink inherited from the dark theme is
    // written on near-white paper.
    const offenders: string[] = [];
    for (const file of components) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(
        /background:\s*"(#[0-9a-fA-F]{3,6})"/g,
      )) {
        const ground = match[1];
        // A light ground must be accompanied by an explicit colour somewhere
        // in the same file; a dark one inherits the theme's ink safely.
        const light = ratioOf("#ffffff", ground) < 3;
        if (light && !/\bcolor:\s*"#/.test(source)) {
          offenders.push(`${path.relative(SRC, file)} paints ${ground}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("never uses a Tailwind palette colour that was never checked", () => {
    // The theme is a closed set of tokens. `text-teal-800` resolves to a dark
    // teal that is invisible on this product's dark grounds, and nothing in
    // the token system would have caught it.
    const raw =
      /\b(?:text|bg|border|fill|stroke)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/;
    const offenders: string[] = [];
    for (const file of components) {
      const source = readFileSync(file, "utf8");
      const hit = raw.exec(source);
      if (hit) offenders.push(`${path.relative(SRC, file)}: ${hit[0]}`);
    }
    expect(offenders).toEqual([]);
  });
});

describe("everything you can operate says so when it has the keyboard", () => {
  const sources = files(path.join(SRC, "components"), [".tsx"]).concat(
    files(path.join(SRC, "app"), [".tsx"]),
  );

  it("never strips the focus ring without drawing one", () => {
    // A control that removes the browser's ring and puts nothing back is
    // unusable by keyboard without looking any different, which is why it
    // survives review. The three that keep `outline-none` all draw their own.
    const offenders: string[] = [];
    for (const file of sources) {
      const source = readFileSync(file, "utf8");
      if (!/\boutline-none\b/.test(source)) continue;
      const draws =
        /focus-visible:(stroke|bg|ring|border|w-|h-)|\[&:focus>circle\]:stroke/.test(
          source,
        );
      if (!draws) offenders.push(path.relative(SRC, file));
    }
    expect(offenders).toEqual([]);
  });

  it("does not draw a focus ring in a colour that vanishes on a pale node", () => {
    // The graph's ring was white, which disappears on its green and amber
    // records — and it is the only indicator on a control you tab to.
    const graph = readFileSync(
      path.join(SRC, "components", "knowledge-graph.tsx"),
      "utf8",
    );
    expect(graph).not.toContain("[&:focus>circle]:stroke-white");
  });
});
