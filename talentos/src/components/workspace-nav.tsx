"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type {
  JobPhaseId,
  JobPhaseReading,
} from "../../artifact-src/core/job-phase";

/**
 * The workspace nav: one row that says where the job is, one row you can click.
 *
 * Every module lives in exactly one phase, and `tests/unit/workspace-nav.test.ts`
 * checks that against the routes on disk — grouping a nav is exactly the kind
 * of change that silently orphans a page, and it did: the first version of
 * this file dropped Review shortlist, which took the card deck and the
 * evidence ribbons with it.
 *
 * It was twenty-one tabs in one wrapping row, which is a list of everything
 * the software can do rather than a shape for the work. Grouping them into
 * four phases fixed that, but paid for it with a second row of links that
 * went where the first row already went: "Understand" and "Overview" were one
 * URL, and Find, Engage and Decide were each a shortcut to the first tab of
 * their group. Two rows, one set of destinations.
 *
 * So the phase row stopped being navigation and became the thing it was
 * always closest to saying: **which phase the job is actually in**, read off
 * the hill chart by `jobPhase` and named rather than counted. The four names
 * stay, because the shape of a search really is those four things; only the
 * links are gone.
 *
 * That leaves the module row as the only way to click, so it now carries every
 * module rather than only the current group's — a group you cannot reach is
 * worse than a row that is one line taller. The group you are in is at full
 * contrast and the rest are quiet until you go looking, which is the same
 * ranking the phase row used to do with a second click. Crew is in neither
 * row: it is an instrument for watching background work rather than a step in
 * a job, so it is reachable by name from the "/" menu and nowhere else.
 */

interface Module {
  path: string;
  label: string;
  /** A picture to find it by. Faster to spot than a word in a row of words. */
  icon: string;
  exact?: boolean;
}

export interface Phase {
  id: JobPhaseId;
  label: string;
  icon: string;
  /** What this phase is for, in a few words. Shown under the tabs. */
  detail: string;
  modules: Module[];
}

export const PHASES: Phase[] = [
  {
    id: "understand",
    label: "Understand",
    icon: "🧭",
    detail: "What the job actually is, and what good looks like.",
    modules: [
      { path: "", label: "Overview", icon: "📋", exact: true },
      { path: "/role", label: "Role", icon: "📄" },
      { path: "/intake", label: "Intake", icon: "🎙️" },
      { path: "/profile", label: "Profile", icon: "🎯" },
      { path: "/market", label: "Market", icon: "📊" },
      { path: "/guide", label: "Guide", icon: "💡" },
    ],
  },
  {
    id: "find",
    label: "Find",
    icon: "🔎",
    detail: "Where these people are, and the strings that reach them.",
    modules: [
      { path: "/strategy", label: "Strategy", icon: "♟️" },
      { path: "/sources", label: "Sources", icon: "📡" },
      { path: "/strings", label: "Strings", icon: "🔤" },
      { path: "/discover", label: "Discover", icon: "🔭" },
      { path: "/graph", label: "Knowledge graph", icon: "🕸️" },
    ],
  },
  {
    id: "engage",
    label: "Engage",
    icon: "💬",
    detail: "The people themselves: reaching them, screening, interviewing.",
    modules: [
      { path: "/candidates", label: "Candidates", icon: "👤" },
      {
        path: "/review-shortlist",
        label: "Review shortlist",
        icon: "🃏",
      },
      { path: "/outreach", label: "Outreach", icon: "✉️" },
      { path: "/screen", label: "Screen", icon: "☎️" },
      { path: "/interviews", label: "Interviews", icon: "🗣️" },
    ],
  },
  {
    id: "decide",
    label: "Decide",
    icon: "⚖️",
    detail: "Where the search stands, why, and what it taught you.",
    modules: [
      { path: "/hill", label: "Hill", icon: "⛰️" },
      { path: "/pipeline", label: "Pipeline", icon: "🪜" },
      { path: "/close", label: "Close", icon: "🤝" },
      { path: "/analytics", label: "Analytics", icon: "📈" },
      { path: "/diagnosis", label: "Diagnosis", icon: "🩺" },
      { path: "/learnings", label: "Learnings", icon: "📚" },
    ],
  },
];

/** The phase a path belongs to. Overview is the fallback, not a guess. */
export function phaseForPath(pathname: string, base: string): Phase {
  const rest = pathname.startsWith(base) ? pathname.slice(base.length) : "";
  const found = PHASES.find((phase) =>
    phase.modules.some(
      (module) => module.path !== "" && rest.startsWith(module.path),
    ),
  );
  return found ?? PHASES[0];
}

