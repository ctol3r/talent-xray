import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Db } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { createSearchProject } from "@/lib/services/search-projects";
import {
  createCandidate,
  createCandidateInput,
} from "@/lib/services/candidates";
import {
  captureWorkspace,
  saveCapturedSource,
} from "@/lib/services/browser-companion";
import {
  assertLocalCompanionRequest,
  captureInputSchema,
  companionBookmarklet,
  localCompanionOrigin,
  readCaptureFragment,
} from "@/lib/core/browser-companion";

let sqlite: Database.Database, db: Db, projectId: string, candidateId: string;
beforeEach(async () => {
  sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: resolve("drizzle") });
  projectId = (
    await createSearchProject(db, {
      name: "Capture fixture",
      roleTitle: "Engineer",
    })
  ).id;
  candidateId = (
    await createCandidate(
      db,
      createCandidateInput.parse({
        searchProjectId: projectId,
        name: "Candidate fixture",
      }),
    )
  ).id;
});
afterEach(() => sqlite.close());

it("saves only reviewed references, dedupes per owner, preserves stage and original source metadata", () => {
  const input = {
    searchProjectId: projectId,
    candidateId,
    destination: "candidate",
    url: "https://example.com/a?view=1#work",
    title: "Source label",
  };
  const before = db.select().from(schema.pipelineEvents).all();
  const saved = saveCapturedSource(db, input);
  expect(saved.duplicate).toBe(false);
  expect(
    saveCapturedSource(db, { ...input, title: "Do not replace" }),
  ).toMatchObject({ id: saved.id, duplicate: true });
  expect(db.select().from(schema.candidateSources).all()).toMatchObject([
    { url: input.url, label: input.title, addedVia: "browser_capture" },
  ]);
  expect(db.select().from(schema.pipelineEvents).all()).toEqual(before);
  expect(db.select().from(schema.candidates).all()).toMatchObject([
    { stage: "identified", resumeText: null },
  ]);
  saveCapturedSource(db, { ...input, destination: "research" });
  expect(db.select().from(schema.researchSources).all()).toMatchObject([
    { url: input.url, snippet: null, query: null, source: "browser_capture" },
  ]);
  expect(captureWorkspace(db).saved).toHaveLength(2);
});

it("rejects a candidate from another search and missing ownership without writes", async () => {
  const other = await createSearchProject(db, {
    name: "Other search",
    roleTitle: "Engineer",
  });
  const input = {
    searchProjectId: other.id,
    candidateId,
    destination: "candidate",
    url: "https://example.com/a",
  };
  expect(() => saveCapturedSource(db, input)).toThrow(/does not belong/);
  expect(() =>
    saveCapturedSource(db, {
      ...input,
      searchProjectId: "00000000-0000-4000-8000-000000000000",
    }),
  ).toThrow(/Search not found/);
  expect(db.select().from(schema.candidateSources).all()).toHaveLength(0);
  expect(db.select().from(schema.researchSources).all()).toHaveLength(0);
});

it.each([
  "javascript:alert(1)",
  "file:///Users/private.txt",
  "data:text/html,private",
  "https://name:password@example.com",
  "https://example.com/a\nb",
  "not a URL",
])("refuses unsafe capture URL %s", (url) => {
  expect(
    captureInputSchema.safeParse({
      searchProjectId: projectId,
      destination: "research",
      url,
    }).success,
  ).toBe(false);
});

it("restricts destinations and request hosts to the exact loopback app origin", () => {
  expect(localCompanionOrigin("http://localhost:3000")).toBe(
    "http://localhost:3000",
  );
  expect(() =>
    assertLocalCompanionRequest("127.0.0.1:3999", "http://127.0.0.1:3999"),
  ).not.toThrow();
  for (const origin of [
    "https://example.com",
    "http://127.0.0.1.example.com",
    "http://127.0.0.1@evil.example",
    "http://localhost:3000/path",
    "http://localhost:3000?capture=x",
  ])
    expect(() => localCompanionOrigin(origin)).toThrow();
  for (const host of [
    "evil.example",
    "localhost.evil.example",
    "127.0.0.1@evil.example",
    "localhost:3999/path",
  ])
    expect(() => assertLocalCompanionRequest(host)).toThrow();
  expect(() =>
    assertLocalCompanionRequest("localhost:3000", "http://localhost:3999"),
  ).toThrow();
});

