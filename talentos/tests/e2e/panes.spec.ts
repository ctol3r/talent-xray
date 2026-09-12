import { expect, test, type Page } from "@playwright/test";

/**
 * A pane whose page is not merely loaded but working.
 *
 * A pane holds the real page, and the gestures a test uses in there — shift
 * to open beside, above all — need that page's JavaScript to be running. The
 * frame marks itself the moment its page says hello, so waiting for it is
 * waiting for the thing the click actually needs rather than for a duration.
 */
async function live(page: Page, target: string) {
  await expect(
    page.locator(`[data-pane-target="${target}"] iframe[data-pane-ready="1"]`),
  ).toBeVisible({ timeout: 30_000 });
  return page.frameLocator(`[data-pane-target="${target}"] iframe`);
}

/**
 * Stacked panes.
 *
 * Asserted in a browser because the properties are spatial: panes stay open
 * beside each other, earlier ones collapse to a spine you can still click,
 * the stack survives a reload because it lives in the URL, and there is no
 * cap on how many are open.
 */
test("panes stack, collapse to spines, and survive a reload", async ({
  page,
}) => {
  // A job and a person sharing a written word, so there are pages to open.
  await page.goto("/searches/new");
  await page.fill('input[name="name"]', "E2E — panes");
  await page.fill('input[name="roleTitle"]', "Engineer");
  await page.getByRole("button", { name: "Create job", exact: true }).click();
  await expect(page).toHaveURL(/\/searches\/[^/]+\/role/);
  const job = page.url().match(/searches\/([^/]+)/)![1];

  await page.goto(`/searches/${job}`);
  const notes = page.locator("form textarea").first();
  await notes.fill(
    "Turns on [[pane alpha]] and [[pane beta]] and [[pane gamma]].",
  );
  await page.getByRole("button", { name: "Save notes" }).click();
  await expect(
    page.getByRole("link", { name: "pane alpha" }).first(),
  ).toBeVisible();

  // Shift-click opens beside the work rather than navigating.
  await page
    .getByRole("link", { name: "pane alpha" })
    .first()
    .click({ modifiers: ["Shift"] });
  const rail = page.getByTestId("sliding-panes");
  await expect(rail).toBeVisible();
  // Canonical form: a bare slug and `page:` are the same pane, spelled once.
  await expect(page).toHaveURL(/panes=page%3Apane-alpha/);

  // Opening from inside a pane appends to the right of it.
  //
  // A pane holds the real page now, so a plain click in there browses within
  // the pane, exactly as it would in the window. Shift-click is what opens
  // beside — the same gesture as everywhere else, and the handler is mounted
  // inside the frame too, so it reaches the rail that owns the frame.
  await (
    await live(page, "page:pane-alpha")
  )
    .getByRole("link", { name: "pane beta" })
    .first()
    .click({ modifiers: ["Shift"] });
  await expect(page.getByTestId("sliding-pane")).toHaveCount(2);
  // Panes are typed now (D-056) and canonicalised on the way in, so every
  // entry carries its kind and the same pane cannot appear twice under two
  // spellings. A bare slug in an older link is still read as a page.
  await expect(page).toHaveURL(/panes=page%3Apane-alpha%2Cpage%3Apane-beta/);

  // A third, from the second: still no cap.
  await (
    await live(page, "page:pane-beta")
  )
    .getByRole("link", { name: "pane gamma" })
    .first()
    .click({ modifiers: ["Shift"] });
  await expect(page.getByTestId("sliding-pane")).toHaveCount(3);

  // Earlier panes pin to the left, each further in than the last.
  const lefts = await page
    .getByTestId("sliding-pane")
    .evaluateAll((panes) =>
      panes.map((pane) => Math.round(pane.getBoundingClientRect().left)),
    );
  expect(lefts[0]).toBeLessThan(lefts[1]);
  expect(lefts[1]).toBeLessThan(lefts[2]);

  // The trail is in the URL, so a reload reproduces it exactly.
  await page.reload();
  await expect(page.getByTestId("sliding-pane")).toHaveCount(3);

  // Going back to the first turning drops the rest of the path.
  await (
    await live(page, "page:pane-alpha")
  )
    .getByRole("link", { name: "pane gamma" })
    .first()
    .click({ modifiers: ["Shift"] });
  await expect(page.getByTestId("sliding-pane")).toHaveCount(2);
  await expect(page).toHaveURL(/panes=page%3Apane-alpha%2Cpage%3Apane-gamma/);

  await page.getByRole("button", { name: /close all/ }).click();
  await expect(page.getByTestId("sliding-panes")).toHaveCount(0);
});

test("panes stay open across pages, and stay closed once X'd", async ({
  page,
}) => {
  // A pane you opened beside your work is the one thing that should still be
  // there when you go and look at something else. Ordinary links carry no
  // `panes` parameter, so the URL alone could not do this.
  await page.goto("/tags?panes=tag:pane-persist");
  const rail = page.getByTestId("sliding-panes");
  await expect(rail).toBeVisible();
  await expect(page.getByTestId("sliding-pane")).toHaveCount(1);

  // Away to another page entirely, by its own address.
  await page.goto("/candidates");
  await expect(page.getByTestId("sliding-pane")).toHaveCount(1);
  await expect(page).toHaveURL(/panes=tag%3Apane-persist/);

  // And again, so it is persistence rather than one lucky hop.
  await page.goto("/tasks");
  await expect(page.getByTestId("sliding-pane")).toHaveCount(1);

  // The X is the only thing that closes it.
  await page
    .getByRole("button", { name: /^Close / })
    .first()
    .click();
  await expect(page.getByTestId("sliding-pane")).toHaveCount(0);
  await expect(page).not.toHaveURL(/panes=/);

  // Closed stays closed: navigating must not resurrect it.
  await page.goto("/candidates");
  await expect(page.getByTestId("sliding-pane")).toHaveCount(0);
  await page.goto("/tags");
  await expect(page.getByTestId("sliding-pane")).toHaveCount(0);
});

test("a link that names its own panes overrules what was remembered", async ({
  page,
}) => {
  // A shared trail has to arrive as the sender left it, not merged with
  // whatever the recipient happened to have open.
  await page.goto("/tags?panes=tag:remembered-one,tag:remembered-two");
  await expect(page.getByTestId("sliding-pane")).toHaveCount(2);

  await page.goto("/candidates?panes=tag:sent-by-someone-else");
  await expect(page.getByTestId("sliding-pane")).toHaveCount(1);
  await expect(page.getByTestId("sliding-pane")).toHaveAttribute(
    "data-pane-target",
    "tag:sent-by-someone-else",
  );

  // And that link's stack is what carries forward from there.
  await page.goto("/tasks");
  await expect(page.getByTestId("sliding-pane")).toHaveCount(1);
  await expect(page.getByTestId("sliding-pane")).toHaveAttribute(
    "data-pane-target",
    "tag:sent-by-someone-else",
  );
});

test("close all clears the memory too", async ({ page }) => {
  await page.goto("/tags?panes=tag:alpha,tag:beta,tag:gamma");
  await expect(page.getByTestId("sliding-pane")).toHaveCount(3);

  await page.getByRole("button", { name: /close all/ }).click();
  await expect(page.getByTestId("sliding-pane")).toHaveCount(0);

  await page.goto("/candidates");
  await expect(page.getByTestId("sliding-pane")).toHaveCount(0);
});
