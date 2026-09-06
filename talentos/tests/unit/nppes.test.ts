/**
 * Wave E acceptance for the NPPES client: correct URLs, no call when off,
 * an allow-list that drops everything the record carries beyond identity,
 * taxonomy and the practice location, and API errors surfaced.
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  buildNppesLookupUrl,
  buildNppesSearchUrl,
  createNppesClient,
  mapNppesResults,
  NPPES_MAX_LIMIT,
} from "@/lib/registries/nppes";
import {
  NPPES_ERROR_PAYLOAD,
  NPPES_FORBIDDEN_VALUES,
  NPPES_SEARCH_PAYLOAD,
} from "../fixtures/nppes-fixtures";

afterEach(() => {
  delete process.env.TALENTOS_REGISTRY_NPPES;
});

describe("urls", () => {
  it("targets the v2.1 API for individuals and clamps the limit", () => {
    const url = new URL(
      buildNppesSearchUrl({
        firstName: "Priya",
        lastName: "Patel",
        state: "tx",
        limit: 500,
      }),
    );
    expect(url.origin + url.pathname).toBe(
      "https://npiregistry.cms.hhs.gov/api/",
    );
    expect(url.searchParams.get("version")).toBe("2.1");
    expect(url.searchParams.get("enumeration_type")).toBe("NPI-1");
    expect(url.searchParams.get("first_name")).toBe("Priya");
    expect(url.searchParams.get("last_name")).toBe("Patel");
    expect(url.searchParams.get("state")).toBe("TX");
    expect(url.searchParams.get("limit")).toBe(String(NPPES_MAX_LIMIT));
    const lookup = new URL(buildNppesLookupUrl("1234-567-893"));
    expect(lookup.searchParams.get("number")).toBe("1234567893");
  });
});

describe("client modes", () => {
  it("is off by default and never calls fetch", async () => {
    let called = 0;
    const client = createNppesClient(async () => {
      called += 1;
      return { ok: true, status: 200, json: async () => ({}) };
    });
    expect(client.configured).toBe(false);
    expect(client.mode).toBe("off");
    await expect(client.search({ lastName: "Patel" })).rejects.toThrow(/off/);
    await expect(client.lookup("1234567893")).rejects.toThrow(/off/);
    expect(called).toBe(0);
  });

  it("maps live results through the allow-list only", async () => {
    process.env.TALENTOS_REGISTRY_NPPES = "1";
    const client = createNppesClient(async () => ({
      ok: true,
      status: 200,
      json: async () => NPPES_SEARCH_PAYLOAD,
    }));
    const records = await client.search({ lastName: "Patel" });
    expect(records).toHaveLength(2);
    expect(Object.keys(records[0]).sort()).toEqual(
      [
        "credential",
        "firstName",
        "lastName",
        "number",
        "practice",
        "taxonomies",
      ].sort(),
    );
    expect(records[0]).toMatchObject({
      number: "1234567893",
      firstName: "PRIYA",
      lastName: "PATEL",
      credential: "MD",
      practice: { city: "AUSTIN", state: "TX", telephone: "512-555-0100" },
    });
    expect(records[0].taxonomies[0]).toEqual({
      description: "Family Medicine",
      state: "TX",
      license: "TX12345",
      primary: true,
    });
    const json = JSON.stringify(records);
    for (const forbidden of NPPES_FORBIDDEN_VALUES) {
      expect(json).not.toContain(forbidden);
    }
  });

  it("surfaces API errors and treats malformed payloads as empty", async () => {
    process.env.TALENTOS_REGISTRY_NPPES = "1";
    const errors = createNppesClient(async () => ({
      ok: true,
      status: 200,
      json: async () => NPPES_ERROR_PAYLOAD,
    }));
    await expect(
      errors.search({ lastName: "Patel", state: "ZZ" }),
    ).rejects.toThrow(/Invalid state value/);
    const http = createNppesClient(async () => ({
      ok: false,
      status: 503,
      json: async () => ({}),
    }));
    await expect(http.lookup("1234567893")).rejects.toThrow(/503/);
    expect(mapNppesResults("nope")).toEqual([]);
    expect(mapNppesResults({ results: [null, 1, {}] })).toEqual([]);
  });

  it("serves watermarked fixtures in mock mode without fetch", async () => {
    process.env.TALENTOS_REGISTRY_NPPES = "mock";
    let called = 0;
    const client = createNppesClient(async () => {
      called += 1;
      return { ok: true, status: 200, json: async () => ({}) };
    });
    const records = await client.search({ lastName: "Patel", state: "TX" });
    expect(records).toHaveLength(1);
    expect(records[0].taxonomies[0].description).toMatch(/^\[Mock\]/);
    expect(called).toBe(0);
  });
});
