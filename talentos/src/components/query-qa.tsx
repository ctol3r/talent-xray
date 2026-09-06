/**
 * Server-safe presentational pieces for the String Lab and Discover pages
 * (Wave A): QA badges, coverage, yield lines. Warnings are shown, never
 * used to hide a string.
 */
import type {
  ChannelCoverage,
  QaWarning,
  QueryQaMeta,
} from "@/lib/domain/query-normalization";
import type { QueryYield, RoleTitleYield } from "@/lib/services/query-yield";
import { Card, Tag } from "./ui";

export function TermCountTag({
  termCount,
  budget,
}: {
  termCount: number;
  budget: number | null;
}) {
  if (budget === null) {
    return <Tag tone="neutral">{termCount} words</Tag>;
  }
  return (
    <Tag tone={termCount > budget ? "warn" : "neutral"}>
      {termCount}/{budget} words
    </Tag>
  );
}

export function QaBadges({ warnings }: { warnings: QaWarning[] }) {
  if (warnings.length === 0) return null;
  return (
    <>
      {warnings.map((w) => (
        <Tag key={w.code} tone="warn">
          {w.message}
        </Tag>
      ))}
    </>
  );
}

export function PartTag({ part }: { part?: QueryQaMeta["part"] }) {
  if (!part) return null;
  return (
    <Tag tone="accent">
      part {part.index}/{part.of}
    </Tag>
  );
}

export function NormalizationNotes({ qa }: { qa: QueryQaMeta | null }) {
  const notes = qa?.notes.filter(
    (n) => n.code !== "platform_pruned" && n.code !== "cross_surface_duplicate",
  );
  if (!notes || notes.length === 0) return null;
  return (
    <p className="mt-1 text-[11px] text-ink-faint">
      {notes.map((n) => n.message).join(" · ")}
    </p>
  );
}

export function YieldLine({ yield: y }: { yield?: QueryYield }) {
  if (!y || y.runs === 0) {
    return <span className="text-[11.5px] text-ink-faint">never run</span>;
  }
  return (
    <span
      className="text-[11.5px] text-ink-faint"
      title="Yield ledger: runs, explicitly saved URLs, candidates created from them"
    >
      ran {y.runs}× · {y.savedUrls} saved · {y.candidates}{" "}
      {y.candidates === 1 ? "candidate" : "candidates"}
    </span>
  );
}

export function CoveragePanel({ coverage }: { coverage: ChannelCoverage[] }) {
  if (coverage.length === 0) return null;
  const covered = coverage.filter((c) => c.covered);
  const missing = coverage.filter((c) => !c.covered);
  return (
    <Card title="Channel coverage">
      <p className="text-[12.5px] text-ink-muted">
        {covered.length} of {coverage.length} channel
        {coverage.length === 1 ? "" : "s"} named by the strategy{" "}
        {covered.length === 1 ? "has" : "have"} a string.
        {missing.length > 0 && (
          <>
            {" "}
            <span className="text-warn">Missing:</span>{" "}
            {missing.map((m) => m.channelName).join(", ")}. Add a query for
            each, or mark the channel rejected on the Sources page.
          </>
        )}
      </p>
    </Card>
  );
}

export function PrunedPlatformsNote({
  pruned,
}: {
  pruned: { platform: string; reason: string }[];
}) {
  if (pruned.length === 0) return null;
  return (
    <p className="text-[12px] text-ink-faint">
      Surfaces skipped for this profession:{" "}
      {pruned.map((p) => `${p.platform} (${p.reason})`).join("; ")}.
    </p>
  );
}

export function RoleYieldPanel({ yield: y }: { yield: RoleTitleYield | null }) {
  if (!y) return null;
  return (
    <Card
      title={`Same role in ${y.searches} other search${y.searches === 1 ? "" : "es"}`}
    >
      {y.rows.length === 0 ? (
        <p className="text-[12.5px] text-ink-muted">
          No strings were run for this role elsewhere yet.
        </p>
      ) : (
        <ul className="space-y-1 text-[12.5px] text-ink-muted">
          {y.rows.slice(0, 8).map((row) => (
            <li key={`${row.platform}-${row.breadth}`}>
              <span className="text-ink">{row.platform}</span> · {row.breadth}:
              saved {row.savedUrls} from {row.runs} run
              {row.runs === 1 ? "" : "s"}
              {row.candidates > 0 &&
                ` · ${row.candidates} candidate${row.candidates === 1 ? "" : "s"}`}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[11px] text-ink-faint">
        Rolled up by normalized role title ({y.normalizedTitle}); explicit saves
        only, never result counts.
      </p>
    </Card>
  );
}

export function ProjectYieldCard({
  totals,
  zeroYieldCount,
}: {
  totals: { runs: number; savedUrls: number; candidates: number };
  zeroYieldCount: number;
}) {
  return (
    <Card title="Yield for this search">
      <p className="text-[12.5px] text-ink-muted">
        {totals.runs} run{totals.runs === 1 ? "" : "s"} · {totals.savedUrls}{" "}
        saved · {totals.candidates} candidate
        {totals.candidates === 1 ? "" : "s"} created from saves.
        {zeroYieldCount > 0 && (
          <>
            {" "}
            Run but nothing saved: {zeroYieldCount} string
            {zeroYieldCount === 1 ? "" : "s"}.
          </>
        )}
      </p>
    </Card>
  );
}
