/**
 * The Phase-1 acceptance test (PRODUCT_SPEC.md §Critical end-to-end test),
 * driven through the real UI against the mock provider:
 * create search → JD → role intelligence → edit → intake → answers →
 * profile → strategy → channels → strings → candidate → evidence →
 * outreach → pipeline → screen → interview evidence → close plan →
 * offer accepted → onboarding → analytics + learnings.
 */
import { expect, test, type Page } from "@playwright/test";

const CAIS_JD = `The Center for AI Safety (CAIS) is hiring a Research Scientist or Research Engineer to advance empirical machine learning safety research in San Francisco. Strong empirical research record (first-author publications at NeurIPS, ICML, ICLR or equivalent open-source impact), excellent engineering in Python and PyTorch or JAX, experience with distributed training. Research taste matters more than citation counts. On-site in San Francisco.`;

function moduleNav(page: Page, label: string) {
  return page.getByTestId("workspace-nav").getByRole("link", { name: label });
}

test("critical path: intake to onboarding on one search", async ({ page }) => {
  // 1. Create the SearchProject.
  await page.goto("/searches/new");
  await page.fill('input[name="name"]', "E2E — CAIS Research Scientist");
  await page.fill(
    'input[name="roleTitle"]',
    "Research Scientist / Research Engineer",
  );
  await page.fill('input[name="companyName"]', "Center for AI Safety");
  await page.fill('input[name="geography"]', "San Francisco, CA");
  await page.fill('input[name="industry"]', "AI safety research");
  await page.click('button:has-text("Create search")');
  await expect(page).toHaveURL(/\/searches\/[^/]+\/role/);

  // 2. Paste the JD.
  await page.fill('textarea[name="jd"]', CAIS_JD);
  await page.click('button:has-text("Save job description")');
  await expect(page.locator("summary", { hasText: "Saved" })).toBeVisible();

  // 3. Extract role intelligence.
  await page.click('button:has-text("Extract role intelligence")');
  await expect(page.getByText("Role hypothesis")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText("Unresolved questions")).toBeVisible();

  // 4. Recruiter edits a requirement through the schema-validated editor.
  await page.click('button:has-text("Edit JSON")');
  const editor = page.locator("textarea").last();
  const payload = JSON.parse(await editor.inputValue()) as {
    hardRequirements: { text: string; provenance: string }[];
  };
  payload.hardRequirements[0].text = "EDITED-REQ-E2E";
  payload.hardRequirements[0].provenance = "recruiter";
  await editor.fill(JSON.stringify(payload, null, 2));
  await page.click('button:has-text("Save")');
  await expect(page.getByText("EDITED-REQ-E2E")).toBeVisible({
    timeout: 15_000,
  });

  // 5. Generate the tailored intake; it must show domain depth.
  await moduleNav(page, "Intake").click();
  await page.click('button:has-text("Generate intake")');
  await expect(page.getByText("Why the role exists")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(/publication quality/i).first()).toBeVisible();

  // 6. Capture an answer and complete the intake.
  await page
    .locator('textarea[placeholder*="Capture the hiring manager"]')
    .first()
    .fill("Capability-driven: we need benchmark construction capacity.");
  await page.locator('button:has-text("Save answer")').first().click();
  await expect(page.getByText(/1\/\d+ answered/)).toBeVisible({
    timeout: 15_000,
  });
  await page.click('button:has-text("Mark intake complete")');
  await expect(page.getByText("complete", { exact: true })).toBeVisible({
    timeout: 15_000,
  });

  // 7. Success profile.
  await moduleNav(page, "Profile").click();
  await page.click('button:has-text("Compile success profile")');
  await expect(page.getByText("Mission", { exact: true })).toBeVisible({
    timeout: 30_000,
  });

  // 8. Sourcing strategy.
  await moduleNav(page, "Strategy").click();
  await page.click('button:has-text("Generate strategy")');
  await expect(page.getByText("Primary target profile")).toBeVisible({
    timeout: 30_000,
  });

  // 9. Channels — model suggestions land as 'inferred', never invented facts.
  await moduleNav(page, "Sources").click();
  await page.click('button:has-text("Map channels")');
  await expect(page.getByText("Google Scholar")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText("inferred").first()).toBeVisible();

  // 10. Boolean/x-ray strings.
  await moduleNav(page, "Strings").click();
  await page.click('button:has-text("Generate strings")');
  await expect(page.getByText("site:linkedin.com/in").first()).toBeVisible({
    timeout: 30_000,
  });

  // 11. Add a candidate.
  await moduleNav(page, "Candidates").click();
  await page.click('button:has-text("Add candidate")');
  await page.fill('input[name="candidateName"]', "Evelyn Example");
  await page
    .locator("textarea")
    .last()
    .fill(
      "Built distributed training infrastructure; two first-author workshop papers.",
    );
  await page.click('form button:has-text("Add candidate")');
  await expect(page.getByRole("link", { name: "Evelyn Example" })).toBeVisible({
    timeout: 15_000,
  });

  // 12. Evidence alignment — advisory, never a decision.
  await page.getByRole("link", { name: "Evelyn Example" }).click();
  await page.click('button:has-text("Align evidence")');
  await expect(
    page.getByText("advisory review priority — you decide"),
  ).toBeVisible({
    timeout: 30_000,
  });

  // 13. Outreach drafts with citations; nothing sends.
  await page.click('button:has-text("Draft outreach sequence")');
  await expect(page.getByText("email 1 · day 0")).toBeVisible({
    timeout: 30_000,
  });

  // 14. Move through the pipeline (every move logs an event).
  await page
    .locator('select[title*="Move stage"]')
    .first()
    .selectOption("recruiter_screen");
  await expect(page.locator('select[title*="Move stage"]').first()).toHaveValue(
    "recruiter_screen",
    { timeout: 15_000 },
  );

  // 15. Recruiter screen guide.
  await moduleNav(page, "Screen").click();
  await page.click('button:has-text("Generate screen guide")');
  await expect(
    page.getByText("Strong evidence sounds like").first(),
  ).toBeVisible({
    timeout: 30_000,
  });

  // 16. Interview plan + structured scorecard (rating requires evidence).
  await moduleNav(page, "Interviews").click();
  await page.click('button:has-text("Design interview plan")');
  await expect(page.getByText("1. Recruiter Screen")).toBeVisible({
    timeout: 30_000,
  });
  await page.click('button:has-text("Record interview evidence")');
  await page.getByLabel("Competency").fill("Experimental execution");
  await page
    .getByLabel("Rating", { exact: true })
    .selectOption("strong_evidence");
  await page
    .getByLabel("Observation (what happened — verbatim, factual)")
    .fill(
      "Described running ablations across 20 model variants with clear methodology.",
    );
  await page
    .getByLabel("Interpretation (what you make of it)")
    .fill("Owns experiments end to end.");
  await page
    .getByLabel(/Written evidence for the rating/)
    .fill("Concrete ablation story with scale, tooling, and outcomes.");
  await page.click('button:has-text("Submit scorecard")');
  await page
    .locator('summary:has-text("Evelyn Example")')
    .first()
    .click({ timeout: 15_000 });
  await expect(
    page.getByText("Strong evidence", { exact: true }).first(),
  ).toBeVisible({
    timeout: 15_000,
  });

  // 17–18. Offer: extended → accepted (drives pipeline stages).
  await moduleNav(page, "Close").click();
  await page.getByLabel("Offer status").selectOption("extended");
  await expect(page.getByText("offer extended", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByLabel("Offer status").selectOption("accepted");
  await expect(page.getByText("offer accepted", { exact: true })).toBeVisible({
    timeout: 15_000,
  });

  // Close plan.
  await page.click('button:has-text("Build close plan")');
  await expect(page.getByText("Risk of decline")).toBeVisible({
    timeout: 30_000,
  });

  // 19. Onboarding plan with working checklist.
  await page.click('button:has-text("Generate onboarding plan")');
  await expect(
    page.getByText("Confirm written acceptance", { exact: false }),
  ).toBeVisible({ timeout: 30_000 });
  const firstCheckbox = page.locator('input[type="checkbox"]').first();
  await firstCheckbox.check();
  await expect(firstCheckbox).toBeChecked({ timeout: 15_000 });

  // 20. Analytics show the accepted offer; learnings capture + synthesis.
  await moduleNav(page, "Analytics").click();
  await expect(
    page.getByText("Funnel — candidates who ever reached each stage"),
  ).toBeVisible();
  await expect(page.getByText("Offer Accepted").first()).toBeVisible();

  await moduleNav(page, "Learnings").click();
  await page
    .getByLabel("What happened, and what it teaches")
    .fill("Mission alignment plus a fast process won the accept.");
  await page.click('button:has-text("Record learning")');
  await expect(
    page
      .getByText("Mission alignment plus a fast process won the accept.")
      .first(),
  ).toBeVisible({ timeout: 15_000 });
  await page.click('button:has-text("Synthesize learnings")');
  await expect(page.getByText("small sample").first()).toBeVisible({
    timeout: 30_000,
  });

  // Dashboard reflects the search.
  await page.goto("/");
  await expect(
    page.getByText("E2E — CAIS Research Scientist").first(),
  ).toBeVisible();
});
