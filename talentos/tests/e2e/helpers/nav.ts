import { expect, type Page } from "@playwright/test";

/**
 * Click a module in the workspace nav.
 *
 * The nav used to be two rows of links — four phases, and only the current
 * phase's modules — so reaching a module meant clicking its phase first. The
 * phase row is now a report on where the job is rather than a way to move, and
 * the module row carries every module, so one click is the whole journey.
 *
 * Kept as a helper anyway: every spec goes through here, so the day the row
 * changes shape again it changes in one file rather than twenty.
 */
export async function moduleNav(page: Page, label: string): Promise<void> {
  const nav = page.getByTestId("workspace-nav");
  const link = nav.getByRole("link", { name: label, exact: true });
  await expect(link).toBeVisible();
  await link.click();
}
