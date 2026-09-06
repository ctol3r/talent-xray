import { expect, type Page } from "@playwright/test";
import { textDocx, textPdf } from "../../fixtures/document-fixtures";

/**
 * Shared review fixture (Wave B): a search, a candidate, a confirmed CV and
 * JD, one JD-anchored requirement, and the comparison opened. Extracted
 * verbatim from document-review.spec.ts so both specs drive the same flow.
 */
export async function selectPassage(
  page: Page,
  side: "CV" | "JD",
  text: string,
) {
  const area = page.getByRole("textbox", {
    name: `Select ${side} passage`,
    exact: true,
  });
  await area.focus();
  await area.evaluate((el, quote) => {
    const input = el as HTMLTextAreaElement;
    const start = input.value.indexOf(quote);
    if (start < 0) throw new Error("Fixture passage missing");
    input.setSelectionRange(start, start + quote.length);
    input.dispatchEvent(new Event("select", { bubbles: true }));
  }, text);
  await area.press("Shift");
}

export async function openReviewFixture(
  page: Page,
): Promise<{ project: string }> {
  page.setDefaultTimeout(10000);
  await page.setViewportSize({ width: 1800, height: 1100 });
  await page.goto("/searches/new");
  await page.fill('input[name="name"]', "Connected review fixture");
  await page.fill('input[name="roleTitle"]', "Engineer");
  await page
    .getByRole("button", { name: "Create search", exact: true })
    .click();
  await expect(page).toHaveURL(/\/searches\/[^/]+\/role/);
  const project = page.url().match(/searches\/([^/]+)/)![1];
  await page.goto(`/searches/${project}/candidates`);
  await page
    .getByRole("button", { name: "Add candidate", exact: true })
    .click();
  await page.fill('input[name="candidateName"]', "Review Fixture");
  await page
    .locator("form")
    .getByRole("button", { name: "Add candidate", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Review Review Fixture · CV ↔ JD", exact: true })
    .click();
  await page.getByLabel("Upload CV", { exact: true }).setInputFiles({
    name: "fixture-cv.pdf",
    mimeType: "application/pdf",
    buffer: textPdf("Built reliable Python services."),
  });
  await page
    .locator("#import-cv")
    .getByRole("button", { name: "Extract file" })
    .click();
  await expect(
    page.getByRole("textbox", { name: "CV extracted text", exact: true }),
  ).toHaveValue(/Built reliable/);
  await page
    .getByRole("textbox", { name: "CV extracted text", exact: true })
    .fill(
      "Built reliable Python services.\n" +
        "Additional project context.\n".repeat(120),
    );
  await page
    .getByRole("button", { name: "Confirm CV text", exact: true })
    .click();
  await expect(page.locator("#import-cv")).toContainText(
    "Extraction state: confirmed",
  );
  await page.getByLabel("Upload JD", { exact: true }).setInputFiles({
    name: "fixture-jd.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: textDocx("Build reliable Python services."),
  });
  await page
    .locator("#import-jd")
    .getByRole("button", { name: "Extract file" })
    .click();
  await expect(
    page.getByRole("textbox", { name: "JD extracted text", exact: true }),
  ).toHaveValue(/Build reliable/);
  await page
    .getByRole("button", { name: "Confirm JD text", exact: true })
    .click();
  await expect(page.locator("#import-jd")).toContainText(
    "Extraction state: confirmed",
  );
  await page.getByRole("checkbox", { name: "Select exact passages" }).check();
  await selectPassage(page, "JD", "Build reliable Python services.");
  await page.getByText("Add requirement manually", { exact: true }).click();
  await page
    .getByRole("button", { name: "Add selected JD requirement", exact: true })
    .click();
  await expect(page.locator(".review-requirements")).toContainText(
    "Unassessed",
  );
  await page
    .getByRole("button", { name: "Open current comparison", exact: true })
    .click();
  await expect(page).toHaveURL(/comparison=/);
  return { project };
}

/** Create a manual CV↔JD relationship and accept it. */
export async function saveAndAcceptRelationship(
  page: Page,
  assessment: "relevant" | "partial",
) {
  await selectPassage(page, "CV", "Built reliable Python services.");
  await selectPassage(page, "JD", "Build reliable Python services.");
  await page
    .getByRole("textbox", { name: "Explanation", exact: true })
    .fill("The CV describes Python services; production scale is unspecified.");
  await page
    .getByRole("textbox", { name: "Limitations", exact: true })
    .fill("Self-authored claim; no independent verification.");
  await page.getByLabel("Assessment", { exact: true }).selectOption(assessment);
  await page
    .getByRole("button", { name: "Save relationship", exact: true })
    .click();
  await expect(page.locator(".review-context")).toContainText(
    `${assessment} · suggested`,
  );
  await page.getByRole("button", { name: "E · Accept", exact: true }).click();
  await expect(page.locator(".review-context")).toContainText(
    `${assessment} · accepted`,
  );
}
