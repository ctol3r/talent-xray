import { expect, test } from "@playwright/test";

/**
 * Reading a list through one attribute, and working a task list.
 *
 * The grouping lives in the URL, so what is asserted is that a link carrying a
 * grouping opens with it — that is what makes a reading you found useful
 * something you can send to somebody.
 */
test("jobs group by an attribute and sort by priority", async ({ page }) => {
  await page.goto("/searches");
  await expect(page.getByRole("combobox").first()).toBeVisible();

  // Priority is the default: the order you work a list in, not the order
  // things last changed.
  await expect(page.getByLabel(/Sort by/)).toHaveValue("priority");
  await expect(page.getByText(/\d+ jobs/)).toBeVisible();

  await page.getByLabel(/Group by/).selectOption("status");
  await expect(page).toHaveURL(/group=status/);
  await expect(page.getByText(/in \d+ groups/)).toBeVisible();
  await expect(page.getByRole("columnheader", { name: /Open/ })).toBeVisible();

  // Every row survives the grouping: a job with nothing set is still a job.
  await page.getByLabel(/Group by/).selectOption("fte");
  await expect(page).toHaveURL(/group=fte/);
  await expect(
    page.getByRole("columnheader", { name: /Not set/ }),
  ).toBeVisible();

  // And the reading is in the link.
  await page.goto("/searches?group=industry&sort=name");
  await expect(page.getByLabel(/Group by/)).toHaveValue("industry");
  await expect(page.getByLabel(/Sort by/)).toHaveValue("name");
});

test("people group by their job, and priority is named as the job's", async ({
  page,
}) => {
  // A person is needed before there is a list to read: an empty page shows
  // the empty state rather than controls for arranging nothing.
  await page.goto("/searches/new");
  await page.fill('input[name="name"]', "E2E — grouping people");
  await page.fill('input[name="roleTitle"]', "Research Scientist");
  await page.selectOption('select[name="industry"]', "ai_research");
  await page.click('button:has-text("Create job")');
  await expect(page).toHaveURL(/\/searches\/[^/]+\/role/);
  const project = page.url().match(/\/searches\/([^/]+)\//)![1];

  await page.goto(`/searches/${project}/candidates`);
  await page
    .getByRole("button", { name: "Add candidate", exact: true })
    .click();
  await page.fill('input[name="candidateName"]', "Ana Silva");
  await page
    .locator("form")
    .getByRole("button", { name: "Add candidate", exact: true })
    .click();

  await page.goto("/candidates");
  const group = page.getByLabel(/Group by/);
  await expect(group).toBeVisible();
  // A person has no priority of their own, and the label has to say so.
  await expect(page.getByLabel(/Sort by/)).toContainText("job");
  await group.selectOption("stage");
  await expect(page).toHaveURL(/group=stage/);
});

test("a task ticks, stays put struck through, and unticks", async ({
  page,
}) => {
  await page.goto("/tasks");
  await page.getByRole("textbox", { name: "New task" }).fill("E2E — tick me");
  await page.getByRole("button", { name: "Add task" }).click();

  const row = page.getByRole("listitem").filter({ hasText: "E2E — tick me" });
  await expect(row).toBeVisible();
  const box = row.getByRole("checkbox");
  await expect(box).not.toBeChecked();

  await box.check();
  // It stays on the list rather than vanishing, and reads as done.
  await expect(row).toBeVisible();
  await expect(row.locator(".line-through")).toBeVisible();

  await page.reload();
  const again = page.getByRole("listitem").filter({ hasText: "E2E — tick me" });
  await expect(again.getByRole("checkbox")).toBeChecked();

  // And it goes back, which is the whole point of a checkbox over a button.
  await again.getByRole("checkbox").uncheck();
  await page.reload();
  await expect(
    page
      .getByRole("listitem")
      .filter({ hasText: "E2E — tick me" })
      .getByRole("checkbox"),
  ).not.toBeChecked();
});

test("the title bar, the column headings and the group heading all stay put", async ({
  page,
}) => {
  await page.goto("/searches?group=status");
  await expect(page.getByRole("columnheader", { name: /Title/ })).toBeVisible();
  await page.mouse.wheel(0, 1400);
  await page.waitForTimeout(300);

  const box = async (selector: string) => {
    const rect = await page.locator(selector).first().boundingBox();
    if (!rect) throw new Error(`nothing at ${selector}`);
    return {
      top: Math.round(rect.y),
      bottom: Math.round(rect.y + rect.height),
    };
  };

  const bar = await box("h1");
  const column = await box("thead th");
  const group = await box("th[colspan]");

  // All three are still on screen well past the top of the document.
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
  expect(bar.top).toBeGreaterThanOrEqual(0);
  expect(bar.top).toBeLessThan(40);

  // And they stack with no overlap: one pixel too few clips the headings
  // behind the bar, which is the failure this arithmetic exists to avoid.
  expect(column.top).toBeGreaterThanOrEqual(bar.bottom - 1);
  expect(group.top).toBeGreaterThanOrEqual(column.bottom - 1);
  expect(group.top - column.bottom).toBeLessThan(12);
});

test("the movement curve reads each job against its own agreed date", async ({
  page,
}) => {
  await page.goto("/searches");
  const curve = page.getByTestId("movement-curve");
  await expect(curve).toBeVisible();

  // What it is, and — because it rests on an assumption for any job with no
  // agreed date — which jobs it is assuming about.
  await expect(curve).toContainText("Movement");
  await expect(curve).toContainText(/\d+ open/);
  await expect(curve).toContainText("agreed at intake");

  // Never progress, never a grade.
  await expect(curve).not.toContainText(/% complete|on track|healthy/i);

  // And the sort it feeds understands the same date.
  await page.getByLabel(/Sort by/).selectOption("pressure");
  await expect(page).toHaveURL(/sort=pressure/);
  await expect(page.getByLabel(/Sort by/)).toHaveValue("pressure");
});
