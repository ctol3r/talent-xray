import { expect, test } from "@playwright/test";
import { moduleNav } from "./helpers/nav";

/**
 * The phase row reports; it does not navigate.
 *
 * It used to be four links that went where the module row already went —
 * Understand and Overview were one URL, and the other three were shortcuts to
 * the first tab of their group. Now it names the phase the job is in, read off
 * the hill, and the module row is the only thing on the page you can click.
 *
 * Both halves are asserted here because both are invisible in a screenshot: a
 * row that quietly became links again would look identical, and so would a row
 * whose reading never changed.
 */
test("the phase row says where the job is, and cannot be clicked", async ({
  page,
}) => {
  await page.goto("/searches/new");
  await page.fill('input[name="name"]', "E2E — the phase row");
  await page.fill('input[name="roleTitle"]', "Research Scientist");
  await page.selectOption('select[name="industry"]', "ai_research");
  await page.selectOption('select[name="startDateAgreement"]', "not_agreed");
  await page.click('button:has-text("Create job")');
  await expect(page).toHaveURL(/\/searches\/[^/]+\/role/);

  const nav = page.getByTestId("workspace-nav");
  const phases = ["understand", "find", "engage", "decide"];

  // All four names are still here, and not one of them is a link or a button.
  // Keeping the names was the point; keeping the second set of destinations
  // was not.
  for (const id of phases) {
    const row = nav.getByTestId(`phase-${id}`);
    await expect(row).toBeVisible();
    await expect(row.locator("a, button")).toHaveCount(0);
  }

  // A job with an untouched chart says so, rather than implying a reading it
  // does not have.
  await expect(nav).toContainText("Where the job is: not recorded yet");
  await expect(nav.getByTestId("phase-understand")).toHaveAttribute(
    "aria-current",
    "step",
  );

  // Every module is reachable from the one clickable row, including the three
  // groups the phase links used to be the way into.
  for (const label of ["Strategy", "Candidates", "Hill", "Analytics"]) {
    await expect(
      nav.getByRole("link", { name: label, exact: true }),
    ).toBeVisible();
  }

  // Move the first scope — "What the job is", which belongs to Understand —
  // and the row stops saying nothing has moved and starts naming it.
  await moduleNav(page, "Hill");
  const first = page.getByRole("slider").first();
  await first.focus();
  await first.press("ArrowRight");
  await first.press("ArrowRight");
  await first.press("ArrowRight");
  await page.reload();

  await expect(nav).toContainText("Where the job is: Understand");
  await expect(nav).toContainText("What the job is");
  await expect(nav).not.toContainText("not recorded yet");
});
