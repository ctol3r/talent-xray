import { expect, test } from "@playwright/test";
test("keyless salary findings require review, persist and invalidate on editing", async ({
  page,
}) => {
  page.setDefaultTimeout(10000);
  await page.goto("/searches/new");
  await page.fill('input[name="name"]', "Compensation fixture");
  await page.fill('input[name="roleTitle"]', "Engineer");
  await page
    .getByRole("button", { name: "Create search", exact: true })
    .click();
  await expect(page).toHaveURL(/\/searches\/[^/]+\/role/);
  const project = page.url().match(/searches\/([^/]+)/)![1];
  await page.goto(`/searches/${project}/market`);
  await page.getByLabel("Target geography", { exact: true }).fill("Boston");
  await page.getByLabel("Employment type", { exact: true }).fill("Employee");
  await page
    .getByText("Research with Codex / Claude — no API key", { exact: true })
    .click();
  // The pasted response must answer the request that is on screen.
  const request = JSON.parse(
    await page.getByLabel("Compensation research request").inputValue(),
  ) as { kind: string; contextHash: string };
  expect(request.kind).toBe("talentos-compensation-research-v1");
  const source = {
    title: "Synthetic source",
    url: "https://one.example/pay",
    quote: "Example range 100000 to 140000",
    dataDate: new Date().toISOString().slice(0, 10),
    role: "Engineer",
    geography: "Boston",
    employmentType: "Employee",
    currency: "USD",
    basis: "annual",
    component: "base",
    low: 100000,
    high: 140000,
    comparability: "Same role and level",
    reviewed: true,
  };
  const findings = page.getByLabel("Compensation findings JSON");
  await findings.fill(JSON.stringify({ contextHash: "stale", sources: [] }));
  await page
    .getByRole("button", { name: "Import unreviewed findings" })
    .click();
  await expect(
    page.getByText("These findings answer a different role context", {
      exact: false,
    }),
  ).toBeVisible();
  await findings.fill(
    JSON.stringify({
      contextHash: request.contextHash,
      sources: [
        source,
        {
          ...source,
          url: "https://two.example/pay",
          low: 120000,
          high: 160000,
        },
      ],
    }),
  );
  await page
    .getByRole("button", { name: "Import unreviewed findings" })
    .click();
  await expect(
    page.getByText(
      "Findings imported as unreviewed. Check each source before including it.",
      { exact: true },
    ),
  ).toBeVisible();
  const reviews = page.getByRole("checkbox", {
    name: "I checked the source amounts, date and comparability",
  });
  await expect(reviews.first()).not.toBeChecked();
  await page.getByRole("button", { name: "Save and recommend range" }).click();
  await expect(
    page.getByText("Insufficient reviewed evidence for a range", {
      exact: true,
    }),
  ).toBeVisible();
  await reviews.nth(0).check();
  await reviews.nth(1).check();
  await page.getByRole("button", { name: "Save and recommend range" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Provisional base-pay range: USD 110,000–150,000 annual",
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Provisional base-pay range: USD 110,000–150,000 annual",
    }),
  ).toBeVisible();
  await page.getByLabel("Source lower bound").first().fill("105000");
  await expect(reviews.first()).not.toBeChecked();
  await expect(
    page.getByRole("heading", { name: /Provisional base-pay range/ }),
  ).toHaveCount(0);
});
