import { expect, test, type Page } from "@playwright/test";
import { textDocx, textPdf } from "../fixtures/document-fixtures";
async function selectPassage(page: Page, side: "CV" | "JD", text: string) {
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
test("document intake, manual connection, ribbons, persistence, historical review and export", async ({
  page,
}) => {
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
  await page.getByRole("button", { name: "C · Analyze", exact: true }).click();
  const requestArea = page.getByRole("textbox", {
    name: "Artifact request",
    exact: true,
  });
  await expect(requestArea).toHaveValue(/document-comparison-request/);
  const artifact = JSON.parse(await requestArea.inputValue()) as {
    contextHash: string;
    data: { requirements: { id: string }[] };
  };
  await page
    .getByRole("textbox", { name: "Artifact response JSON", exact: true })
    .fill(
      JSON.stringify({
        contextHash: artifact.contextHash,
        output: {
          links: [
            {
              requirementId: artifact.data.requirements[0].id,
              cvQuote: "Fabricated source passage",
              jdQuote: "Build reliable Python services.",
              assessment: "relevant",
              explanation: "Deliberately invalid fixture",
              limitation: "Reject this quote",
            },
          ],
        },
      }),
    );
  await page
    .getByRole("button", {
      name: "Validate and import suggestions",
      exact: true,
    })
    .click();
  await expect(page.getByRole("status").first()).toContainText(
    "0 suggested relationships imported; 1 unresolved anchors rejected",
  );

  await selectPassage(page, "CV", "Built reliable Python services.");
  await selectPassage(page, "JD", "Build reliable Python services.");
  await page
    .getByRole("textbox", { name: "Explanation", exact: true })
    .fill("The CV describes Python services; production scale is unspecified.");
  await page
    .getByRole("textbox", { name: "Limitations", exact: true })
    .fill("Self-authored claim; no independent verification.");
  await page.getByLabel("Assessment", { exact: true }).selectOption("partial");
  await page
    .getByRole("button", { name: "Save relationship", exact: true })
    .click();
  await expect(page.locator(".review-ribbons path")).toHaveCount(1);
  await page.locator(".review-cv .review-scroll").evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expect(page.locator(".review-ribbons path")).toHaveCount(0);
  await page.locator(".review-jd mark").click();
  await expect(page.locator(".review-ribbons path")).toHaveCount(1);
  await page.setViewportSize({ width: 1450, height: 950 });
  await expect(page.locator(".review-ribbons path")).toHaveCount(1);
  await page.setViewportSize({ width: 1800, height: 1100 });

  await expect(page.locator(".review-context")).toContainText(
    "partial · suggested",
  );
  await page.getByRole("button", { name: "E · Accept", exact: true }).click();
  await expect(page.locator(".review-context")).toContainText(
    "partial · accepted",
  );
  const reviewUrl = page.url();
  await page.reload();
  await expect(page.locator(".review-context")).toContainText(
    "partial · accepted",
  );
  await page
    .getByRole("button", { name: "H · Review output", exact: true })
    .click();
  await page.getByRole("checkbox", { name: "Include in export" }).check();
  await page
    .getByRole("textbox", { name: "Recruiter-authored conclusion" })
    .fill("Ask about production scale before shortlisting.");
  await page
    .getByRole("button", { name: "Save conclusion", exact: true })
    .click();
  await expect(
    page.getByText(
      "Saved conclusion: Ask about production scale before shortlisting.",
    ),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export selected reviewed material" })
    .click();
  expect((await downloadPromise).suggestedFilename()).toBe(
    "reviewed-material.json",
  );
  await page
    .getByRole("link", { name: "Prepare reviewed shortlist", exact: true })
    .click();
  await expect(page).toHaveURL(/review-shortlist$/);
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Save draft selection", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Draft selection saved.");
  await page.reload();
  await expect(page.getByRole("checkbox")).toBeChecked();
  const shortlistDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export saved draft shortlist", exact: true })
    .click();
  expect((await shortlistDownload).suggestedFilename()).toBe(
    "reviewed-shortlist-draft.json",
  );
  await page.goto(reviewUrl);
  await page
    .getByRole("button", { name: "H · Review output", exact: true })
    .click();
  await page.screenshot({
    path: "test-results/connected-review.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "A · Import CV", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "CV extracted text", exact: true })
    .fill("Revised text with different experience.");
  await page
    .getByRole("button", { name: "Confirm CV text", exact: true })
    .click();
  await expect(page.locator(".review-stale")).toBeVisible();
  await expect(page.locator(".review-cv")).toContainText(
    "Built reliable Python services.",
  );
  await expect(
    page.getByRole("button", { name: "E · Accept", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "E · Accept", exact: true }),
  ).toHaveAttribute("title", /Historical comparison/);
  await page.goto(`/searches/${project}/candidates`);
  await page.getByRole("button", { name: "Show candidate deck" }).click();
  await page.getByRole("link", { name: "Open CV–JD comparison" }).click();
  await expect(page.locator(".review-stale")).toBeVisible();
  await expect(page.locator(".review-cv")).toContainText(
    "Built reliable Python services.",
  );
  await page.goto(reviewUrl);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 600, height: 900 });
  await expect(page.locator(".review-ribbons")).toBeHidden();
  await expect(page.locator(".review-cv")).toContainText(
    "Built reliable Python services.",
  );
});
