import { expect, test, type Page } from "@playwright/test";

/**
 * The seeded SP104 walkthrough through the same forms every search uses.
 * Pins the fixture identities the demo script and docs promise: the W9
 * snapshot id, its HSAL state, the CRIT ids of the post-review profile and
 * LEARN-SP104-001, and that the recruiter's belief stays at 76 % until the
 * explicit revision to 31 %.
 */
const bigNumber = (page: Page) => page.locator("div.text-3xl").first();

test("SP104: seeded values flow through the generic forms unchanged", async ({
  page,
}) => {
  page.on("dialog", (d) => d.accept());
  await page.goto("/searches/SP104/diagnosis");
  await expect(page.getByText("124", { exact: true }).first()).toBeVisible();

  // BELIEVE (pre-filled from the fixture)
  await page
    .getByRole("button", { name: "Record what I think", exact: true })
    .click();
  await expect(bigNumber(page)).toHaveText("76%");
  await expect(page.getByText("B-SP104-SUPPLY").first()).toBeVisible();

  // CHALLENGE → TEST
  await page.getByRole("button", { name: /^(re-)?run diagnosis$/i }).click();
  await expect(
    page.getByText("Success Profile Constraint").first(),
  ).toBeVisible({
    timeout: 60_000,
  });
  await expect(
    page.getByText("Blind Adjacent Profile Review").first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Select test", exact: true }).click();
  await page
    .getByRole("button", { name: /Record result \(seeded: 7\/10 advanced\)/ })
    .click();
  await expect(
    page.getByText("Experiment result", { exact: true }),
  ).toBeVisible();
  await expect(bigNumber(page)).toHaveText("76%");

  // ACT: the pre-filled post-review profile keeps its fixture ids
  await page
    .getByRole("button", { name: "Apply profile change", exact: true })
    .click();
  await expect(
    page.getByText("Success Profile changed by you").first(),
  ).toBeVisible();
  await expect(
    page.getByText(
      /Must-have removed: Professional Go experience; Current Staff Engineer title/,
    ),
  ).toBeVisible();
  await expect(
    page.getByText(/Now transferable: Go \/ Rust \/ C\+\+ \/ Java/),
  ).toBeVisible();

  // OBSERVE AGAIN: the seeded W9 snapshot keeps its id and becomes state S-PIPE-SP104-W9
  await page
    .getByRole("button", { name: "Record pipeline and compare", exact: true })
    .click();
  await expect(page.getByText(/^Trajectory /).first()).toBeVisible();
  await expect(
    page.getByText(/Recorded in HSAL as state S-PIPE-SP104-W9/),
  ).toBeVisible();
  await expect(page.getByText(/Hires: 0 → 1/).first()).toBeVisible();
  await expect(bigNumber(page)).toHaveText("76%");

  // REVISE (pre-filled 31 % + reason), then the new belief at 82 %
  await page
    .getByRole("button", { name: "Revise my confidence", exact: true })
    .click();
  await expect(page.getByText(/Revised to/)).toContainText("31%");
  await page.getByRole("button", { name: /^Add belief:/ }).click();
  await expect(page.getByText("B-SP104-PROFILE").first()).toBeVisible();
  await expect(page.getByText("82%", { exact: true }).first()).toBeVisible();

  // LEARN (pre-filled) keeps LEARN-SP104-001
  await page
    .getByRole("button", { name: "Save learning", exact: true })
    .click();
  await expect(
    page.getByText(
      "Avoid stack/title overconstraint in distributed-systems searches",
    ),
  ).toBeVisible();
  await expect(page.getByText(/LEARN-SP104-001/).first()).toBeVisible();
});
