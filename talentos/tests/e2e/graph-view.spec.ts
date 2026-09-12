import { expect, test } from "@playwright/test";

/**
 * Moving around the graph.
 *
 * The label has claimed you could drag the background for as long as it has
 * existed, and you could not — the pan was state only the reset button ever
 * wrote. So a graph zoomed in past its frame could not be moved, which is the
 * one thing zoom makes necessary. Asserted through the transform on the drawn
 * group, because that is the thing the eye is actually reading.
 */
const transform = (page: import("@playwright/test").Page) =>
  page
    .locator("svg[aria-label*='knowledge graph'] > g")
    .first()
    .getAttribute("transform");

test("the canvas moves when you drag the background", async ({ page }) => {
  await page.goto("/graph");
  const svg = page.locator("svg[aria-label*='knowledge graph']").first();
  await expect(svg).toBeVisible();

  const before = await transform(page);
  const box = await svg.boundingBox();
  if (!box) throw new Error("The graph has no box to drag in.");

  // A corner, so the drag starts on canvas rather than on a record.
  await page.mouse.move(box.x + 24, box.y + 24);
  await page.mouse.down();
  await page.mouse.move(box.x + 224, box.y + 124, { steps: 8 });
  await page.mouse.up();

  const after = await transform(page);
  expect(after).not.toBe(before);
  // Moved right and down, by roughly what the pointer did rather than by some
  // arbitrary amount: a canvas that slides out from under the cursor is worse
  // than one that does not move.
  const [x, y] =
    (after ?? "").match(/translate\(([-\d.]+) ([-\d.]+)\)/)?.slice(1) ?? [];
  expect(Number(x)).toBeGreaterThan(40);
  expect(Number(y)).toBeGreaterThan(20);
});

test("arrow keys move it too, and reset puts it back", async ({ page }) => {
  await page.goto("/graph");
  const svg = page.locator("svg[aria-label*='knowledge graph']").first();
  await expect(svg).toBeVisible();

  await svg.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  expect(await transform(page)).not.toBe("translate(0 0) scale(1)");

  await page.getByRole("button", { name: "Reset the view" }).first().click();
  expect(await transform(page)).toBe("translate(0 0) scale(1)");
});
