import { expect, test } from "@playwright/test";
import { moduleNav } from "./helpers/nav";

/**
 * Putting a job on hold, and closing it.
 *
 * The column has been read by the dashboard since the beginning — every count
 * and the desk's movement curve are computed over open jobs only — and there
 * was no way to change it. So a desk's dashboard was a list of every job it
 * had ever opened, and the one number a recruiter looks at first was wrong by
 * however long they had been using it.
 *
 * The two properties worth holding: closing is one click and reversible, and
 * it removes the job from today's counts without removing the record. A close
 * that deletes is not a close, it is a delete with a friendlier name.
 */
test("a job can be put on hold and closed, and comes back", async ({
  page,
}) => {
  await page.goto("/searches/new");
  await page.fill('input[name="name"]', "E2E — closing time");
  await page.fill('input[name="roleTitle"]', "Staff Engineer");
  await page.selectOption('select[name="industry"]', "ai_research");
  await page.click('button:has-text("Create job")');
  await expect(page).toHaveURL(/\/searches\/[^/]+\/role/);

  await moduleNav(page, "Overview");
  const status = page.getByRole("group", { name: "Job status" });
  await expect(status).toBeVisible();

  // It starts open, and says what that means rather than only colouring a pill.
  await expect(status.getByRole("button", { name: /Open/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByText("Counted on the dashboard")).toBeVisible();

  // On the dashboard, because it is open.
  await page.goto("/");
  await expect(page.getByText("E2E — closing time").first()).toBeVisible();

  await page.goBack();
  await status.getByRole("button", { name: /On hold/ }).click();
  await expect(status.getByRole("button", { name: /On hold/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page.getByText(/out of the counts, still on the list/),
  ).toBeVisible();

  await status.getByRole("button", { name: /Closed/ }).click();
  await expect(status.getByRole("button", { name: /Closed/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // Out of the dashboard, still on the jobs list, with every record intact.
  await page.goto("/");
  await expect(page.getByText("E2E — closing time")).toHaveCount(0);
  await page.goto("/searches");
  await expect(page.getByText("E2E — closing time").first()).toBeVisible();

  // And reversible, which is the difference between closing and deleting.
  await page.getByRole("link", { name: "E2E — closing time" }).first().click();
  await moduleNav(page, "Overview");
  await page
    .getByRole("group", { name: "Job status" })
    .getByRole("button", { name: /Open/ })
    .click();
  await page.goto("/");
  await expect(page.getByText("E2E — closing time").first()).toBeVisible();
});
