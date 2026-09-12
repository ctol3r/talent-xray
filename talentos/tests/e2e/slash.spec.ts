import { expect, test } from "@playwright/test";

/**
 * The slash menu, and the first thing on it.
 *
 * What a browser has to prove is the part the unit tests cannot: the menu
 * comes out of the cursor rather than from under the box, and choosing the
 * first row makes a real task that shows up on the task list — which is the
 * whole reason a note block should be able to become one.
 */
test("typing a slash opens the menu at the cursor, and the first row is a to-do", async ({
  page,
}) => {
  await page.goto("/daily");
  // The journal is a scroll of days now, so this is today's outline rather
  // than "the" outline — there are ten of them on the page.
  const outline = page.locator("[data-day]").first().getByTestId("outliner");
  // The placeholder differs between the scroll and a single day; both say
  // what Tab does, which is the part worth matching on.
  const blank = outline.getByRole("button", {
    name: /Tab indents|Tab to indent/,
  });
  if (await blank.count()) {
    await blank.click();
  } else {
    await outline
      .locator("[data-block]")
      .first()
      .getByRole("button")
      .nth(1)
      .click();
    await page.getByRole("textbox").first().press("End");
    await page.getByRole("textbox").first().press("Enter");
  }

  const editor = page.getByRole("textbox").first();
  await editor.pressSequentially("Call the manager back /");

  const menu = page.getByTestId("slash-menu");
  await expect(menu).toBeVisible();
  // The to-do is first, because it is the one that goes somewhere.
  await expect(menu.getByRole("button").first()).toContainText("To-do");

  // From the cursor: the menu's left edge is out along the line, not at the
  // left edge of the box.
  const box = (await editor.boundingBox())!;
  const at = (await menu.boundingBox())!;
  expect(at.x).toBeGreaterThan(box.x + 40);
  expect(at.y).toBeGreaterThan(box.y);

  await editor.press("Enter");
  await expect(menu).toHaveCount(0);

  // The block is a to-do now, ticked from either place, and the editor has
  // closed so the row id behind it is not in your sentence.
  await expect(outline.getByRole("textbox")).toHaveCount(0);
  const checkbox = outline.getByRole("checkbox").first();
  await expect(checkbox).toBeVisible();
  await expect(checkbox).not.toBeChecked();
  await expect(outline).toContainText("Call the manager back");
  // The anchor is a pointer, never on screen.
  await expect(outline).not.toContainText("^");

  // And it is a real row: the task list has it.
  await page.goto("/tasks");
  await expect(
    page.getByRole("listitem").filter({ hasText: "Call the manager back" }),
  ).toBeVisible();
});

test("a slash inside a web address is punctuation, not a menu", async ({
  page,
}) => {
  await page.goto("/daily");
  // The journal is a scroll of days now, so this is today's outline rather
  // than "the" outline — there are ten of them on the page.
  const outline = page.locator("[data-day]").first().getByTestId("outliner");
  // The placeholder differs between the scroll and a single day; both say
  // what Tab does, which is the part worth matching on.
  const blank = outline.getByRole("button", {
    name: /Tab indents|Tab to indent/,
  });
  if (await blank.count()) {
    await blank.click();
  } else {
    await outline
      .locator("[data-block]")
      .first()
      .getByRole("button")
      .nth(1)
      .click();
    await page.getByRole("textbox").first().press("End");
    await page.getByRole("textbox").first().press("Enter");
  }
  await page.getByRole("textbox").first().pressSequentially("see https://");
  await expect(page.getByTestId("slash-menu")).toHaveCount(0);
});

test("asking lands the answer under the question, labelled", async ({
  page,
}) => {
  await page.goto("/daily");
  // The journal is a scroll of days now, so this is today's outline rather
  // than "the" outline — there are ten of them on the page.
  const outline = page.locator("[data-day]").first().getByTestId("outliner");
  // The placeholder differs between the scroll and a single day; both say
  // what Tab does, which is the part worth matching on.
  const blank = outline.getByRole("button", {
    name: /Tab indents|Tab to indent/,
  });
  if (await blank.count()) {
    await blank.click();
  } else {
    await outline
      .locator("[data-block]")
      .first()
      .getByRole("button")
      .nth(1)
      .click();
    await page.getByRole("textbox").first().press("End");
    await page.getByRole("textbox").first().press("Enter");
  }

  const editor = page.getByRole("textbox").first();
  await editor.pressSequentially("what should I ask the manager /ask");
  const menu = page.getByTestId("slash-menu");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("button").first()).toContainText("Ask AI");
  await editor.press("Enter");

  // The question keeps its own words, and the answer is a child of it — never
  // mixed into the line you wrote.
  await expect(outline).toContainText("what should I ask the manager");
  await expect(outline.locator("[data-block='0.0']")).toBeVisible();
  // And whatever came back says what answered it. With the mock provider that
  // is a mock; with the session provider it is a file somebody has to fulfil.
  await expect(outline.locator("[data-block='0.0']")).toContainText(
    /answered by a model|waiting on a Claude session|no answer/,
  );
});
