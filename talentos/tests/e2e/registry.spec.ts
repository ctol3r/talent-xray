import { expect, test } from "@playwright/test";

/**
 * Wave E: registry-matched identity through the real UI with the mock
 * registry (watermarked fixtures, no network). The card prefills from the
 * candidate, results carry a match strength, one click confirms, the tag
 * and link-out render, a reload persists, and clear removes it.
 */
test("match a clinician to a public registry record by hand", async ({
  page,
}) => {
  await page.goto("/searches/new");
  await page.fill('input[name="name"]', "E2E — registry");
  await page.fill('input[name="roleTitle"]', "Physician");
  await page.click('button:has-text("Create job")');
  await expect(page).toHaveURL(/\/searches\/[^/]+\/role/);
  const project = page.url().match(/searches\/([^/]+)/)![1];

  await page.goto(`/searches/${project}/candidates`);
  await page
    .getByRole("button", { name: "Add candidate", exact: true })
    .click();
  await page.fill('input[name="candidateName"]', "Priya Patel");
  await page.getByLabel("Geography").fill("Austin, TX");
  await page
    .locator("form")
    .getByRole("button", { name: "Add candidate", exact: true })
    .click();
  await page.getByRole("link", { name: "Priya Patel", exact: true }).click();

  await expect(page.getByText("Registry identity")).toBeVisible();
  await expect(page.getByLabel("State")).toHaveValue("TX");
  await expect(page.getByLabel("Last name")).toHaveValue("Patel");
  await page.getByRole("button", { name: "Search NPPES" }).click();
  await expect(page.getByText("[Mock] Family Medicine")).toBeVisible();
  await expect(page.getByText("same name same location")).toBeVisible();
  await page.getByRole("button", { name: "This is them" }).first().click();

  // The badge appears on the registry card and, from Wave H, on the address
  // itself in the profile-connections card. Both are correct; assert each.
  await expect(
    page.getByText("registry-matched · CMS NPPES").first(),
  ).toBeVisible();
  await expect(page.getByText("registry-matched · CMS NPPES")).toHaveCount(2);
  const link = page.getByRole("link", { name: "Open NPI record" });
  await expect(link).toHaveAttribute(
    "href",
    /npiregistry\.cms\.hhs\.gov\/provider-view\/1234567893/,
  );
  await expect(
    page.getByText("An NPI is not proof of licensure"),
  ).toBeVisible();

  await page.reload();
  await expect(
    page.getByText("registry-matched · CMS NPPES").first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear match" }).click();
  // Clearing the match demotes the saved address too: a badge that names a
  // registry must not outlive the record it came from (Wave H).
  await expect(page.getByText("registry-matched · CMS NPPES")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Search NPPES" }),
  ).toBeVisible();
});
