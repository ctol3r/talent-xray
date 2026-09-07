import { expect, test, type Page } from "@playwright/test";

/**
 * Wave H through the real UI, with mock adapters and no network.
 *
 * The run proves the things a recruiter has to be able to trust: an address
 * says where it came from, a private surface is refused until this search
 * says otherwise in writing, two people sharing an address raises a question
 * rather than merging them, and the app never shows an address it would not
 * let you keep. Every link is asserted, never followed.
 */
function moduleNav(page: Page, label: string) {
  return page.getByTestId("workspace-nav").getByRole("link", { name: label });
}

async function addCandidate(page: Page, project: string, name: string) {
  await page.goto(`/searches/${project}/candidates`);
  await page
    .getByRole("button", { name: "Add candidate", exact: true })
    .click();
  await page.fill('input[name="candidateName"]', name);
  await page
    .locator("form")
    .getByRole("button", { name: "Add candidate", exact: true })
    .click();
  await page.getByRole("link", { name, exact: true }).click();
}

test("addresses carry their provenance, private surfaces are refused, duplicates raise a question", async ({
  page,
}) => {
  await page.goto("/searches/new");
  await page.fill('input[name="name"]', "E2E — profile connections");
  await page.fill('input[name="roleTitle"]', "Staff Engineer");
  await page.click('button:has-text("Create search")');
  await expect(page).toHaveURL(/\/searches\/[^/]+\/role/);
  const project = page.url().match(/searches\/([^/]+)/)![1];

  await addCandidate(page, project, "Jordan Rivera");

  // 1. An empty card says so, and the notice clock is running because no
  //    jurisdiction has been set (the strictest default).
  const card = page.locator("section", { hasText: "Profile connections" });
  await expect(
    page.getByText("Profile connections — 0 addresses"),
  ).toBeVisible();
  await expect(page.getByText(/notice:/)).toBeVisible();
  await expect(page.getByText(/due \d{4}-\d{2}-\d{2}/)).toBeVisible();

  // 2. Two addresses in one paste, with the recruiter's own reason.
  await card
    .locator("textarea")
    .first()
    .fill(
      "https://github.com/jrivera-dev\nhttps://orcid.org/0000-0002-1825-0097",
    );
  await card
    .getByPlaceholder("Why you think these are the same person (your own note)")
    .fill("Same employer and city as the LinkedIn profile");
  await card.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("2 kept")).toBeVisible();

  await page.reload();
  await expect(
    page.getByText("Profile connections — 2 addresses"),
  ).toBeVisible();
  const githubRow = page.locator("li", { hasText: "github.com/jrivera-dev" });
  await expect(
    githubRow.getByText("unverified · recruiter-added"),
  ).toBeVisible();
  await expect(
    githubRow.getByText(/added by you on .* via paste/),
  ).toBeVisible();
  await expect(
    githubRow.getByText("Address only. The page was never read or stored"),
  ).toBeVisible();
  await expect(
    githubRow.getByText(
      "Why you kept it: Same employer and city as the LinkedIn profile",
    ),
  ).toBeVisible();
  const link = githubRow.getByRole("link", { name: /github\.com/ });
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", /noopener/);
  // Grouped by what kind of surface it is.
  await expect(page.getByText("Professional profile (1)")).toBeVisible();
  await expect(page.getByText("Scholarly / registry (1)")).toBeVisible();

  // 3. A private surface is refused, with the reason it is refused, and turns
  //    on only for this search and only in writing.
  const cardAfter = page.locator("section", { hasText: "Profile connections" });
  await cardAfter
    .locator("textarea")
    .first()
    .fill("https://www.facebook.com/jordan.rivera");
  await cardAfter.getByRole("button", { name: "Add", exact: true }).click();
  // The refusal names the line that was refused, and the full warning appears
  // beside the reason field so the recruiter reads it before overriding.
  await expect(
    page.getByText(
      /https:\/\/www\.facebook\.com\/jordan\.rivera — Personal-life surface/,
    ),
  ).toBeVisible();
  await expect(
    page.getByText(/UK, French, Italian and Dutch regulators/),
  ).toBeVisible();
  await expect(
    page.getByText("Profile connections — 2 addresses"),
  ).toBeVisible();

  await page
    .getByPlaceholder(/Reason this search needs/)
    .fill("Role requires a public-facing community presence; noted at intake");
  await page.getByRole("button", { name: "Turn on for this search" }).click();
  await expect(
    page.getByText("Personal-life surface is on for this search."),
  ).toBeVisible();

  await page
    .locator("section", { hasText: "Profile connections" })
    .locator("textarea")
    .first()
    .fill("https://www.facebook.com/jordan.rivera");
  await page
    .locator("section", { hasText: "Profile connections" })
    .getByRole("button", { name: "Add", exact: true })
    .click();
  await expect(page.getByText("1 kept")).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("personal-life surface · link only · never matched"),
  ).toBeVisible();

  // 4. Reading what the person listed themselves. The mock GitHub account
  //    declares a LinkedIn page, an X handle and an Instagram page; only the
  //    LinkedIn one may be kept in one click.
  await expect(
    page.getByRole("button", { name: /Read github list for jrivera-dev/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /Read github list for jrivera-dev/ })
    .click();
  await expect(
    page.getByText("suggested · not yet opened").first(),
  ).toBeVisible();
  const suggestion = page.locator("li", { hasText: "linkedin.com/in/mock" });
  await expect(suggestion).toBeVisible();
  // The broadcast surface is off for this search, so its address is counted,
  // never shown: naming it would be showing it.
  await expect(page.getByText(/x\.com\/mock-jrivera-dev/)).toHaveCount(0);
  await expect(
    page.getByText(/address(es)? on surfaces that are off for this search/),
  ).toBeVisible();

  await suggestion.getByRole("button", { name: "This is them — keep" }).click();
  await page.reload();
  const declaredRow = page.locator("li", { hasText: "linkedin.com/in/mock" });
  await expect(
    declaredRow.getByText("unverified · declared on GitHub"),
  ).toBeVisible();
  await expect(
    declaredRow.getByText(/read from the GitHub API on \d{4}-\d{2}-\d{2}/),
  ).toBeVisible();
  await expect(
    declaredRow.getByText("found on: https://github.com/jrivera-dev"),
  ).toBeVisible();

  // 5. A second person keeping the same work address raises a question and
  //    merges nothing; both records survive.
  await addCandidate(page, project, "J. Rivera");
  await page
    .locator("section", { hasText: "Profile connections" })
    .locator("textarea")
    .first()
    .fill("https://github.com/jrivera-dev");
  await page
    .locator("section", { hasText: "Profile connections" })
    .getByRole("button", { name: "Add", exact: true })
    .click();
  await expect(page.getByText(/also on Jordan Rivera/)).toBeVisible();

  await moduleNav(page, "Candidates").click();
  await expect(
    page.getByRole("link", { name: "Jordan Rivera", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "J. Rivera", exact: true }),
  ).toBeVisible();

  await page.goto("/tasks");
  // The task names both records so the recruiter can open each one; it does
  // not say which is right, because that is theirs to decide.
  const review = page.getByText(/Identity review.*Rivera/);
  await expect(review).toBeVisible();
  await expect(review).toContainText("J. Rivera");
  await expect(review).toContainText("Jordan Rivera");
  await expect(review).toContainText("decide which record stays");

  // 6. A company page is not a person, whatever the recruiter pastes.
  await page.goto(`/searches/${project}/candidates`);
  await page.getByRole("link", { name: "J. Rivera", exact: true }).click();
  await page
    .locator("section", { hasText: "Profile connections" })
    .locator("textarea")
    .first()
    .fill("https://www.linkedin.com/company/acme");
  await page
    .locator("section", { hasText: "Profile connections" })
    .getByRole("button", { name: "Add", exact: true })
    .click();
  await expect(
    page.getByText("This is a company page, not a person."),
  ).toBeVisible();
});

