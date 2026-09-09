import { expect, test } from "@playwright/test";

/**
 * The lines between parallel pages.
 *
 * Two things open side by side are two things until you can see what they have
 * in common. Wherever the same **keyword** appears in two open surfaces, a band
 * runs from one to the other.
 *
 * Keywords only. It joined every kind of record at first, and jobs and people
 * are named on every page, so the picture was a wash of bands saying that the
 * job list mentions the job. A word written on two records is the connection
 * somebody made, and the only one worth a line.
 */
test("the same keyword on two open surfaces draws a line between them", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  // A word written on a job, with the tag's own page open beside it: the same
  // keyword on two surfaces is the thing worth a line.
  await page.goto("/searches/new");
  await page.fill('input[name="name"]', `E2E — ribbons ${Date.now()}`);
  await page.fill('input[name="roleTitle"]', "Engineer");
  await page.getByRole("button", { name: "Create job", exact: true }).click();
  await expect(page).toHaveURL(/\/searches\/[^/]+\/role/);
  const job = page.url().match(/searches\/([^/]+)/)![1];

  await page.goto(`/searches/${job}`);
  await page.locator("form textarea").first().fill("About [[ribbon word]].");
  await page.getByRole("button", { name: "Save notes" }).click();
  await expect(
    page.getByRole("link", { name: "ribbon word" }).first(),
  ).toBeVisible();

  await page.goto(`/tags/ribbon-word?panes=job:${job}`);
  await expect(
    page.locator(`[data-pane-target="job:${job}"] iframe[data-pane-ready="1"]`),
  ).toBeVisible({ timeout: 30_000 });

  const ribbons = page.getByTestId("parallel-ribbons");
  await expect
    .poll(async () => ribbons.locator("path").count(), { timeout: 20_000 })
    .toBeGreaterThan(0);

  // Keywords and nothing else: a job named on both surfaces draws no line.
  const targets = await ribbons
    .locator("path")
    .evaluateAll((paths) =>
      paths.map((p) => (p as HTMLElement).dataset.ribbon ?? ""),
    );
  expect(targets.length).toBeGreaterThan(0);
  expect(targets.every((t) => t.startsWith("tag:"))).toBe(true);
  expect(targets.some((t) => t.startsWith("job:"))).toBe(false);

  // The switch, on the rail the bands are drawn across.
  const linked = page.getByRole("button", { name: /linked|🔗 off/ });
  await expect(linked).toHaveAttribute("aria-pressed", "true");
  await linked.click();
  await expect(page.getByTestId("parallel-ribbons")).toHaveCount(0);

  // Remembered: it is about how somebody reads, not about this page.
  await page.reload();
  await expect(
    page.locator(`[data-pane-target="job:${job}"] iframe[data-pane-ready="1"]`),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByRole("button", { name: /linked|🔗 off/ }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("parallel-ribbons")).toHaveCount(0);

  // And back on again, without touching anything else about the panes.
  await page.getByRole("button", { name: /linked|🔗 off/ }).click();
  await expect
    .poll(
      async () => page.getByTestId("parallel-ribbons").locator("path").count(),
      {
        timeout: 20_000,
      },
    )
    .toBeGreaterThan(0);
  await expect(page.getByTestId("sliding-pane")).toHaveCount(1);

  // Nothing to be parallel to, nothing drawn.
  await page.goto("/tags/ribbon-word");
  await expect(page.getByTestId("parallel-ribbons")).toHaveCount(0);
});
