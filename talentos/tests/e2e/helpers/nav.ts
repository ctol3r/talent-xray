import { expect, type Page } from "@playwright/test";
import { PHASES } from "@/components/workspace-nav";

/**
 * Click a module in the workspace nav, and wait until it is the page.
 *
 * The nav used to be two rows of links — four phases, and only the current
 * phase's modules — so reaching a module meant clicking its phase first. The
 * phase row is now a report on where the job is rather than a way to move, and
 * the module row carries every module, so one click is the whole journey.
 *
 * The wait is not incidental. Two clicks with an assertion between them used
 * to leave enough time for the destination to render, so specs could read the
 * page on the next line and get away with it; one click does not, and
 * `tests/e2e/hill.spec.ts` counted its sliders before the hill existed. So the
 * settling that used to be luck is now the helper's job: it waits for the URL
 * the module owns before it returns.
 */
export async function moduleNav(page: Page, label: string): Promise<void> {
  const module = PHASES.flatMap((phase) => phase.modules).find(
    (entry) => entry.label === label,
  );
  if (!module) throw new Error(`No workspace module is labelled "${label}".`);

  const nav = page.getByTestId("workspace-nav");
  const link = nav.getByRole("link", { name: label, exact: true });
  await expect(link).toBeVisible();
  await link.click();

  // Module paths are letters and hyphens only, so they need no escaping, and
  // the overview's empty path correctly gives "the job itself".
  const landed = new RegExp(`^/searches/[^/]+${module.path}$`);
  // Its own timeout, well under the test's. A module that never arrives should
  // say so in seconds and name itself, not quietly spend the whole budget and
  // report only that the test was slow.
  await page.waitForURL((url) => landed.test(url.pathname), {
    timeout: 15_000,
  });
}
