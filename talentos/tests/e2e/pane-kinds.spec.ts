import { expect, test } from "@playwright/test";

/**
 * Any section can be a pane, and a pane can be moved between slots.
 *
 * The kinds are asserted through the URL rather than by clicking through the
 * app, because the point is that a stack of mixed kinds survives being
 * written down and read back — that is what makes a workspace shareable.
 *
 * The contents are asserted inside the frame, because a pane holds the page
 * itself now rather than a summary of one. That is also what the last test
 * here is for: a pane you can read and not work in was the old arrangement,
 * and it is the thing this is meant to stop being true.
 */

/** What is actually in a pane: the page, in its frame. */
const inside = (page: import("@playwright/test").Page, target: string) =>
  page.frameLocator(`[data-pane-target="${target}"] iframe`);
test("a stack can mix a task list, a calendar and a page", async ({ page }) => {
  await page.goto("/tags?panes=tasks,calendar,page:ai-safety");

  const panes = page.getByTestId("sliding-pane");
  await expect(panes).toHaveCount(3);

  // Each pane loaded its own kind of content — the real page of it.
  await expect(inside(page, "tasks").getByText("New task")).toBeVisible();
  // The calendar is a scroll of days; today is the first of them and says so.
  await expect(
    inside(page, "calendar").getByText("today", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    inside(page, "page:ai-safety").getByRole("heading", { name: /Ai safety/ }),
  ).toBeVisible();

  // Earlier panes pin further left as the stack grows.
  const lefts = await panes.evaluateAll((nodes) =>
    nodes.map((node) => Math.round(node.getBoundingClientRect().left)),
  );
  expect(lefts[0]).toBeLessThan(lefts[1]);
  expect(lefts[1]).toBeLessThan(lefts[2]);
});

test("a pane moves from one slot to another by dragging its spine", async ({
  page,
}) => {
  await page.goto("/tags?panes=tasks,calendar,page:ai-safety");
  await expect(page.getByTestId("sliding-pane")).toHaveCount(3);

  const order = () =>
    page
      .getByTestId("sliding-pane")
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-pane-target")),
      );
  expect(await order()).toEqual(["tasks", "calendar", "page:ai-safety"]);

  // The spine is the handle, because a pane you can only drag by its header
  // is unmovable the moment it is covered.
  const lastSpine = page
    .locator('[data-pane-target="page:ai-safety"] [draggable="true"]')
    .first();
  // Drop onto the first pane's SPINE, not its middle. Once the rail is fuller
  // than it is wide, earlier panes are covered by later ones and the spine is
  // the only part of them still on screen — which is the whole point of the
  // spine, and therefore the only place a person could drop onto.
  const firstSpine = page
    .locator('[data-pane-target="tasks"] [draggable="true"]')
    .first();
  await lastSpine.dragTo(firstSpine);

  await expect.poll(order).toEqual(["page:ai-safety", "tasks", "calendar"]);
  // The move is in the URL, so it survives a reload like everything else.
  await expect(page).toHaveURL(/panes=page%3Aai-safety%2Ctasks%2Ccalendar/);
});

test("an old-style stack of bare slugs still opens", async ({ page }) => {
  // Written before panes were typed. It must still mean pages.
  await page.goto("/tags?panes=ai-safety");
  const pane = page.getByTestId("sliding-pane");
  await expect(pane).toHaveCount(1);
  await expect(pane).toHaveAttribute("data-pane-target", "ai-safety");
  // A page it is: it renders the tag page, not a task list or calendar.
  // The title is sentence-cased from the slug when nobody has written the
  // word out in full, which is the tag page's own rule.
  await expect(
    inside(page, "ai-safety").getByRole("heading", { name: /Ai safety/ }),
  ).toBeVisible();
});

