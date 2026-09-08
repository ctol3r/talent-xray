import { expect, test, type Page } from "@playwright/test";

const JOB_DESCRIPTION =
  "We are looking for a Research Scientist to advance empirical machine learning safety research. Research taste matters more than citation counts. Strong Python engineering, distributed training, and open-source research contributions are required. This role is based in San Francisco.";

async function createSearch(page: Page, name: string): Promise<void> {
  await page.goto("/searches/new");
  await page.locator('input[name="name"]').fill(name);
  await page.locator('input[name="roleTitle"]').fill("Research Scientist");
  await page.locator('input[name="companyName"]').fill("E2E Research Lab");
  await page.locator('input[name="geography"]').fill("San Francisco, CA");
  await page.locator('input[name="industry"]').fill("AI safety research");
  await page
    .getByRole("button", { name: "Create search", exact: true })
    .click();
  await expect(page).toHaveURL(/\/searches\/[^/]+\/role$/);
}

async function openStrings(page: Page): Promise<void> {
  await page
    .getByTestId("workspace-nav")
    .getByRole("link", { name: "Strings", exact: true })
    .click();
  await expect(page).toHaveURL(/\/searches\/[^/]+\/strings$/);
}

test("a fresh search can derive a hiring need, plan, and persistent queries through the UI", async ({
  page,
}, testInfo) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await createSearch(page, "E2E — search planning");
  await page.locator('textarea[name="jd"]').fill(JOB_DESCRIPTION);
  await page
    .getByRole("button", { name: "Save job description", exact: true })
    .click();
  await expect(page.locator("summary", { hasText: "Saved" })).toBeVisible();
  await openStrings(page);

  await expect(
    page.getByRole("heading", { name: "Plan the search", exact: true }),
  ).toBeVisible();
  const deriveNeed = page.getByRole("button", {
    name: "Derive hiring need",
    exact: true,
  });
  const composeQueries = page.getByRole("button", {
    name: "Compose from search plan",
    exact: true,
  });
  await expect(deriveNeed).toBeVisible();
  await expect(composeQueries).toHaveCount(0);
  await deriveNeed.click();

  await expect(
    page.getByRole("heading", { name: "Hiring need", exact: true }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByText("[Mock] Staff the Research Scientist seat.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByText(/Review \d+ requirements and open questions/).click();
  await expect(page.getByText("Research taste", { exact: true })).toBeVisible();
  await expect(
    page.getByText("First-author publications at top ML venues", {
      exact: true,
    }),
  ).toBeVisible();
  // The initial interpretation action disappears once requirements exist,
  // so returning to this page cannot silently replace human clarifications.
  await expect(deriveNeed).toHaveCount(0);
  await expect(composeQueries).toHaveCount(0);
  await page
    .getByRole("button", { name: "Derive search plan", exact: true })
    .click();

  const planHeading = page.getByRole("heading", {
    name: "Search plan draft",
    exact: true,
  });
  await expect(planHeading).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByText("[Mock] Core Machine learning research practitioners", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "[Mock] Primary segment plan derived from explicit requirements; open consequential uncertainties noted in intent.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(composeQueries).toBeVisible();
  await composeQueries.click();
  await expect(
    page.getByText(/queries composed from \d+ plan segments?/),
  ).toBeVisible({
    timeout: 30_000,
  });

  const queries = page.locator("code");
  await expect(queries.first()).toBeVisible();
  const savedQueries = await queries.allTextContents();
  expect(savedQueries.length).toBeGreaterThan(0);
  expect(
    savedQueries.some((query) => query.includes("Research Scientist")),
  ).toBe(true);
  expect(savedQueries.some((query) => query.includes("site:"))).toBe(true);

  await page.reload();
  await expect(planHeading).toBeVisible();
  await expect(composeQueries).toBeVisible();
  await expect(deriveNeed).toHaveCount(0);
  await expect(queries).toHaveText(savedQueries);
  await page.screenshot({ path: testInfo.outputPath("search-planning.png") });
  expect(pageErrors).toEqual([]);
});

test("search planning explains the missing JD and links to the job description", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await createSearch(page, "E2E — search planning without a JD");
  const roleUrl = page.url();
  await openStrings(page);

  await expect(
    page.getByText("Save a job description before deriving the hiring need.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Derive hiring need", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Derive search plan", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Compose from search plan", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("link", { name: "Add job description", exact: true })
    .click();
  await expect(page).toHaveURL(roleUrl);
  await expect(page.locator('textarea[name="jd"]')).toBeVisible();
  await expect(page.locator('textarea[name="jd"]')).toHaveValue("");
  expect(pageErrors).toEqual([]);
});
