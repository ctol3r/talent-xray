import { expect, test } from "@playwright/test";

/**
 * The workspace on a phone.
 *
 * Three surfaces that each hold ground do not fit: 208px of menu plus a page
 * that will not go below 420 is already more than a phone has, and the page
 * was getting 167px of a 518px window. Below the breakpoint the menu and the
 * rail lie over the page instead, and the page has the whole width.
 *
 * The property worth asserting is the one a person notices: the page never
 * scrolls sideways.
 */
test.use({ viewport: { width: 375, height: 812 } });

const PAGES = ["/", "/searches", "/candidates", "/notes", "/tasks", "/graph"];

test("no page scrolls sideways on a phone", async ({ page }) => {
  for (const path of PAGES) {
    await page.goto(path);
    await page.waitForTimeout(250);
    // Asserted by trying to scroll rather than by comparing widths: a tall
    // page in a desktop browser has a vertical scrollbar, which makes
    // scrollWidth exceed clientWidth by about 16px with nothing actually
    // overflowing. Whether the page MOVES is what a person notices, and it is
    // the same answer on a phone, which has no scrollbar at all.
    const moved = await page.evaluate(() => {
      window.scrollTo(500, 0);
      const x = window.scrollX;
      window.scrollTo(0, 0);
      return x;
    });
    expect(moved, path).toBe(0);
  }
});

test("the page has the whole width, and the menu lies over it", async ({
  page,
}) => {
  await page.goto("/searches");
  const stage = page.getByTestId("page-pane");
  await expect.poll(async () => (await stage.boundingBox())!.width).toBe(375);

  // The menu starts shut on a phone whatever the desktop preference says:
  // arriving with the page covered by navigation you did not ask for is the
  // wrong first frame.
  const menu = page.getByTestId("workspace-menu");
  await expect(menu).toHaveAttribute("data-narrow", "true");
  await expect(menu).toHaveAttribute("data-open", "false");

  const burger = page.getByRole("button", { name: "Show the menu" });
  await expect(burger).toBeVisible();
  await burger.click();
  await expect(menu).toHaveAttribute("data-open", "true");
  // Over the page, not beside it: the page did not move.
  expect(Math.round((await stage.boundingBox())!.width)).toBe(375);

  // Going somewhere closes it, because it was covering where you were going.
  await page.getByRole("link", { name: "Tasks" }).click();
  await expect(page).toHaveURL(/\/tasks/);
  await expect(menu).toHaveAttribute("data-open", "false");
});

test("a pane is the whole window rather than a column beside nothing", async ({
  page,
}) => {
  await page.goto("/tags?panes=tasks");
  const pane = page.getByTestId("sliding-pane").first();
  await expect(pane).toBeVisible();
  const width = (await pane.boundingBox())!.width;
  expect(width).toBeGreaterThan(300);
  expect(width).toBeLessThanOrEqual(375);
});

test("a wide table scrolls inside itself, not the page", async ({ page }) => {
  await page.goto("/searches");
  const table = page.locator("table").first();
  await expect(table).toBeVisible();
  // The table is wider than the phone on purpose — the columns are worth
  // keeping — so its own box is what scrolls.
  const box = await table.evaluate((el) => {
    const wrap = el.parentElement!;
    return {
      table: Math.round(el.getBoundingClientRect().width),
      wrap: Math.round(wrap.getBoundingClientRect().width),
      overflowX: getComputedStyle(wrap).overflowX,
    };
  });
  expect(box.overflowX).toBe("auto");
  expect(box.table).toBeGreaterThan(box.wrap);
  expect(box.wrap).toBeLessThanOrEqual(375);
});
