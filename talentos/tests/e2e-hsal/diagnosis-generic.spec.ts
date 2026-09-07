import { expect, test, type Page } from "@playwright/test";

/**
 * The complete OBSERVE → BELIEVE → CHALLENGE → TEST → ACT → OBSERVE AGAIN →
 * REVISE → LEARN loop on a search created through the UI, with no fixture
 * data. The recruiter's confidence must not move until they revise it.
 */

const BASELINE = {
  Sourced: 124,
  "Outreach sent": 118,
  Replies: 17,
  "Positive replies": 9,
  "Recruiter screens": 6,
  "HM screens": 4,
  Onsites: 1,
  Offers: 0,
  Hires: 0,
};
const AFTER = {
  Sourced: 58,
  "Outreach sent": 55,
  Replies: 21,
  "Positive replies": 15,
  "Recruiter screens": 11,
  "HM screens": 8,
  Onsites: 5,
  Offers: 2,
  Hires: 1,
};

/** The recruiter's confidence as the belief card shows it. */
const bigNumber = (page: Page) => page.locator("div.text-3xl").first();

async function fillCounts(page: Page, counts: Record<string, number>) {
  for (const [label, value] of Object.entries(counts)) {
    await page.getByLabel(label, { exact: true }).fill(String(value));
  }
}

/** React-controlled range inputs need the native setter + an input event. */
async function setRange(page: Page, value: number) {
  await page
    .locator('input[type="range"]')
    .first()
    .evaluate((el, v) => {
      const input = el as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!;
      setter.call(input, String(v));
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }, value);
}

test("generic search runs the whole diagnosis loop; confidence only moves on explicit revision", async ({
  page,
}) => {
  page.on("dialog", (d) => d.accept());

  // a search created like any other
  await page.goto("/searches/new");
  await page.fill('input[name="name"]', "HSAL generic loop");
  await page.fill('input[name="roleTitle"]', "Staff Platform Engineer");
  await page
    .getByRole("button", { name: "Create search", exact: true })
    .click();
  await expect(page).toHaveURL(/\/searches\/[^/]+\/role/);
  const id = page.url().match(/searches\/([^/]+)/)![1];
  await page.goto(`/searches/${id}/diagnosis`);

  // OBSERVE: baseline pipeline typed in (no fixture, no events yet)
  await expect(page.getByText("No pipeline snapshot yet")).toBeVisible();
  await fillCounts(page, BASELINE);
  await page
    .getByRole("button", { name: "Record pipeline", exact: true })
    .click();
  await expect(page.getByText("Largest observed drop:")).toBeVisible();
  await expect(page.getByText("124", { exact: true })).toBeVisible();

  // BELIEVE
  await page
    .getByPlaceholder(
      "What do you currently think is causing the search problem?",
    )
    .fill("The candidate market is the primary constraint.");
  await setRange(page, 70);
  await page
    .getByRole("button", { name: "Record what I think", exact: true })
    .click();
  await expect(
    page.getByText("“The candidate market is the primary constraint.”"),
  ).toBeVisible();
  await expect(bigNumber(page)).toHaveText("70%");

  // CHALLENGE + COMPARE + DESIGN TEST
  await page.getByRole("button", { name: /^(re-)?run diagnosis$/i }).click();
  await expect(
    page.getByText(/Support: (high|medium|low)/).first(),
  ).toBeVisible({ timeout: 60_000 });
  await expect(bigNumber(page)).toHaveText("70%");
  await page.getByRole("button", { name: "Select test", exact: true }).click();
  await expect(page.getByText("selected", { exact: true })).toBeVisible();

  // ACT: record what the test showed
  await page
    .getByPlaceholder("What did the test show? (one line)")
    .fill("The HM advanced most adjacent candidates when title was hidden.");
  await page
    .getByPlaceholder(/Distinct observations/)
    .fill(
      "7 of 10 adjacent candidates advanced\nAdvanced candidates held Senior, Principal and Staff titles",
    );
  const advanced = page.getByLabel("Candidates advanced");
  if (await advanced.isVisible()) {
    await advanced.fill("7");
    await page.getByLabel("Candidates reviewed").fill("10");
  }
  await page
    .getByRole("button", { name: "Record result", exact: true })
    .click();
  await expect(
    page.getByText("Experiment result", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Your belief still reads/)).toContainText("70%");

  // ACT: the human changes the Success Profile (workstation applies; HSAL records)
  const profileForm = page.locator("form").filter({
    has: page.getByRole("button", {
      name: "Apply profile change",
      exact: true,
    }),
  });
  await expect(profileForm.locator("textarea")).toHaveCount(3);
  const must = profileForm.locator('textarea[name="mustHave"]');
  const transferable = profileForm.locator('textarea[name="transferable"]');
  await must.fill(
    "Production distributed systems experience\nEvidence of Staff-equivalent scope",
  );
  await transferable.fill("Professional Go experience");
  await expect(transferable).toHaveValue("Professional Go experience");
  await page
    .getByRole("button", { name: "Apply profile change", exact: true })
    .click();
  await expect(page.getByText("Success Profile changed by you")).toBeVisible();
  await expect(
    page.getByText(/Now transferable: Professional Go experience/),
  ).toBeVisible();

  // OBSERVE AGAIN: post-intervention pipeline → Trajectory
  await fillCounts(page, AFTER);
  await page
    .getByRole("button", { name: "Record pipeline and compare", exact: true })
    .click();
  await expect(page.getByText(/^Trajectory /)).toBeVisible();
  await expect(page.getByText(/Hires: 0 → 1/)).toBeVisible();
  await expect(page.getByText(/Onsites: 1 → 5/)).toBeVisible();
  await expect(bigNumber(page)).toHaveText("70%"); // still untouched

  // REVISE: explicit, with a reason
  await setRange(page, 30);
  await page
    .getByPlaceholder("Why are you changing your confidence?")
    .fill(
      "Hidden-title review advanced 7 of 10; broadened profile converted downstream.",
    );
  await page
    .getByRole("button", { name: "Revise my confidence", exact: true })
    .click();
  await expect(page.getByText(/Revised to/)).toContainText("30%");
  await expect(bigNumber(page)).toHaveText("30%");

  // LEARN
  await page
    .getByPlaceholder("Title")
    .fill("Title and stack are weak proxies for Staff scope");
  await page
    .getByPlaceholder("What should the next similar search do differently?")
    .fill(
      "Calibrate on demonstrated scope before filtering on current title or language.",
    );
  await page
    .getByRole("button", { name: "Save learning", exact: true })
    .click();
  await expect(
    page.getByText("Title and stack are weak proxies for Staff scope"),
  ).toBeVisible();
  await expect(page.getByText(/from beliefs/)).toBeVisible();
});
