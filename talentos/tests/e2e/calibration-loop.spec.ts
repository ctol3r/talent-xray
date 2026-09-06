import { expect, test, type Page } from "@playwright/test";
import {
  openReviewFixture,
  saveAndAcceptRelationship,
} from "./helpers/review-fixture";

/**
 * Wave B: an accepted CV↔JD connection reshapes the String Lab vocabulary
 * with a visible reason, a later dismissal makes the strings stale, and a
 * regenerate applies the change. Mock model provider; no network.
 */
function moduleNav(page: Page, label: string) {
  return page.getByTestId("workspace-nav").getByRole("link", { name: label });
}

test("accepted evidence calibrates the strings and shows why", async ({
  page,
}) => {
  const { project } = await openReviewFixture(page);
  await saveAndAcceptRelationship(page, "relevant");

  await page.goto(`/searches/${project}/strings`);
  await page.click('button:has-text("Generate strings")');
  await expect(page.getByText("site:linkedin.com/in").first()).toBeVisible({
    timeout: 30_000,
  });
  const panel = page.getByText("Calibration from 1 reviewed connection");
  await expect(panel).toBeVisible();
  await expect(
    page.getByText("Build reliable Python services. · 1 accepted").first(),
  ).toBeVisible();
  await expect(
    page
      .locator("code", { hasText: '"Built reliable Python services"' })
      .first(),
  ).toBeVisible();
  const provenance = page.getByTestId("term-provenance").first();
  await expect(provenance).toContainText("Recruiter");
  await expect(provenance).toContainText("Added from accepted evidence");
  await expect(provenance).toContainText(
    "1 accepted anchor across 1 candidate",
  );

  // Dismiss the link, come back: stale notice, then regenerate applies it.
  await moduleNav(page, "Candidates").click();
  await page
    .getByRole("link", { name: "Review Review Fixture · CV ↔ JD", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open current comparison", exact: true })
    .click();
  await page.locator(".review-jd mark").first().click();
  await page.getByRole("button", { name: "F · Dismiss", exact: true }).click();
  await expect(page.locator(".review-context")).toContainText(
    "relevant · dismissed",
  );

  await page.goto(`/searches/${project}/strings`);
  await expect(
    page.getByText(/changed since these strings were generated/),
  ).toBeVisible();
  await page.click('button:has-text("Regenerate strings")');
  await expect(
    page.getByText(/changed since these strings were generated/),
  ).toHaveCount(0, { timeout: 30_000 });
  await expect(
    page.getByText("Calibration from 1 reviewed connection"),
  ).toBeVisible();
  // Regenerate adds rows and never deletes earlier ones: the rows generated
  // from the accepted decision stay, marked stale; the new rows carry no
  // decision because the only accepted anchor was dismissed.
  await expect(page.getByTestId("term-provenance")).toHaveCount(0);
  expect(
    await page.getByTestId("term-provenance-stale").count(),
  ).toBeGreaterThan(0);
});
