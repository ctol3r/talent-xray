import { expect, test } from "@playwright/test";
import { moduleNav } from "./helpers/nav";

/**
 * Live preview on hover.
 *
 * The first version only wrapped written page references, so two links on a
 * page of seventy-four did anything and the feature was effectively
 * invisible. What is asserted here is coverage as much as behaviour: the
 * links a recruiter actually hovers — a job in the sidebar, a person in a
 * list — show a card, and that card says something specific enough to
 * decide with.
 */
test("hovering a job in the sidebar previews it without opening it", async ({
  page,
}) => {
  await page.goto("/searches/new");
  await page.fill('input[name="name"]', "E2E — preview job");
  await page.fill('input[name="roleTitle"]', "Staff Engineer");
  await page.fill('input[name="geography"]', "Berlin");
  await page.getByRole("button", { name: "Create job", exact: true }).click();
  await expect(page).toHaveURL(/\/searches\/[^/]+\/role/);
  const jobUrl = page.url();

  const sidebarLink = page
    .locator('aside [data-preview-target^="job:"]')
    .filter({ hasText: "E2E — preview job" })
    .first();
  await sidebarLink.hover();

  const card = page.getByTestId("page-preview");
  await expect(card).toBeVisible();
  await expect(card).toContainText("E2E — preview job");
  // Specific enough to decide with: the role, the place, the headcount.
  await expect(card).toContainText("Staff Engineer");
  await expect(card).toContainText("Berlin");

  // A preview is not a navigation: the page has not moved.
  expect(page.url()).toBe(jobUrl);

  // It goes away again.
  await page.getByRole("heading", { level: 1 }).first().hover();
  await expect(card).toHaveCount(0);
});

test("hovering a person previews the person, not the job", async ({ page }) => {
  await page.goto("/searches/new");
  await page.fill('input[name="name"]', "E2E — preview people");
  await page.fill('input[name="roleTitle"]', "Engineer");
  await page.getByRole("button", { name: "Create job", exact: true }).click();
  await expect(page).toHaveURL(/\/searches\/[^/]+\/role/);

  await moduleNav(page, "Candidates");
  await page.click('button:has-text("Add candidate")');
  await page.fill('input[name="candidateName"]', "Priya Raman");
  await page.click('form button:has-text("Add candidate")');

  await page.goto("/candidates");
  await page
    .locator('[data-preview-target^="candidate:"]')
    .filter({ hasText: "Priya Raman" })
    .first()
    .hover();

  const card = page.getByTestId("page-preview");
  await expect(card).toBeVisible();
  await expect(card).toContainText("Priya Raman");
  await expect(card).toContainText("E2E — preview people");
  await expect(card).toContainText("Scorecards: 0 submitted · 0 draft");
  await expect(card).toContainText("Pipeline: 0 recorded moves");

  const personLink = page
    .locator('[data-preview-target^="candidate:"]')
    .filter({ hasText: "Priya Raman" })
    .first();
  const href = await personLink.getAttribute("href");
  const editor = await page.context().newPage();
  await editor.goto(href!);
  await editor
    .getByLabel("Next action", { exact: true })
    .fill("Ask candidate to confirm interview availability");
  const save = editor
    .getByLabel("Next action", { exact: true })
    .locator("xpath=ancestor::form")
    .getByRole("button", { name: "Save", exact: true });
  const saved = editor.waitForResponse(
    (response) => response.request().method() === "POST" && response.ok(),
  );
  await save.click();
  await saved;
  await editor.close();
  await page.getByRole("heading", { level: 1 }).first().hover();
  await expect(card).toHaveCount(0);
  await personLink.hover();
  await expect(card).toContainText(
    "Ask candidate to confirm interview availability",
  );
});