test("a sweep, a notice and an answer: the whole loop for one person", async ({
  page,
}) => {
  await page.goto("/searches/new");
  await page.fill('input[name="name"]', "E2E — sweep and consent");
  await page.fill('input[name="roleTitle"]', "Research Engineer");
  await page.click('button:has-text("Create search")');
  // Wait for the redirect: reading the URL too early yields "new".
  await expect(page).toHaveURL(/\/searches\/[^/]+\/role/);
  const project = page.url().match(/searches\/([^/]+)/)![1];

  await page.goto(`/searches/${project}/candidates`);
  await page
    .getByRole("button", { name: "Add candidate", exact: true })
    .click();
  await page.fill('input[name="candidateName"]', "Robin Vale");
  await page.getByLabel("Current company").fill("Acme Robotics");
  await page.getByLabel("Geography").fill("Austin, TX");
  await page
    .locator("form")
    .getByRole("button", { name: "Add candidate", exact: true })
    .click();
  await page.getByRole("link", { name: "Robin Vale", exact: true }).click();

  // 1. The sweep is composed from what is already known, and every string
  //    opens on the right engine with the string verbatim.
  await expect(page.getByText("Search for more profiles")).toBeVisible();
  const t1 = page.locator("li", { hasText: "T1 · Every people surface" });
  await expect(t1).toBeVisible();
  const t1Text = await t1.locator("textarea").inputValue();
  expect(t1Text).toContain('"Robin Vale"');
  expect(t1Text).toContain('("Acme Robotics" OR Acme)');
  expect(t1Text).toContain("-site:facebook.com");
  const t1Link = t1.getByRole("link", { name: "Open on engine ↗" });
  const href = new URL((await t1Link.getAttribute("href")) ?? "");
  expect(href.origin + href.pathname).toBe("https://cse.google.com/cse");
  expect(href.searchParams.get("cx")).toBe("a157d37906e1141cc");
  expect(href.searchParams.get("q")).toBe(t1Text);
  await expect(t1Link).toHaveAttribute("rel", /noopener/);

  // The registry template goes to the second engine.
  const t3 = page.locator("li", { hasText: "T3 · Registries and author" });
  const t3Href = new URL(
    (await t3
      .getByRole("link", { name: "Open on engine ↗" })
      .getAttribute("href")) ?? "",
  );
  expect(t3Href.searchParams.get("cx")).toBe("918bc00e18d0c46e5");

  // 2. Recording a sweep run keeps the addresses on this person and lands in
  //    the ledger under its template.
  await page.getByPlaceholder("e.g. 12").fill("7");
  await page
    .getByLabel(/Addresses to keep on Robin Vale/)
    .fill(
      "https://orcid.org/0000-0002-1825-0097\nhttps://github.com/robin-vale",
    );
  await page.getByRole("button", { name: "Record run" }).click();
  await expect(page.getByText(/2 addresses kept on Robin Vale/)).toBeVisible();

  await page.reload();
  await expect(
    page.getByText("Profile connections — 2 addresses"),
  ).toBeVisible();
  await expect(page.getByText(/via sweep T1/).first()).toBeVisible();

  // 3. The notice is due, and the message that discharges it lists what is
  //    held and the right to object.
  await expect(page.getByText(/due \d{4}-\d{2}-\d{2}/)).toBeVisible();
  await page.getByRole("link", { name: /Ask Robin Vale/ }).click();
  await expect(page.getByText("Nothing is sent from here")).toBeVisible();
  const body = await page.locator("textarea").first().inputValue();
  expect(body).toContain("1. https://orcid.org/0000-0002-1825-0097");
  expect(body).toContain("Your right to object.");
  expect(body).toContain("legitimate interest");
  expect(body).toContain("[Your name]");

  await page.getByRole("button", { name: "Record as sent" }).click();
  await expect(page.getByText(/Recorded as sent on/)).toBeVisible();

  // 4. Their answer: one confirmed, one denied and blocked.
  const orcidRow = page.locator("li", { hasText: "orcid.org" });
  await orcidRow.getByLabel("Theirs", { exact: true }).check();
  const githubRow = page.locator("li", { hasText: "github.com/robin-vale" });
  await githubRow.getByLabel("Not theirs", { exact: true }).check();
  await page.getByRole("button", { name: "Record answer" }).click();
  await expect(
    page.getByText(/1 confirmed · 1 removed and blocked/),
  ).toBeVisible();

  await page.goto(`/searches/${project}/candidates`);
  await page.getByRole("link", { name: "Robin Vale", exact: true }).click();
  await expect(
    page.getByText(/confirmed by the person \(recorded by you\)/),
  ).toBeVisible();
  await expect(page.getByText("notice:")).toBeVisible();
  await expect(page.getByText(/sent \d{4}-\d{2}-\d{2}/)).toBeVisible();

  // 5. The denied address cannot come back.
  await page
    .locator("section", { hasText: "Profile connections" })
    .locator("textarea")
    .first()
    .fill("https://github.com/robin-vale");
  await page
    .locator("section", { hasText: "Profile connections" })
    .getByRole("button", { name: "Add", exact: true })
    .click();
  await expect(page.getByText(/asked not to be recorded/)).toBeVisible();

  // 6. And Settings can find who is held at an address.
  await page.goto("/settings");
  await expect(page.getByText("Data requests")).toBeVisible();
  await page
    .getByPlaceholder("https://www.linkedin.com/in/example")
    .fill("https://orcid.org/0000-0002-1825-0097");
  await page.getByRole("button", { name: "Find", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Robin Vale", exact: true }),
  ).toBeVisible();
});
