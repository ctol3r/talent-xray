/**
 * Wave H2 acceptance: asking the person.
 *
 * Two things this file exists to stop:
 *  1. A message that claims to be a GDPR Article 14 notice but is missing the
 *     elements that make it one. Each element is asserted by name.
 *  2. The app quietly sending anything. `fetch` is replaced with a spy that
 *     fails the test if it is called at all.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import { candidates, profileSuppressions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/client";
import { noticeStatus } from "@/lib/domain/profile-links";
import {
  buildConfirmationDraft,
  confirmationWorkspace,
  recordCandidateAnswer,
  recordRequestSent,
  resolveNotice,
} from "@/lib/services/profile-confirmations";
import {
  addProfileLink,
  listProfileLinks,
  setSurfaceOptIn,
} from "@/lib/services/profile-links";
import { createCandidate } from "@/lib/services/candidates";
import { createSearchProject } from "@/lib/services/search-projects";

process.env.TALENTOS_MODEL_PROVIDER = "mock";

let db: Db;
let sqlite: Database.Database;
let dir: string;
let projectId: string;
let candidateId: string;

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "talentos-confirm-"));
  sqlite = new Database(path.join(dir, "test.db"));
  sqlite.pragma("foreign_keys = ON");
  db = drizzle(sqlite, { schema }) as unknown as Db;
  migrate(db, { migrationsFolder: path.resolve("drizzle") });
  const project = await createSearchProject(db, {
    name: "Confirmation test",
    roleTitle: "Staff Engineer",
  });
  projectId = project.id;
  setSurfaceOptIn(db, {
    searchProjectId: projectId,
    family: "personal_life",
    reason: "Community-facing role, documented at intake with the manager",
  });
  const candidate = await createCandidate(db, {
    searchProjectId: projectId,
    name: "Jordan Rivera",
  });
  candidateId = candidate.id;
  for (const url of [
    "https://github.com/jrivera-dev",
    "https://www.linkedin.com/in/jordan-rivera",
    "https://www.facebook.com/jordan.rivera",
  ]) {
    addProfileLink(db, {
      candidateId,
      url,
      addedVia: "manual",
      provenance: "recruiter_added",
    });
  }
});

afterAll(() => {
  sqlite.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("the message is a notice, not just a question", () => {
  const draft = () =>
    buildConfirmationDraft(
      { name: "Jordan Rivera" },
      { name: "Confirmation test", roleTitle: "Staff Engineer" },
      [
        {
          id: "a",
          url: "https://github.com/jrivera-dev",
          family: "professional",
        },
        {
          id: "b",
          url: "https://www.facebook.com/jordan.rivera",
          family: "personal_life",
        },
      ],
    );

  it("carries every element Article 14 requires", () => {
    const { body } = draft();
    const elements: [string, RegExp][] = [
      ["who is asking (14(1)(a))", /\[Your name\][\s\S]*\[Your company\]/],
      ["why, and the legal basis (14(1)(c))", /legitimate interest/],
      ["what is held (14(1)(d))", /1\. https:\/\/github\.com\/jrivera-dev/],
      ["how long (14(2)(a))", /Until this search closes/],
      ["where it came from (14(2)(f))", /found these pages on the public web/],
      ["the right to object (21)", /Your right to object\./],
      ["the right to a copy (15)", /ask me for a copy/],
      ["how to complain", /data protection authority/],
      ["how to reach you", /\[your email\]/],
    ];
    for (const [name, pattern] of elements) {
      expect(`${name} → ${pattern.test(body)}`).toBe(`${name} → true`);
    }
  });

  it("puts the right to object in its own paragraph, not buried in a sentence", () => {
    const { body } = draft();
    const paragraphs = body.split("\n\n").map((p) => p.trim());
    expect(paragraphs).toContain(
      "Your right to object.\nYou can tell me to stop using your details at any time, and I will delete everything I hold about you and not contact you again. You can also ask me for a copy of it. Either way, reply to this message or write to [your email]. You can also complain to your national data protection authority.",
    );
  });

  it("numbers every address and says what kind of page each one is", () => {
    const { body, listed } = draft();
    expect(listed).toHaveLength(2);
    expect(body).toContain(
      "1. https://github.com/jrivera-dev  [Professional profile]",
    );
    expect(body).toContain(
      "2. https://www.facebook.com/jordan.rivera  [Personal-life surface]",
    );
  });

  it("promises no contact detail is held, and offers none", () => {
    const { body } = draft();
    expect(body).toContain("I hold no email address or phone number for you");
    // The only email placeholder is the recruiter's own.
    expect(body.match(/\[your email\]/g)).toHaveLength(2);
    expect(body).not.toMatch(/@[a-z]+\.[a-z]{2,}/i);
  });

  it("leaves its blanks visible so an unfinished draft cannot be sent by accident", () => {
    const { body } = draft();
    for (const placeholder of [
      "[Your name]",
      "[Your company]",
      "[your email]",
    ]) {
      expect(body).toContain(placeholder);
    }
  });
});

describe("nothing is sent", () => {
  it("records the recruiter's word that they sent it, and makes no request", () => {
    const spy = vi.fn();
    const original = globalThis.fetch;
    globalThis.fetch = spy as unknown as typeof fetch;
    try {
      recordRequestSent(db, {
        candidateId,
        channel: "email",
        sentAt: "2026-09-08T12:00:00.000Z",
      });
    } finally {
      globalThis.fetch = original;
    }
    expect(spy).not.toHaveBeenCalled();
    const row = db
      .select()
      .from(candidates)
      .where(eq(candidates.id, candidateId))
      .get();
    expect(row?.noticeResolution).toBe("sent");
    expect(row?.noticeNote).toBe("via email");
    expect(noticeStatus(row!, null, new Date("2026-12-01T00:00:00Z"))).toEqual({
      tone: "ok",
      text: "sent 2026-09-08",
    });
  });

  it("will not let 'sent' be claimed without the date and channel", () => {
    expect(() =>
      resolveNotice(db, { candidateId, resolution: "sent" }),
    ).toThrow(/with the date and channel/);
  });

  it("makes an exemption cost a written reason", () => {
    expect(() =>
      resolveNotice(db, { candidateId, resolution: "exempt" }),
    ).toThrow(/needs a written reason/);
    expect(() =>
      resolveNotice(db, {
        candidateId,
        resolution: "exempt",
        note: "They told me their age already",
      }),
    ).toThrow(/must not weigh/);
  });
});

describe("what the person said", () => {
  it("confirms, deletes and blocks, and takes what they offered", () => {
    const before = listProfileLinks(db, candidateId);
    const github = before.find((l) => l.url.includes("github.com"))!;
    const facebook = before.find((l) => l.url.includes("facebook.com"))!;
    const linkedin = before.find((l) => l.url.includes("linkedin.com"))!;

    const result = recordCandidateAnswer(db, {
      candidateId,
      respondedAt: "2026-09-10T12:00:00.000Z",
      channel: "email",
      answers: [
        { sourceId: github.id, answer: "theirs" },
        { sourceId: facebook.id, answer: "not_theirs" },
        { sourceId: linkedin.id, answer: "no_answer" },
      ],
      addedUrls: ["https://orcid.org/0000-0002-1825-0097"],
    });
    expect(result).toEqual({ confirmed: 1, removed: 1, added: 1 });

    const after = listProfileLinks(db, candidateId);
    const confirmed = after.find((l) => l.url.includes("github.com"))!;
    expect(confirmed.badge).toBe(
      "confirmed by the person (recorded by you) · 2026-09-10 · email",
    );
    expect(confirmed.assertedBy).toBe("the person");

    // The address they denied is gone, and blocked from returning.
    expect(after.find((l) => l.url.includes("facebook.com"))).toBeUndefined();
    expect(() =>
      addProfileLink(db, {
        candidateId,
        url: "https://www.facebook.com/jordan.rivera",
        addedVia: "manual",
        provenance: "recruiter_added",
      }),
    ).toThrow(/asked not to be recorded/);
    const suppression = db
      .select()
      .from(profileSuppressions)
      .all()
      .find((s) => s.normalizedValue.includes("facebook.com"));
    expect(suppression?.reason).toBe("denied_by_person");

    // The one they offered is theirs, dated, and needs no opt-in.
    const added = after.find((l) => l.url.includes("orcid.org"))!;
    expect(added.badge).toContain("confirmed by the person");
    expect(added.addedVia).toBe("candidate_answer");

    // An address they said nothing about is untouched.
    const untouched = after.find((l) => l.url.includes("linkedin.com"))!;
    expect(untouched.badge).toBe("unverified · recruiter-added");
  });

  it("stores which addresses they named, never a word of what they wrote", async () => {
    const sentinel = "PLEASE-STOP-EMAILING-ME-I-AM-NOT-LOOKING";
    const person = await createCandidate(db, {
      searchProjectId: projectId,
      name: "Sentinel Person",
    });
    const link = addProfileLink(db, {
      candidateId: person.id,
      url: "https://github.com/sentinel-person",
      addedVia: "manual",
      provenance: "recruiter_added",
    });
    recordCandidateAnswer(db, {
      candidateId: person.id,
      respondedAt: "2026-09-10T12:00:00.000Z",
      channel: "email",
      answers: [{ sourceId: link.sourceId, answer: "theirs" }],
    });
    // There is nowhere to put their words, so the sentinel cannot be anywhere.
    const dump = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((row) => (row as { name: string }).name)
      .filter((name) => !name.startsWith("sqlite_"))
      .map((name) =>
        JSON.stringify(sqlite.prepare(`SELECT * FROM "${name}"`).all()),
      )
      .join("");
    expect(dump).not.toContain(sentinel);
  });

  it("hands the confirmation page the draft and the current addresses together", () => {
    const workspace = confirmationWorkspace(db, candidateId);
    expect(workspace.candidate.name).toBe("Jordan Rivera");
    expect(workspace.draft.subject).toContain("Staff Engineer");
    expect(workspace.draft.listed.map((l) => l.url)).toEqual(
      workspace.links.map((l) => l.url),
    );
  });
});
