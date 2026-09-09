import { expect, test } from "@playwright/test";

/**
 * The note as an outline.
 *
 * `/daily` is a scroll of days now, so every one of these scopes itself to
 * today's section rather than to "the outliner" — there are ten on the page.
 *
 * Everything asserted here is a gesture rather than a shape: type, Enter, Tab,
 * click a bullet. The tree itself is covered by the unit tests; what a browser
 * has to prove is that the four keystrokes reach it and that a zoom shows one
 * branch and nothing else.
 */
test("bullets nest to any depth, and a bullet zooms into its branch", async ({
  page,
}) => {
  await page.goto("/daily");
  const outline = page.locator("[data-day]").first().getByTestId("outliner");
  await expect(outline).toBeVisible();

  // An empty note offers the first line.
  await outline.getByRole("button", { name: /Tab indents/ }).click();
  const editor = page.getByRole("textbox").first();
  await editor.fill("parent block");

  await editor.press("Enter");
  await page.getByRole("textbox").first().fill("child block");
  await page.getByRole("textbox").first().press("Tab");
  await expect(page.locator("[data-block='0.0']")).toBeVisible();

  await page.getByRole("textbox").first().press("Enter");
  await page.getByRole("textbox").first().fill("grandchild block");
  await page.getByRole("textbox").first().press("Tab");
  // Three levels, and nothing stops it going further.
  await expect(page.locator("[data-block='0.0.0']")).toBeVisible();

  await page.locator("body").click();
  await expect(outline).toContainText("parent block");
  await expect(outline).toContainText("grandchild block");

  // Zoom into the child: its branch is all that is left, with a way back.
  await page
    .locator("[data-block='0.0']")
    .getByRole("button", { name: /Zoom into child block/ })
    .first()
    .click();
  await expect(outline).toContainText("grandchild block");
  await expect(
    outline.getByRole("button", { name: /whole note/ }),
  ).toBeVisible();
  // The branch, and only the branch. The parent is still named in the
  // breadcrumb — that is the way back — but it is no longer a row.
  await expect(outline.locator("[data-block]")).toHaveCount(1);
  await expect(outline.locator("ul")).not.toContainText("parent block");

  await outline.getByRole("button", { name: /whole note/ }).click();
  await expect(outline).toContainText("parent block");
});

test("the bullet becomes an arrow while a block has the caret", async ({
  page,
}) => {
  await page.goto("/daily");
  const outline = page.locator("[data-day]").first().getByTestId("outliner");
  await outline.getByRole("button", { name: /Tab indents/ }).click();
  await page.getByRole("textbox").first().fill("a line");
  // Somewhere that is definitely not a block, so the editor closes.
  await page.getByRole("heading", { level: 1 }).click();
  await page.waitForTimeout(300);

  const bullet = page
    .locator("[data-block='0']")
    .getByRole("button", { name: /Zoom into/ })
    .first();
  const opacity = (glyph: "bullet" | "arrow") =>
    bullet
      .locator(`[data-glyph="${glyph}"]`)
      .evaluate((el) => Number(getComputedStyle(el).opacity));

  // At rest: the bullet is shown and the arrow is not.
  expect(await opacity("bullet")).toBeGreaterThan(0.9);
  expect(await opacity("arrow")).toBeLessThan(0.1);

  await page
    .locator("[data-block='0']")
    .getByRole("button", { name: "a line", exact: true })
    .click();
  await page.waitForTimeout(300);
  expect(await opacity("arrow")).toBeGreaterThan(0.9);
  expect(await opacity("bullet")).toBeLessThan(0.1);
});

