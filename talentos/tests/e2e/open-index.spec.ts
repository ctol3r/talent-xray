import { expect, test } from "@playwright/test";
import { moduleNav } from "./helpers/nav";

/**
 * The open index in the browser.
 *
 * Asserted here because they are the promises a screenshot cannot check:
 * the spec is on screen and editable before anything is called, the exact
 * request URLs are shown, and keeping a row goes through the same explicit
 * save that a link-out row does.
 *
 * Runs against the mock source set, so no public API is called from a test.
 * The switched-off case is a unit test — `searchOpenIndex` with no sources
 * enabled calls nobody — because it needs no browser.
 */
test("the spec is visible and editable, and a kept row becomes a person", async ({
  page,
}) => {
  await page.goto("/searches/new");
  await page.fill('input[name="name"]', "E2E — open index");
  await page.fill('input[name="roleTitle"]', "Research Engineer");
  await page.selectOption('select[name="industry"]', "ai_research");
  await page.getByRole("button", { name: "Create job", exact: true }).click();
  await expect(page).toHaveURL(/\/searches\/[^/]+\/role/);

  await moduleNav(page, "Discover");

  // Derived from the search, with its provenance stated.
  const terms = page.getByRole("textbox").filter({ hasNot: page.locator("x") });
  await expect(
    page.getByText("Open index", { exact: false }).first(),
  ).toBeVisible();
  const termsInput = page
    .locator('input[placeholder="comma separated"]')
    .first();
  await expect(termsInput).toHaveValue(/Research Engineer/);
  await expect(
    page.getByText("no search plan exists yet", { exact: false }),
  ).toBeVisible();
  expect(await terms.count()).toBeGreaterThan(0);

  // Editable before anything is called.
  await termsInput.fill("machine learning");
  await page.getByRole("button", { name: "Search the open index" }).click();

  const results = page.getByTestId("open-index-results");
  await expect(results).toBeVisible({ timeout: 30_000 });

  // What was asked is on screen, not hidden.
  await page.getByText("What was asked", { exact: false }).click();
  await expect(page.getByText("wikidata.org/w/api.php").first()).toBeVisible();

  // Keeping one is explicit and per row.
  await results.getByRole("button", { name: "Keep" }).first().click();
  await expect(results.getByRole("button", { name: "Kept" })).toBeVisible();

  await moduleNav(page, "Candidates");
  await expect(
    page.getByText("[Mock]", { exact: false }).first(),
  ).toBeVisible();
});
