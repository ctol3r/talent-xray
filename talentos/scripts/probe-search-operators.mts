/**
 * Does the open-web index actually honour the operators the angles compose?
 *
 *   pnpm probe:search
 *
 * Needs TALENTOS_BRAVE_SEARCH_KEY. Makes one request per probe, a second
 * apart, and writes what it found to docs/SEARCH-OPERATORS-PROBE.md.
 *
 * The probes compare membership, never result counts. A count comparison is
 * worthless against a paged index: a common term and a broader query both
 * return exactly one page, so "the group returned more rows" is a fact about
 * the page size rather than about the operator. Each probe therefore checks a
 * property of the rows that came back — every host is under the site, every
 * path contains the fragment, every title carries the phrase.
 *
 * An operator that is silently dropped is the failure this exists to catch:
 * a dropped `-site:` turns a people-only query into a job-board query, and the
 * rows still look like answers.
 */
import fs from "node:fs";
import path from "node:path";
import {
  buildBraveUrl,
  BRAVE_MIN_INTERVAL_MS,
  mapBrave,
} from "../src/lib/research/web-search/brave.ts";
import type { DiscoveryResult } from "../src/lib/research/discovery-provider.ts";

const key = (process.env.TALENTOS_BRAVE_SEARCH_KEY ?? "").trim();
if (!key) {
  console.error(
    "No TALENTOS_BRAVE_SEARCH_KEY. The probe makes real requests against a real key; it does not run on fixtures.",
  );
  process.exit(1);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function ask(query: string): Promise<DiscoveryResult[]> {
  await sleep(BRAVE_MIN_INTERVAL_MS);
  const response = await fetch(buildBraveUrl(query, 20), {
    headers: { Accept: "application/json", "X-Subscription-Token": key },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${query}`);
  return mapBrave(await response.json(), query, new Date().toISOString());
}

interface Probe {
  operator: string;
  query: string;
  /** True when every row has the property the operator promises. */
  holds(rows: DiscoveryResult[]): boolean;
  /** What a failure means for the composed angles. */
  matters: string;
}

const PROBES: Probe[] = [
  {
    operator: "site:",
    query: "site:nasa.gov engineer",
    holds: (rows) =>
      rows.every((r) => new URL(r.url).hostname.endsWith("nasa.gov")),
    matters:
      "twelve of the twenty angles pin a surface with site:. Without it they return the open web.",
  },
  {
    operator: "site: with a path",
    query: "site:github.io/cv",
    holds: (rows) => rows.every((r) => new URL(r.url).pathname.includes("/cv")),
    matters: "the CV and portfolio angles address a path, not just a host.",
  },
  {
    operator: "-site:",
    query: "software engineer -site:wikipedia.org",
    holds: (rows) =>
      rows.every((r) => !new URL(r.url).hostname.endsWith("wikipedia.org")),
    matters:
      "every angle carries job-board exclusions. A dropped -site: turns a people query into a job-ad query.",
  },
  {
    operator: "filetype:",
    query: 'filetype:pdf "curriculum vitae" robotics',
    holds: (rows) =>
      rows.every((r) => new URL(r.url).pathname.toLowerCase().endsWith(".pdf")),
    matters: "the document angles are filetype: and nothing else.",
  },
  {
    operator: "inurl:",
    query: "inurl:/people/ laboratory",
    holds: (rows) =>
      rows.every((r) => r.url.toLowerCase().includes("/people/")),
    matters: "the roster angles find team pages by their address shape.",
  },
  {
    operator: "intitle:",
    query: 'intitle:"our team" robotics',
    holds: (rows) =>
      rows.every((r) => (r.title ?? "").toLowerCase().includes("our team")),
    matters:
      "the team-page angle leans on the title when the URL says nothing.",
  },
  {
    operator: "quoted phrase",
    query: '"principal perception engineer"',
    holds: (rows) =>
      rows.every((r) =>
        `${r.title ?? ""} ${r.snippet ?? ""}`
          .toLowerCase()
          .includes("principal perception engineer"),
      ),
    matters:
      "a title is a phrase. Unquoted, it matches every page carrying the three words separately.",
  },
  {
    operator: "(grouped OR)",
    query: "(site:.edu OR site:.ac.uk) robotics laboratory",
    holds: (rows) =>
      rows.every((r) => {
        const host = new URL(r.url).hostname;
        return host.endsWith(".edu") || host.endsWith(".ac.uk");
      }),
    matters:
      "the academic and skill-alternative angles are grouped ORs. Brave does not document grouping, which is why this is a probe rather than an assumption.",
  },
];

const lines: string[] = [
  "# Do the operators hold?",
  "",
  `Probed ${new Date().toISOString().slice(0, 10)} against the open-web index, one request per row.`,
  "Membership tests, not counts: a count comparison against a paged index measures the page size.",
  "",
  "| Operator | Verdict | Rows | What a failure would mean |",
  "| --- | --- | --- | --- |",
];

let failures = 0;
for (const probe of PROBES) {
  let verdict: string;
  let count = 0;
  try {
    const rows = await ask(probe.query);
    count = rows.length;
    if (count === 0) {
      verdict = "inconclusive — no rows";
    } else if (probe.holds(rows)) {
      verdict = "holds";
    } else {
      verdict = "**dropped**";
      failures++;
    }
  } catch (error) {
    verdict = `error — ${error instanceof Error ? error.message : String(error)}`;
    failures++;
  }
  console.log(`${probe.operator.padEnd(20)} ${verdict} (${count} rows)`);
  lines.push(
    `| \`${probe.operator}\` | ${verdict} | ${count} | ${probe.matters} |`,
  );
}

lines.push(
  "",
  failures === 0
    ? "Every probe held. Set the matching rows in `OPERATOR_SUPPORT` to `verified`."
    : `${failures} probe(s) did not hold. Until they do, an angle using one of them is composed for a person to open rather than run.`,
  "",
);

const out = path.resolve("docs/SEARCH-OPERATORS-PROBE.md");
fs.writeFileSync(out, lines.join("\n"));
console.log(`\nWrote ${out}`);
process.exit(failures === 0 ? 0 : 1);