test("a block being edited is as wide as its row and as tall as its text", async ({
  page,
}) => {
  // Clicking into a block used to halve its width: the editor's wrapper was
  // not a flex child, so it shrank to its content inside a row the read-only
  // view filled. And a one-row box holding four wrapped lines is a box you
  // edit through a letterbox.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/daily");
  const outline = page.locator("[data-day]").first().getByTestId("outliner");
  await outline.getByRole("button", { name: /Tab indents/ }).click();

  const editor = page.getByRole("textbox").first();
  await editor.fill("short");
  // Notes are read, not scanned: the outline sets its own size and the block
  // inherits it, so a block is never the size of a table cell.
  const size = await editor.evaluate((box) =>
    Number.parseFloat(getComputedStyle(box).fontSize),
  );
  expect(size).toBeGreaterThanOrEqual(15);
  const narrow = (await editor.boundingBox())!;
  const row = (await page.locator("[data-block='0']").boundingBox())!;
  // Within the bullet and the gap of the row it sits in.
  expect(row.width - narrow.width).toBeLessThan(40);

  await editor.fill(
    "A long block that wraps onto several lines, so the field has to be as tall as what is in it rather than showing one line and hiding the rest. ".repeat(
      6,
    ),
  );
  await expect
    .poll(async () => (await editor.boundingBox())!.height)
    .toBeGreaterThan(narrow.height);

  // And leaving the block does not move the words: the read view carries the
  // same padding, border width and leading as the box, so clicking into a
  // block and out of it again is not a twitch down the whole list.
  const editing = (await editor.boundingBox())!;
  await outline.click({ position: { x: 2, y: 2 } });
  // The bullet is the first button in the row; the words are the second.
  const words = page.locator("[data-block='0']").getByRole("button").nth(1);
  await expect(words).toBeVisible();
  const reading = (await words.boundingBox())!;
  expect(Math.abs(reading.width - editing.width)).toBeLessThan(4);
  expect(Math.abs(reading.height - editing.height)).toBeLessThan(4);
});

test("the journal is one scroll, and every day in it is writable", async ({
  page,
}) => {
  // A page per day with arrows between them means the day you want is four
  // clicks away, and four chances to lose your place. It is a roll now.
  await page.goto("/daily");
  const days = page.locator("[data-day]");
  await expect(days.first()).toBeVisible();
  const shown = await days.count();
  expect(shown).toBeGreaterThan(1);

  // Today is first and says so, so the top of the scroll is never ambiguous.
  await expect(days.first().getByText("today", { exact: true })).toBeVisible();

  // Yesterday is writable where it sits — no opening, no navigating.
  const yesterday = days.nth(1);
  await yesterday.getByRole("button", { name: /Tab indents/ }).click();
  const written = `E2E — written in the scroll ${Date.now()}`;
  await page.getByRole("textbox").first().fill(written);
  await expect(yesterday.getByText(/Saved/)).toBeVisible({ timeout: 20_000 });

  // And it really is that day's note, not today's.
  const on = await yesterday.getAttribute("data-day");
  await page.goto(`/daily/${on}`);
  await expect(page.getByText(written, { exact: false }).first()).toBeVisible({
    timeout: 15_000,
  });
});

test("the days away from the reading line are squeezed, and the one you write in is not", async ({
  page,
}) => {
  // A month on one screen, steered by shape. The rule that keeps it usable is
  // the second half: a field that compresses under the caret is unusable.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/daily");
  await expect(page.locator("[data-day]").first()).toBeVisible();

  await expect
    .poll(async () => page.locator("[data-squish]").count(), {
      timeout: 15_000,
    })
    .toBeGreaterThan(0);

  // Writing wins over the arithmetic: the section holding the caret is whole.
  const first = page.locator("[data-day]").first();
  const on = await first.getAttribute("data-day");
  await first.getByRole("button", { name: /Tab indents/ }).click();
  await page.getByRole("textbox").first().fill("held open");
  await expect(page.locator(`[data-squish-for="${on}"]`)).not.toHaveAttribute(
    "data-squish",
  );

  // And turning it off gives the plain scroll back.
  await page.getByRole("button", { name: /Squeezed|Full length/ }).click();
  await expect
    .poll(async () => page.locator("[data-squish]").count(), {
      timeout: 10_000,
    })
    .toBe(0);
});
