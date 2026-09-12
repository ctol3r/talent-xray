import { describe, expect, it } from "vitest";
import { diagnosePipeline } from "@/lib/domain/diagnosis";

const healthy = {
  identified: 40,
  contacted: 30,
  responded: 12,
  screens: 8,
  hmApprovals: 6,
  interviews: 5,
  finals: 3,
  offers: 2,
  accepts: 2,
};

describe("diagnosePipeline", () => {
  it("finds nothing wrong with a healthy funnel", () => {
    expect(diagnosePipeline(healthy).findings).toEqual([]);
  });

  it("diagnoses high outreach / low response with experiments", () => {
    const { findings } = diagnosePipeline({
      ...healthy,
      contacted: 40,
      responded: 2,
    });
    const finding = findings.find((f) => f.id === "low_response");
    expect(finding).toBeDefined();
    expect(finding?.possibleCauses.length).toBeGreaterThan(2);
    expect(finding?.experiments.length).toBeGreaterThan(2);
  });

  it("diagnoses screen-passes-but-HM-rejects", () => {
    const { findings } = diagnosePipeline({
      ...healthy,
      screens: 10,
      hmApprovals: 2,
    });
    expect(findings.some((f) => f.id === "hm_rejection")).toBe(true);
  });

  it("diagnoses offer declines", () => {
    const { findings } = diagnosePipeline({
      ...healthy,
      offers: 4,
      accepts: 1,
    });
    expect(findings.some((f) => f.id === "offer_declines")).toBe(true);
  });

  it("refuses to extrapolate from tiny samples and says so", () => {
    const { findings, insufficientData } = diagnosePipeline({
      identified: 3,
      contacted: 3,
      responded: 0,
      screens: 1,
      hmApprovals: 0,
      interviews: 0,
      finals: 0,
      offers: 1,
      accepts: 0,
    });
    expect(findings.find((f) => f.id === "low_response")).toBeUndefined();
    expect(findings.find((f) => f.id === "hm_rejection")).toBeUndefined();
    expect(insufficientData.length).toBeGreaterThanOrEqual(3);
  });
});
