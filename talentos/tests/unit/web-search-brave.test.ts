/**
 * The open-web connector. The interesting assertions are the refusals: what it
 * will not read out of a response, and what it will not claim about the index.
 */
import { describe, expect, it } from "vitest";
import {
  buildBraveUrl,
  createBraveDiscoveryProvider,
  mapBrave,
  OPERATOR_SUPPORT,
  unverifiedOperators,
  type BraveFetch,
} from "@/lib/research/web-search/brave";

const AT = "2026-09-08T00:00:00.000Z";

function answering(payload: unknown, status = 200): BraveFetch {
  return async () => ({
    ok: status < 400,
    status,
    json: async () => payload,
  });
}

describe("the request", () => {
  it("asks for what the caller asked for, and turns off spell correction", () => {
    const url = new URL(buildBraveUrl("(a OR b) site:.edu", 10));
    expect(url.origin + url.pathname).toBe(
      "https://api.search.brave.com/res/v1/web/search",
    );
    expect(url.searchParams.get("q")).toBe("(a OR b) site:.edu");
    expect(url.searchParams.get("count")).toBe("10");
    // A composed boolean is not a typo, and letting the index fix it silently
    // turns a precise query into a different one.
    expect(url.searchParams.get("spellcheck")).toBe("0");
  });

  it("stays inside the index's page size", () => {
    expect(new URL(buildBraveUrl("x", 500)).searchParams.get("count")).toBe(
      "20",
    );
    expect(new URL(buildBraveUrl("x", 0)).searchParams.get("count")).toBe("1");
  });
});

describe("the response", () => {
  it("reads an explicit list of fields and numbers the rows as they came", () => {
    const rows = mapBrave(
      {
        web: {
          results: [
            {
              url: "https://a.example/p",
              title: "<b>Ana</b> Silva",
              description: "Chair",
            },
            { url: "https://b.example/p", title: "Bo Lin" },
          ],
        },
      },
      "q",
      AT,
    );
    expect(rows.map((r) => r.providerRank)).toEqual([1, 2]);
    expect(rows[0].title).toBe("Ana Silva");
    expect(rows[0].provider).toBe("brave");
    expect(rows[0].retrievedAt).toBe(AT);
  });

  it("drops a row it cannot address", () => {
    const rows = mapBrave(
      {
        web: {
          results: [
            { title: "no url" },
            { url: "javascript:alert(1)" },
            { url: "http://insecure.example/" },
            null,
            { url: "https://ok.example/" },
          ],
        },
      },
      "q",
      AT,
    );
    expect(rows.map((r) => r.url)).toEqual(["https://ok.example/"]);
  });

  it("survives a shape it did not expect", () => {
    expect(mapBrave({}, "q", AT)).toEqual([]);
    expect(mapBrave({ web: { results: "nope" as never } }, "q", AT)).toEqual(
      [],
    );
  });
});

describe("the provider", () => {
  it("reports itself unconfigured without a key, and refuses to guess", async () => {
    const provider = createBraveDiscoveryProvider("", answering({}));
    expect(provider.configured).toBe(false);
    await expect(provider.search("x")).rejects.toThrow(
      /TALENTOS_BRAVE_SEARCH_KEY/u,
    );
  });

  it("returns rows when it has one", async () => {
    const provider = createBraveDiscoveryProvider(
      "k",
      answering({
        web: { results: [{ url: "https://a.example/p", title: "Ana" }] },
      }),
    );
    expect(provider.configured).toBe(true);
    expect(await provider.search("x", { limit: 5 })).toHaveLength(1);
  });

  it("says what went wrong rather than returning nothing", async () => {
    await expect(
      createBraveDiscoveryProvider("k", answering({}, 429)).search("x"),
    ).rejects.toThrow(/slow down/u);
    await expect(
      createBraveDiscoveryProvider("k", answering({}, 401)).search("x"),
    ).rejects.toThrow(/rejected the key/u);
  });
});

describe("what it claims about the index", () => {
  it("claims nothing about an operator nobody has probed", () => {
    // Every row starts unverified on purpose. An operator the index silently
    // drops turns a precise query into a broad one, and rows from a widened
    // query still look like answers.
    expect(unverifiedOperators().length).toBe(
      Object.keys(OPERATOR_SUPPORT).length,
    );
    for (const confidence of Object.values(OPERATOR_SUPPORT)) {
      expect(confidence).not.toBe("verified");
    }
  });
});
