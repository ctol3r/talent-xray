import { expect, test } from "@playwright/test";
import { moduleNav } from "./helpers/nav";

/**
 * Tags as pages, the Roam way.
 *
 * The behaviours worth a browser: typing @ recalls a tag that already
 * exists, choosing it writes the right form into the text, and the same word
 * written on a job and on a person puts both on one page. None of that can
 * be checked without a caret.
 */
test("a word written on a job and on a person becomes one page", async ({
  page,
}) => {
  await page.goto("/searches/new");
  await page.fill('input[name="name"]', "E2E — tags");
  await page.fill('input[name="roleTitle"]', "Founding Recruiter");
  await page.getByRole("button", { name: "Create job", exact: true }).click();
  await expect(page).toHaveURL(/\/searches\/[^/]+\/role/);
  const searchId = page.url().match(/\/searches\/([^/]+)/)![1];

  // Tag the job.
  await page.goto(`/searches/${searchId}`);
  const jobNotes = page.locator("form textarea").first();
  await jobNotes.fill("Turns on closing [[research engineers]].");
  await page.getByRole("button", { name: "Save notes" }).click();
  await expect(
    page.getByRole("link", { name: "research engineers" }).first(),
  ).toBeVisible();

  // Tag a person with the same word, recalled with "@" rather than typed.
  await moduleNav(page, "Candidates");
  await page.click('button:has-text("Add candidate")');
  await page.fill('input[name="candidateName"]', "Jordan Rivera");
  await page.click('form button:has-text("Add candidate")');
  await page.getByRole("link", { name: "Jordan Rivera" }).first().click();
  // The candidate list links into the review view; the notes live on the
  // person's own page one level up.
  await expect(page).toHaveURL(/\/candidates\/[^/]+/);
  await page.goto(page.url().replace(/\/review$/, ""));

  const personNotes = page.getByPlaceholder("Recruiter notes", {
    exact: false,
  });
  await personNotes.click();
  // "[[" offers every page, so it finds the tag written on the job. "@"
  // would not: that trigger offers people only.
  await personNotes.pressSequentially("Closed three [[research");
  const suggestions = page.getByTestId("tag-suggestions");
  await expect(suggestions).toBeVisible();
  await expect(
    suggestions.getByRole("button", { name: /research engineers/ }),
  ).toBeVisible();
  await personNotes.press("Enter");
  await expect(personNotes).toHaveValue("Closed three [[research engineers]] ");
  await page.getByRole("button", { name: "Save notes" }).click();

  // One page now holds both.
  await page.goto("/tags");
  await page
    .getByRole("link", { name: /research engineers/ })
    .first()
    .click();
  // The heading carries the page's kind as an emoji, so match the words.
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "research engineers",
  );
  await expect(page.getByText("E2E — tags").first()).toBeVisible();
  await expect(page.getByText("Jordan Rivera").first()).toBeVisible();
});

test("a protected characteristic never becomes a page", async ({ page }) => {
  await page.goto("/searches/new");
  await page.fill('input[name="name"]', "E2E — tag guard");
  await page.fill('input[name="roleTitle"]', "Engineer");
  await page.getByRole("button", { name: "Create job", exact: true }).click();
  await expect(page).toHaveURL(/\/searches\/[^/]+\/role/);
  const searchId = page.url().match(/\/searches\/([^/]+)/)![1];

  await page.goto(`/searches/${searchId}`);
  const notes = page.locator("form textarea").first();
  // Written through the words the fair-hiring module owns. The text is saved
  // verbatim, but no link is made and no page exists.
  await notes.fill("Note mentioning [[ethnicity]] and #marital-status.");
  await page.getByRole("button", { name: "Save notes" }).click();
  await expect(page.getByRole("link", { name: "ethnicity" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "marital-status" })).toHaveCount(
    0,
  );
});

test("@ offers only people and jj offers only jobs", async ({ page }) => {
  // Both searches and the person from the first test are on file by now, so
  // this exercises the filters rather than the parser.
  await page.goto("/daily");
  // The note is an outline now, so the recall menu lives inside a block. Open
  // a fresh empty one rather than typing into whatever another spec left.
  const outline = page.getByTestId("outliner");
  const blank = outline.getByRole("button", { name: /Tab to indent/ });
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
  const note = page.getByRole("textbox").first();

  // "@" is people. A tag written on a job must not appear under it.
  await note.pressSequentially("met @Jordan");
  const suggestions = page.getByTestId("tag-suggestions");
  await expect(suggestions).toBeVisible();
  await expect(suggestions.getByText("people")).toBeVisible();
  // Other specs create people with this name too, so the assertion is that
  // the trigger offers one at all, not that it offers exactly one.
  await expect(
    suggestions.getByRole("button", { name: /Jordan Rivera/ }).first(),
  ).toBeVisible();
  await note.press("Enter");
  await expect(note).toHaveValue("met [[Jordan Rivera]] ");

  // "jj" is jobs, and a person must not appear under it.
  await note.pressSequentially("about jjE2E");
  await expect(suggestions).toBeVisible();
  await expect(suggestions.getByText("jobs")).toBeVisible();
  await expect(
    suggestions.getByRole("button", { name: /E2E — / }).first(),
  ).toBeVisible();
  await note.press("Enter");
  // Which E2E search sorts first depends on what other specs have run, so
  // the assertion is on the shape, not on a particular one.
  await expect(note).toHaveValue(
    /^met \[\[Jordan Rivera\]\] about \[\[E2E — .+\]\] $/,
  );
});
