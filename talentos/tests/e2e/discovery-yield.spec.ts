import { expect, test, type Page } from "@playwright/test";

/**
 * Wave A: yield ledger through the real UI with the mock model provider and
 * the mock discovery provider (watermarked "[Mock]" results on an invalid
 * domain — no network, no real people). A verbatim run credits the stored
 * string; an edited run is recorded but never credited.
 */
const JD = `Research Scientist / Research Engineer
We are hiring a research scientist to work on AI safety: alignment,
interpretability and evaluation of large language models.`;

function moduleNav(page: Page, label: string) {
  return page.getByTestId("workspace-nav").getByRole("link", { name: label });
}

test("discovery runs and explicit saves are credited to the stored string", async ({
  page,
}) => {
  await page.goto("/searches/new");
  await page.fill('input[name="name"]', "E2E — yield ledger");
  await page.fill('input[name="roleTitle"]', "Research Scientist");
  await page.fill('input[name="industry"]', "AI safety research");
  await page.click('button:has-text("Create search")');
  await expect(page).toHaveURL(/\/searches\/[^/]+\/role/);

  await page.fill('textarea[name="jd"]', JD);
  await page.click('button:has-text("Save job description")');
  await expect(page.locator("summary", { hasText: "Saved" })).toBeVisible();

  await moduleNav(page, "Strings").click();
  await page.click('button:has-text("Generate strings")');
  await expect(page.getByText("site:linkedin.com/in").first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(/\d+\/32 words/).first()).toBeVisible();
  await expect(page.getByText("never run").first()).toBeVisible();

  await moduleNav(page, "Discover").click();
  const select = page.locator("select").first();
  await expect(select).toBeVisible();
  const storedQuery = await page.locator("textarea").first().inputValue();
  await page.click('button:has-text("Run search")');
  await expect(page.getByText("[Mock] Result 1 (core)")).toBeVisible({
    timeout: 30_000,
  });
  await page.locator('button:has-text("Save URL")').first().click();
  await expect(page.getByText("saved", { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.locator("select").first()).toContainText("· 1 saved");
  await expect(page.getByText("Yield for this search")).toBeVisible();
  await expect(page.getByText(/1 run · 1 saved/)).toBeVisible();

  // Edited run: recorded, not credited.
  await page.locator("textarea").first().fill(`${storedQuery} extra`);
  await expect(page.getByText("Edited from the stored string")).toBeVisible();
  await page.click('button:has-text("Run search")');
  await expect(page.getByText("[Mock] Result 2 (core)")).toBeVisible({
    timeout: 30_000,
  });
  await page.locator('button:has-text("Save URL")').nth(1).click();
  await expect(page.getByText("saved", { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.locator("select").first()).toContainText("· 1 saved");
  await expect(page.getByText(/2 runs · 2 saved/)).toBeVisible();

  await moduleNav(page, "Strings").click();
  await expect(page.getByText("ran 1× · 1 saved").first()).toBeVisible();
  // No channels were generated in this flow, so the coverage card stays
  // hidden (nothing to cover); critical-path.spec.ts asserts the positive case.
  await expect(page.getByText("Channel coverage")).toHaveCount(0);
});
