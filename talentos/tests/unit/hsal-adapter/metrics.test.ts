import { describe, expect, it } from "vitest";
import { computePipelineMetrics, largestDrop } from "@talentos/hsal-adapter";
import { sp104 } from "../../../fixtures/sp104";

describe("pipeline metrics", () => {
  it("derives SP104 baseline conversion rates", () => {
    const m = computePipelineMetrics(sp104.pipelineW6.counts);
    expect(m.outreachReplyRate).toBeCloseTo(0.144, 3);
    expect(m.positiveReplyRate).toBeCloseTo(0.076, 3);
    expect(m.recruiterScreenToHMRate).toBeCloseTo(0.667, 3);
    expect(m.hmToOnsiteRate).toBeCloseTo(0.25, 3);
    expect(m.onsiteToOfferRate).toBe(0);
    expect(m.offerToHireRate).toBeUndefined();
  });

  it("finds the largest observed drop at HM screen → onsite", () => {
    const d = largestDrop(sp104.pipelineW6.counts);
    expect(d?.from).toBe("hm_screen");
    expect(d?.to).toBe("onsite");
    expect(d?.label).toBe("HM SCREENS → ONSITES");
  });

  it("returns undefined rates for empty funnels rather than zero", () => {
    const m = computePipelineMetrics({
      sourced: 0,
      outreach_sent: 0,
      reply: 0,
      positive_reply: 0,
      recruiter_screen: 0,
      hm_screen: 0,
      onsite: 0,
      offer: 0,
      hire: 0,
    });
    expect(m.outreachReplyRate).toBeUndefined();
    expect(
      largestDrop({
        sourced: 0,
        outreach_sent: 0,
        reply: 0,
        positive_reply: 0,
        recruiter_screen: 0,
        hm_screen: 0,
        onsite: 0,
        offer: 0,
        hire: 0,
      }),
    ).toBeUndefined();
  });
});
