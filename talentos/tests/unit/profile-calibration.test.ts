/**
 * The calibration question's rules.
 *
 * Most of these are refusals, because the feature is mostly a refusal: it
 * asks one question, it does not answer it, and it changes the profile and
 * nothing else. The tests that would fail if somebody "improved" it into a
 * recommender are the point of the file.
 */
import { describe, expect, it } from "vitest";
import {
  applyChange,
  askCalibration,
  CalibrationRefused,
  changeSays,
  criteriaList,
  describeChange,
  lastAnsweredAt,
  REJECTIONS_BEFORE_ASKING,
  RELAXES_TO,
  type ProfileCriteria,
  type ProfileRevision,
  type Rejection,
} from "../../artifact-src/core/profile-calibration";

const profile = (): ProfileCriteria => ({
  mustHave: [
    {
      id: "CRIT-STAFF",
      text: "Current Staff Engineer title",
      tier: "mustHave",
    },
    { id: "CRIT-GO", text: "Professional Go experience", tier: "mustHave" },
  ],
  preferred: [
    { id: "CRIT-AI", text: "AI infrastructure experience", tier: "preferred" },
  ],
  trainable: [{ id: "CRIT-K8S", text: "Kubernetes", tier: "trainable" }],
});

const rejection = (n: number, opts: Partial<Rejection> = {}): Rejection => ({
  candidateId: `C${n}`,
  candidateName: `Candidate C${n}`,
  stage: "hm_review",
  stageLabel: "Hiring Manager Review",
  at: `2026-08-0${n}T16:00:00.000Z`,
  note: "I'd prefer someone who has already held Staff.",
  ...opts,
});

const answered = (at: string): ProfileRevision => ({
  at,
  by: "you",
  note: "The title bar was the problem.",
  change: {
    kind: "relaxed",
    criterionId: "CRIT-STAFF",
    text: "Current Staff Engineer title",
    from: "mustHave",
    to: "preferred",
  },
  promptedBy: {
    stage: "hm_review",
    stageLabel: "Hiring Manager Review",
    candidateIds: ["C1", "C2", "C3"],
  },
});

describe("when the question is asked", () => {
  it("stays quiet below the threshold", () => {
    const two = [rejection(1), rejection(2)];
    expect(askCalibration(two, profile(), [])).toBeNull();
  });

  it("asks once the same stage has turned enough people down", () => {
    const three = [rejection(1), rejection(2), rejection(3)];
    const question = askCalibration(three, profile(), []);
    expect(question?.stage).toBe("hm_review");
    expect(question?.rejections).toHaveLength(3);
    expect(question?.asks).toBe("Which requirement was wrong?");
  });

  it("starts at three", () => {
    expect(REJECTIONS_BEFORE_ASKING).toBe(3);
  });

  it("counts per stage, not across the pipeline", () => {
    // Three rejections, but spread over three different stages, is a normal
    // funnel rather than a bar that is set wrong in one place.
    const spread = [
      rejection(1, { stage: "recruiter_screen" }),
      rejection(2, { stage: "hm_review" }),
      rejection(3, { stage: "interviewing" }),
    ];
    expect(askCalibration(spread, profile(), [])).toBeNull();
  });

  it("says the count as counts, never as a percentage", () => {
    const question = askCalibration(
      [rejection(1), rejection(2), rejection(3), rejection(4)],
      profile(),
      [],
    );
    expect(question?.says).toContain("4 people");
    expect(question?.says).not.toMatch(/%/);
  });

  it("asks nothing of a job with no compiled profile", () => {
    const empty: ProfileCriteria = {
      mustHave: [],
      preferred: [],
      trainable: [],
    };
    const three = [rejection(1), rejection(2), rejection(3)];
    // Not miscalibrated. Uncompiled, which is a different sentence.
    expect(askCalibration(three, empty, [])).toBeNull();
  });

  it("picks one stage when two qualify, and picks the same one every time", () => {
    const many = [
      rejection(1, { stage: "hm_review" }),
      rejection(2, { stage: "hm_review" }),
      rejection(3, { stage: "hm_review" }),
      rejection(4, { stage: "recruiter_screen" }),
      rejection(5, { stage: "recruiter_screen" }),
      rejection(6, { stage: "recruiter_screen" }),
      rejection(7, { stage: "recruiter_screen" }),
    ];
    const first = askCalibration(many, profile(), []);
    const again = askCalibration([...many].reverse(), profile(), []);
    expect(first?.stage).toBe("recruiter_screen");
    expect(again?.stage).toBe(first?.stage);
  });
});

