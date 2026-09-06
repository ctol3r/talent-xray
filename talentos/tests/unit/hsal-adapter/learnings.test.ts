import { describe, expect, it } from "vitest";
import {
  InMemoryLearningStore,
  rankLearnings,
  searchLearningSchema,
} from "@talentos/hsal-adapter";
import { sp104Learning } from "../../../fixtures/sp104";

describe("search learning", () => {
  const learning = sp104Learning({
    evidenceIds: ["E-EXP-SP104-BLIND-1-1"],
    originatingBeliefIds: ["B-SP104-SUPPLY", "B-SP104-PROFILE"],
    originatingModelIds: ["M-SP104-PROFILE"],
  });

  it("validates and references HSAL ids rather than copying the graph", () => {
    expect(searchLearningSchema.safeParse(learning).success).toBe(true);
    expect(learning.originatingBeliefIds).toContain("B-SP104-SUPPLY");
    expect(learning.originatingModelIds).toEqual(["M-SP104-PROFILE"]);
    expect(Object.keys(learning)).not.toContain("models");
  });

  it("persists in a store and is retrievable by role family / seniority", async () => {
    const store = new InMemoryLearningStore();
    await store.save(learning);
    const all = await store.list();
    expect(
      rankLearnings(all, {
        roleFamily: "Distributed Systems",
        seniority: "staff",
      })[0]?.id,
    ).toBe("LEARN-SP104-001");
    expect(
      rankLearnings(all, { roleFamily: "infrastructure engineering" }),
    ).toHaveLength(1);
    expect(
      rankLearnings(all, { roleFamily: "sales", seniority: "junior" }),
    ).toHaveLength(0);
  });
});
