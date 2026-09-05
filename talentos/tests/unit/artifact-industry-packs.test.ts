/**
 * Industry packs (spec §7). A pack changes guidance and platform
 * selection. It never adds a requirement, never filters a person, and
 * never claims anything — and Universal is always the fallback.
 */
import { describe, expect, it } from "vitest";
import {
  INDUSTRY_PACKS,
  UNIVERSAL_PACK,
  packById,
  packFor,
  renderPackSection,
  suggestPack,
} from "../../artifact-src/core/industry-packs";
import { contextFromFacts } from "../../artifact-src/core/search-context";
import {
  PLATFORM_CONSTRAINTS,
  tagsFromPlatformNames,
} from "../../artifact-src/core/query-compiler";
import { FRESHNESS_RULES } from "../../artifact-src/core/research";

const NOW = "2026-09-04T00:00:00.000Z";
const ctxFor = (over: Record<string, unknown>) =>
  contextFromFacts({ id: "s", roleTitle: "Role", ...over }, [], NOW);

describe("the registry", () => {
  it("ships the six packs the brief names, with Universal first", () => {
    expect(INDUSTRY_PACKS.map((p) => p.id)).toEqual([
      "universal",
      "healthcare",
      "ai_ml_research",
      "sales",
      "skilled_trades",
      "finance",
    ]);
    expect(INDUSTRY_PACKS[0]).toBe(UNIVERSAL_PACK);
  });

  it("every pack carries themes, evidence notes and cautions, and only known tags and source kinds", () => {
    const tags = new Set(PLATFORM_CONSTRAINTS.map((p) => p.tag));
    for (const pack of INDUSTRY_PACKS) {
      expect(pack.intakeThemes.length, pack.id).toBeGreaterThan(0);
      expect(pack.evidenceNotes.length, pack.id).toBeGreaterThan(0);
      expect(pack.cautions.length, pack.id).toBeGreaterThan(0);
      for (const tag of pack.platformTags) expect(tags).toContain(tag);
      for (const kind of pack.sourceKinds)
        expect(FRESHNESS_RULES[kind]).toBeDefined();
    }
  });

  it("falls back to Universal for an unknown or missing id", () => {
    expect(packById(undefined).id).toBe("universal");
    expect(packById("not_a_pack").id).toBe("universal");
    expect(packFor(ctxFor({})).id).toBe("universal");
    expect(packFor(ctxFor({ selectedIndustryPack: "healthcare" })).id).toBe(
      "healthcare",
    );
  });
});

describe("suggestion, never selection", () => {
  it("suggests healthcare for a clinical brief and says what it matched on", () => {
    const s = suggestPack(
      ctxFor({
        roleTitle: "Staff Nurse, ICU",
        industry: "Healthcare",
        jd: "NMC registration, ICU ward, patient care.",
      }),
    );
    expect(s?.pack.id).toBe("healthcare");
    expect(s?.reason).toMatch(/vocabulary in the brief/);
  });

  it("suggests the research pack for an ML research brief", () => {
    const s = suggestPack(
      ctxFor({
        roleTitle: "Research Scientist",
        jd: "Empirical machine learning safety, NeurIPS, PyTorch.",
      }),
    );
    expect(s?.pack.id).toBe("ai_ml_research");
  });

  it("suggests nothing when the brief says nothing, and never re-suggests the selected pack", () => {
    expect(suggestPack(ctxFor({ roleTitle: "Person", jd: "" }))).toBeNull();
    const clinical = {
      roleTitle: "ICU Nurse",
      jd: "NMC registration, hospital ward, patient.",
    };
    expect(
      suggestPack(ctxFor({ ...clinical, selectedIndustryPack: "healthcare" })),
    ).toBeNull();
  });
});

describe("what a pack actually changes", () => {
  it("the research pack unlocks the scholar and github platforms, which names alone never did", () => {
    const research = packById("ai_ml_research");
    expect(research.platformTags).toContain("research");
    expect(research.platformTags).toContain("engineering");
    // The model returns platform NAMES; those map onto tags now.
    expect(tagsFromPlatformNames(["Google (Scholar/arXiv x-ray)"])).toEqual([
      "research",
    ]);
    expect(
      tagsFromPlatformNames(["github", "LinkedIn (native boolean)"]).sort(),
    ).toEqual(["engineering", "general"]);
    expect(tagsFromPlatformNames(["Some Tool That Does Not Exist"])).toEqual(
      [],
    );
  });

  it("renders a prompt section carrying the cautions verbatim", () => {
    const text = renderPackSection(packById("healthcare"));
    expect(text).toContain("## Industry pack: Healthcare & clinical");
    expect(text).toContain("Field-specific cautions (mandatory)");
    expect(text).toContain("proves enumeration");
    for (const theme of packById("healthcare").intakeThemes) {
      expect(text).toContain(theme);
    }
  });

  it("names its proxies as proxies rather than as requirements", () => {
    const finance = packById("finance").cautions.join(" ");
    expect(finance).toContain("proxy");
    const research = packById("ai_ml_research").cautions.join(" ");
    expect(research).toMatch(/citation counts/i);
    expect(research).toContain("proxy");
  });

  it("carries no field that could act as a protected-characteristic filter", () => {
    const text = JSON.stringify(
      INDUSTRY_PACKS.map((p) => ({ ...p, applies: undefined })),
    );
    for (const banned of [
      '"age"',
      '"gender"',
      '"race"',
      '"religion"',
      "ethnicity",
    ]) {
      expect(text.toLowerCase()).not.toContain(banned);
    }
  });
});