describe("answering clears it", () => {
  it("goes quiet once an answer covers the rejections that raised it", () => {
    const three = [rejection(1), rejection(2), rejection(3)];
    const history = [answered("2026-08-04T00:00:00.000Z")];
    expect(askCalibration(three, profile(), history)).toBeNull();
  });

  it("asks again after another threshold's worth, not on the very next one", () => {
    const history = [answered("2026-08-04T00:00:00.000Z")];
    const one = [...[1, 2, 3].map((n) => rejection(n)), rejection(5)];
    expect(askCalibration(one, profile(), history)).toBeNull();

    const three = [
      ...[1, 2, 3].map((n) => rejection(n)),
      rejection(5),
      rejection(6),
      rejection(7),
    ];
    expect(askCalibration(three, profile(), history)?.rejections).toHaveLength(
      3,
    );
  });

  it("counts 'the profile is right' as an answer", () => {
    // Otherwise the only way to stop being asked is to change something, and
    // a question that can only be silenced by agreeing with it is not one.
    const affirmed: ProfileRevision = {
      ...answered("2026-08-04T00:00:00.000Z"),
      change: { kind: "affirmed" },
    };
    const three = [rejection(1), rejection(2), rejection(3)];
    expect(askCalibration(three, profile(), [affirmed])).toBeNull();
    expect(applyChange(profile(), { kind: "affirmed" })).toEqual(profile());
  });

  it("reads the latest answer, whatever order the history arrives in", () => {
    expect(
      lastAnsweredAt([
        answered("2026-08-04T00:00:00.000Z"),
        answered("2026-09-01T00:00:00.000Z"),
        answered("2026-08-20T00:00:00.000Z"),
      ]),
    ).toBe("2026-09-01T00:00:00.000Z");
  });
});

describe("it does not answer its own question", () => {
  it("offers every criterion, in the profile's own order, and nominates none", () => {
    // Three of the four notes name the title. Nothing here may notice that.
    const notes = [
      rejection(1, { note: "I don't see the Staff title we asked for." }),
      rejection(2, { note: "I want someone who already operates at Staff." }),
      rejection(3, { note: "I'd prefer someone who has already held Staff." }),
    ];
    const question = askCalibration(notes, profile(), []);
    expect(question?.criteria.map((c) => c.id)).toEqual([
      "CRIT-STAFF",
      "CRIT-GO",
      "CRIT-AI",
      "CRIT-K8S",
    ]);
    // No ranking, no score, no nomination, no default selection.
    const serialised = JSON.stringify(question);
    expect(serialised).not.toMatch(/suggest|likely|probab|rank|score|guess/i);
    expect(Object.keys(question ?? {})).not.toContain("suspect");
  });

  it("hands over the notes verbatim, because that is evidence rather than a guess", () => {
    const question = askCalibration(
      [1, 2, 3].map((n) =>
        rejection(n, { note: `Reason number ${n}, said plainly.` }),
      ),
      profile(),
      [],
    );
    expect(question?.rejections.map((r) => r.note)).toEqual([
      "Reason number 1, said plainly.",
      "Reason number 2, said plainly.",
      "Reason number 3, said plainly.",
    ]);
  });
});

describe("what an answer does to the profile", () => {
  it("relaxes a must-have down one tier, keeping it in the profile", () => {
    const change = describeChange(profile(), {
      kind: "relaxed",
      criterionId: "CRIT-STAFF",
    });
    const after = applyChange(profile(), change);
    expect(after.mustHave.map((c) => c.id)).toEqual(["CRIT-GO"]);
    expect(after.preferred.map((c) => c.id)).toContain("CRIT-STAFF");
    expect(criteriaList(after)).toHaveLength(4);
  });

  it("refuses to relax something already trainable, and says what to do instead", () => {
    expect(() =>
      describeChange(profile(), { kind: "relaxed", criterionId: "CRIT-K8S" }),
    ).toThrow(CalibrationRefused);
    expect(RELAXES_TO.trainable).toBeNull();
  });

  it("drops a criterion out of the profile entirely", () => {
    const change = describeChange(profile(), {
      kind: "dropped",
      criterionId: "CRIT-STAFF",
    });
    const after = applyChange(profile(), change);
    expect(criteriaList(after).map((c) => c.id)).not.toContain("CRIT-STAFF");
  });

  it("rewords one without moving its tier", () => {
    const change = describeChange(profile(), {
      kind: "reworded",
      criterionId: "CRIT-STAFF",
      to: "Has operated at Staff scope, titled or not",
    });
    const after = applyChange(profile(), change);
    expect(after.mustHave.map((c) => c.text)).toContain(
      "Has operated at Staff scope, titled or not",
    );
    expect(after.mustHave).toHaveLength(2);
    // The history keeps what it used to say; that is the point of a history.
    expect(changeSays(change)).toContain("Current Staff Engineer title");
  });

  it("adds one that was missing", () => {
    const after = applyChange(profile(), {
      kind: "added",
      criterionId: "new-1",
      text: "Has shipped a scheduler",
      tier: "preferred",
    });
    expect(after.preferred.map((c) => c.text)).toContain(
      "Has shipped a scheduler",
    );
  });

  it("refuses a duplicate rather than quietly asking for the same thing twice", () => {
    expect(() =>
      applyChange(profile(), {
        kind: "added",
        criterionId: "new-2",
        text: "  professional go experience ",
        tier: "preferred",
      }),
    ).toThrow(CalibrationRefused);
  });

  it("refuses an answer about a criterion the profile no longer holds", () => {
    const dropped = applyChange(profile(), {
      kind: "dropped",
      criterionId: "CRIT-STAFF",
      text: "Current Staff Engineer title",
      from: "mustHave",
    });
    expect(() =>
      describeChange(dropped, { kind: "relaxed", criterionId: "CRIT-STAFF" }),
    ).toThrow(CalibrationRefused);
  });

  it("never mutates what it was given", () => {
    const before = profile();
    const snapshot = JSON.stringify(before);
    applyChange(before, {
      kind: "dropped",
      criterionId: "CRIT-GO",
      text: "Professional Go experience",
      from: "mustHave",
    });
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});
