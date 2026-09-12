import { expect, test } from "@playwright/test";

/**
 * The command menu, opened the Roam way.
 *
 * Three properties are asserted because each one, if it broke, would be
 * invisible in a screenshot: "/" opens the menu from anywhere; "/" typed
 * into a field is a slash and nothing else; and any page can reach any
 * other page and any person through the menu, which is what replaces
 * adding more navigation.
 */
test("a bare slash opens the menu and reaches another search", async ({
  page,
}) => {
  await page.goto("/searches/new");
  await page.fill('input[name="name"]', "E2E — command menu");
  await page.fill('input[name="roleTitle"]', "Founding Recruiter");
  await page.getByRole("button", { name: "Create job", exact: true }).click();
  await expect(page).toHaveURL(/\/searches\/[^/]+\/role/);

  // Focus is in a field after creating the search, so move it out first:
  // the point of the next assertion is that "/" works from the page.
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("/");
  const menu = page.getByTestId("command-bar");
  await expect(menu).toBeVisible();

  // Grouped, with this job's own modules first. The heading carries an
  // emoji, so the match is on the words rather than the whole text node.
  await expect(menu.getByText("This job")).toBeVisible();
  await menu
    .getByRole("button", { name: /Profile/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/searches\/[^/]+\/profile/);
});

test("a slash typed into a field stays a slash", async ({ page }) => {
  await page.goto("/searches/new");
  const name = page.locator('input[name="name"]');
  await name.click();
  await name.pressSequentially("AI/ML");
  await expect(page.getByTestId("command-bar")).toHaveCount(0);
  await expect(name).toHaveValue("AI/ML");
});

test("a slash typed into a textarea stays a slash", async ({ page }) => {
  // The home page's ask box is a textarea, and a recruiter typing "and/or"
  // into a question must not have the words eaten by a menu.
  await page.goto("/");
  const box = page.locator('textarea[name="question"]');
  await box.click();
  await box.pressSequentially("perception and/or lidar");
  await expect(page.getByTestId("command-bar")).toHaveCount(0);
  await expect(box).toHaveValue("perception and/or lidar");
});

/**
 * One input, four things typed into it.
 *
 * This is the whole claim of the front door: from a page that has nothing to
 * do with searching, "/" and some words reach a record, a narrowed workspace,
 * a sourcing run or a specialist — without going anywhere first.
 */
test("one input takes a name, a filter, a brief and a question", async ({
  page,
}) => {
  await page.goto("/searches/new");
  await page.fill('input[name="name"]', "E2E — one input");
  await page.fill('input[name="roleTitle"]', "Founding Recruiter");
  await page.getByRole("button", { name: "Create job", exact: true }).click();
  await expect(page).toHaveURL(/\/searches\/[^/]+\/role/);

  const menu = page.getByTestId("command-bar");
  const open = async (typed: string) => {
    await page.locator("body").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("/");
    await expect(menu).toBeVisible();
    await page.keyboard.type(typed);
  };

  // A filter expression narrows, and the block that says so is first.
  await page.goto("/tasks");
  await open("has:email robotics");
  await expect(menu.getByText("Narrow everything")).toBeVisible();
  await expect(
    menu.locator('[data-testid="block-filter"]').first(),
  ).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/search\?q=/);

  // A brief scours. Same key, same box, different words.
  await open("find technical recruiters in the Bay Area");
  await expect(menu.getByText("Scour for people")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/sourcing\?q=/);

  // A name jumps to the record.
  await open("E2E — one input");
  await expect(menu.getByText("Jump to")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/searches\/[^/]+/);

  // And a question reaches a specialist, leaving the thread on the home page
  // exactly as the ask box there would have.
  await open("why is nobody replying to my messages");
  await expect(menu.getByText("Ask a specialist")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByText("why is nobody replying to my messages").first(),
  ).toBeVisible();
});

test("Tab overrides the classification without retyping", async ({ page }) => {
  // The classifier reads this as a filter. Tab moves to the top of the next
  // block, which is what makes a wrong reading cost a keystroke.
  await page.goto("/tasks");
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("/");
  await page.keyboard.type("has:email robotics");
  await expect(page.getByTestId("command-bar")).toBeVisible();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/sourcing\?q=/);
});

test("the workspace's promise is kept: / reaches another phase's module", async ({
  page,
}) => {
  // The job workspace says "press / to go anywhere" in so many words. The two
  // tests above prove the key opens the menu; this one proves the sentence,
  // which is a larger claim: anywhere has to include a module belonging to a
  // different phase from the page you are standing on, reached without
  // touching the nav. Role is in Understand, Analytics is in Decide.
  await page.goto("/searches/new");
  await page.fill('input[name="name"]', "E2E — go anywhere");
  await page.fill('input[name="roleTitle"]', "Founding Recruiter");
  await page.selectOption('select[name="startDateAgreement"]', "not_agreed");
  await page.getByRole("button", { name: "Create job", exact: true }).click();
  await expect(page).toHaveURL(/\/searches\/[^/]+\/role/);

  await expect(page.getByText("press / to go anywhere")).toBeVisible();

  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("/");
  const menu = page.getByTestId("command-bar");
  await expect(menu).toBeVisible();

  // Type, then choose — the menu shows the first twelve until you narrow it,
  // which is the whole reason it has an input. Analytics is nineteenth.
  await page.keyboard.type("analytics");
  await menu
    .getByRole("button", { name: /Analytics/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/searches\/[^/]+\/analytics/);
});