test("every page in the workspace opens as a pane", async ({ page }) => {
  // Not a list somebody has to remember to extend: shift-click is handled once,
  // on the document, so a link that exists is a link that can be a pane.
  await page.goto("/");
  for (const [href, expected] of [
    ["/searches", "jobs"],
    ["/tags", "tags"],
    ["/graph", "graph"],
    ["/settings", "settings"],
    ["/candidates", "people"],
    ["/tasks", "tasks"],
  ] as const) {
    await page
      .locator(`aside a[href="${href}"]`)
      .first()
      .click({ modifiers: ["Shift"] });
    await expect(
      page.locator(`[data-pane-target="${expected}"]`),
    ).toBeVisible();
  }
  // Shift-clicking never navigated: the dashboard is still the page behind.
  await expect(page).toHaveURL(/^[^?]*\/\?panes=/);
  await expect(page.getByTestId("sliding-pane")).toHaveCount(6);
});

test("home opens with today's note and the expert", async ({ page }) => {
  // The two things a recruiter does first: write something down, and ask
  // somebody. Both on the front page, neither a click away. The counts moved
  // to /dashboard, which is where a report belongs.
  await page.goto("/");
  await expect(page.getByTestId("outliner").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Save note" })).toBeVisible();
  await expect(page.getByPlaceholder(/Ask the team/).first()).toBeVisible();

  await page.goto("/dashboard");
  await expect(page.getByText(/Tasks \(/)).toBeVisible();
});

test("a pane is worked in, not only read", async ({ page }) => {
  // The whole reason a pane holds the page rather than a summary of it. A
  // task made in a pane is a task, in the same table, visible on the page the
  // pane is a pane of.
  await page.goto("/?panes=tasks");
  // Loaded is not the same as working: the form in there needs its page's
  // JavaScript. The frame says when that has happened.
  await expect(
    page.locator('[data-pane-target="tasks"] iframe[data-pane-ready="1"]'),
  ).toBeVisible({ timeout: 30_000 });
  const frame = page.frameLocator('[data-pane-target="tasks"] iframe');

  const title = `E2E — made in a pane ${Date.now()}`;
  await frame.getByPlaceholder(/Call HM/).fill(title);
  await frame.getByRole("button", { name: "Add task" }).click();
  await expect(frame.getByText(title)).toBeVisible({ timeout: 15_000 });

  // And it is really there, not only in the frame that made it.
  await page.goto("/tasks");
  await expect(page.getByText(title)).toBeVisible();
});

test("a pane arrives without the workspace around it", async ({ page }) => {
  // A sidebar, a pane rail and a command bar inside a 500px frame would be a
  // workspace inside a workspace. The page detects the frame and comes bare.
  await page.goto("/?panes=tasks");
  const frame = page.frameLocator('[data-pane-target="tasks"] iframe');
  await expect(frame.getByTestId("paned-page")).toBeVisible();
  await expect(frame.getByTestId("workspace-menu")).toHaveCount(0);
  await expect(frame.getByTestId("sliding-panes")).toHaveCount(0);
});

test("the page behind catches up when you come back to it", async ({
  page,
}) => {
  // Work done in a pane is real work, and the window behind it was rendered
  // before that happened. Returning focus to the page is when you look at it
  // again, and the only moment a refresh cannot interrupt anything.
  await page.goto("/tasks?panes=tasks");
  await expect(
    page.locator('[data-pane-target="tasks"] iframe[data-pane-ready="1"]'),
  ).toBeVisible({ timeout: 30_000 });
  const frame = page.frameLocator('[data-pane-target="tasks"] iframe');

  const title = `E2E — catch up ${Date.now()}`;
  await frame.getByPlaceholder(/Call HM/).fill(title);
  await frame.getByRole("button", { name: "Add task" }).click();
  await expect(frame.getByText(title)).toBeVisible({ timeout: 15_000 });

  await page.getByTestId("page-pane").click({ position: { x: 5, y: 5 } });
  await expect(page.getByTestId("page-pane").getByText(title)).toBeVisible({
    timeout: 15_000,
  });
});
