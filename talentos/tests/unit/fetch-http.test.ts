/**
 * The transport's two load-bearing helpers.
 *
 * The resolver hook is where the address rules are actually enforced — the
 * gate can only see a name, and a name is not an address. Two of Node's
 * behaviours are pinned here because neither is obvious and both are the kind
 * that get refactored away: calling back with an empty array crashes the
 * process rather than failing the request, so a refusal has to be an Error;
 * and the hook is never called for an address literal, which is why the gate
 * refuses those outright rather than relying on this.
 */
import { describe, expect, it } from "vitest";
import type { LookupAddress } from "node:dns";
import { decodeBody, guardedLookup, userAgent } from "@/lib/fetch/http";

type Resolver = Parameters<typeof guardedLookup>[0];

function resolvingTo(...addresses: [string, number][]): Resolver {
  return ((
    _host: string,
    _options: unknown,
    callback: (e: Error | null, a: LookupAddress[]) => void,
  ) => {
    callback(
      null,
      addresses.map(([address, family]) => ({ address, family })),
    );
  }) as unknown as Resolver;
}

function ask(
  resolver: Resolver,
): Promise<{ error: Error | null; addresses: unknown }> {
  return new Promise((resolve) => {
    guardedLookup(resolver)(
      "somewhere.example.org",
      { all: true },
      (error, addresses) => resolve({ error, addresses }),
    );
  });
}

describe("guardedLookup", () => {
  it("keeps only the addresses we are willing to connect to", async () => {
    const { error, addresses } = await ask(
      resolvingTo(["127.0.0.1", 4], ["8.8.8.8", 4], ["10.0.0.1", 4]),
    );
    expect(error).toBeNull();
    expect(addresses).toEqual([{ address: "8.8.8.8", family: 4 }]);
  });

  it("refuses with an Error, never an empty list", async () => {
    // An empty array here crashes the process instead of failing the request.
    const { error, addresses } = await ask(resolvingTo(["169.254.169.254", 4]));
    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toContain("link-local");
    expect(addresses).toBe("");
  });

  it("catches a public name that answers with a private address", async () => {
    const { error } = await ask(resolvingTo(["::ffff:127.0.0.1", 6]));
    expect(error).toBeInstanceOf(Error);
  });

  it("passes a resolver's own failure straight through", async () => {
    const failing = ((
      _h: string,
      _o: unknown,
      callback: (e: Error | null) => void,
    ) => callback(new Error("ENOTFOUND"))) as unknown as Resolver;
    const { error } = await ask(failing);
    expect(error?.message).toBe("ENOTFOUND");
  });
});

describe("decodeBody", () => {
  it("prefers a byte-order mark over everything", () => {
    const bom = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from("Ana Silva", "utf8"),
    ]);
    expect(decodeBody(bom, "iso-8859-1")).toBe("Ana Silva");
  });

  it("uses the header charset when there is no mark", () => {
    expect(
      decodeBody(Buffer.from([0x4a, 0x6f, 0x73, 0xe9]), "iso-8859-1"),
    ).toBe("José");
  });

  it("falls back to the page's own meta charset, which old rosters rely on", () => {
    const body = Buffer.concat([
      Buffer.from('<meta charset="iso-8859-1"><p>', "latin1"),
      Buffer.from([0x4a, 0x6f, 0x73, 0xe9]),
    ]);
    expect(decodeBody(body, null)).toContain("José");
  });

  it("survives a charset label no decoder has", () => {
    expect(decodeBody(Buffer.from("Ana", "utf8"), "x-nonsense-9000")).toBe(
      "Ana",
    );
  });
});

describe("userAgent", () => {
  it("names a place to complain when there is one", () => {
    expect(userAgent("some-reader", "https://x.example/who")).toBe(
      "some-reader (+https://x.example/who)",
    );
    expect(userAgent("some-reader", null)).toBe("some-reader");
  });
});
