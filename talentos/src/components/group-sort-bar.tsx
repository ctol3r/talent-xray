"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * How a list is read: grouped by one attribute, sorted by another.
 *
 * Both go in the URL rather than in component state, for the same reasons the
 * pane stack does — a grouping you found useful can be sent to somebody, the
 * back button undoes it, and a list opened as a pane keeps the reading you
 * were using. It also means the page stays a server component and the grouping
 * happens where the rows already are.
 */
export interface Choosable {
  id: string;
  label: string;
  icon: string;
}

export function GroupSortBar({
  facets,
  sorts,
  group,
  sort,
  /** What the list holds, for the count: "jobs", "people". */
  noun,
  total,
  groups,
  overlapping,
  notSet,
}: {
  facets: Choosable[];
  sorts: Choosable[];
  group: string | null;
  sort: string;
  noun: string;
  total: number;
  groups: number;
  overlapping: boolean;
  notSet: number;
}) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  function set(key: string, value: string) {
    const query = new URLSearchParams(params.toString());
    if (value) query.set(key, value);
    else query.delete(key);
    const search = query.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, {
      scroll: false,
    });
  }

  const select =
    "rounded border border-edge2 bg-panel2 px-2 py-1 text-[13px] text-ink";

  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
      <label className="flex items-center gap-1.5 text-[13px] text-ink-muted">
        <span aria-hidden>🧺</span>
        Group by
        <select
          className={select}
          value={group ?? ""}
          onChange={(event) => set("group", event.target.value)}
        >
          <option value="">Nothing — one list</option>
          {facets.map((facet) => (
            <option key={facet.id} value={facet.id}>
              {facet.icon} {facet.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-1.5 text-[13px] text-ink-muted">
        <span aria-hidden>↕️</span>
        Sort by
        <select
          className={select}
          value={sort}
          onChange={(event) => set("sort", event.target.value)}
        >
          {sorts.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.icon} {entry.label}
            </option>
          ))}
        </select>
      </label>

      <p className="text-[12.5px] text-ink-faint">
        {total} {noun}
        {group ? ` in ${groups} groups` : ""}
        {/* Said out loud rather than left for somebody to notice while they
            are counting: with a multi-valued attribute the group sizes add up
            to more than the list, on purpose. */}
        {overlapping ? " · some appear in more than one group" : ""}
        {notSet > 0 ? ` · ${notSet} with nothing set` : ""}
      </p>
    </div>
  );
}

/** A heading row inside a table, so groups read as one list rather than many. */
export function GroupHeading({
  icon,
  label,
  count,
  columns,
}: {
  icon: string;
  label: string;
  count: number;
  columns: number;
}) {
  return (
    <tr className="border-t border-edge">
      <th
        colSpan={columns}
        scope="colgroup"
        // Under the column headings, which are themselves under the title bar.
        // Scrolling through a long group should never leave you unable to say
        // which group you are in — that is the whole reason to group at all.
        style={{ top: "calc(var(--sticky-title) + var(--sticky-thead))" }}
        className="sticky z-10 bg-panel2 px-0 py-1.5 max-sm:static text-left text-[12.5px] font-medium tracking-wide text-ink"
      >
        <span aria-hidden className="mr-1.5">
          {icon}
        </span>
        {label}
        <span className="ml-2 text-[12px] font-normal text-ink-faint">
          {count}
        </span>
      </th>
    </tr>
  );
}
