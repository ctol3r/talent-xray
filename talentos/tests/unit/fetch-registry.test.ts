/**
 * The registry's contract. Most of these are honesty checks rather than
 * behaviour checks, because the thing that makes a registry defensible is not
 * what it decides — it is that every row says how it knows.
 */
import { describe, expect, it } from "vitest";
import {
  ASSUMED_PREFIX,
  POSTURES,
  postureFor,
  registrySummary,
  SOURCE_REGISTRY,
  UNLISTED_NOTE,
  type Basis,
  type Posture,
  type SourceRecord,
} from "@/lib/fetch/registry";

describe("every row", () => {
  it("writes its own note, and no row shares one", () => {
    const notes = SOURCE_REGISTRY.map((r) => r.note);
    expect(new Set(notes).size).toBe(notes.length);
    for (const note of notes) expect(note.length).toBeGreaterThan(80);
  });

  it("never says 'as above'", () => {
    for (const record of SOURCE_REGISTRY) {
      expect(record.note.toLowerCase()).not.toMatch(
        /\bas above\b|\bsee above\b|\bditto\b/u,
      );
    }
  });

  it("says so in its own words when nobody read the terms", () => {
    for (const record of SOURCE_REGISTRY) {
      if (record.basis === "assumed") {
        expect(record.note.startsWith(ASSUMED_PREFIX)).toBe(true);
      }
    }
  });

  it("carries a read date exactly when the basis is a read", () => {
    for (const record of SOURCE_REGISTRY) {
      expect(record.termsReadOn === null).toBe(record.basis !== "read");
    }
  });

  it("only widens on a basis of read", () => {
    // `cleared` is the only posture wider than the default, and a guess may
    // never reach it.
    for (const record of SOURCE_REGISTRY) {
      if (record.posture === "cleared") expect(record.basis).toBe("read");
    }
  });

  it("states whether it governs subdomains, rather than defaulting", () => {
    for (const record of SOURCE_REGISTRY) {
      expect(typeof record.suffix).toBe("boolean");
      expect(record.host).toMatch(/^[a-z0-9.-]+$/u);
    }
  });

  it("counts itself rather than being counted by hand", () => {
    const summary = registrySummary();
    const total = summary.reduce((sum, row) => sum + row.count, 0);
    expect(total).toBe(SOURCE_REGISTRY.length);
    // Nobody has read a host's terms yet, and the table must not imply they have.
    expect(SOURCE_REGISTRY.filter((r) => r.basis === "read")).toHaveLength(0);
  });
});

/**
 * The pin: what every host is set to today, host by host.
 *
 * The rule this file already asserts — only a basis of `read` may widen — was
 * enforced for exactly one case, `cleared`, and nothing stopped the two
 * widenings that are actually easy to make by accident. Loosening a row from
 * `refused` to `handoff` passed. So did **deleting** a row, which is the
 * sharpest one of all: an unlisted host is `open` by design (D-083), so
 * removing a refusal does not leave a gap, it opens a door.
 *
 * A row may move down this table or gain evidence. It may not move up, and it
 * may not leave. Changing a line here is the deliberate act; a diff that
 * touches it is the thing to read twice.
 */
const PINNED: Record<string, `${Posture}/${Basis}`> = {
  "web.archive.org": "refused/assumed",
  "archive.ph": "refused/assumed",
  "archive.today": "refused/assumed",
  "archive.is": "refused/assumed",
  "archive.li": "refused/assumed",
  "archive.vn": "refused/assumed",
  "archive.fo": "refused/assumed",
  "r.jina.ai": "refused/assumed",
  "webcache.googleusercontent.com": "refused/assumed",
  "translate.goog": "refused/assumed",
  "linkedin.com": "handoff/assumed",
  "facebook.com": "handoff/assumed",
  "instagram.com": "handoff/assumed",
  "x.com": "handoff/assumed",
  "glassdoor.com": "handoff/assumed",
  "google.com": "handoff/assumed",
  "bing.com": "handoff/assumed",
  "duckduckgo.com": "handoff/assumed",
  "rocketreach.co": "handoff/assumed",
  "apollo.io": "handoff/assumed",
  "signalhire.com": "handoff/assumed",
  "orcid.org": "handoff/documented-elsewhere",
  "semanticscholar.org": "handoff/documented-elsewhere",
  "dblp.org": "handoff/documented-elsewhere",
};

