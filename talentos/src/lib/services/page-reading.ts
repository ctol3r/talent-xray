/**
 * Reading the pages a search returned.
 *
 * The one call site for `PageReader`, and deliberately the only one: a run's
 * budget, its robots cache and its per-host pace only mean anything if every
 * address in a run goes through the same reader.
 *
 * Nothing here writes to the database. A reading is handed back to the page
 * and dropped; a person becomes a record through the same explicit save a
 * link-out result already uses. That is the other half of the rule the owner
 * reversed — fetching is now permitted, bulk-persisting still is not.
 */
import { z } from "zod";
import {
  PageReader,
  readerEnv,
  readingSwitches,
  whyDisabled,
  type PageRead,
  type ReadingSwitch,
} from "@/lib/fetch/read-page";
import { registrySummary } from "@/lib/fetch/registry";
import { unverifiedOperators } from "@/lib/research/web-search/brave";

export const readPagesInput = z.object({
  urls: z.array(z.string().min(8).max(2048)).min(1).max(25),
});

export interface PageReadingRun {
  reads: PageRead[];
  /** What the run spent, so the page can show it rather than imply it. */
  requests: number;
  bytes: number;
  /** Empty when reading is on. */
  disabled: string;
}

export async function readPages(
  input: z.infer<typeof readPagesInput>,
): Promise<PageReadingRun> {
  const env = readerEnv();
  if (!env.enabled) {
    return {
      reads: input.urls.map((url) => ({
        url,
        finalUrl: url,
        ok: false,
        reason: whyDisabled(env),
        reading: null,
        title: "",
        bytes: 0,
        hops: 0,
      })),
      requests: 0,
      bytes: 0,
      disabled: whyDisabled(env),
    };
  }

  const reader = new PageReader({ env });
  const reads: PageRead[] = [];
  // Sequential on purpose. The per-host pace is the point, and a run that
  // fires them all at once satisfies the interval on paper while sending
  // everything at the same moment.
  for (const url of input.urls) {
    reads.push(await reader.read(url));
  }
  return {
    reads,
    requests: reader.budget.requests,
    bytes: reader.budget.bytes,
    disabled: "",
  };
}

/**
 * What turning both switches on would do, and what it would still not do.
 *
 * Written here rather than in the card because it is the answer to the
 * question somebody actually has in front of a switch — not "is it on" but
 * "what am I turning on" — and because a claim on a settings page should be
 * one a test can hold to the code that makes it true.
 */
export const READING_WOULD: readonly string[] = [
  "Open one address at a time that a search already returned, and read that page for the people named on it.",
  "Ask the host's own robots.txt first, and keep any crawl-delay it publishes.",
  "Hold to one request at a time per host, under a size cap and a per-run budget.",
  "Hand back the claims and the address, then drop the page.",
];

export const READING_WOULD_NOT: readonly string[] = [
  "Crawl. One address in, one page out — no link on the page is followed.",
  "Get past a sign-in wall, a paywall or a bot check. It stops and names the one it saw.",
  "Touch a host the registry refuses or hands off, including by a redirect onto one.",
  "Store anything. Nothing reaches the database until you save a person.",
  "Widen the registry. A row whose basis is assumed stays assumed until a human reads that host's terms and records it.",
];

/** What the settings page says about reading, counted rather than claimed. */
export function pageReadingStatus(): {
  enabled: boolean;
  why: string;
  contact: string | null;
  switches: ReadingSwitch[];
  registry: ReturnType<typeof registrySummary>;
  unverifiedOperators: string[];
} {
  const env = readerEnv();
  return {
    enabled: env.enabled,
    why: whyDisabled(env),
    contact: env.contact,
    switches: readingSwitches(),
    registry: registrySummary(),
    unverifiedOperators: unverifiedOperators(),
  };
}
