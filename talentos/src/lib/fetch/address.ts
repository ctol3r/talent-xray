/**
 * Is this address one we are willing to open at all?
 *
 * Every URL that reaches the fetcher came from somewhere else — a search
 * engine's result list, a link on a page we already read, a string somebody
 * typed. So this module assumes the address is hostile until it has been
 * argued with, and it runs twice: once on the URL, and again on every IP the
 * name resolves to, because a name that looks public can answer with a
 * private one.
 *
 * Deliberately free of `node:` and `process.env`. The address rules are the
 * same wherever they run, and the browser build needs them to explain a
 * refusal without a network stack. The half that resolves names lives in
 * `http.ts`, which is the only file here that Node has to run.
 */

/** Only TLS. A cleartext fetch of a person's page is not worth its cost. */
export const ALLOWED_SCHEMES = ["https:"] as const;
export const ALLOWED_PORT = 443;
export const MAX_URL_LENGTH = 2048;

export interface AddressVerdict {
  ok: boolean;
  /** Said plainly, for a recruiter who wants to know why nothing happened. */
  reason: string;
}

const ALLOWED: AddressVerdict = { ok: true, reason: "" };

function no(reason: string): AddressVerdict {
  return { ok: false, reason };
}

/**
 * Names that are reserved, resolve differently on every machine, or address
 * something that is not the open web. A single-label host is in the same
 * family: `intranet` means whatever the local resolver says it means.
 */
const RESERVED_SUFFIXES = [
  "localhost",
  "local",
  "internal",
  "intranet",
  "home",
  "home.arpa",
  "lan",
  "corp",
  "alt",
  "onion",
  "i2p",
  "test",
  "example",
  "invalid",
  "in-addr.arpa",
  "ip6.arpa",
];

// --------------------------------------------------------------------------
// address literals, parsed by hand
//
// `node:net` would do this in one call and cannot be imported here: the
// artifact build runs esbuild with platform "browser" and would fail on it.
// Hand-rolling is also the honest option, because the rules below are about
// what an address MEANS, and a boolean from `isIP` does not carry that.

export function parseIpv4(host: string): number[] | null {
  const parts = host.split(".");
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const part of parts) {
    // Strictly decimal, no leading zeros: `010.1.1.1` is octal to some
    // resolvers and decimal to others, and an address two libraries disagree
    // about is an address to refuse rather than to guess at.
    if (!/^\d{1,3}$/.test(part)) return null;
    if (part.length > 1 && part.startsWith("0")) return null;
    const value = Number(part);
    if (value > 255) return null;
    octets.push(value);
  }
  return octets;
}

/** 16 bytes, or null. Accepts `::` compression and a trailing v4 tail. */
export function parseIpv6(host: string): number[] | null {
  let text = host;
  if (text.startsWith("[") && text.endsWith("]")) text = text.slice(1, -1);
  // A zone id (`fe80::1%eth0`) never survives a WHATWG URL parse, so it can
  // only arrive from a caller passing a raw string. Refuse it either way.
  if (text.includes("%")) return null;
  if (!text.includes(":")) return null;

  let tail: number[] = [];
  const lastColon = text.lastIndexOf(":");
  const trailing = text.slice(lastColon + 1);
  if (trailing.includes(".")) {
    const v4 = parseIpv4(trailing);
    if (!v4) return null;
    tail = v4;
    text = text.slice(0, lastColon + 1) + "0:0";
  }

  const halves = text.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const rest =
    halves.length === 2 ? (halves[1] ? halves[1].split(":") : []) : null;

  const groups: string[] = [];
  if (rest === null) {
    groups.push(...head);
    if (groups.length !== 8) return null;
  } else {
    const fill = 8 - head.length - rest.length;
    if (fill < 1) return null;
    groups.push(...head, ...Array<string>(fill).fill("0"), ...rest);
  }

  const bytes: number[] = [];
  for (const group of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(group)) return null;
    const value = Number.parseInt(group, 16);
    bytes.push((value >> 8) & 0xff, value & 0xff);
  }
  if (bytes.length !== 16) return null;
  if (tail.length === 4) {
    bytes[12] = tail[0];
    bytes[13] = tail[1];
    bytes[14] = tail[2];
    bytes[15] = tail[3];
  }
  return bytes;
}

function v4(a: number, b: number, c: number, d: number): number {
  return ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;
}

function inV4Range(o: number[], base: number, bits: number): boolean {
  const value = v4(o[0], o[1], o[2], o[3]);
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (value & mask) >>> 0 === (base & mask) >>> 0;
}

