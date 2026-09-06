import { expect, test } from "@playwright/test";

test("browser companion reviews fragment input, saves once, survives reload and leaves candidate stage unchanged", async ({
  page,
}) => {
  await page.goto("/searches/new");
  await page.fill('input[name="name"]', "Browser companion fixture");
  await page.fill('input[name="roleTitle"]', "Engineer");
  await page
    .getByRole("button", { name: "Create search", exact: true })
    .click();
  await expect(page).toHaveURL(/\/searches\/[^/]+\/role/);
  const project = page.url().match(/searches\/([^/]+)/)![1];
  await page.goto(`/searches/${project}/candidates`);
  await page
    .getByRole("button", { name: "Add candidate", exact: true })
    .click();
  await page.fill('input[name="candidateName"]', "Companion candidate");
  await page
    .locator("form")
    .getByRole("button", { name: "Add candidate", exact: true })
    .click();
  await expect(
    page.getByRole("link", {
      name: "Review Companion candidate · CV ↔ JD",
      exact: true,
    }),
  ).toBeVisible();
  const fragment = new URLSearchParams({
    url: "https://example.com/companion?view=profile#work",
    title: "Companion reference",
  });
  await page.goto(`/capture?search=${project}#${fragment}`);
  await expect(page.getByLabel("Source URL", { exact: true })).toHaveValue(
    "https://example.com/companion?view=profile#work",
  );
  await expect(page).not.toHaveURL(/#/);
  await expect(page.getByLabel("Save to search")).toHaveValue(project);
  await expect(
    page.getByText("No browser links have been saved to this search.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel("Link category").selectOption("candidate");
  await page
    .getByLabel("Save to candidate")
    .selectOption({ label: "Companion candidate" });
  await page
    .getByRole("button", { name: "Save reviewed link", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Link saved");
  await expect(
    page.getByRole("link", { name: "Companion reference", exact: true }),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "Save reviewed link", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("already saved");
  await page.reload();
  await expect(
    page.getByRole("link", { name: "Companion reference", exact: true }),
  ).toHaveCount(1);
  await page
    .getByLabel("Source URL", { exact: true })
    .fill("https://example.com/exposure");
  await page
    .getByLabel("Source title", { exact: true })
    .fill("Exposure reference");
  await page
    .getByRole("button", { name: "Save reviewed link", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Link saved");
  await page.reload();
  await expect(
    page.getByRole("link", { name: "Exposure reference", exact: true }),
  ).toHaveCount(1);
  await page.goto(`/searches/${project}/candidates`);
  const row = page.getByRole("row").filter({ hasText: "Companion candidate" });
  await expect(row).toContainText(/identified/i);
});
