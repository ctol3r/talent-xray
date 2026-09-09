import { expect, test } from "@playwright/test";

/**
 * The three surfaces the reader can move: the menu, a pane's width, and the
 * dock along the bottom. All three change how much room the page has, and the
 * property worth pinning is that the page is told — a page that reserves the
 * wrong amount either overlaps a pane or leaves a stripe of empty canvas.
 */
test("the menu opens and closes, and the page takes the room back", async ({
  page,
}) => {
  await page.goto("/tags");
  const menu = page.getByTestId("workspace-menu");
  const stage = page.getByTestId("page-pane");

  await expect(menu).toHaveAttribute("data-open", "true");
  const widthOf = async (): Promise<number> =>
    (await stage.boundingBox())!.width;
  // The stage animates its margins and remeasures the window after the first
  // paint, so a width read once is a width read mid-flight.
  await expect.poll(widthOf).toBeGreaterThan(0);
  const wide = await widthOf();

  await page.getByRole("button", { name: "Hide the menu" }).click();
  await expect(menu).toHaveAttribute("data-open", "false");
  // The icons stay: closed means the labels go, not that navigation does.
  // Scoped to the menu: by the time the whole suite has run, some earlier
  // spec has written a tag, and the connected-here panel at the foot of the
  // page links to records by name (D-100).
  await expect(menu.getByRole("link", { name: "Tags" })).toBeVisible();
  await expect.poll(widthOf).toBeGreaterThan(wide);

  // And it is a preference, so it survives a reload.
  await page.reload();
  await expect(menu).toHaveAttribute("data-open", "false");
  await page.getByRole("button", { name: "Show the menu" }).click();
  await expect(menu).toHaveAttribute("data-open", "true");
});

test("a pane can be made wider, and the page gives way", async ({ page }) => {
  await page.goto("/tags?panes=tasks");
  const pane = page.getByTestId("sliding-pane").first();
  await expect(pane).toBeVisible();

  const paneWidth = async (): Promise<number> =>
    (await pane.boundingBox())!.width;
  const stageWidth = async (): Promise<number> =>
    (await page.getByTestId("page-pane").boundingBox())!.width;

  // Settle first: the rail sizes itself from a measured window, not from the
  // one the server guessed.
  await expect.poll(paneWidth).toBeGreaterThan(0);
  const before = await paneWidth();
  const stageBefore = await stageWidth();

  // Named, not `.first()`: the page has edges of its own now, and they are
  // earlier in the document than the rail.
  const handle = page.getByRole("separator", { name: "Resize Tasks" });
  await handle.focus();
  for (let i = 0; i < 8; i++) await handle.press("ArrowRight");

  await expect.poll(paneWidth).toBeGreaterThan(before);
  // The page reserved the new width rather than the default one.
  await expect.poll(stageWidth).toBeLessThan(stageBefore);
});

test("a pane can be sent to the bottom, and brought back", async ({ page }) => {
  await page.goto("/tags?panes=tasks");
  await expect(page.getByTestId("sliding-pane")).toHaveCount(1);

  await page.getByRole("button", { name: /^Dock / }).click();
  await expect(page.getByTestId("bottom-pane")).toBeVisible();
  // It moved rather than being copied: one thing cannot be open twice.
  await expect(page.getByTestId("sliding-pane")).toHaveCount(0);
  await expect(page).toHaveURL(/bottom=tasks/);

  // The dock is resizable by its own top edge.
  const dock = page.getByTestId("bottom-pane");
  const tall = (await dock.boundingBox())!.height;
  const handle = page.getByRole("separator", { name: "Resize Tasks" });
  await handle.focus();
  for (let i = 0; i < 3; i++) await handle.press("ArrowUp");
  expect((await dock.boundingBox())!.height).toBeGreaterThan(tall);

  await page.getByRole("button", { name: /back to the side/i }).click();
  await expect(page.getByTestId("bottom-pane")).toHaveCount(0);
  await expect(page.getByTestId("sliding-pane")).toHaveCount(1);
});

test("the page itself can be resized from either edge", async ({ page }) => {
  // Every other surface in the workspace could be resized and the one you
  // spend the day reading could not. Both edges move independently, so a
  // reader can pull the measure in on one side and leave the other alone.
  await page.goto("/searches");
  const stage = page.getByTestId("page-pane");
  const wide = (await stage.boundingBox())!.width;

  const left = page.getByTestId("page-edge-left");
  await left.focus();
  for (let i = 0; i < 5; i += 1) await left.press("ArrowRight");
  await expect
    .poll(async () => (await stage.boundingBox())!.width)
    .toBeLessThan(wide);
  const narrowed = (await stage.boundingBox())!.width;

  const right = page.getByTestId("page-edge-right");
  await right.focus();
  for (let i = 0; i < 4; i += 1) await right.press("ArrowLeft");
  await expect
    .poll(async () => (await stage.boundingBox())!.width)
    .toBeLessThan(narrowed);

  // It survives a reload, like every other size in this workspace.
  await page.reload();
  await expect
    .poll(async () => (await stage.boundingBox())!.width)
    .toBeLessThan(narrowed);

  // And Home puts both edges back, which is the way out of any arrangement.
  await page.getByTestId("page-edge-left").press("Home");
  await expect.poll(async () => (await stage.boundingBox())!.width).toBe(wide);
});

test("the page keeps a readable width whatever the edges are dragged to", async ({
  page,
}) => {
  // The edges are bounded by MIN_PAGE_WIDTH rather than by trust: a page
  // squeezed to nothing is a workspace with no work in it and no obvious way
  // back, and the handles are 8px wide.
  await page.goto("/searches");
  const stage = page.getByTestId("page-pane");
  const left = page.getByTestId("page-edge-left");
  await left.focus();
  for (let i = 0; i < 80; i += 1) await left.press("ArrowRight");
  const right = page.getByTestId("page-edge-right");
  await right.focus();
  for (let i = 0; i < 80; i += 1) await right.press("ArrowLeft");

  expect((await stage.boundingBox())!.width).toBeGreaterThanOrEqual(400);
});