/** Most restrictive first, so a smaller index is a tighter posture. */
const restrictiveness = (posture: Posture) => POSTURES.indexOf(posture);
/** How well a posture is known. Only the top one may widen anything. */
const evidence: Record<Basis, number> = {
  assumed: 0,
  "documented-elsewhere": 1,
  read: 2,
};

describe("nothing widens by accident", () => {
  it("still lists every host it listed", () => {
    const present = new Set(SOURCE_REGISTRY.map((r) => r.host));
    const gone = Object.keys(PINNED).filter((host) => !present.has(host));
    // Deleting a row is a widening: an unlisted host is open (D-083).
    expect(gone).toEqual([]);
  });

  it("holds every row at or below the posture it was pinned at", () => {
    for (const record of SOURCE_REGISTRY) {
      const pinned = PINNED[record.host];
      if (!pinned) continue;
      const [posture] = pinned.split("/") as [Posture, Basis];
      expect({
        host: record.host,
        looser: restrictiveness(record.posture) > restrictiveness(posture),
      }).toEqual({ host: record.host, looser: false });
    }
  });

  it("never lets a row lose the evidence it had", () => {
    for (const record of SOURCE_REGISTRY) {
      const pinned = PINNED[record.host];
      if (!pinned) continue;
      const [, basis] = pinned.split("/") as [Posture, Basis];
      expect({
        host: record.host,
        weaker: evidence[record.basis] < evidence[basis],
      }).toEqual({ host: record.host, weaker: false });
    }
  });

  it("does not let a probe stand in for a reading", () => {
    // A probe observes an index answering a query. A basis records what a
    // host's terms permit. No number of successful requests is a reading of
    // anybody's terms, so a run of the operator probe must leave every row
    // here exactly where it is.
    for (const record of SOURCE_REGISTRY) {
      if (record.basis === "read") {
        expect(record.termsReadOn).not.toBeNull();
      }
    }
    expect(SOURCE_REGISTRY.every((r) => r.basis !== "read")).toBe(true);
  });
});

describe("postureFor", () => {
  it("is open for a host nobody listed, and says why", () => {
    const verdict = postureFor("some-lab.university.example.org");
    expect(verdict.posture).toBe("open");
    expect(verdict.record).toBeNull();
    expect(verdict.reason).toBe(UNLISTED_NOTE);
  });

  it("applies a suffix row to a subdomain", () => {
    expect(postureFor("uk.linkedin.com").posture).toBe("handoff");
    expect(postureFor("www.linkedin.com").posture).toBe("handoff");
  });

  it("does not apply an exact row to a subdomain", () => {
    expect(postureFor("mirror.web.archive.org").posture).toBe("open");
    expect(postureFor("web.archive.org").posture).toBe("refused");
  });

  it("takes the most restrictive of several matches, not the most specific", () => {
    const registry: SourceRecord[] = [
      {
        host: "example.org",
        suffix: true,
        posture: "refused",
        basis: "assumed",
        note: `${ASSUMED_PREFIX} refused at the domain, for a reason that does not stop being true one label down.`,
        termsReadOn: null,
      },
      {
        host: "people.example.org",
        suffix: false,
        posture: "open",
        basis: "assumed",
        note: `${ASSUMED_PREFIX} a permissive row written on a subdomain, which must not lift the refusal above it.`,
        termsReadOn: null,
      },
    ];
    expect(postureFor("people.example.org", registry).posture).toBe("refused");
  });

  it("refuses every address the same archive answers on", () => {
    // A registry that names one of a service's addresses and not the others
    // refuses nothing: the unlisted alias is an open door to the same copy.
    for (const host of [
      "archive.ph",
      "archive.today",
      "archive.is",
      "archive.li",
      "archive.vn",
      "archive.fo",
      "www.archive.today",
    ]) {
      expect(postureFor(host).posture).toBe("refused");
    }
  });

  it("refuses the copies as well as the walls", () => {
    expect(postureFor("web.archive.org").posture).toBe("refused");
    expect(postureFor("r.jina.ai").posture).toBe("refused");
    expect(postureFor("anything.translate.goog").posture).toBe("refused");
  });
});
