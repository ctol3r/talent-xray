/**
 * Every heading carries a picture.
 *
 * Not decoration: a page of headings that all look the same is a page you read
 * linearly, and one where each has its own mark is one you navigate by shape.
 * The rule only holds if it is enforced, because the next heading somebody adds
 * is the one that will not have one — so this scans the source rather than
 * trusting a sweep that was done once.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.join(__dirname, "..", "..", "src");

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return files(full);
    return entry.name.endsWith(".tsx") ? [full] : [];
  });
}

/**
 * A leading `${` counts: those titles interpolate an icon chosen per record,
 * which is the same rule applied to something the source cannot see.
 */
const LEADS_WITH_A_MARK =
  /^(?:\$\{|[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{2600}-\u{26FF}])/u;

const TITLE = /<(PageHeader|Card)\b[^>]*?\btitle=(?:"([^"]*)"|\{`([^`]*)`\})/gs;

describe("headings", () => {
  it("every page and card title starts with an emoji", () => {
    const bare: string[] = [];
    let counted = 0;
    for (const file of files(SRC)) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(TITLE)) {
        const title = (match[2] ?? match[3] ?? "").trim();
        if (!title) continue;
        counted++;
        if (!LEADS_WITH_A_MARK.test(title)) {
          bare.push(`${path.relative(SRC, file)}: ${title.slice(0, 60)}`);
        }
      }
    }
    // The count guards the guard: a regex that stopped matching would pass
    // this test by finding nothing at all.
    expect(counted).toBeGreaterThan(150);
    expect(bare).toEqual([]);
  });

  it("does not fall back to a placeholder mark", () => {
    // The sweep that added these used a black square when it could not think
    // of anything. One left in is a heading nobody chose a picture for.
    for (const file of files(SRC)) {
      expect(readFileSync(file, "utf8")).not.toContain("▪️");
    }
  });
});

/**
 * And no heading, chip or hint shows the database's own word for something.
 *
 * `on_hold` is not a status, it is how a status is spelled in a column. It
 * leaked onto four surfaces at once — the workspace header, the jobs table,
 * the dashboard list and the command bar — because each was written on its
 * own day and the enum happened to read almost like English. `open` looking
 * fine is exactly why the other two did not get caught.
 */
describe("stored values are labelled before they are shown", () => {
  // Not preceded by `=`, so passing the value to a component that will label
  // it — `status={project.status}` — is the correct thing rather than a hit.
  const RAW_JOB_STATUS = /(?<!=)\{\s*(?:project|search|job)\.status\s*\}/;

  it("never renders a job's status straight out of the column", () => {
    const offenders = files(SRC).filter((file) =>
      RAW_JOB_STATUS.test(readFileSync(file, "utf8")),
    );
    expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
  });
});