/** What an IPv4 address is for, when it is not the open internet. */
export function classifyIpv4(o: number[]): AddressVerdict {
  const ranges: [number, number, string][] = [
    [v4(0, 0, 0, 0), 8, "the unspecified block"],
    [v4(10, 0, 0, 0), 8, "a private network"],
    [v4(100, 64, 0, 0), 10, "a carrier-internal network"],
    [v4(127, 0, 0, 0), 8, "this machine"],
    [
      v4(169, 254, 0, 0),
      16,
      "a link-local address, which is where cloud metadata lives",
    ],
    [v4(172, 16, 0, 0), 12, "a private network"],
    [v4(192, 0, 0, 0), 24, "a reserved block"],
    [v4(192, 0, 2, 0), 24, "a documentation block"],
    [v4(192, 88, 99, 0), 24, "a deprecated relay block"],
    [v4(192, 168, 0, 0), 16, "a private network"],
    [v4(198, 18, 0, 0), 15, "a benchmarking block"],
    [v4(198, 51, 100, 0), 24, "a documentation block"],
    [v4(203, 0, 113, 0), 24, "a documentation block"],
    [v4(224, 0, 0, 0), 4, "a multicast block"],
    [v4(240, 0, 0, 0), 4, "a reserved block"],
  ];
  for (const [base, bits, what] of ranges) {
    if (inV4Range(o, base, bits)) {
      return no(`That address is ${what}, not a page on the open web.`);
    }
  }
  return ALLOWED;
}

function prefixIs(bytes: number[], prefix: number[], bits: number): boolean {
  const whole = Math.floor(bits / 8);
  for (let i = 0; i < whole; i++) if (bytes[i] !== prefix[i]) return false;
  const remainder = bits % 8;
  if (remainder === 0) return true;
  const mask = 0xff << (8 - remainder);
  return (bytes[whole] & mask) === (prefix[whole] & mask);
}

/**
 * What an IPv6 address is for.
 *
 * The transition prefixes are the interesting ones. `::ffff:0:0/96` and
 * `64:ff9b::/96` wrap a v4 address, so the v4 rules are re-run on what they
 * wrap — `::ffff:127.0.0.1` is this machine written differently. `2002::/16`
 * and `2001::/32` wrap one too but cannot be unwrapped safely at every
 * offset, so they are refused whole rather than parsed.
 */
export function classifyIpv6(bytes: number[]): AddressVerdict {
  const all = (n: number) => bytes.slice(0, n).every((b) => b === 0);
  if (all(16)) return no("That address is the unspecified address.");
  if (all(15) && bytes[15] === 1) return no("That address is this machine.");

  if (prefixIs(bytes, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xff, 0xff], 96)) {
    return classifyIpv4(bytes.slice(12));
  }
  if (
    prefixIs(bytes, [0x00, 0x64, 0xff, 0x9b], 32) &&
    bytes.slice(4, 12).every((b) => b === 0)
  ) {
    return classifyIpv4(bytes.slice(12));
  }
  if (all(12)) return no("That address is a deprecated v4-compatible address.");

  const blocks: [number[], number, string][] = [
    [[0x01, 0x00], 64, "a discard-only block"],
    [[0x20, 0x01, 0x00, 0x00], 32, "a tunnelling block"],
    [[0x20, 0x01, 0x00, 0x02], 48, "a benchmarking block"],
    [[0x20, 0x01, 0x0d, 0xb8], 32, "a documentation block"],
    [[0x20, 0x02], 16, "a v4 tunnelling block"],
    [[0x3f, 0xff], 20, "a documentation block"],
    [[0x5f, 0x00], 16, "a routing block"],
    [[0xfc], 7, "a private network"],
    [[0xfe, 0x80], 10, "a link-local address"],
    [[0xfe, 0xc0], 10, "a site-local address"],
    // RFC 8215's local-use NAT64 prefix. The well-known one above is unwrapped
    // and re-checked, because on an IPv6-only network with DNS64 every public
    // site resolves into it; this one addresses somebody's own network.
    [[0x00, 0x64, 0xff, 0x9b, 0x00, 0x01], 48, "a local translation block"],
    [[0xff], 8, "a multicast block"],
  ];
  for (const [prefix, bits, what] of blocks) {
    const padded = [...prefix, ...Array<number>(16 - prefix.length).fill(0)];
    if (prefixIs(bytes, padded, bits)) {
      return no(`That address is ${what}, not a page on the open web.`);
    }
  }
  return ALLOWED;
}

