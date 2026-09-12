/**
 * Grouping and sorting a list by any attribute it has.
 *
 * The test that earns its keep is the last one: every column on the table is
 * either something you can group by or is named as deliberately not, with a
 * reason. Without it, "group by any attribute" becomes "group by the ones
 * somebody remembered" the first time a field is added, and a list quietly
 * lacking the attribute you are looking for is worse than one that never
 * offered grouping at all.
 */
import { describe, expect, it } from "vitest";
import { getTableColumns } from "drizzle-orm";
import {
  NOT_SET,
  arrange,
  byDueDate,
  byRecency,
  byVocabulary,
  groupRows,
  rankIn,
  sortRows,
  type FacetSpec,
  type SortSpec,
} from "../../artifact-src/core/facets";
import { candidates, searchProjects } from "@/lib/db/schema";
import {
  JOB_FACETS,
  JOB_NOT_FACETED,
  jobSorts,
  PERSON_FACETS,
  PERSON_NOT_FACETED,
  PERSON_SORTS,
  facetById,
  salaryBand,
  sortById,
  type JobLike,
} from "@/lib/domain/facets";

interface Row {
  id: string;
  kind?: string;
  tags?: string[];
  at?: string | null;
}

const kind: FacetSpec<Row> = {
  id: "kind",
  label: "Kind",
  icon: "k",
  valuesOf: (row) => (row.kind ? [row.kind] : []),
};

const tags: FacetSpec<Row> = {
  id: "tags",
  label: "Tags",
  icon: "t",
  valuesOf: (row) => row.tags ?? [],
};

describe("grouping", () => {
  it("keeps rows with nothing to say, in a group that sorts last", () => {
    const grouping = groupRows(
      [
        { id: "a", kind: "one" },
        { id: "b" },
        { id: "c", kind: "one" },
        { id: "d", kind: "two" },
      ],
      kind,
    );
    // A job with no industry is still a job. Hiding it because a column is
    // blank means the list quietly stops being the list.
    expect(grouping.groups.map((g) => g.key)).toEqual(["one", "two", NOT_SET]);
    expect(grouping.groups.at(-1)?.label).toBe("Not set");
    expect(grouping.notSet).toBe(1);
    expect(grouping.groups.flatMap((g) => g.rows)).toHaveLength(4);
  });

  it("puts a row with several values in each of them, and says so", () => {
    const grouping = groupRows(
      [
        { id: "a", tags: ["safety", "remote"] },
        { id: "b", tags: ["remote"] },
      ],
      tags,
    );
    expect(grouping.overlapping).toBe(true);
    // The sizes deliberately add up to more than the list.
    expect(grouping.groups.flatMap((g) => g.rows)).toHaveLength(3);
    expect(grouping.groups.map((g) => g.key)).toEqual(["remote", "safety"]);
  });

  it("does not claim overlap when there is none", () => {
    expect(groupRows([{ id: "a", tags: ["one"] }], tags).overlapping).toBe(
      false,
    );
    expect(groupRows([{ id: "a" }], tags).overlapping).toBe(false);
  });

  it("counts a repeated value once", () => {
    const grouping = groupRows([{ id: "a", tags: ["x", "x"] }], tags);
    expect(grouping.groups).toHaveLength(1);
    expect(grouping.groups[0].rows).toHaveLength(1);
    expect(grouping.overlapping).toBe(false);
  });

  it("keeps a vocabulary's order however small its groups are", () => {
    const ordered: FacetSpec<Row> = { ...kind, order: ["one", "two", "three"] };
    const grouping = groupRows(
      [
        { id: "a", kind: "three" },
        { id: "b", kind: "three" },
        { id: "c", kind: "three" },
        { id: "d", kind: "one" },
      ],
      ordered,
    );
    // Critical before high before normal, always. Sorting these by size would
    // put the busiest first, which is backwards for the one attribute where
    // the order IS the meaning.
    expect(grouping.groups.map((g) => g.key)).toEqual(["one", "three"]);
  });

  it("puts the biggest group first when there is no order to keep", () => {
    const grouping = groupRows(
      [
        { id: "a", kind: "berlin" },
        { id: "b", kind: "london" },
        { id: "c", kind: "london" },
      ],
      kind,
    );
    expect(grouping.groups.map((g) => g.key)).toEqual(["london", "berlin"]);
  });

  it("sorts anything outside the vocabulary after all of it", () => {
    expect(rankIn(["a", "b"], "a")).toBe(0);
    expect(rankIn(["a", "b"], "z")).toBe(2);
    expect(rankIn(undefined, "z")).toBe(0);
  });
});

