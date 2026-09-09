import { expect, test } from "@playwright/test";

/**
 * The sourcing console in a browser.
 *
 * What needs a browser rather than a unit test: that the query language reaches
 * the page at all, that a dormant angle shows the query it would run instead of
 * hiding it, and that the two promises printed on the page — nothing dormant is
 * executed, nothing found is stored — are visible where a recruiter reads them.
 */
test("a brief in prose is read into filters, and the reading is shown", async ({
  page,
}) => {
  await page.goto(
    "/sourcing?q=" +
      encodeURIComponent("technical recruiters in the Bay Area has:email"),
  );

  const reading = page.getByText("How Talent read your brief");
  await expect(reading).toBeVisible();
  await expect(page.getByText("skills: technical recruiters")).toBeVisible();
  await expect(
    page.getByText("locations: san francisco bay area"),
  ).toBeVisible();
  await expect(page.getByText("must have: email")).toBeVisible();
});

test("an angle that cannot run still shows its query and what turns it on", async ({
  page,
}) => {
  await page.goto("/sourcing?q=" + encodeURIComponent("skill:robotics"));

  // Every angle carries the reason it finds people who are not looking.
  await expect(
    page.getByText("Public CVs and résumés (PDF)").first(),
  ).toBeVisible();
  await expect(
    page
      .getByText(
        "People who publish a PDF CV are documenting themselves for peers",
      )
      .first(),
  ).toBeVisible();

  // And the composed query is on the page, never hidden behind a toggle.
  await expect(page.getByText('"curriculum vitae"').first()).toBeVisible();
});

test("the structured sources are listed with the exact request each would make", async ({
  page,
}) => {
  await page.goto("/sourcing?q=" + encodeURIComponent("skill:robotics"));
  await expect(page.getByText("Structured sources").first()).toBeVisible();
  await expect(
    page.getByText(/api\.openalex\.org|wikidata\.org/).first(),
  ).toBeVisible();
});

test("asking the structured sources is opt-in, not something a page load does", async ({
  page,
}) => {
  await page.goto("/sourcing?q=" + encodeURIComponent("skill:robotics"));
  // The opt-in is a link now rather than a checkbox in a form, because the
  // page has no form: the brief is typed in the command menu. What must not
  // change is that arriving with a brief asks nobody anything.
  const toggle = page.getByTestId("live-toggle");
  await expect(toggle).toHaveText(/also ask the structured sources/);
  await expect(toggle).toHaveAttribute("href", /live=1/);
  await expect(
    page.getByText("What the structured sources returned"),
  ).toHaveCount(0);
});

test("the results pages have no query box of their own", async ({ page }) => {
  // Two front doors became two result views. A box here would be a second
  // grammar to keep in step with the menu's.
  for (const path of [
    "/sourcing?q=" + encodeURIComponent("skill:robotics"),
    "/search?q=" + encodeURIComponent("recruiter"),
  ]) {
    await page.goto(path);
    await expect(page.locator('input[name="q"]')).toHaveCount(0);
    // And the string that produced the page is still on it, and still editable.
    await expect(page.getByRole("button", { name: /Change it/ })).toBeVisible();
  }
});

test("the identity review page says where the line sits", async ({ page }) => {
  await page.goto("/sourcing/review");
  await expect(page.getByText("Where the line sits")).toBeVisible();
  await expect(
    page.getByText(/two strangers can\s+both be in London/),
  ).toBeVisible();
});

test("one search reaches jobs and people at once", async ({ page }) => {
  await page.goto("/searches/new");
  await page.fill('input[name="name"]', "E2E — sourcing search");
  await page.fill('input[name="roleTitle"]', "Founding Recruiter");
  await page.getByRole("button", { name: "Create job", exact: true }).click();
  await expect(page).toHaveURL(/\/searches\/[^/]+\/role/);

  await page.goto("/search?q=" + encodeURIComponent("sourcing search"));
  await expect(
    page.getByRole("link", { name: "E2E — sourcing search" }).first(),
  ).toBeVisible();
  await expect(page.getByText(/matched:/).first()).toBeVisible();
});

test("every angle opens in ordinary Google, dormant ones included", async ({
  page,
}) => {
  // A dormant angle is one no connector will RUN. It was never one you could
  // not search — the query is written and its negatives are what make it
  // behave on the open web, so plain Google needs no key at all.
  await page.goto("/sourcing?q=" + encodeURIComponent("skill:robotics"));

  const google = page.getByRole("link", { name: /Open in Google/ });
  const count = await google.count();
  expect(count).toBeGreaterThan(10);

  const href = await google.first().getAttribute("href");
  expect(href).toContain("https://www.google.com/search?");
  // Google must not "correct" a hand-built boolean, nor collapse the
  // near-duplicates a site-restricted search depends on.
  expect(href).toContain("nfpr=1");
  expect(href).toContain("filter=0");
  // URLSearchParams encodes a space as "+", so match the word, not the phrase.
  expect(href).toContain("curriculum");

  // Every one of them opens in a new tab with the opener severed (rule 5).
  for (const link of await google.all()) {
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);
  }

  // The dormant card says what the connector actually buys.
  await expect(page.getByText(/To run it for you:/).first()).toBeVisible();
});
