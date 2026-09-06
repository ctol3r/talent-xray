import { expect, test } from "@playwright/test";
import { HIREEZ_CSV } from "../fixtures/import-fixtures";

/**
 * Wave D: a hireEZ export with a blocked column and a duplicate row goes
 * through preview → commit; candidates carry the import label; the
 * lookalike gets an identity-review task; nothing is merged.
 */
test("import a vendor export with preview, dropped column and identity review", async ({
  page,
}) => {
  await page.goto("/searches/new");
  await page.fill('input[name="name"]', "E2E — import");
  await page.fill('input[name="roleTitle"]', "Engineer");
  await page.click('button:has-text("Create search")');
  await expect(page).toHaveURL(/\/searches\/[^/]+\/role/);
  const project = page.url().match(/searches\/([^/]+)/)![1];

  // An existing candidate the import should flag but never merge.
  await page.goto(`/searches/${project}/candidates`);
  await page
    .getByRole("button", { name: "Add candidate", exact: true })
    .click();
  await page.fill('input[name="candidateName"]', "Ben Sample");
  await page
    .locator("form")
    .getByRole("button", { name: "Add candidate", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Ben Sample", exact: true }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Import candidates" }).click();
  await expect(page).toHaveURL(/candidates\/import$/);
  await page.locator('input[name="file"]').setInputFiles({
    name: "hireez-export.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(HIREEZ_CSV, "utf8"),
  });
  await page.click('button:has-text("Preview import")');
  await expect(
    page.getByText("1 column dropped before mapping: Gender"),
  ).toBeVisible();
  await expect(page.getByTestId("mapping-table")).toContainText("Full Name");
  await expect(page.getByText("skip · same URL already saved")).toBeVisible();
  await expect(page.getByText("identity review").first()).toBeVisible();

  // Untick Cara, import the rest.
  await page.getByRole("checkbox", { name: "Import Cara Fixture" }).uncheck();
  await page.click('button:has-text("Import 2 candidates")');
  await expect(
    page.getByText("2 candidates created · 1 flagged for identity review"),
  ).toBeVisible();

  await page.goto(`/searches/${project}/candidates`);
  await expect(
    page.getByRole("link", { name: "Ada Example", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Ben Sample", exact: true }),
  ).toHaveCount(2);
  await page.getByRole("link", { name: "Ada Example", exact: true }).click();
  await expect(page.getByText("hireEZ export · import:hireez")).toBeVisible();

  await page.goto("/tasks");
  await expect(
    page.getByText(/Identity review: "Ben Sample" may be "Ben Sample"/),
  ).toBeVisible();
});
