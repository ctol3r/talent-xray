/**
 * Sourcing angles. Every angle is a claim about where passive people are
 * written up, so these assertions pin the shape of the queries and the
 * promise that a reason is always attached.
 */
import { describe, expect, it } from "vitest";
import {
  ANGLES,
  angleApplies,
  angleByName,
  INDUSTRY_HINTS,
  industryTerms,
  planAngles,
  renderAngle,
} from "@/lib/sourcing/angles";
import { parseQuery } from "@/lib/sourcing/query-language";

describe("the angle library", () => {
  it("covers the sourcing surfaces a recruiter works by hand", () => {
    const names = ANGLES.map((a) => a.name);
    for (const expected of [
      "cv_pdf",
      "academic_cv",
      "personal_site_bio",
      "portfolio",
      "team_page",
      "staff_directory",
      "conference_speaker",
      "award_list",
      "professional_body",
      "patent_inventor",
      "press_expert",
      "podcast_guest",
      "job_change",
      "people_dataset",
      "grant_register",
      "alumni_list",
      "publication_author",
      "thesis",
      "repo_owner",
      "contact_route",
    ]) {
      expect(names).toContain(expected);
    }
  });

  it("gives every angle a stated reason it finds people who are not looking", () => {
    for (const angle of ANGLES) {
      expect(angle.rationale.length).toBeGreaterThan(40);
      expect(angle.label.length).toBeGreaterThan(5);
    }
  });

  it("is industry-neutral until the brief names an industry", () => {
    const brief = parseQuery("skill:robotics");
    expect(industryTerms(brief)).toEqual([]);
    const medical = parseQuery("skill:robotics industry:healthcare");
    expect(industryTerms(medical)).toEqual([...INDUSTRY_HINTS.healthcare]);
  });
});

describe("renderAngle", () => {
  it("fills the pattern from the brief and keeps the angle's negatives", () => {
    const brief = parseQuery("skill:robotics");
    const query = renderAngle(angleByName("cv_pdf")!, brief);
    expect(query).toContain("robotics");
    expect(query).toContain('"curriculum vitae"');
    expect(query).toContain("filetype:pdf");
    expect(query).toContain("-template");
    expect(query).toContain("-site:indeed.com");
  });

  it("lets the brief's own operators win over the angle's defaults", () => {
    const brief = parseQuery("skill:robotics filetype:docx");
    const query = renderAngle(angleByName("cv_doc")!, brief);
    expect(query).toContain("filetype:docx");
    expect(query).not.toContain("filetype:pdf");
  });

  it("appends the brief's site and negation operators", () => {
    const brief = parseQuery(
      "skill:robotics -site:linkedin.com -recruiter site:ac.uk",
    );
    const query = renderAngle(angleByName("team_page")!, brief);
    expect(query).toContain("site:ac.uk");
    expect(query).toContain("-site:linkedin.com");
    expect(query).toContain("-recruiter");
  });

  it("adds adjacent capabilities only when asked", () => {
    const brief = parseQuery("skill:robotics");
    const narrow = renderAngle(angleByName("cv_pdf")!, brief);
    const wide = renderAngle(angleByName("cv_pdf")!, brief, {
      includeAdjacent: true,
    });
    expect(wide.length).toBeGreaterThan(narrow.length);
    expect(wide).toContain("Autonomous Systems");
  });

  it("carries a location into every angle that does not name one", () => {
    const brief = parseQuery('skill:robotics loc:"united kingdom"');
    expect(renderAngle(angleByName("award_list")!, brief)).toContain(
      '"united kingdom"',
    );
  });
});

describe("planAngles", () => {
  it("refuses to render bare operators when there is nothing to search for", () => {
    expect(planAngles(parseQuery("has:email"))).toEqual([]);
    expect(planAngles(parseQuery(""))).toEqual([]);
  });

  it("orders by weight, densest source first", () => {
    const planned = planAngles(parseQuery("skill:robotics"));
    const weights = planned.map((p) => p.angle.weight);
    expect([...weights].sort((a, b) => b - a)).toEqual(weights);
    expect(planned[0].angle.name).toBe("cv_pdf");
  });

  it("only runs the contact angle when the brief asks for contact routes", () => {
    expect(
      planAngles(parseQuery("skill:robotics")).map((p) => p.angle.name),
    ).not.toContain("contact_route");
    expect(
      planAngles(parseQuery("skill:robotics has:email")).map(
        (p) => p.angle.name,
      ),
    ).toContain("contact_route");
  });

  it("mutes angles that target other formats when the brief pins one", () => {
    const names = planAngles(parseQuery("skill:robotics filetype:csv")).map(
      (p) => p.angle.name,
    );
    expect(names).toContain("people_dataset");
    expect(names).not.toContain("cv_pdf");
  });

  it("narrows to the artifact type the brief names", () => {
    const brief = parseQuery("skill:robotics artifact:patent");
    expect(angleApplies(angleByName("patent_inventor")!, brief)).toBe(true);
    expect(angleApplies(angleByName("team_page")!, brief)).toBe(false);
  });
});