describe("sorting", () => {
  const byId: SortSpec<Row> = {
    id: "id",
    label: "Id",
    icon: "i",
    compare: (a, b) => a.id.localeCompare(b.id),
  };

  it("is stable, so rows it cannot separate keep the order they came in", () => {
    const rows = [
      { id: "a", kind: "second" },
      { id: "a", kind: "first" },
    ];
    expect(sortRows(rows, byId).map((r) => r.kind)).toEqual([
      "second",
      "first",
    ]);
  });

  it("puts an unset value last, not in the middle", () => {
    const order = ["critical", "high", "normal"];
    const compare = byVocabulary(order);
    // A job nobody has prioritised is not a normal-priority job; it is a job
    // nobody has said anything about. Below the ranked ones, still visible.
    expect(compare("critical", "normal")).toBeLessThan(0);
    expect(compare("normal", null)).toBeLessThan(0);
    expect(compare(null, "normal")).toBeGreaterThan(0);
    expect(compare(null, undefined)).toBe(0);
  });

  it("reads a changed date newest-first and a due date soonest-first", () => {
    expect(byRecency("2026-01-02", "2026-01-01")).toBeLessThan(0);
    expect(byDueDate("2026-01-01", "2026-01-02")).toBeLessThan(0);
    // Undated last either way, and nonsense treated as undated.
    expect(byRecency(null, "2026-01-01")).toBeGreaterThan(0);
    expect(byDueDate("not a date", "2026-01-01")).toBeGreaterThan(0);
    expect(byRecency(null, null)).toBe(0);
  });

  it("sorts inside each group rather than across the list", () => {
    const grouping = arrange(
      [
        { id: "b", kind: "two" },
        { id: "a", kind: "one" },
        { id: "c", kind: "one" },
      ],
      { ...kind, order: ["one", "two"] },
      byId,
    );
    expect(grouping.groups.map((g) => g.rows.map((r) => r.id))).toEqual([
      ["a", "c"],
      ["b"],
    ]);
  });

  it("still sorts with no grouping at all", () => {
    const grouping = arrange([{ id: "b" }, { id: "a" }], null, byId);
    expect(grouping.groups).toHaveLength(1);
    expect(grouping.groups[0].rows.map((r) => r.id)).toEqual(["a", "b"]);
  });
});

