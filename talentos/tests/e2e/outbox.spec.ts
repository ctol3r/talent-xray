import { expect, test } from "@playwright/test";

/**
 * The outbox page, as a person meets it.
 *
 * The loop itself — ask, row, paste, answered in the conversation — is tested
 * against the real services in `tests/unit/outbox.test.ts`, because e2e runs
 * on the mock provider and the mock never writes a handoff. What is asserted
 * here is everything that only exists in a browser: that the queue is
 * reachable from the nav, that a waiting request reads as one row saying what
 * it is and how long it has waited, that a bad paste is refused by the name of
 * the field, and that a good one is written and the row changes state.
 *
 * The request it works on is seeded into a throwaway outbox by the global
 * setup, so nothing here can touch a real waiting request.
 */
test("the queue is reachable, readable, and answerable", async ({ page }) => {
  await page.goto("/");

  // It is in the nav, not only at a URL somebody has to know.
  await page
    .getByRole("link", { name: /Outbox/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/outbox$/);

  // One row, and it says what the request is and what it belongs to.
  const row = page.getByTestId("outbox-row");
  await expect(row).toHaveCount(1);
  await expect(row).toHaveAttribute("data-state", "waiting");
  await expect(row).toContainText("Expert reply");
  await expect(row).toContainText("why is nobody replying");
  await expect(row).toContainText(/waiting \d+ (minute|hour|day)/);
  await expect(page.getByTestId("outbox-copy")).toBeVisible();

  // A response missing a field is refused, and the message names the field.
  await page.getByTestId("outbox-paste-toggle").click();
  await page
    .getByTestId("outbox-paste")
    .fill(JSON.stringify({ answer: "Because.", uncertain: [], next: [] }));
  await page.getByTestId("outbox-submit").click();
  await expect(page.getByTestId("outbox-error")).toContainText("declined");

  // Still waiting: a refusal writes nothing.
  await expect(row).toHaveAttribute("data-state", "waiting");

  // A valid one is taken, and the row stops waiting.
  await page.getByTestId("outbox-paste").fill(
    JSON.stringify({
      answer: "A first message that asks for a call asks for a decision early.",
      uncertain: [],
      declined: false,
      next: [],
    }),
  );
  await page.getByTestId("outbox-submit").click();
  await expect(page.getByTestId("outbox-done")).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("outbox-row")).toHaveCount(0);
  await page.getByText(/already answered/).click();
  await expect(
    page.getByTestId("outbox-answered").getByTestId("outbox-row"),
  ).toHaveAttribute("data-state", "answered");
});
