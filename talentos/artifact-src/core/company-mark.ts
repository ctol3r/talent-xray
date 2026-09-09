/**
 * A little square that stands for a company.
 *
 * A list of twenty jobs is twenty lines of text that all look the same, and
 * the thing you are actually scanning for is usually the employer. A mark
 * makes that scannable without adding a column.
 *
 * **The mark is drawn, not fetched.** Initials on a colour derived from the
 * name, so every company has one immediately: no network, no waiting, nothing
 * to go wrong, and it works in the browser-only artifact where there is no
 * server to ask. A real favicon is available on top of this and is off by
 * default, for a reason worth stating plainly — asking a company's server for
 * its icon tells that company somebody is looking at them, and in a recruiting
 * tool the list of employers you are looking at is not a neutral fact. See
 * `companyFaviconUrl`.
 *
 * The colour is a hue from a hash of the name, at fixed saturation and
 * lightness chosen to sit on either ground. Hue alone varies, so two marks are
 * never distinguished by brightness — and the initials carry the meaning in
 * any case, because a mark you can only tell apart by colour is one that
 * several readers cannot tell apart at all.
 */

/**
 * Words that are not the company. Dropped before taking initials, so
 * "Northwind Trading Ltd" is NT rather than NT-L, and "The Meridian Group" is
 * M rather than TM.
 */
const NOT_THE_NAME = new Set([
  // A joiner standing on its own is not a word of the name. Attached it
  // survives, so AT&T keeps its ampersand and Johnson & Johnson gives JJ.
  "&",
  "the",
  "a",
  "an",
  "and",
  "of",
  "for",
  "group",
  "holdings",
  "holding",
  "company",
  "co",
  "corp",
  "corporation",
  "inc",
  "incorporated",
  "llc",
  "llp",
  "lp",
  "ltd",
  "limited",
  "plc",
  "gmbh",
  "ag",
  "sa",
  "sas",
  "srl",
  "spa",
  "bv",
  "nv",
  "ab",
  "as",
  "oy",
  "oyj",
  "aps",
  "pty",
  "pte",
  "kk",
  "kg",
  "ug",
  "sarl",
  "sl",
  "international",
  "global",
  "worldwide",
]);

function meaningfulWords(name: string): string[] {
  return name
    .replace(/[^\p{L}\p{N}\s&-]/gu, " ")
    .split(/[\s-]+/u)
    .map((word) => word.trim())
    .filter(Boolean)
    .filter((word) => !NOT_THE_NAME.has(word.toLowerCase()));
}

/**
 * Up to two letters. One word gives its first two letters rather than one,
 * because a single letter collides constantly in a list of employers.
 */
export function companyInitials(name: string): string {
  const words = meaningfulWords(name);
  if (words.length === 0) {
    // Everything was a legal suffix or punctuation. Fall back to the raw name
    // rather than showing an empty square.
    const bare = name.replace(/[^\p{L}\p{N}]/gu, "");
    return (bare.slice(0, 2) || "?").toUpperCase();
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** A stable hue, 0–359, from the name. Not random: the same company is always the same colour. */
export function companyHue(name: string): number {
  const key = name.trim().toLowerCase();
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % 360;
}

export interface CompanyMark {
  initials: string;
  /** The square's ground. */
  background: string;
  /** The initials, always dark on the light ground this picks. */
  foreground: string;
}

export function companyMark(name: string): CompanyMark {
  const hue = companyHue(name);
  // Saturation and lightness fixed, hue alone varying: every mark is the same
  // weight, so a row does not read as more important because its company drew
  // a brighter colour.
  return {
    initials: companyInitials(name),
    background: `hsl(${hue} 62% 82%)`,
    foreground: `hsl(${hue} 70% 22%)`,
  };
}

/**
 * The company's own icon, from the company's own site.
 *
 * Deliberately the site's own files and never a third-party favicon service.
 * A service would mean handing somebody else the list of every employer this
 * workspace looks at, which is a worse trade than the one it saves.
 *
 * **A tab's logo is rarely `/favicon.ico`.** That path is the twenty-year-old
 * default, and a modern site declares its icon with `<link rel="icon">`
 * pointing at a PNG or an SVG of its own choosing. Reading that link means
 * fetching the home page, which is behind the policy gate and off in most
 * installs — so instead this returns the handful of paths that sites actually
 * serve, in the order they are worth trying, and the browser walks them until
 * one loads. Costs nothing when the first works, and turns "initials" into "a
 * logo" for most of the rest.
 *
 * `www.` is tried as well as the bare host: plenty of sites answer on one and
 * not the other, and which one somebody pasted is an accident.
 *
 * Empty for anything that is not an ordinary web address, so a malformed or
 * non-http `url` column can never become a request.
 */
const ICON_PATHS = [
  "/favicon.ico",
  "/favicon.png",
  "/favicon-32x32.png",
  "/apple-touch-icon.png",
  "/apple-touch-icon-precomposed.png",
] as const;

export function companyFaviconUrls(url: string | null | undefined): string[] {
  const raw = (url ?? "").trim();
  if (!raw) return [];
  let parsed: URL;
  try {
    parsed = new URL(raw.includes("//") ? raw : `https://${raw}`);
  } catch {
    return [];
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return [];
  if (!parsed.hostname.includes(".")) return [];

  const host = parsed.hostname;
  const bare = host.startsWith("www.") ? host.slice(4) : host;
  const hosts = bare === host ? [host, `www.${host}`] : [host, bare];
  const out: string[] = [];
  for (const path of ICON_PATHS) {
    for (const each of hosts) {
      out.push(`${parsed.protocol}//${each}${path}`);
    }
  }
  return out;
}

/** The first thing worth trying. Kept for callers that want one address. */
export function companyFaviconUrl(
  url: string | null | undefined,
): string | null {
  return companyFaviconUrls(url)[0] ?? null;
}

/**
 * The address a company probably lives at, as a **suggestion**.
 *
 * Never written anywhere by itself. Nothing in this product resolves a name to
 * a domain on its own — "Meridian Software" is not whoever owns meridian.com,
 * and a stranger's logo beside a live job is wrong silently and confidently on
 * the surface a recruiter scans fastest. What this is for is saving the typing:
 * the field on the companies page opens with this in it, greyed, and a person
 * presses the button or does not.
 */
export function suggestedCompanySite(name: string): string | null {
  const words = name
    .trim()
    .toLowerCase()
    .replace(/[''’]/gu, "")
    .replace(/[^a-z0-9]+/gu, " ")
    .split(" ")
    .filter(Boolean)
    .filter((word) => !NOT_THE_NAME.has(word));
  if (words.length === 0) return null;
  // Everything joined, which is what a company domain nearly always is.
  const host = words.join("");
  if (host.length < 2 || host.length > 40) return null;
  return `${host}.com`;
}