describe("the job and person facets", () => {
  const NOW = "2026-09-08T12:00:00.000Z";
  const JOB_SORTS = jobSorts(NOW);

  it("defaults to priority, because that is the order you work a list in", () => {
    expect(sortById(JOB_SORTS, null).id).toBe("priority");
    expect(sortById(PERSON_SORTS, "nonsense").id).toBe("priority");
    expect(facetById(JOB_FACETS, "nonsense")).toBeNull();
    expect(facetById(JOB_FACETS, "fte")?.label).toBe("FTE");
  });

  it("names a person's priority as the job's, because that is whose it is", () => {
    // A person has no priority in this product, and a derived one would be a
    // score nobody set. The label has to say where it came from.
    const sort = PERSON_SORTS.find((s) => s.id === "priority");
    expect(sort?.label).toContain("job");
    expect(facetById(PERSON_FACETS, "priority")?.label).toBe("Job priority");
  });

  it("bands a salary rather than making one group per figure", () => {
    const job = (over: Partial<JobLike>): JobLike => ({
      id: "j",
      name: "n",
      roleTitle: "r",
      status: "open",
      ...over,
    });
    expect(salaryBand(job({ salaryMax: 30_000 }))).toEqual(["under 50k"]);
    expect(
      salaryBand(job({ salaryMax: 95_000, salaryCurrency: "eur" })),
    ).toEqual(["80k–120k EUR"]);
    expect(salaryBand(job({ salaryMax: 400_000 }))).toEqual(["250k and up"]);
    // Nothing recorded is not a band, and this product does not convert
    // currencies it was never given a rate for.
    expect(salaryBand(job({}))).toEqual([]);
    expect(salaryBand(job({ salaryMin: 0 }))).toEqual([]);
  });

  it("has a distinct id and an icon for every facet and sort", () => {
    for (const list of [JOB_FACETS, PERSON_FACETS]) {
      expect(new Set(list.map((f) => f.id)).size).toBe(list.length);
      expect(list.every((f) => f.icon.length > 0 && f.label.length > 0)).toBe(
        true,
      );
    }
    for (const list of [JOB_SORTS, PERSON_SORTS]) {
      expect(new Set(list.map((s) => s.id)).size).toBe(list.length);
    }
  });

  it("accounts for every column on both tables", () => {
    // The point of the whole file. A column is either something you can group
    // by or is named as deliberately not, with a reason — so adding a field
    // forces a decision instead of quietly leaving a gap in the list.
    const check = (
      table: Record<string, unknown>,
      facets: { covers: readonly string[] }[],
      excluded: Record<string, string>,
    ) => {
      const covered = new Set(facets.flatMap((facet) => facet.covers));
      const unaccounted = Object.keys(table).filter(
        (column) => !covered.has(column) && !(column in excluded),
      );
      expect(unaccounted).toEqual([]);
      // And nothing is excluded that is also grouped by, which would mean the
      // reason attached to it is a lie.
      expect(Object.keys(excluded).filter((c) => covered.has(c))).toEqual([]);
      // Every reason is an actual reason.
      for (const [column, reason] of Object.entries(excluded)) {
        expect(reason.length, column).toBeGreaterThan(15);
      }
    };

    check(getTableColumns(searchProjects), JOB_FACETS, JOB_NOT_FACETED);
    check(getTableColumns(candidates), PERSON_FACETS, PERSON_NOT_FACETED);
  });
});

describe("priority understands the date agreed at intake", () => {
  const NOW = "2026-09-08T12:00:00.000Z";
  const daysAgo = (days: number) =>
    new Date(Date.parse(NOW) - days * 86_400_000).toISOString();
  const inDays = (days: number) =>
    new Date(Date.parse(NOW) + days * 86_400_000).toISOString().slice(0, 10);

  const job = (over: Partial<JobLike>): JobLike => ({
    id: over.name ?? "j",
    name: over.name ?? "j",
    roleTitle: "r",
    status: "open",
    ...over,
  });

  it("separates two jobs of the same priority by how pressed they are", () => {
    // A critical role wanted in a fortnight and a critical role wanted next
    // year are not the same amount of critical today.
    const soon = job({
      name: "two weeks",
      priority: "critical",
      createdAt: daysAgo(10),
      targetStartDate: inDays(4),
    });
    const later = job({
      name: "two years",
      priority: "critical",
      createdAt: daysAgo(10),
      targetStartDate: inDays(700),
    });
    const sorted = sortRows([later, soon], sortById(jobSorts(NOW), "priority"));
    expect(sorted.map((j) => j.name)).toEqual(["two weeks", "two years"]);
  });

  it("never lets the agreed date overrule the priority somebody set", () => {
    // The stated priority is a human's explicit call. Nothing derived
    // outranks it.
    const stated = job({
      name: "critical, plenty of time",
      priority: "critical",
      createdAt: daysAgo(1),
      targetStartDate: inDays(300),
    });
    const pressed = job({
      name: "back burner, overdue",
      priority: "backburner",
      createdAt: daysAgo(100),
      targetStartDate: inDays(-40),
    });
    const sorted = sortRows(
      [pressed, stated],
      sortById(jobSorts(NOW), "priority"),
    );
    expect(sorted[0].name).toBe("critical, plenty of time");
  });

  it("sorts a job with no agreed date in the middle, asserting nothing", () => {
    const none = job({ name: "no date", createdAt: daysAgo(50) });
    const early = job({
      name: "early",
      createdAt: daysAgo(1),
      targetStartDate: inDays(200),
    });
    const late = job({
      name: "late",
      createdAt: daysAgo(200),
      targetStartDate: inDays(-10),
    });
    const sorted = sortRows(
      [early, none, late],
      sortById(jobSorts(NOW), "pressure"),
    );
    expect(sorted.map((j) => j.name)).toEqual(["late", "no date", "early"]);
  });
});
