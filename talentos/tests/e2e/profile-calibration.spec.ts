import { expect, test } from "@playwright/test";
import { moduleNav } from "./helpers/nav";

/**
 * The calibration loop, driven the way a recruiter would drive it.
 *
 * Three people are turned down at the same stage, the hill asks which
 * requirement was wrong, the recruiter answers, and the answer is on the
 * success profile's history with the people who prompted it.
 *
 * The property worth protecting is the one in the middle: the app asks the
 * question and does not answer it. Nothing on the card nominates a
 * requirement, however plainly the three notes point at one.
 */
test("three rejections at one stage raise one question, and the answer lands on the profile", async ({
  page,
}) => {
  test.slow();

  await page.goto("/searches/new");
  await page.fill('input[name="name"]', "E2E — calibrating the profile");
  await page.fill('input[name="roleTitle"]', "Staff Software Engineer");
  await page.selectOption('select[name="industry"]', "ai_research");
  await page.click('button:has-text("Create job")');
  await expect(page).toHaveURL(/\/searches\/[^/]+\/role/);
  const jobId = new URL(page.url()).pathname.split("/")[2];

  // A profile to have been wrong about.
  await moduleNav(page, "Profile");
  await page.click('button:has-text("Compile success profile")');
  await expect(page.getByText("Must have").first()).toBeVisible({
    timeout: 60_000,
  });

  // Nothing is asked yet, and the history says so plainly.
  await expect(page.getByText("Nothing recorded yet.")).toBeVisible();

  const notes = [
    "I don't see the Staff title we asked for.",
    "I want someone who already operates formally at Staff.",
    "I'd prefer someone who has already held Staff.",
  ];
  for (const [index, note] of notes.entries()) {
    await page.goto(`/searches/${jobId}/candidates`);
    await page.fill('input[name="candidateName"]', `E2E person ${index + 1}`);
    await page.click('button:has-text("Add candidate")');
    await page
      .getByRole("link", { name: `E2E person ${index + 1}`, exact: true })
      .click();
    await expect(page).toHaveURL(/\/candidates\/[^/]+$/);

    await page.selectOption('select[title^="Move stage"]', "hm_review");
    await page.getByRole("button", { name: "pass", exact: true }).click();
    await page.fill("textarea[placeholder^='The evidence behind']", note);
    await page.click('button:has-text("Record HM feedback")');
    await expect(page.getByText(note)).toBeVisible();
    await page.selectOption('select[aria-label="Disposition"]', "not_selected");
    await expect(page.locator('select[aria-label="Disposition"]')).toHaveValue(
      "not_selected",
    );
  }

  // The question is on the hill, with all three notes, and no nomination.
  await page.goto(`/searches/${jobId}/hill`);
  await expect(page.getByText("One question")).toBeVisible();
  await expect(
    page.getByText("3 people turned down at Hiring Manager Review"),
  ).toBeVisible();
  await expect(page.getByText("Which requirement was wrong?")).toBeVisible();
  for (const note of notes) await expect(page.getByText(note)).toBeVisible();

  // Nothing preselected: the recruiter makes the join, not the software.
  const choice = page.getByLabel("Which requirement");
  await expect(choice).toHaveValue("");

  // And the chart itself has not been touched by any of this.
  await expect(page.getByText("Nothing recorded yet")).toBeVisible();

  const options = await choice.locator("option").allTextContents();
  const target = options.find((text) => text.includes("(must have)"));
  expect(target).toBeTruthy();
  await choice.selectOption({ label: target as string });
  await page.fill(
    "textarea[placeholder^='Why, in your own words']",
    "Every pass named the title. The scope is the requirement; the title is not.",
  );
  await page.click('button:has-text("Record the answer")');

  // Answered, so the question goes quiet.
  await expect(page.getByText("Which requirement was wrong?")).toHaveCount(0, {
    timeout: 20_000,
  });

  // And the profile now carries the revision, with what prompted it.
  await page.goto(`/searches/${jobId}/profile`);
  await expect(page.getByText("Nothing recorded yet.")).toHaveCount(0);
  await expect(
    page.getByText("moved from must have to preferred"),
  ).toBeVisible();
  await expect(page.getByText("The scope is the requirement")).toBeVisible();
  await expect(
    page.getByText(/after E2E person 1, E2E person 2, E2E person 3/),
  ).toBeVisible();
});
