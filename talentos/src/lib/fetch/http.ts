/**
 * The transport. The only file in this folder that Node has to run.
 *
 * It uses `node:https.request` rather than `fetch`, and the reason is not
 * taste: the global `fetch` accepts a `lookup` option and silently ignores it,
 * so the address a name resolves to is never checked and a public-looking host
 * that answers with `127.0.0.1` is fetched happily. `https.request` honours
 * `lookup`, which is where the resolved-address rules in `address.ts` are
 * actually enforced.
 *
 * Everything else here is a cap. Bytes, time, headers, redirects, content
 * types, character sets. A remote page is somebody else's input and the only
 * safe assumption about its size and shape is that it is adversarial.
 */
import { Agent, request as httpsRequest } from "node:https";
import type { IncomingHttpHeaders } from "node:http";
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import type { LookupFunction } from "node:net";
import { classifyResolvedAddress } from "@/lib/fetch/address";

export const MAX_WIRE_BYTES = 2 * 1024 * 1024;
export const MAX_DECODED_CHARS = 1_000_000;
export const MAX_HEADER_BYTES = 16 * 1024;
export const CONNECT_TIMEOUT_MS = 5_000;
export const RESPONSE_TIMEOUT_MS = 15_000;
export const MAX_REDIRECT_HOPS = 3;

export const ALLOWED_CONTENT_TYPES = [
  "text/html",
  "application/xhtml+xml",
  "text/plain",
] as const;

export interface HttpResponse {
  status: number;
  headers: IncomingHttpHeaders;
  /** Decoded text, capped. Empty for a status with no body worth reading. */
  body: string;
  /** Octets that came off the wire, whether or not they were decoded. */
  bytes: number;
  /** Set when a redirect was seen; the caller re-gates it rather than us. */
  location: string | null;
}

export type HttpOutcome =
  | { ok: true; response: HttpResponse }
  | {
      ok: false;
      kind: "throttled" | "serverError" | "transportError" | "refused";
      reason: string;
      status?: number;
      headers?: IncomingHttpHeaders;
    };

/**
 * Identify the caller, name a place to complain, and do it in a token a site
 * can actually write in its robots.txt.
 */
export function userAgent(token: string, contact: string | null): string {
  return contact ? `${token} (+${contact})` : token;
}

/**
 * The resolver hook. Node calls this instead of `dns.lookup`, and every
 * address it returns is one we are willing to connect to.
 *
 * Two behaviours of Node's are load-bearing and neither is obvious. Returning
 * an empty array crashes the process rather than failing the request, so a
 * refusal has to be an `Error`. And the hook is not called at all when the
 * host is an address literal — which is why `checkAddress` refuses literals
 * outright rather than relying on this.
 */
export function guardedLookup(
  resolver: typeof dnsLookup = dnsLookup,
): LookupFunction {
  return (hostname, options, callback) => {
    resolver(hostname, { ...options, all: true }, (error, addresses) => {
      if (error) {
        callback(error, "", 0);
        return;
      }
      const list: LookupAddress[] = Array.isArray(addresses)
        ? addresses
        : [{ address: String(addresses), family: 0 }];
      const permitted = list.filter(
        (entry) => classifyResolvedAddress(entry.address).ok,
      );
      if (permitted.length === 0) {
        const first = list[0];
        callback(
          new Error(
            first
              ? classifyResolvedAddress(first.address).reason
              : "That name resolved to nothing.",
          ),
          "",
          0,
        );
        return;
      }
      if (options.all) {
        callback(null, permitted);
        return;
      }
      callback(null, permitted[0].address, permitted[0].family);
    });
  };
}

