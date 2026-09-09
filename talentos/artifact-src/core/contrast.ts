/**
 * Whether text can be read on the ground it is drawn on.
 *
 * WCAG 2.1 relative luminance and contrast ratio, which is the only part of
 * "is this legible" that is arithmetic rather than opinion. It exists so the
 * question can be asked by a test rather than by somebody squinting: a token
 * nudged one shade darker is a change nobody notices in review and everybody
 * notices at 10px.
 *
 * Nothing here imports anything, so the artifact can check its own palette.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** `#rgb`, `#rrggbb`, or null if it is not a hex colour at all. */
export function parseHex(value: string): Rgb | null {
  const hex = value.trim().replace(/^#/, "");
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function luminance(colour: Rgb): number {
  return (
    0.2126 * channel(colour.r) +
    0.7152 * channel(colour.g) +
    0.0722 * channel(colour.b)
  );
}

/**
 * Lay a translucent colour over an opaque one.
 *
 * Needed because half the product's surfaces are `bg-panel/95` or an icon at
 * `opacity 0.55`, and the ratio that matters is the one after compositing —
 * a colour that passes at full strength can fail at 40% over a dark ground.
 */
export function over(top: Rgb, bottom: Rgb, alpha: number): Rgb {
  const mix = (a: number, b: number) => Math.round(a * alpha + b * (1 - alpha));
  return {
    r: mix(top.r, bottom.r),
    g: mix(top.g, bottom.g),
    b: mix(top.b, bottom.b),
  };
}

/** 1 (invisible) to 21 (black on white). AA wants 4.5 for body text, 3 for large. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

export function ratioOf(foreground: string, background: string): number {
  const fg = parseHex(foreground);
  const bg = parseHex(background);
  if (!fg || !bg) return 0;
  return contrastRatio(fg, bg);
}

/** What a ratio is good enough for. */
export type ContrastVerdict = "AAA" | "AA" | "AA-large" | "fails";

export function verdictFor(ratio: number): ContrastVerdict {
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3) return "AA-large";
  return "fails";
}

/** Rounded the way a report should show it, so 4.4999 never reads as 4.5. */
export function say(ratio: number): string {
  return `${Math.floor(ratio * 100) / 100}:1`;
}
