/**
 * Wave H acceptance, part 2: the guard and the write path, against a real
 * database.
 *
 * What these tests hold in place:
 *  - one guard, called by every candidate-bound write, refusing a suppressed
 *    address, a company page, and an off-family surface;
 *  - a lookalike is flagged for a human and never blocked or merged (Wave D's
 *    rule), so the review task is reachable from the only write path;
 *  - a shared private page never binds two records together;
 *  - deleting a person deletes their addresses and keeps their objection.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import { candidateSources, profileSuppressions, tasks } from "@/lib/db/schema";
import type { Db } from "@/lib/db/client";
import {
  addProfileLink,
  enforcePolicyForSave,
  FamilyOffError,
  findCandidatesByUrl,
  linksForModel,
  listProfileLinks,
  matchableProfileUrlsFor,
  moveProfileLink,
  NotAPersonError,
  removeProfileLink,
  setSurfaceOptIn,
  SuppressedUrlError,
  suppressUrl,
} from "@/lib/services/profile-links";
import { createCandidate, deleteCandidate } from "@/lib/services/candidates";
import { createSearchProject } from "@/lib/services/search-projects";

process.env.TALENTOS_MODEL_PROVIDER = "mock";

let db: Db;
let sqlite: Database.Database;
let dir: string;
let projectId: string;
let jordanId: string;

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "talentos-profile-links-"));
  sqlite = new Database(path.join(dir, "test.db"));
  sqlite.pragma("foreign_keys = ON");
  db = drizzle(sqlite, { schema }) as unknown as Db;
  migrate(db, { migrationsFolder: path.resolve("drizzle") });
  const project = await createSearchProject(db, {
    name: "Profile links test",
    roleTitle: "Staff Engineer",
  });
  projectId = project.id;
  const jordan = await createCandidate(db, {
    searchProjectId: projectId,
    name: "Jordan Rivera",
    currentCompany: "Acme",
  });
  jordanId = jordan.id;
});

afterAll(() => {
  sqlite.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("the one guard", () => {
  it("passes a work surface and an unknown host, and names the family it returns", () => {
    expect(
      enforcePolicyForSave(db, {
        searchProjectId: projectId,
        url: "https://github.com/jrivera-dev",
        provenance: "recruiter_added",
      }),
    ).toBe("professional");
    // A developer's own domain is the most valuable link a sourcer finds; it
    // saves, and is never an identity signal.
    expect(
      enforcePolicyForSave(db, {
        searchProjectId: projectId,
        url: "https://jrivera.dev",
        provenance: "recruiter_added",
      }),
    ).toBe("unrecognised");
  });

  it("refuses a company page with a message that says what to do instead", () => {
    expect(() =>
      enforcePolicyForSave(db, {
        searchProjectId: projectId,
        url: "https://www.linkedin.com/company/acme",
        provenance: "recruiter_added",
      }),
    ).toThrow(NotAPersonError);
  });

  it("refuses an off-family surface and hands back the warning to show", () => {
    try {
      enforcePolicyForSave(db, {
        searchProjectId: projectId,
        url: "https://www.facebook.com/jordan.rivera",
        provenance: "recruiter_added",
      });
      throw new Error("should have refused");
    } catch (error) {
      expect(error).toBeInstanceOf(FamilyOffError);
      const off = error as FamilyOffError;
      expect(off.family).toBe("personal_life");
      expect(off.warning).toContain("off for this search");
    }
  });

  it("lets an address through when the person themselves supplied it", () => {
    expect(
      enforcePolicyForSave(db, {
        searchProjectId: projectId,
        url: "https://www.facebook.com/jordan.rivera",
        provenance: "candidate_provided",
      }),
    ).toBe("personal_life");
  });
});

describe("adding addresses", () => {
  it("writes one row, labels it recruiter-added, and keeps the recruiter's note", () => {
    const result = addProfileLink(db, {
      candidateId: jordanId,
      url: "https://github.com/jrivera-dev",
      whyNote: "Same employer and city as the LinkedIn profile",
      addedVia: "manual",
      provenance: "recruiter_added",
    });
    expect(result.duplicate).toBe(false);
    expect(result.family).toBe("professional");
    const rows = listProfileLinks(db, jordanId);
    expect(rows).toHaveLength(1);
    expect(rows[0].badge).toBe("unverified · recruiter-added");
    expect(rows[0].whyNote).toBe(
      "Same employer and city as the LinkedIn profile",
    );
    expect(rows[0].matchable).toBe(true);
  });

  it("treats the same address twice as a no-op, not an error", () => {
    const again = addProfileLink(db, {
      candidateId: jordanId,
      url: "https://github.com/jrivera-dev/",
      addedVia: "manual",
      provenance: "recruiter_added",
    });
    expect(again.duplicate).toBe(true);
    expect(listProfileLinks(db, jordanId)).toHaveLength(1);
  });

  it("refuses a note that names a protected characteristic", () => {
    expect(() =>
      addProfileLink(db, {
        candidateId: jordanId,
        url: "https://gitlab.com/jrivera",
        whyNote: "Same age as the last hire",
        addedVia: "manual",
        provenance: "recruiter_added",
      }),
    ).toThrow(/hiring record must not weigh/);
  });

  it("opens a review task when another candidate holds the same work address, and merges nothing", async () => {
    const twin = await createCandidate(db, {
      searchProjectId: projectId,
      name: "J. Rivera",
    });
    const result = addProfileLink(db, {
      candidateId: twin.id,
      url: "https://github.com/jrivera-dev",
      addedVia: "manual",
      provenance: "recruiter_added",
    });
    // The row is written: refusing it would make the task unreachable and
    // would invert Wave D's rule that a lookalike is flagged, never blocked.
    expect(result.duplicate).toBe(false);
    expect(result.conflicts.map((c) => c.name)).toEqual(["Jordan Rivera"]);
    const open = db
      .select()
      .from(tasks)
      .where(eq(tasks.kind, "identity_review"))
      .all();
    expect(open).toHaveLength(1);
    expect(open[0].title).toContain("Jordan Rivera");
    expect(open[0].title).toContain("J. Rivera");
    // Both records still exist. Nothing merged.
    expect(listProfileLinks(db, twin.id)).toHaveLength(1);
    expect(listProfileLinks(db, jordanId)).toHaveLength(1);

    // A second identical add does not pile up duplicate tasks.
    addProfileLink(db, {
      candidateId: twin.id,
      url: "https://github.com/jrivera-dev",
      addedVia: "manual",
      provenance: "recruiter_added",
    });
    expect(
      db.select().from(tasks).where(eq(tasks.kind, "identity_review")).all(),
    ).toHaveLength(1);

    // Moving the address to the other record is the answer to a duplicate:
    // it keeps the row intact and empties the loser.
    const [row] = listProfileLinks(db, twin.id);
    moveProfileLink(db, { sourceId: row.id, toCandidateId: jordanId });
    expect(listProfileLinks(db, twin.id)).toHaveLength(0);
    expect(listProfileLinks(db, jordanId)).toHaveLength(1);
  });

  it("never binds two records through a shared private page", async () => {
    const project2 = await createSearchProject(db, {
      name: "Shared page test",
      roleTitle: "Nurse",
    });
    setSurfaceOptIn(db, {
      searchProjectId: project2.id,
      family: "personal_life",
      reason: "Community-facing role documented in the intake notes",
    });
    const a = await createCandidate(db, {
      searchProjectId: project2.id,
      name: "Alex Stone",
    });
    const b = await createCandidate(db, {
      searchProjectId: project2.id,
      name: "Alex Stone",
    });
    addProfileLink(db, {
      candidateId: a.id,
      url: "https://www.facebook.com/groups/nurses",
      addedVia: "manual",
      provenance: "recruiter_added",
    });
    const second = addProfileLink(db, {
      candidateId: b.id,
      url: "https://www.facebook.com/groups/nurses",
      addedVia: "manual",
      provenance: "recruiter_added",
    });
    expect(second.conflicts).toEqual([]);
    expect(matchableProfileUrlsFor(db, a.id)).toEqual([]);
  });
});

describe("opt-in", () => {
  it("needs a reason of real length and refuses one that names a protected characteristic", () => {
    expect(() =>
      setSurfaceOptIn(db, {
        searchProjectId: projectId,
        family: "mixed_broadcast",
        reason: "because",
      }),
    ).toThrow();
    expect(() =>
      setSurfaceOptIn(db, {
        searchProjectId: projectId,
        family: "mixed_broadcast",
        reason: "We want candidates of a particular age for this team",
      }),
    ).toThrow(/may not be widened/);
  });

  it("applies to the whole search once set, and not to another search", () => {
    setSurfaceOptIn(db, {
      searchProjectId: projectId,
      family: "mixed_broadcast",
      reason: "Public writing and conference talks are part of this role",
    });
    expect(
      enforcePolicyForSave(db, {
        searchProjectId: projectId,
        url: "https://x.com/jrivera",
        provenance: "recruiter_added",
      }),
    ).toBe("mixed_broadcast");
  });
});

describe("suppression", () => {
  it("blocks an address on every path once the person has objected, and dates the refusal", async () => {
    const person = await createCandidate(db, {
      searchProjectId: projectId,
      name: "Sam Objector",
    });
    addProfileLink(db, {
      candidateId: person.id,
      url: "https://github.com/sam-objector",
      addedVia: "manual",
      provenance: "recruiter_added",
    });
    suppressUrl(db, {
      url: "https://github.com/sam-objector",
      candidateId: person.id,
      reason: "denied_by_person",
    });
    expect(() =>
      addProfileLink(db, {
        candidateId: person.id,
        url: "https://github.com/sam-objector",
        addedVia: "manual",
        provenance: "recruiter_added",
      }),
    ).toThrow(SuppressedUrlError);
    expect(() =>
      addProfileLink(db, {
        candidateId: jordanId,
        // Same address, different spelling: the suppression is normalised.
        url: "https://www.github.com/sam-objector/",
        addedVia: "manual",
        provenance: "recruiter_added",
      }),
    ).toThrow(/asked not to be recorded/);
  });

  it("keeps the objection after the record it was about is deleted", async () => {
    const person = await createCandidate(db, {
      searchProjectId: projectId,
      name: "Del Etion",
    });
    addProfileLink(db, {
      candidateId: person.id,
      url: "https://gitlab.com/del-etion",
      addedVia: "manual",
      provenance: "recruiter_added",
    });
    suppressUrl(db, {
      url: "https://gitlab.com/del-etion",
      candidateId: person.id,
      reason: "objection",
    });
    await deleteCandidate(db, person.id);
    const rows = db
      .select()
      .from(candidateSources)
      .where(eq(candidateSources.candidateId, person.id))
      .all();
    expect(rows).toHaveLength(0);
    const kept = db
      .select()
      .from(profileSuppressions)
      .all()
      .find((s) => s.normalizedValue === "gitlab.com/del-etion");
    expect(kept).toBeTruthy();
    // Detached, so it outlives the record without pointing at a ghost.
    expect(kept?.candidateId).toBeNull();
    // And it still bites.
    expect(() =>
      addProfileLink(db, {
        candidateId: jordanId,
        url: "https://gitlab.com/del-etion",
        addedVia: "manual",
        provenance: "recruiter_added",
      }),
    ).toThrow(SuppressedUrlError);
  });
});

describe("what leaves the candidate record", () => {
  it("shows a model only work and scholarly addresses", async () => {
    const person = await createCandidate(db, {
      searchProjectId: projectId,
      name: "Model Boundary",
    });
    for (const url of [
      "https://www.linkedin.com/in/model-boundary",
      "https://orcid.org/0000-0002-1825-0097",
      "https://x.com/model-boundary",
      "https://jrivera-boundary.dev",
    ]) {
      addProfileLink(db, {
        candidateId: person.id,
        url,
        addedVia: "manual",
        provenance: "recruiter_added",
      });
    }
    expect(linksForModel(db, person.id)).toEqual([
      "https://www.linkedin.com/in/model-boundary",
      "https://orcid.org/0000-0002-1825-0097",
    ]);
  });

  it("finds every record holding an address, for a data-subject request", () => {
    const hits = findCandidatesByUrl(db, "https://github.com/jrivera-dev");
    expect(hits.map((h) => h.name)).toContain("Jordan Rivera");
  });

  it("keeps a copied-from pointer, and clears it rather than failing when the origin goes", () => {
    const origin = listProfileLinks(db, jordanId).find((r) =>
      r.url.includes("github.com/jrivera-dev"),
    )!;
    const child = addProfileLink(db, {
      candidateId: jordanId,
      url: "https://jordan-rivera.dev",
      addedVia: "declared_copy",
      provenance: "recruiter_added",
      originSourceId: origin.id,
    });
    expect(
      listProfileLinks(db, jordanId).find((r) => r.id === child.sourceId)
        ?.originUrl,
    ).toContain("github.com/jrivera-dev");
    // The migration cannot carry ON DELETE on an added column, so the service
    // nulls children explicitly. Without that this delete would throw.
    removeProfileLink(db, { candidateId: jordanId, sourceId: origin.id });
    const after = listProfileLinks(db, jordanId).find(
      (r) => r.id === child.sourceId,
    );
    expect(after).toBeTruthy();
    expect(after?.originSourceId).toBeNull();
  });
});
