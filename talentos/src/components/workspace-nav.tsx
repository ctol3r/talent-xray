"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const MODULES: { path: string; label: string; exact?: boolean }[] = [
  { path: "", label: "Overview", exact: true },
  { path: "/crew", label: "Crew" },
  { path: "/guide", label: "Guide" },
  { path: "/role", label: "Role" },
  { path: "/intake", label: "Intake" },
  { path: "/profile", label: "Profile" },
  { path: "/market", label: "Market" },
  { path: "/strategy", label: "Strategy" },
  { path: "/sources", label: "Sources" },
  { path: "/graph", label: "Knowledge graph" },
  { path: "/strings", label: "Strings" },
  { path: "/discover", label: "Discover" },
  { path: "/candidates", label: "Candidates" },
  { path: "/outreach", label: "Outreach" },
  { path: "/screen", label: "Screen" },
  { path: "/interviews", label: "Interviews" },
  { path: "/pipeline", label: "Pipeline" },
  { path: "/close", label: "Close" },
  { path: "/analytics", label: "Analytics" },
  { path: "/diagnosis", label: "Diagnosis" },
  { path: "/learnings", label: "Learnings" },
];

export function WorkspaceNav({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const base = `/searches/${projectId}`;
  return (
    <nav
      data-testid="workspace-nav"
      className="mb-5 flex flex-wrap gap-0.5 border-b border-edge pb-0"
    >
      {MODULES.map((module) => {
        const href = `${base}${module.path}`;
        const active = module.exact
          ? pathname === href
          : pathname.startsWith(href);
        return (
          <Link
            key={module.path}
            href={href}
            className={`-mb-px border-b-2 px-2.5 py-1.5 text-[12.5px] ${
              active
                ? "border-accent font-medium text-ink"
                : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            {module.label}
          </Link>
        );
      })}
      <Link
        href={`/capture?search=${encodeURIComponent(projectId)}`}
        className="px-2.5 py-1.5 text-[12.5px] text-ink-muted hover:text-ink"
      >
        Browser companion ↗
      </Link>
    </nav>
  );
}
