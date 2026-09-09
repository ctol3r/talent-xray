/**
 * Contact hypotheses.
 *
 * Ported from the Talent X-Ray reference console, whose logic CLAUDE.md says
 * to port verbatim. Given a name and an employer's mail domain it produces
 * the addresses that employer probably uses, most common pattern first.
 *
 * Every one of them is a guess. Not a lookup, not a purchase, not a scrape —
 * arithmetic on two strings the recruiter typed. That is why every surface
 * that renders one has to say "unverified" (product rule 3), and why the
 * right next step is a deliverability check rather than sending to all eight.
 *
 * **Nothing here is ever stored.** That is not caution, it is a promise
 * already made: the Article 14 notice this product drafts tells the person
 * "I hold no email address or phone number for you", and a test asserts the
 * draft contains no address at all. Persisting a generated address would
 * turn that sentence into a lie the product sends to the person it is about.
 * So the finder generates, displays, and lets the recruiter copy one out to
 * their own mail client. The clipboard is the boundary.
 */

export interface ContactInput {
  name: string;
  /** The employer's mail domain, as the recruiter typed it. */
  domain: string;
}

/** Strip a domain of the things people paste around it. */
export function normalizeDomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[/?#].*$/, "")
    .replace(/^@/, "");
}

/**
 * Fold a name to the letters an address can carry.
 *
 * One deliberate departure from the reference console, which stripped every
 * character outside `a-z`. That silently deleted accents rather than folding
 * them, so "Ana María López" produced `ana.lpez@` — a wrong address, and
 * wrong for exactly the names least likely to be checked by an English
 * speaker. Accents fold to their base letter; apostrophes are dropped
 * because almost no employer keeps them in a local part; hyphens stay,
 * because plenty of employers do keep those.
 */
export function foldName(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['\u2019]/g, "")
    .replace(/[^a-z\s-]/g, "");
}

/**
 * The eight patterns, in the order they are common — that ordering is from
 * the reference implementation, the only part of this system validated
 * against live results. The name folding above is this file's own.
 */
export function emailPatterns(name: string, domain: string): string[] {
  const clean = normalizeDomain(domain);
  const parts = foldName(name).split(/\s+/).filter(Boolean);
  if (parts.length < 2 || !clean) return [];
  const f = parts[0];
  const l = parts[parts.length - 1];
  return [
    `${f}.${l}`,
    `${f[0]}${l}`,
    `${f}${l}`,
    `${f}_${l}`,
    `${f}`,
    `${l}${f[0]}`,
    `${f[0]}.${l}`,
    `${l}.${f}`,
  ].map((user) => `${user}@${clean}`);
}

export interface Hunt {
  label: string;
  query: string;
}

/**
 * Searches to run inside the people-only engines. These look for a page the
 * person published that happens to carry an address — a conference bio, an
 * author block, a CV. Finding one is worth more than eight guesses, because
 * it is a fact rather than a pattern.
 */
export function contactHunts(name: string, company: string): Hunt[] {
  const person = `"${name.trim()}"`;
  const employer = company.trim() ? ` "${company.trim()}"` : "";
  return [
    {
      label: "A page they wrote that carries an address",
      query: `${person}${employer} (email OR contact OR "reach me")`,
    },
    {
      label: "Conference or speaker bio",
      query: `${person}${employer} (speaker OR keynote OR panel)`,
    },
    {
      label: "Published work — an address often sits in the author block",
      query: `${person}${employer} (author OR corresponding)`,
    },
    {
      label: "A CV or resume document",
      query: `${person}${employer} (CV OR resume OR curriculum)`,
    },
  ];
}

export interface ExternalCheck {
  label: string;
  url: string;
  /** What it is for, so nobody opens it expecting something else. */
  purpose: string;
}

/**
 * Places to verify a pattern, opened in a new tab. Link-out only: this
 * product never calls them and never reads their pages.
 */
export function verificationLinks(
  name: string,
  domain: string,
): ExternalCheck[] {
  const clean = normalizeDomain(domain);
  const out: ExternalCheck[] = [];
  if (clean) {
    out.push({
      label: "Check the domain's usual pattern",
      url: `https://hunter.io/search/${encodeURIComponent(clean)}`,
      purpose:
        "Tells you which of the eight this employer actually uses, which is the whole question.",
    });
  }
  if (name.trim()) {
    out.push({
      label: "Commit address on a code host",
      url: `https://github.com/search?q=${encodeURIComponent(name)}&type=users`,
      purpose:
        "A person who commits publicly has often published an address themselves.",
    });
  }
  return out;
}

/** The line every surface rendering a generated address has to carry. */
export const UNVERIFIED_NOTE =
  "Generated from the name and domain you typed, not looked up. Ordered by how common each pattern is. Verify one before sending, and never send to all eight.";

/** Why none of this is saved, said where the recruiter will read it. */
export const NOT_STORED_NOTE =
  "None of this is stored. This product tells people it holds no address for them, and keeping one here would make that untrue. Copy the one you want into your mail client.";