export function WorkspaceNav({
  projectId,
  reading,
}: {
  projectId: string;
  /**
   * Where the hill says the job is. Optional because the phase row is a
   * report and a report with nothing to report should still leave the four
   * names standing — a nav that disappears when a chart is unreadable is a
   * worse failure than a nav that is briefly quiet.
   */
  reading?: JobPhaseReading;
}) {
  const pathname = usePathname();
  const base = `/searches/${projectId}`;
  const viewing = phaseForPath(pathname, base);

  return (
    <div data-testid="workspace-nav" className="mb-5">
      <PhaseRow reading={reading} viewing={viewing.id} />
      <nav className="mt-1.5 flex flex-wrap items-center gap-x-0.5 gap-y-1">
        {PHASES.map((phase) => (
          <ModuleGroup
            key={phase.id}
            phase={phase}
            base={base}
            pathname={pathname}
            here={phase.id === viewing.id}
            projectId={projectId}
          />
        ))}
      </nav>
      <p className="mt-1 text-[12.5px] text-ink-faint">{viewing.detail}</p>
    </div>
  );
}

/**
 * The four names, as a report.
 *
 * Not links, not buttons, and not a `<nav>`: there is nothing here to go to.
 * `aria-current="step"` is what tells a screen reader which one the job is on,
 * and every mark is doubled by a word in its `title`, because a mark that only
 * exists as a colour or a glyph is a mark half the readers do not get.
 */
function PhaseRow({
  reading,
  viewing,
}: {
  reading?: JobPhaseReading;
  viewing: JobPhaseId;
}) {
  return (
    <div className="border-b border-edge pb-1.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <ol className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {PHASES.map((phase) => {
            const at = reading?.phase === phase.id;
            const settled = reading?.settled.includes(phase.id) ?? false;
            return (
              <li
                key={phase.id}
                data-testid={`phase-${phase.id}`}
                aria-current={at ? "step" : undefined}
                title={
                  at
                    ? `The job is in ${phase.label}: ${reading?.says ?? ""}`
                    : settled
                      ? `${phase.label}: nothing here is uphill any more`
                      : phase.detail
                }
                className={`flex items-center gap-1 text-[14px] ${
                  at
                    ? "font-medium text-ink"
                    : settled
                      ? "text-ink-muted"
                      : "text-ink-faint"
                }`}
              >
                <span aria-hidden>{phase.icon}</span>
                <span>{phase.label}</span>
                {at && (
                  <span aria-hidden className="text-accent">
                    ●
                  </span>
                )}
                {!at && settled && <span aria-hidden>✓</span>}
              </li>
            );
          })}
        </ol>
        {/* Hidden on a phone, which has no "/" key — the search button in the
            corner is the way there instead. */}
        <span className="ml-auto pr-1 text-[12px] text-ink-faint max-sm:hidden">
          press / to go anywhere
        </span>
      </div>
      {reading && (
        <p className="mt-0.5 text-[12.5px] text-ink-faint">
          {reading.unread ? (
            <>
              Where the job is: not recorded yet — {reading.says}. Set the
              scopes on the hill and this row starts saying something.
            </>
          ) : (
            <>
              Where the job is: {labelOf(reading.phase)} — {reading.says}
            </>
          )}
        </p>
      )}
      {/* The row above is where the job is; the row below is where you are.
          They are allowed to disagree, and when they do that is the useful
          part: reading Analytics while the pay band is still open is a real
          thing to notice, not a state to hide. */}
      {reading && !reading.unread && reading.phase !== viewing && (
        <p className="sr-only">
          You are looking at {labelOf(viewing)}; the job is in{" "}
          {labelOf(reading.phase)}.
        </p>
      )}
    </div>
  );
}

function labelOf(id: JobPhaseId): string {
  return PHASES.find((phase) => phase.id === id)?.label ?? id;
}

/**
 * One phase's modules, with its name in front of them as a label rather than a
 * link. Every group is always here — the row is the only clickable one now, so
 * a module missing from it is a module with no mouse path at all.
 */
function ModuleGroup({
  phase,
  base,
  pathname,
  here,
  projectId,
}: {
  phase: Phase;
  base: string;
  pathname: string;
  here: boolean;
  projectId: string;
}) {
  return (
    <span className="flex items-center gap-0.5">
      <span
        className={`mr-0.5 select-none pl-1 text-[11px] uppercase tracking-wide ${
          here ? "text-ink-muted" : "text-ink-faint"
        }`}
      >
        {phase.label}
      </span>
      {phase.modules.map((module) => {
        const href = `${base}${module.path}`;
        const active = module.exact
          ? pathname === href
          : pathname.startsWith(href);
        return (
          <Link
            key={module.path}
            href={href}
            className={`rounded px-2 py-1 text-[13.5px] ${
              active
                ? "bg-panel2 font-medium text-ink"
                : here
                  ? "text-ink-muted hover:text-ink"
                  : "text-ink-faint hover:text-ink"
            }`}
          >
            <span aria-hidden className="mr-1">
              {module.icon}
            </span>
            {module.label}
          </Link>
        );
      })}
      {phase.id === "find" && (
        <Link
          href={`/capture?search=${encodeURIComponent(projectId)}`}
          className={`rounded px-2 py-1 text-[13.5px] ${
            here
              ? "text-ink-muted hover:text-ink"
              : "text-ink-faint hover:text-ink"
          }`}
        >
          <span aria-hidden className="mr-1">
            🧭
          </span>
          Browser companion ↗
        </Link>
      )}
    </span>
  );
}
