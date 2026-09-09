/**
 * The tag index, against a real database.
 *
 * The claim being tested is the one the owner asked for: the same word
 * written on a job and on a person puts both on one page. There is no join
 * table to assert on, so the assertion is the page itself.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/db/client";
import { appendTagToNotes, listTags, tagPage } from "@/lib/services/tags";
import { createCandidate, updateCandidate } from "@/lib/services/candidates";
import {
  createSearchProject,
  updateSearchProject,
} from "@/lib/services/search-projects";

process.env.TALENTOS_MODEL_PROVIDER = "mock";

let db: Db;
let sqlite: Database.Database;
let dir: string;
let projectId: string;
let jordanId: string;
let samId: string;

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "talentos-tags-"));
  sqlite = new Database(path.join(dir, "test.db"));
  sqlite.pragma("foreign_keys = ON");
  db = drizzle(sqlite, { schema }) as unknown as Db;
  migrate(db, { migrationsFolder: path.resolve("drizzle") });

  const project = await createSearchProject(db, {
    name: "CAIS — Founding Recruiter",
    roleTitle: "Founding Recruiter",
  });
  projectId = project.id;
  await updateSearchProject(db, {
    id: projectId,
    recruiterNotes:
      "Turns on closing [[research engineers]] who are not looking. #ai-safety",
  });

  const jordan = await createCandidate(db, {
    searchProjectId: projectId,
    name: "Jordan Rivera",
  });
  jordanId = jordan.id;
  await updateCandidate(db, {
    id: jordanId,
    recruiterNotes:
      "Closed three [[research engineers]] at a lab. Strong on #boolean-search.",
  });

  const sam = await createCandidate(db, {
    searchProjectId: projectId,
    name: "Sam Okonkwo",
  });
  samId = sam.id;
  await updateCandidate(db, {
    id: samId,
    recruiterNotes: "Volume healthcare hiring. #boolean-search is a strength.",
  });
});

afterAll(() => {
  sqlite.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("a word written twice is a connection", () => {
  it("puts the job and the person who match on one page", () => {
    const page = tagPage(db, "research-engineers");
    expect(page.mentions.map((m) => `${m.kind}:${m.label}`)).toEqual([
      "search:CAIS — Founding Recruiter",
      "candidate:Jordan Rivera",
    ]);
  });

  it("puts two people who share a word on one page", () => {
    const page = tagPage(db, "boolean-search");
    expect(page.mentions.map((m) => m.label).sort()).toEqual([
      "Jordan Rivera",
      "Sam Okonkwo",
    ]);
  });

  it("counts a tag that bridges a job and a person as bridging", () => {
    const bridging = listTags(db).find((t) => t.slug === "research-engineers")!;
    expect({
      searches: bridging.searchCount,
      people: bridging.candidateCount,
    }).toEqual({ searches: 1, people: 1 });

    const peopleOnly = listTags(db).find((t) => t.slug === "boolean-search")!;
    expect(peopleOnly.searchCount).toBe(0);
  });

  it("carries the sentence the tag was written in", () => {
    const page = tagPage(db, "ai-safety");
    expect(page.mentions[0].context).toContain("not looking");
    expect(page.mentions[0].field).toBe("notes");
  });

  it("names the tags written alongside a tag", () => {
    const page = tagPage(db, "research-engineers");
    expect(page.related.map((r) => r.slug)).toContain("boolean-search");
    expect(page.related.map((r) => r.slug)).toContain("ai-safety");
  });
});

describe("deleting the word deletes the tag", () => {
  it("has no index to fall out of step with the text", async () => {
    await updateCandidate(db, {
      id: samId,
      recruiterNotes: "Volume healthcare hiring.",
    });
    expect(tagPage(db, "boolean-search").mentions.map((m) => m.label)).toEqual([
      "Jordan Rivera",
    ]);
    await updateCandidate(db, {
      id: samId,
      recruiterNotes:
        "Volume healthcare hiring. #boolean-search is a strength.",
    });
  });
});

describe("keeping a suggested tag", () => {
  it("writes the word into the notes, in the form the tag needs", () => {
    expect(
      appendTagToNotes("Existing note.", {
        slug: "greenhouse",
        display: "greenhouse",
      }),
    ).toBe("Existing note.\n#greenhouse");
    expect(
      appendTagToNotes("Existing note.", {
        slug: "passive-sourcing",
        display: "passive sourcing",
      }),
    ).toBe("Existing note.\n[[passive sourcing]]");
  });

  it("does not write a tag the person already carries", () => {
    const notes = "Already #greenhouse here.";
    expect(
      appendTagToNotes(notes, { slug: "greenhouse", display: "greenhouse" }),
    ).toBe(notes);
  });

  it("writes into empty notes without a leading blank line", () => {
    expect(appendTagToNotes(null, { slug: "orcid", display: "orcid" })).toBe(
      "#orcid",
    );
  });
});
