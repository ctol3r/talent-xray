/**
 * The agreed date: asked at intake, and never faked afterwards.
 *
 * Two rules, and the second one is the one that was actually broken. The
 * first is that intake has to get an answer — a blank date field could mean
 * "no date was agreed" or "nobody typed it", and every pace measure in the
 * product was treating those as the same thing. The second is that wherever
 * the fortnight is still being assumed, the screen says so; a job with no
 * agreed date used to render no start-date row at all, which is the most
 * effective way there is to hide an assumption from the person relying on it.
 */
import { describe, expect, it } from "vitest";
import { intakeSearchProjectInput } from "@/lib/services/search-projects";
import { startDateLine } from "@/lib/domain/job-fields";
import { jobClock } from "../../artifact-src/core/clock";

const BASE = {
  name: "CAIS — Founding Recruiter",
  roleTitle: "Founding Recruiter",
};

describe("intake insists on an answer", () => {
  it("refuses a job created without answering the question", () => {
    expect(intakeSearchProjectInput.safeParse(BASE).success).toBe(false);
  });

  it("accepts an agreed date", () => {
    const result = intakeSearchProjectInput.safeParse({
      ...BASE,
      startDateAgreement: "agreed",
      targetStartDate: "2026-11-02",
    });
    expect(result.success).toBe(true);
  });

  it("accepts 'no date agreed', which is a real answer and not a failure", () => {
    // A manager who has not committed to a date has not committed to one. A
    // form that refused this would be trading a visible assumption for an
    // invented date, which is strictly worse.
    const result = intakeSearchProjectInput.safeParse({
      ...BASE,
      startDateAgreement: "not_agreed",
    });
    expect(result.success).toBe(true);
  });

  it("refuses 'agreed' with no date, which is a claim with nothing behind it", () => {
    const result = intakeSearchProjectInput.safeParse({
      ...BASE,
      startDateAgreement: "agreed",
    });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).toContain("targetStartDate");
  });

  it("refuses a date sitting under an answer that contradicts it", () => {
    const result = intakeSearchProjectInput.safeParse({
      ...BASE,
      startDateAgreement: "not_agreed",
      targetStartDate: "2026-11-02",
    });
    expect(result.success).toBe(false);
  });
});

describe("an assumed date never renders as an agreed one", () => {
  it("shows the date when there is one, and flags nothing", () => {
    const line = startDateLine({
      targetStartDate: "2026-11-02",
      startDateAgreement: "agreed",
    });
    expect(line.text).toBe("2026-11-02");
    expect(line.assumed).toBe(false);
  });

  it("says the fortnight is assumed when the manager agreed no date", () => {
    const line = startDateLine({
      targetStartDate: null,
      startDateAgreement: "not_agreed",
    });
    expect(line.assumed).toBe(true);
    expect(line.text).toContain("No date agreed");
    expect(line.text).toContain("assumed fortnight");
  });

  it("tells 'not agreed' apart from 'never asked'", () => {
    // A job made before the question existed is a different situation from one
    // where somebody answered. Both get the fortnight; only one is an answer.
    const line = startDateLine({ targetStartDate: null });
    expect(line.assumed).toBe(true);
    expect(line.text).toContain("Not recorded");
    expect(line.text).toContain("assumed fortnight");
  });

  it("never returns an empty line, because an omitted row hides the assumption", () => {
    for (const job of [
      { targetStartDate: null },
      { targetStartDate: "", startDateAgreement: "not_agreed" },
      { targetStartDate: "   " },
    ]) {
      expect(startDateLine(job).text.trim()).not.toBe("");
      expect(startDateLine(job).assumed).toBe(true);
    }
  });
});

describe("the clock still says which window it used", () => {
  it("names the assumption when there is no agreed date", () => {
    const clock = jobClock(
      "2026-09-01T00:00:00.000Z",
      null,
      "2026-09-08T00:00:00.000Z",
    );
    expect(clock.agreedDays).toBeNull();
    expect(clock.says).toContain("no start date agreed");
    expect(clock.says).toContain("default fortnight");
  });

  it("names the agreed window when there is one", () => {
    const clock = jobClock(
      "2026-09-01T00:00:00.000Z",
      "2026-11-02",
      "2026-09-08T00:00:00.000Z",
    );
    expect(clock.agreedDays).not.toBeNull();
    expect(clock.says).toContain("agreed");
    expect(clock.says).not.toContain("default fortnight");
  });
});
