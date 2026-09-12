/**
 * Wave H acceptance, part 1: the label rules. One module spells every badge
 * and provenance line, every non-registry non-confirmed badge begins with
 * "unverified", and the bare word "verified" appears nowhere except inside
 * "unverified" and inside the registry badge, which names its registry
 * (product rule 7, D-032).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  day,
  linkTier,
  noticeDueAt,
  noticeStatus,
  platformAccount,
  platformName,
  profileLinkLabel,
  REGISTRY_MATCH_BADGE,
  type ProfileLinkRow,
} from "@/lib/domain/profile-links";

const base: ProfileLinkRow = {
  url: "https://github.com/jrivera-dev",
  createdAt: "2026-09-07T10:00:00.000Z",
};

describe("tiers", () => {
  it("derives a pre-Wave-H row from how it arrived, checking import first", () => {
    // Wave D writes `import:<source>` on its NPI link-out row too, so an
    // imported registry link is imported, not registry-matched.
    expect(
      linkTier({ ...base, addedVia: "import:hireez", sourceType: "registry" }),
    ).toBe("imported");
    expect(linkTier({ ...base, addedVia: "registry_match" })).toBe(
      "registry_match",
    );
    expect(linkTier({ ...base, sourceType: "registry" })).toBe(
      "registry_match",
    );
    expect(linkTier({ ...base, addedVia: "manual" })).toBe("recruiter_added");
    expect(linkTier({ ...base, addedVia: "browser_capture" })).toBe(
      "recruiter_added",
    );
  });

  it("prefers a stored provenance over any derivation", () => {
    expect(
      linkTier({
        ...base,
        addedVia: "import:hireez",
        provenance: "candidate_provided",
      }),
    ).toBe("candidate_provided");
  });
});

describe("labels", () => {
  it("labels a pasted address as unverified and says how it arrived", () => {
    const { badge, provenanceLine, subLines } = profileLinkLabel(
      { ...base, addedVia: "manual", provenance: "recruiter_added" },
      "professional",
    );
    expect(badge).toBe("unverified · recruiter-added");
    expect(provenanceLine).toBe("added by you on 2026-09-07 via paste");
    expect(subLines[0]).toContain("The page was never read or stored");
  });

  it("names the engine a Discover save came from, and never calls it Verified", () => {
    const core = profileLinkLabel(
      { ...base, addedVia: "discover:core", provenance: "recruiter_added" },
      "professional",
    );
    const reach = profileLinkLabel(
      { ...base, addedVia: "discover:reach", provenance: "recruiter_added" },
      "professional",
    );
    expect(core.provenanceLine).toContain("via Discover (Core engine)");
    expect(reach.provenanceLine).toContain("via Discover (Reach engine)");
    expect(reach.provenanceLine).not.toMatch(/\bverified\b/i);
  });

  it("keeps an imported address honest about being third-party", () => {
    const { badge, provenanceLine } = profileLinkLabel(
      { ...base, addedVia: "import:hireEZ export", provenance: "imported" },
      "professional",
    );
    expect(badge).toBe("unverified · imported");
    expect(provenanceLine).toContain("open it and check before relying on it");
  });

  it("says 'declared on GitHub' with the account, the read date and the kept date", () => {
    const { badge, provenanceLine, subLines } = profileLinkLabel(
      {
        ...base,
        url: "https://jrivera.dev",
        addedVia: "profile_api:github",
        provenance: "platform_declared",
        assertedBy: "github:jrivera-dev",
        retrievedAt: "2026-09-07T09:00:00.000Z",
      },
      "unrecognised",
    );
    expect(badge).toContain("unverified · declared on GitHub");
    expect(provenanceLine).toContain("listed by the holder of jrivera-dev");
    expect(provenanceLine).toContain("read from the GitHub API on 2026-09-07");
    expect(provenanceLine).toContain("kept by you on 2026-09-07");
    expect(subLines.some((l) => l.includes("still your judgement"))).toBe(true);
  });

  it("renders a reciprocal claim only when both dates exist, and never hard-codes a platform", () => {
    const withDates = profileLinkLabel(
      {
        ...base,
        provenance: "platform_reciprocal",
        assertedBy: "keybase:jrivera",
        assertedAt: "2026-01-02T00:00:00.000Z",
        retrievedAt: "2026-09-07T00:00:00.000Z",
      },
      "professional",
    );
    expect(withDates.badge).toBe(
      "unverified · reciprocal · Keybase reports a proven back-link",
    );
    expect(withDates.provenanceLine).toContain(
      "Keybase reported on 2026-01-02",
    );

    // No date, no claim: the badge falls back rather than asserting a check
    // that has no time attached to it.
    const without = profileLinkLabel(
      { ...base, provenance: "platform_reciprocal", assertedBy: "keybase:x" },
      "professional",
    );
    expect(without.badge).toBe("unverified · recruiter-added");
  });

  it("never prints 'confirmed' without the date the person confirmed it", () => {
    const noDate = profileLinkLabel(
      { ...base, provenance: "candidate_provided" },
      "professional",
    );
    expect(noDate.badge).toBe("unverified · recruiter-added");
    expect(noDate.badge).not.toContain("confirmed");

    const confirmed = profileLinkLabel(
      {
        ...base,
        provenance: "candidate_provided",
        confirmedAt: "2026-09-08T00:00:00.000Z",
        confirmedVia: "email",
      },
      "professional",
    );
    expect(confirmed.badge).toBe(
      "confirmed by the person (recorded by you) · 2026-09-08 · email",
    );
    expect(confirmed.subLines.some((l) => l.includes("not a licence"))).toBe(
      true,
    );
  });

  it("keeps Wave E's registry badge exactly as it was", () => {
    const { badge } = profileLinkLabel(
      { ...base, provenance: "registry_match", assertedBy: "cms-nppes" },
      "scholarly_registry",
    );
    expect(badge).toBe(REGISTRY_MATCH_BADGE);
    expect(badge).toBe("registry-matched · CMS NPPES");
  });

  it("appends what kind of surface it is when that changes what the link means", () => {
    expect(
      profileLinkLabel(
        { ...base, provenance: "recruiter_added" },
        "personal_life",
      ).badge,
    ).toContain("personal-life surface · link only · never matched");
    expect(
      profileLinkLabel(
        { ...base, provenance: "recruiter_added" },
        "unrecognised",
      ).badge,
    ).toContain("unrecognised surface");
    expect(
      profileLinkLabel(
        { ...base, provenance: "recruiter_added" },
        "professional",
      ).badge,
    ).toBe("unverified · recruiter-added");
  });
});

describe("the word 'verified' never escapes", () => {
  const files = [
    "src/lib/domain/profile-links.ts",
    "src/lib/domain/surface-families.ts",
    "src/components/profile-connections.tsx",
  ];

  it("appears in the label modules only inside 'unverified' or a named registry", () => {
    for (const file of files) {
      const text = fs.readFileSync(path.resolve(file), "utf8");
      const bare = [...text.matchAll(/\bverified\b/gi)].filter((match) => {
        const before = text.slice(Math.max(0, match.index - 3), match.index);
        return !before.endsWith("un");
      });
      expect(`${file} → ${bare.length}`).toBe(`${file} → 0`);
    }
  });

  it("produces no bare 'verified' in any rendered label", () => {
    const rows: ProfileLinkRow[] = [
      { ...base, provenance: "recruiter_added" },
      { ...base, provenance: "imported", addedVia: "import:x" },
      {
        ...base,
        provenance: "candidate_provided",
        confirmedAt: base.createdAt,
        confirmedVia: "call",
      },
      {
        ...base,
        provenance: "platform_declared",
        assertedBy: "github:x",
        retrievedAt: base.createdAt,
      },
      {
        ...base,
        provenance: "platform_reciprocal",
        assertedBy: "keybase:x",
        assertedAt: base.createdAt,
        retrievedAt: base.createdAt,
      },
      { ...base, provenance: "registry_match", assertedBy: "cms-nppes" },
    ];
    for (const row of rows) {
      const { badge, provenanceLine, subLines } = profileLinkLabel(
        row,
        "professional",
      );
      const all = [badge, provenanceLine, ...subLines].join(" ");
      const bare = [...all.matchAll(/\bverified\b/gi)].filter((match) => {
        const before = all.slice(Math.max(0, match.index - 3), match.index);
        return !before.endsWith("un");
      });
      // The registry badge is the one permitted use, and it names CMS NPPES.
      if (row.provenance === "registry_match") {
        expect(all).toContain("registry-matched · CMS NPPES");
      }
      expect(`${row.provenance} → ${bare.length}`).toBe(
        `${row.provenance} → 0`,
      );
    }
  });
});

describe("platform names", () => {
  it("reads the platform and account out of assertedBy", () => {
    expect(platformName("github:octocat")).toBe("GitHub");
    expect(platformName("keybase:jr")).toBe("Keybase");
    expect(platformName(null)).toBe("the platform");
    expect(platformAccount("github:octocat")).toBe("octocat");
    expect(platformAccount("cms-nppes")).toBeNull();
  });
});

describe("the Article 14 clock", () => {
  const created = "2026-09-07T00:00:00.000Z";

  it("falls due one month after the record was made", () => {
    expect(day(noticeDueAt(created))).toBe("2026-10-07");
  });

  it("counts down, then goes overdue, for an unset jurisdiction", () => {
    expect(
      noticeStatus(
        { createdAt: created },
        null,
        new Date("2026-09-20T00:00:00Z"),
      ),
    ).toEqual({ tone: "warn", text: "due 2026-10-07" });
    expect(
      noticeStatus(
        { createdAt: created },
        null,
        new Date("2026-11-01T00:00:00Z"),
      ),
    ).toEqual({ tone: "bad", text: "overdue since 2026-10-07" });
  });

  it("stops once the recruiter records how they discharged it", () => {
    expect(
      noticeStatus(
        {
          createdAt: created,
          noticeResolution: "sent",
          noticeResolvedAt: "2026-09-09T00:00:00.000Z",
        },
        "eu_uk",
        new Date("2026-11-01T00:00:00Z"),
      ),
    ).toEqual({ tone: "ok", text: "sent 2026-09-09" });
    expect(
      noticeStatus(
        {
          createdAt: created,
          noticeResolution: "exempt",
          noticeNote: "no contact details held",
        },
        null,
        new Date("2026-11-01T00:00:00Z"),
      ).text,
    ).toBe("exempt: no contact details held");
  });

  it("hides for the three named US regimes and says which one", () => {
    for (const jurisdiction of ["california", "nyc", "illinois"] as const) {
      expect(
        noticeStatus(
          { createdAt: created },
          jurisdiction,
          new Date("2026-11-01T00:00:00Z"),
        ),
      ).toEqual({
        tone: "neutral",
        text: `Article 14 clock hidden: jurisdiction set to ${jurisdiction}`,
      });
    }
    // "other" is an unknown regime, so it keeps the strictest behaviour.
    expect(
      noticeStatus(
        { createdAt: created },
        "other",
        new Date("2026-11-01T00:00:00Z"),
      ).tone,
    ).toBe("bad");
  });
});
