import { expect, test } from "@playwright/test";
import { moduleNav } from "./helpers/nav";

/**
 * D-034: link-out discovery. The Discover page opens a stored string on the
 * engine's own hosted results page (no key, no fetch); the recruiter records
 * the count they read and pastes the URLs they chose to keep. Those land in
 * the same yield ledger as an API run, credited to the stored string only
 * when it ran verbatim. No network: the link is asserted, not followed.
 */
const JD = `Founding Recruiter
Build the talent function from scratch: sourcing, structured interviews,
ATS setup, employer brand for an AI safety research organisation.`;

test("a link-out run and its pasted saves are credited to the stored string", async ({
  page,
}) => {
  await page.goto("/searches/new");
  await page.fill('input[name="name"]', "E2E — link-out discovery");
  await page.fill('input[name="roleTitle"]', "Founding Recruiter");
  // Industry is a dropdown now (D-050): a job typed "AI safety research"
  // and another typed "AI safety" cannot be compared.
  await page.selectOption('select[name="industry"]', "ai_research");
  await page.click('button:has-text("Create job")');
  await expect(page).toHaveURL(/\/searches\/[^/]+\/role/);

  await page.fill('textarea[name="jd"]', JD);
  await page.click('button:has-text("Save job description")');
  await expect(page.locator("summary", { hasText: "Saved" })).toBeVisible();

  await moduleNav(page, "Strings");
  await page.click('button:has-text("Generate strings")');
  await expect(page.getByText("site:linkedin.com/in").first()).toBeVisible({
    timeout: 30_000,
  });

  await moduleNav(page, "Discover");
  const storedQuery = await page.locator("textarea").first().inputValue();

  // The hosted page link carries the Core engine id and the string verbatim.
  const open = page.getByRole("link", { name: "Open on engine ↗" });
  await expect(open).toHaveAttribute("target", "_blank");
  await expect(open).toHaveAttribute("rel", "noopener");
  const href = await open.getAttribute("href");
  const url = new URL(href ?? "");
  expect(url.origin + url.pathname).toBe("https://cse.google.com/cse");
  expect(url.searchParams.get("cx")).toBe("a157d37906e1141cc");
  expect(url.searchParams.get("q")).toBe(storedQuery);

  // Switching engines changes the id, never the string.
  await page.locator("select").nth(1).selectOption("reach");
  const reachHref = await open.getAttribute("href");
  expect(new URL(reachHref ?? "").searchParams.get("cx")).toBe(
    "918bc00e18d0c46e5",
  );
  expect(new URL(reachHref ?? "").searchParams.get("q")).toBe(storedQuery);
  await page.locator("select").nth(1).selectOption("core");

  // A bad line is reported, not dropped.
  await page.getByPlaceholder("e.g. 230").fill("230");
  await page.locator("textarea").nth(1).fill("not a url");
  await page.getByRole("button", { name: "Record run" }).click();
  await expect(page.getByText(/Not a complete http\(s\) URL/)).toBeVisible();

  await page
    .locator("textarea")
    .nth(1)
    .fill(
      "https://www.linkedin.com/in/e2e-linkout-person | E2E Linkout Person\nhttps://github.com/e2e-linkout",
    );
  await page.getByRole("button", { name: "Record run" }).click();
  await expect(
    page.getByText("Run recorded · 2 saved · 1 candidate created"),
  ).toBeVisible();

  await page.reload();
  await expect(page.locator("select").first()).toContainText("· 2 saved");
  await expect(page.getByText("Yield for this search")).toBeVisible();
  await expect(page.getByText(/1 run · 2 saved · 1 candidate/)).toBeVisible();
  // Scoped past the connected-here panel at the foot of every page, which
  // lists the same records by name (D-100). The page's own content always
  // comes first in the document.
  await expect(
    page.getByRole("link", { name: "https://github.com/e2e-linkout" }).first(),
  ).toHaveAttribute("rel", "noopener");

  // Edited run: recorded, not credited.
  await page.locator("textarea").first().fill(`${storedQuery} extra`);
  await expect(page.getByText("Edited from the stored string")).toBeVisible();
  await page.getByPlaceholder("e.g. 230").fill("0");
  await page.getByRole("button", { name: "Record run" }).click();
  await expect(
    page.getByText("Run recorded · 0 saved · 0 candidates created"),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator("select").first()).toContainText("· 2 saved");
  await expect(page.getByText(/2 runs · 2 saved · 1 candidate/)).toBeVisible();

  await moduleNav(page, "Strings");
  await expect(page.getByText("ran 1× · 2 saved").first()).toBeVisible();

  await moduleNav(page, "Candidates");
  await expect(
    page
      .getByRole("table")
      .getByRole("link", { name: "E2E Linkout Person", exact: true }),
  ).toBeVisible();
});