/** One verdict for a resolved address in either family. */
export function classifyResolvedAddress(ip: string): AddressVerdict {
  const v4parsed = parseIpv4(ip);
  if (v4parsed) return classifyIpv4(v4parsed);
  const v6parsed = parseIpv6(ip);
  if (v6parsed) return classifyIpv6(v6parsed);
  return no("That address could not be read as an address.");
}

// --------------------------------------------------------------------------
// the URL itself

export interface CheckedAddress {
  url: URL;
  /** Lowercased, trailing dot removed, default port dropped. */
  origin: string;
  host: string;
}

/**
 * Everything decidable before a name is resolved. A refusal here costs no
 * packets, which is the reason to put as much as possible in it.
 */
export function checkAddress(
  raw: string,
  options: { selfOrigins?: readonly string[] } = {},
): { verdict: AddressVerdict; address: CheckedAddress | null } {
  if (raw.length > MAX_URL_LENGTH) {
    return {
      verdict: no("That address is longer than we will open."),
      address: null,
    };
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return {
      verdict: no("That is not a complete web address."),
      address: null,
    };
  }
  if (url.href.length > MAX_URL_LENGTH) {
    return {
      verdict: no("That address is longer than we will open."),
      address: null,
    };
  }
  if (!(ALLOWED_SCHEMES as readonly string[]).includes(url.protocol)) {
    return {
      verdict: no(
        `Only https addresses are opened, and that one is ${url.protocol}//.`,
      ),
      address: null,
    };
  }
  if (url.username || url.password) {
    return {
      verdict: no("That address carries a username or password in it."),
      address: null,
    };
  }
  if (url.port && url.port !== String(ALLOWED_PORT)) {
    return {
      verdict: no(
        `Only port ${ALLOWED_PORT} is opened, and that address names ${url.port}.`,
      ),
      address: null,
    };
  }

  let host = url.hostname.toLowerCase();
  // Every trailing dot, not just one: `example.com..` survives a single strip
  // and would then miss every comparison below while resolving normally.
  host = host.replace(/\.+$/u, "");
  if (!host || host.includes("..")) {
    return {
      verdict: no("That address does not name a host we can read."),
      address: null,
    };
  }

  // A bare address literal never reaches a name resolver, so the check that
  // guards the resolved address never runs on one. It is refused here or not
  // at all.
  const literal =
    parseIpv4(host) !== null ||
    host.startsWith("[") ||
    parseIpv6(host) !== null;
  if (literal) {
    const verdict = classifyResolvedAddress(host.replace(/^\[|\]$/g, ""));
    if (!verdict.ok) return { verdict, address: null };
    return {
      verdict: no("Pages are opened by name, not by address literal."),
      address: null,
    };
  }

  if (!host.includes(".")) {
    return {
      verdict: no(
        "That host has no public name — it means something different on every machine.",
      ),
      address: null,
    };
  }
  for (const suffix of RESERVED_SUFFIXES) {
    if (host === suffix || host.endsWith(`.${suffix}`)) {
      return {
        verdict: no(`\`.${suffix}\` is a reserved name, not a public one.`),
        address: null,
      };
    }
  }

  // The URL carries the normalised name from here on, so the transport
  // resolves exactly the host the gate decided about rather than the string
  // that arrived.
  url.hostname = host;
  const origin = `${url.protocol}//${host}`;
  if (options.selfOrigins?.some((self) => self.toLowerCase() === origin)) {
    return { verdict: no("That address is this application."), address: null };
  }

  return { verdict: ALLOWED, address: { url, origin, host } };
}

/** The registrable-ish domain: the last two labels, or the whole host. */
export function baseDomain(host: string): string {
  const labels = host.split(".");
  if (labels.length <= 2) return host;
  // Two-label public suffixes are common enough in this corpus (`ac.uk`,
  // `edu.au`, `gov.uk`) that ignoring them would group every British
  // university under one key.
  const twoLabelSuffixes = [
    "ac",
    "co",
    "gov",
    "org",
    "net",
    "edu",
    "sch",
    "nhs",
  ];
  const [, second] = labels.slice(-2);
  if (
    second.length === 2 &&
    twoLabelSuffixes.includes(labels[labels.length - 2])
  ) {
    return labels.slice(-3).join(".");
  }
  return labels.slice(-2).join(".");
}
