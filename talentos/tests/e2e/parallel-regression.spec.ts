import { expect, test, type Page } from "@playwright/test";

async function jobWithTags(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/searches/new");
  await page.fill('input[name="name"]', `E2E — shared keywords ${Date.now()}`);
  await page.fill('input[name="roleTitle"]', "Engineer");
  await page.getByRole("button", { name: "Create job", exact: true }).click();
  await expect(page).toHaveURL(/\/searches\/[^/]+\/role/);
  const job = page.url().match(/searches\/([^/]+)/)![1];
  await page.goto(`/searches/${job}`);
  const form = page
    .locator("form")
    .filter({ has: page.locator("textarea") })
    .first();
  await form
    .locator("textarea")
    .fill("Evidence to review: [[robotics]] and [[distributed systems]].");
  await form.getByRole("button", { name: "Save notes", exact: true }).click();
  await expect(form.getByRole("status")).toContainText("Saved");
  return job;
}

test("a pane opened after load updates ribbons on scroll, navigation and close", async ({
  page,
}, testInfo) => {
  await jobWithTags(page);
  await page
    .getByRole("link", { name: "robotics", exact: true })
    .first()
    .click({ modifiers: ["Shift"] });
  const element = page.locator('iframe[data-testid="pane-frame"]').first();
  await expect(element).toHaveAttribute("data-pane-ready", "1");
  const frame = page.frameLocator('iframe[data-testid="pane-frame"]').first();
  const ribbons = page.locator('[data-ribbon="tag:robotics"]');
  await expect(ribbons).toHaveCount(1);
  const initial = await ribbons.getAttribute("d");
  // Layout fixture creates room to scroll even when this fresh tag page is short.
  await frame.locator("body").evaluate((body) => {
    body.style.minHeight = "2400px";
  });
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await frame.locator("body").evaluate((body) => {
    body.ownerDocument.defaultView!.scrollBy(0, 120);
  });
  await page.clock.runFor(160);
  expect(await ribbons.getAttribute("d")).not.toBe(initial);
  // This must settle from events; a once-a-second polling fallback cannot pass.
  await page.clock.resume();
  const tag = page
    .locator('[data-testid="page-pane"] [data-preview-target="tag:robotics"]')
    .first();
  const inside = frame.locator('[data-preview-target="tag:robotics"]').first();
  expect(
    await tag.evaluate((el) =>
      getComputedStyle(el).getPropertyValue("--keyword-hue"),
    ),
  ).toBe(
    await inside.evaluate((el) =>
      getComputedStyle(el).getPropertyValue("--keyword-hue"),
    ),
  );
  await page.screenshot({
    path: testInfo.outputPath("connected-keywords.png"),
  });
  await frame
    .getByRole("link", { name: "distributed systems", exact: true })
    .first()
    .click();
  await expect(frame.getByRole("heading", { level: 1 }).first()).toContainText(
    "distributed systems",
  );
  await page
    .getByRole("button", { name: /^Close / })
    .first()
    .click();
  await expect(page.getByTestId("parallel-ribbons")).toHaveCount(0);
});

test("the bottom dock connects shared keywords vertically", async ({
  page,
}, testInfo) => {
  await jobWithTags(page);
  await page
    .getByRole("link", { name: "robotics", exact: true })
    .first()
    .click({ modifiers: ["Shift"] });
  await expect(page.locator('iframe[data-pane-ready="1"]')).toHaveCount(1);
  await page.getByRole("button", { name: /^Dock / }).click();
  await expect(page.getByTestId("bottom-pane")).toBeVisible();
  await expect(
    page.locator('[data-ribbon][data-direction="vertical"]').first(),
  ).toBeVisible();
  const keyword = page
    .locator('[data-testid="page-pane"] [data-preview-target="tag:robotics"]')
    .first();
  await expect
    .poll(async () => {
      const box = (await keyword.boundingBox())!;
      const start = (await page
        .locator('[data-ribbon="tag:robotics"]')
        .getAttribute("d"))!.match(/^M ([\d.-]+) ([\d.-]+)/)!;
      return Math.abs(Number(start[2]) - (box.y + box.height));
    })
    .toBeLessThan(2);
  await page.screenshot({
    path: testInfo.outputPath("connected-bottom-dock.png"),
  });
});
