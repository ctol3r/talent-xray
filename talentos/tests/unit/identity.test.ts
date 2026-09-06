import { describe, expect, it } from "vitest";
import { findIdentityMatches } from "@/lib/domain/identity";

describe("findIdentityMatches (app port)", () => {
  it("treats a shared profile URL as the only strong signal", () => {
    const out = findIdentityMatches(
      {
        id: "n",
        name: "A. Person",
        profileUrls: ["https://www.linkedin.com/in/a-person/"],
      },
      [
        {
          id: "e",
          name: "Someone Else",
          profileUrls: ["linkedin.com/in/a-person?trk=1"],
        },
      ],
    );
    expect(out).toEqual([
      {
        otherId: "e",
        strength: "same_urls",
        reason: "Same profile URL (linkedin.com/in/a-person).",
      },
    ]);
  });

  it("separates same-org, different-org and unknown-org name matches", () => {
    const existing = [
      { id: "same", name: "Dr Jane Doe", currentCompany: "Acme Inc" },
      { id: "diff", name: "Jane Doe", currentCompany: "Other Ltd" },
      { id: "unknown", name: "jane doe" },
    ];
    const out = findIdentityMatches(
      { id: "n", name: "Jane Doe", currentCompany: "Acme" },
      existing,
    );
    expect(out.map((m) => [m.otherId, m.strength])).toEqual([
      ["same", "same_name_same_org"],
      ["diff", "same_name_different_org"],
      ["unknown", "similar_name"],
    ]);
  });

  it("adds a location strength when organisations are unknown but a location token is shared", () => {
    const out = findIdentityMatches(
      { id: "n", name: "Jane Doe", geography: "Austin, TX" },
      [{ id: "e", name: "Jane Doe", geography: "Austin" }],
    );
    expect(out[0].strength).toBe("same_name_same_location");
  });

  it("flags last-name plus initial as similar, never as a merge", () => {
    const out = findIdentityMatches({ id: "n", name: "J. Doe" }, [
      { id: "e", name: "Jane Doe" },
    ]);
    expect(out[0].strength).toBe("similar_name");
    expect(Object.keys(out[0])).toEqual(["otherId", "strength", "reason"]);
  });
});
