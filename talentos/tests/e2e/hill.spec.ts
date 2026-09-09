import { expect, test } from "@playwright/test";
import { moduleNav } from "./helpers/nav";

/**
 * The hill chart, on a job, the way somebody would actually use it.
 *
 * Two properties matter and neither is about the drawing. Every job has a
 * chart the moment it exists, with nothing to set up — a chart you have to
 * configure is a chart nobody fills in. And a dot only moves because a person
 * moved it: what the app knows about the job never becomes a position, because
 * a position the software fills in is percent-complete wearing a picture.
 */
test("every new job has a hill, and moving a dot is recorded", async ({
  page,
}) => {
  await page.goto("/searches/new");
  await page.fill('input[name="name"]', "E2E — the hill");
  await page.fill('input[name="roleTitle"]', "Research Scientist");
  await page.selectOption('select[name="industry"]', "ai_research");
  await page.click('button:has-text("Create job")');
  await expect(page).toHaveURL(/\/searches\/[^/]+\/role/);

  await moduleNav(page, "Hill");
  await expect(page).toHaveURL(/\/searches\/[^/]+\/hill/);

  // Every scope is there, at the left foot, with nothing configured.
  const dots = page.getByRole("slider");
  await expect(dots).toHaveCount(7);
  await expect(page.getByText("7 of 7 still has unknowns in it")).toBeVisible();
  await expect(
    page.getByText("No recorded signal needs attention"),
  ).toBeVisible();
  await expect(page.getByText("Nothing recorded yet")).toBeVisible();

  // Nothing on the page claims a percentage.
  await expect(page.locator("body")).not.toContainText("% complete");

  // Move one dot with the keyboard, which is also the accessible path.
  const first = dots.first();
  await first.focus();
  await first.press("ArrowRight");
  await first.press("ArrowRight");
  await first.press("ArrowRight");

  await expect(
    page.getByText("still working out what to do").first(),
  ).toBeVisible();

  // And the move is on the trail, with its date, after a reload.
  await page.reload();
  await expect(page.getByText("Nothing recorded yet")).toHaveCount(0);
  await expect(page.getByRole("slider").first()).toHaveAttribute(
    "aria-valuenow",
    /[1-9]/,
  );
});

test("a scope can be split so its halves move independently", async ({
  page,
}) => {
  await page.goto("/searches/new");
  await page.fill('input[name="name"]', "E2E — splitting a scope");
  await page.fill('input[name="roleTitle"]', "Research Scientist");
  await page.selectOption('select[name="industry"]', "ai_research");
  await page.click('button:has-text("Create job")');
  await moduleNav(page, "Hill");

  const before = await page.getByRole("slider").count();
  // The row in the list, not the label on the chart: the chart's labels sit
  // over each other and the row is where the controls are anyway.
  await page
    .getByRole("listitem")
    .filter({ hasText: "What it pays" })
    .first()
    .hover();
  await page.getByRole("button", { name: "split in two" }).first().click();
  await page
    .getByPlaceholder("and the other half")
    .fill("Sign-off on the band");
  await page.getByRole("button", { name: "Split", exact: true }).click();

  await expect(page.getByRole("slider")).toHaveCount(before + 1);
  await expect(page.getByText("Sign-off on the band").first()).toBeVisible();
});