function contentTypeOf(headers: IncomingHttpHeaders): {
  type: string;
  charset: string | null;
} {
  const raw = String(headers["content-type"] ?? "").toLowerCase();
  const [type, ...params] = raw.split(";").map((p) => p.trim());
  const charsetParam = params.find((p) => p.startsWith("charset="));
  return {
    type,
    charset: charsetParam ? charsetParam.slice(8).replace(/["']/gu, "") : null,
  };
}

/**
 * BOM first, then the header, then the page's own `<meta charset>`, then
 * UTF-8. The meta tag matters more than it looks: the faculty pages, rosters
 * and directories this product reads are often old enough to be Latin-1 and
 * to say so only in the markup.
 */
export function decodeBody(
  buffer: Buffer,
  headerCharset: string | null,
): string {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xef &&
    buffer[1] === 0xbb &&
    buffer[2] === 0xbf
  ) {
    return buffer.subarray(3).toString("utf8");
  }
  const peek = buffer.subarray(0, 4096).toString("latin1");
  const meta =
    /<meta[^>]+charset\s*=\s*["']?\s*([a-z0-9_-]+)/iu.exec(peek)?.[1] ??
    /<meta[^>]+content\s*=\s*["'][^"']*charset=([a-z0-9_-]+)/iu.exec(
      peek,
    )?.[1] ??
    null;
  for (const label of [headerCharset, meta, "utf-8"]) {
    if (!label) continue;
    try {
      return new TextDecoder(label, { fatal: false }).decode(buffer);
    } catch {
      continue;
    }
  }
  return buffer.toString("utf8");
}

export interface HttpOptions {
  userAgent: string;
  /** Injected in tests. Defaults to Node's own resolver. */
  resolver?: typeof dnsLookup;
  signal?: AbortSignal;
  timeoutMs?: number;
  maxBytes?: number;
}

/**
 * One request, no redirect following. The caller re-runs the whole gate on a
 * `Location` rather than trusting this to do it, because a redirect is a new
 * address and a new address is a new decision.
 */
export function fetchOnce(
  url: URL,
  options: HttpOptions,
): Promise<HttpOutcome> {
  const maxBytes = options.maxBytes ?? MAX_WIRE_BYTES;
  const deadline = options.timeoutMs ?? RESPONSE_TIMEOUT_MS;

  return new Promise<HttpOutcome>((resolve) => {
    let settled = false;
    const finish = (outcome: HttpOutcome) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(outcome);
    };

    const agent = new Agent({ keepAlive: false, maxSockets: 1 });
    const req = httpsRequest(
      {
        protocol: url.protocol,
        host: url.hostname,
        port: 443,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        agent,
        lookup: guardedLookup(options.resolver),
        maxHeaderSize: MAX_HEADER_BYTES,
        // Sent deliberately, and this is the whole list. No cookie, no
        // authorization, no referer: a request that carries none of those
        // cannot accidentally be a request made as somebody.
        headers: {
          "User-Agent": options.userAgent,
          Accept: "text/html,application/xhtml+xml;q=0.9,text/plain;q=0.8",
          "Accept-Language": "en",
          // Identity only. A compressed body is a decompression bomb waiting
          // for a cap to be applied in the wrong place, and the pages here are
          // small enough that the extra octets are cheaper than the risk.
          "Accept-Encoding": "identity",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const location =
          typeof res.headers.location === "string"
            ? res.headers.location
            : null;

        if (status >= 300 && status < 400) {
          // Destroyed, never drained. `finish` clears the wall-clock timer, and
          // a resumed body has no byte cap on this path — a server that keeps
          // writing after a 302 would be read forever, off the clock.
          res.destroy();
          finish({
            ok: true,
            response: {
              status,
              headers: res.headers,
              body: "",
              bytes: 0,
              location,
            },
          });
          return;
        }
        if (status === 429) {
          res.destroy();
          finish({
            ok: false,
            kind: "throttled",
            reason: "That site asked us to slow down.",
            status,
            headers: res.headers,
          });
          return;
        }
        if (status >= 500) {
          res.destroy();
          finish({
            ok: false,
            kind: "serverError",
            reason: `That site answered ${status}.`,
            status,
            headers: res.headers,
          });
          return;
        }

        const { type, charset } = contentTypeOf(res.headers);
        // 401, 403 and 451 are read far enough to say which they are: the
        // commonest bot check arrives as a 403, and telling somebody "that
        // site refused us" when it actually showed a challenge is the wrong
        // sentence. The body is still never used.
        const readable =
          (ALLOWED_CONTENT_TYPES as readonly string[]).includes(type) ||
          type === "";
        if (!readable) {
          res.destroy();
          finish({
            ok: false,
            kind: "refused",
            reason: `That address is ${type || "not a page"}, not a page to read.`,
            status,
          });
          return;
        }

        const chunks: Buffer[] = [];
        let bytes = 0;
        let capped = false;
        res.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > maxBytes) {
            capped = true;
            res.destroy();
            return;
          }
          chunks.push(chunk);
        });
        res.on("aborted", () => {
          if (!capped) {
            finish({
              ok: false,
              kind: "transportError",
              reason: "That site closed the connection part-way through.",
            });
          }
        });
        res.on("error", () => {
          if (!capped) {
            finish({
              ok: false,
              kind: "transportError",
              reason: "That site closed the connection part-way through.",
            });
          }
        });
        const done = () => {
          const buffer = Buffer.concat(chunks);
          const body = decodeBody(buffer, charset).slice(0, MAX_DECODED_CHARS);
          finish({
            ok: true,
            response: {
              status,
              headers: res.headers,
              body,
              bytes,
              location: null,
            },
          });
        };
        res.on("end", done);
        // A body stopped at the cap is a body we chose to stop reading, not a
        // broken one. What arrived is used.
        res.on("close", () => {
          if (capped) done();
        });
      },
    );

    const timer = setTimeout(() => {
      req.destroy();
      finish({
        ok: false,
        kind: "transportError",
        reason: `Nothing came back within ${Math.round(deadline / 1000)}s.`,
      });
    }, deadline);

    req.setTimeout(CONNECT_TIMEOUT_MS, () => {
      req.destroy();
      finish({
        ok: false,
        kind: "transportError",
        reason: "Nothing answered at that address in time.",
      });
    });

    options.signal?.addEventListener("abort", () => {
      req.destroy();
      finish({ ok: false, kind: "refused", reason: "Stopped." });
    });

    req.on("error", (error: NodeJS.ErrnoException) => {
      const reason =
        error.code === "ECONNREFUSED"
          ? "Nothing answered at that address."
          : error.code === "ENOTFOUND"
            ? "That host name does not resolve."
            : error.message || "That request did not complete.";
      finish({ ok: false, kind: "transportError", reason });
    });

    req.end();
  });
}
