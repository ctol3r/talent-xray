import type { JobActivity } from "@/lib/services/job-activity";

/**
 * A job's activity, the way GitHub shows a repository's.
 *
 * The strip is one cell per day over twelve weeks, shaded relative to this
 * job's own busiest day rather than a fixed scale — a job that peaks at
 * three events a day and one that peaks at forty should both read as busy on
 * their busiest day. A gap is the most useful thing it shows, because a
 * fortnight of blank cells is a job nobody is running and no number says
 * that as quickly.
 *
 * The bar underneath is the pipeline's shape: sixty people sitting in
 * research is a different problem from six spread through to offer.
 */
export function ActivityBar({
  activity,
  compact = false,
}: {
  activity: JobActivity;
  compact?: boolean;
}) {
  const shades = [
    "var(--color-panel2, #1e293b)",
    "#14532d",
    "#166534",
    "#22c55e",
    "#4ade80",
  ];
  const weeks: (typeof activity.cells)[] = [];
  for (let i = 0; i < activity.cells.length; i += 7) {
    weeks.push(activity.cells.slice(i, i + 7));
  }

  return (
    <div data-testid="activity-bar">
      <div className="flex gap-[3px]" aria-hidden>
        {weeks.map((week, index) => (
          <div key={index} className="flex flex-col gap-[3px]">
            {week.map((cell) => (
              <span
                key={cell.day}
                title={`${cell.day}: ${cell.count} ${cell.count === 1 ? "thing" : "things"}`}
                style={{ backgroundColor: shades[cell.level] }}
                className={`block rounded-[2px] ${compact ? "h-1.5 w-1.5" : "h-2 w-2"}`}
              />
            ))}
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[12.5px] text-ink-muted">{activity.summary}</p>

      {activity.slices.length > 0 && (
        <div className="mt-2">
          <div
            className="flex h-1.5 w-full overflow-hidden rounded-full"
            role="img"
            aria-label={`Pipeline: ${activity.slices
              .map((slice) => `${slice.count} ${slice.label}`)
              .join(", ")}`}
          >
            {activity.slices.map((slice) => (
              <span
                key={slice.stage}
                title={`${slice.label}: ${slice.count} (${slice.percent}%)`}
                style={{
                  width: `${slice.percent}%`,
                  backgroundColor: slice.colour,
                }}
              />
            ))}
          </div>
          <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
            {activity.slices.map((slice) => (
              <li
                key={slice.stage}
                className="flex items-center gap-1 text-[12px] text-ink-muted"
              >
                <span
                  aria-hidden
                  style={{ backgroundColor: slice.colour }}
                  className="inline-block h-2 w-2 rounded-full"
                />
                {slice.label} {slice.count}
              </li>
            ))}
          </ul>
        </div>
      )}

      {activity.slices.length === 0 && activity.people === 0 && (
        <p className="mt-1.5 text-[12.5px] text-ink-faint">
          Nobody in this job yet, so there is no pipeline to show a shape of.
        </p>
      )}
    </div>
  );
}
