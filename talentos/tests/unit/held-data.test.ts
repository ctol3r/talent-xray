/**
 * What the notice tells a person is held about them.
 *
 * This used to be a hardcoded sentence promising no email address or phone
 * number was held — true only while the product had nowhere to put one. It
 * now has somewhere, so the sentence is derived from the record.
 *
 * The test that matters is the pair: with nothing held the person is still
 * told exactly what they were told before, and the moment a contact detail
 * exists the notice says so instead of repeating the old promise.
 */
import { describe, expect, it } from "vitest";
import { heldCategories, summariseHeld } from "@/lib/domain/held-data";
import { emptyCandidateProfile } from "@/lib/core/payloads";

const bare = {
  profile: emptyCandidateProfile(),
  addressCount: 0,
  hasResumeText: false,
  hasNotes: false,
};

describe("with only public addresses held", () => {
  it("keeps the promise it used to make, word for word", () => {
    const summary = summariseHeld({ ...bare, addressCount: 3 });
    expect(summary.hasContact).toBe(false);
    expect(summary.sentence).toContain(
      "I hold no email address or phone number for you",
    );
    expect(summary.sentence).toContain("3 web addresses of public pages");
  });
});

describe("the moment a contact detail is held", () => {
  const withEmail = {
    ...bare,
    addressCount: 2,
    profile: {
      ...emptyCandidateProfile(),
      contact: {
        emails: [
          { value: "a@b.example", provenance: "given_by_person" as const },
        ],
        phones: [],
        links: [],
      },
    },
  };

  it("stops claiming none is held", () => {
    const summary = summariseHeld(withEmail);
    expect(summary.hasContact).toBe(true);
    expect(summary.sentence).not.toContain("I hold no email address");
  });

  it("names the category without reprinting the value", () => {
    // Emailing someone their own phone number back is a worse idea than
    // telling them you have one.
    const summary = summariseHeld(withEmail);
    expect(summary.sentence).toContain("email address");
    expect(summary.sentence).not.toContain("a@b.example");
  });

  it("counts rather than lists when there are several", () => {
    const summary = summariseHeld({
      ...bare,
      profile: {
        ...emptyCandidateProfile(),
        contact: {
          emails: [
            { value: "a@b.example", provenance: "typed_by_recruiter" as const },
            {
              value: "c@d.example",
              provenance: "generated_unverified" as const,
            },
          ],
          phones: [
            {
              value: "+44 7700 900000",
              provenance: "given_by_person" as const,
            },
          ],
          links: [],
        },
      },
    });
    expect(summary.sentence).toContain("2 email addresses");
    expect(summary.sentence).toContain("phone number");
  });
});

describe("every other category", () => {
  it("declares work history, a CV and the recruiter's own notes", () => {
    const categories = heldCategories({
      addressCount: 1,
      hasResumeText: true,
      hasNotes: true,
      profile: {
        ...emptyCandidateProfile(),
        experience: [{ title: "Engineer", company: "Acme" }],
      },
    });
    const labels = categories.map((category) => category.label);
    expect(labels).toContain("work history you or a public page stated");
    expect(labels).toContain("a CV or profile text");
    expect(labels).toContain("my own notes about the role fit");
  });

  it("says nothing beyond a name when nothing else is held", () => {
    expect(summariseHeld(bare).sentence).toBe("Nothing yet beyond your name.");
    expect(heldCategories(bare)).toEqual([]);
  });

  it("survives a profile written before contact details existed", () => {
    // Rows predating the field have no `contact` key at all.
    const summary = summariseHeld({
      ...bare,
      addressCount: 1,
      profile: null,
    });
    expect(summary.hasContact).toBe(false);
    // One address reads as one, not as a plural with the count stripped.
    expect(summary.sentence).toContain("Web address of a public page");
  });
});
