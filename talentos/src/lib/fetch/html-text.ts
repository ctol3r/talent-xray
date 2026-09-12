/**
 * Markup to the text the reader in `page-people.ts` expects.
 *
 * `extractPeopleFromPage` reads lines and blocks, so the only thing that
 * matters here is that the page's own structure survives as line breaks: a
 * roster in a table has to arrive as one line per row, and a card with a name
 * above a role has to keep them adjacent. Everything else is thrown away.
 *
 * No parser, no DOM, no dependency. A remote page is hostile input and a
 * regular-expression pass over it cannot be made to execute anything, which
 * is worth more here than fidelity.
 */

/** Tags whose contents are never text on the page. */
const DROPPED =
  /<(script|style|noscript|template|svg|iframe|object|head)\b[^>]*>[\s\S]*?<\/\1\s*>/giu;

/**
 * The same tags when the markup never closes them. A truncated page — and this
 * reader truncates at a byte cap — ends mid-element often enough that without
 * this a script's source arrives as text and its string literals read as
 * people. `head` is left out on purpose: `</head>` is legally omissible, so
 * dropping to end-of-document on it would blank the whole page.
 */
const UNCLOSED =
  /<(script|style|noscript|template|svg|iframe|object)\b[^>]*>[\s\S]*$/giu;

/** Tags that end a line. A table cell ends one too, or a roster row collapses. */
const BREAKS =
  /<\/?(p|div|section|article|header|footer|main|aside|nav|br|hr|li|ul|ol|dl|dt|dd|tr|td|th|h[1-6]|blockquote|figure|figcaption|address|table|tbody|thead|form|label|option)\b[^>]*>/giu;

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
  middot: "·",
  bull: "•",
  eacute: "é",
  egrave: "è",
  uuml: "ü",
  ouml: "ö",
  auml: "ä",
  ccedil: "ç",
  szlig: "ß",
  aacute: "á",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  ntilde: "ñ",
};

export function decodeEntities(value: string): string {
  return value.replace(
    /&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/gu,
    (whole, body: string) => {
      if (body.startsWith("#")) {
        const code =
          body[1] === "x" || body[1] === "X"
            ? Number.parseInt(body.slice(2), 16)
            : Number.parseInt(body.slice(1), 10);
        if (!Number.isFinite(code) || code < 9 || code > 0x10ffff) return whole;
        try {
          return String.fromCodePoint(code);
        } catch {
          return whole;
        }
      }
      return ENTITIES[body.toLowerCase()] ?? whole;
    },
  );
}

/** The page's own title, when it has one worth reading. */
export function titleFrom(html: string): string {
  const match = /<title[^>]*>([\s\S]{0,300}?)<\/title>/iu.exec(html);
  if (!match) return "";
  return decodeEntities(match[1]).replace(/\s+/gu, " ").trim();
}

export function htmlToText(html: string): string {
  let text = html.replace(/<!--[\s\S]*?-->/gu, " ");
  text = text.replace(DROPPED, "\n");
  text = text.replace(UNCLOSED, "\n");
  text = text.replace(BREAKS, "\n");
  text = text.replace(/<[^>]*>/gu, " ");
  text = decodeEntities(text);
  text = text.replace(/[ \t   ]+/gu, " ");
  return text
    .split(/\n+/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

/**
 * The page that is not the page: a sign-in wall, a consent interstitial, a
 * bot check. These arrive with a 200 as often as with a 403, so the status is
 * not the signal — the shape of the body is. Detected in order to stop, never
 * in order to get past: a challenge is a refusal that the site is entitled to
 * make.
 */
const CHALLENGE_SIGNS: [RegExp, string][] = [
  [
    /\b(enable javascript and cookies to continue|checking your browser|verify you are (a )?human|just a moment)\b/iu,
    "a bot check",
  ],
  [
    /\b(cf-challenge|__cf_chl|cf_chl_opt|turnstile|recaptcha|hcaptcha)\b/iu,
    "a bot check",
  ],
  [
    /\b(sign in to continue|log in to continue|please log in to view|members only|create an account to continue)\b/iu,
    "a sign-in wall",
  ],
  [
    /\b(subscribe to (read|continue)|this article is for subscribers|paywall)\b/iu,
    "a paywall",
  ],
  [
    /\b(accept (all )?cookies to continue|we use cookies.{0,80}(accept|consent) to continue)\b/iu,
    "a consent wall",
  ],
];

export function challengeIn(html: string): string | null {
  const head = html.slice(0, 20_000);
  for (const [pattern, what] of CHALLENGE_SIGNS) {
    if (pattern.test(head)) return what;
  }
  return null;
}