it("bookmarklet transfers only URL/title through the fragment, without a query or opener", () => {
  const open = vi.fn();
  runInNewContext(
    companionBookmarklet("http://127.0.0.1:3999").replace(/^javascript:/, ""),
    {
      location: { protocol: "https:", href: "https://example.com/#profile" },
      document: { title: "Profile" },
      window: { open },
      URLSearchParams,
    },
  );
  const [target, name, features] = open.mock.calls[0];
  const url = new URL(target as string);
  expect(url.search).toBe("");
  expect(url.pathname).toBe("/capture");
  expect(readCaptureFragment(url.hash)).toEqual({
    url: "https://example.com/#profile",
    title: "Profile",
  });
  expect(name).toBe("_blank");
  expect(features).toBe("noopener,noreferrer");
  expect(() => readCaptureFragment("x".repeat(30001))).toThrow(/too large/);
});

it("extension requests only activeTab and performs no capture before its explicit action", async () => {
  const manifest = JSON.parse(
    readFileSync(resolve("browser-extension/manifest.json"), "utf8"),
  ) as Record<string, unknown>;
  expect(manifest.permissions).toEqual(["activeTab"]);
  expect(manifest.host_permissions).toBeUndefined();
  expect(manifest.content_scripts).toBeUndefined();
  expect(manifest.background).toBeUndefined();
  let listener:
    ((event: { preventDefault(): void }) => Promise<void>) | undefined;
  const query = vi
    .fn()
    .mockResolvedValue([
      { url: "https://example.com/profile", title: "A title" },
    ]);
  const create = vi.fn();
  const store = vi.fn();
  const address = { value: "http://127.0.0.1:3000" };
  const status = { textContent: "" };
  const elements: Record<string, unknown> = {
    origin: address,
    status,
    capture: {
      addEventListener: (_: string, action: typeof listener) => {
        listener = action;
      },
    },
  };
  runInNewContext(readFileSync(resolve("browser-extension/popup.js"), "utf8"), {
    document: { getElementById: (id: string) => elements[id] },
    localStorage: { getItem: () => null, setItem: store },
    chrome: { tabs: { query, create } },
    window: { close: vi.fn() },
    URL,
    URLSearchParams,
  });
  expect(query).not.toHaveBeenCalled();
  expect(create).not.toHaveBeenCalled();
  await listener!({ preventDefault: vi.fn() });
  expect(query).toHaveBeenCalledWith({ active: true, currentWindow: true });
  const target = new URL(create.mock.calls[0][0].url as string);
  expect(target.origin).toBe("http://127.0.0.1:3000");
  expect(target.search).toBe("");
  expect(readCaptureFragment(target.hash)).toEqual({
    url: "https://example.com/profile",
    title: "A title",
  });
  expect(store).toHaveBeenCalledExactlyOnceWith(
    "talentos-origin",
    "http://127.0.0.1:3000",
  );
  for (const unsupported of [
    "https://remote.example",
    "http://localhost.evil.example",
    "http://localhost:3000/path",
  ]) {
    query.mockClear();
    create.mockClear();
    address.value = unsupported;
    await listener!({ preventDefault: vi.fn() });
    expect(query).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(status.textContent).toMatch(/local address/);
  }
  address.value = "http://localhost:3999";
  for (const unsupported of [
    "chrome://settings",
    "file:///Users/private.txt",
    "https://user:secret@example.com",
  ]) {
    query.mockResolvedValue([{ url: unsupported, title: "Unsupported" }]);
    create.mockClear();
    await listener!({ preventDefault: vi.fn() });
    expect(create).not.toHaveBeenCalled();
    expect(status.textContent).toMatch(/no supported HTTP/);
  }
});
