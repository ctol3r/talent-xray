"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CommandBar } from "./command-bar";

const NAV = [
  { href: "/", label: "Dashboard", exact: true },
  { href: "/searches", label: "Searches" },
  { href: "/candidates", label: "Candidates" },
  { href: "/tasks", label: "Tasks" },
  { href: "/settings", label: "Settings" },
];

export interface ShellSearch {
  id: string;
  name: string;
  status: string;
}

export function AppShell({
  productName,
  searches,
  children,
}: {
  productName: string;
  searches: ShellSearch[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 flex w-52 flex-col border-r border-edge bg-panel">
        <div className="flex items-center gap-2 px-4 py-4">
          <span className="inline-block h-2 w-2 rounded-sm bg-accent" />
          <span className="text-sm font-semibold tracking-wide">
            {productName}
          </span>
        </div>
        <nav className="flex flex-col gap-0.5 px-2">
          {NAV.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded px-2 py-1.5 text-[13px] ${
                  active
                    ? "bg-panel2 text-ink"
                    : "text-ink-muted hover:bg-panel2 hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-4 flex-1 overflow-y-auto px-2 pb-4">
          <div className="px-2 pb-1 text-[11px] font-medium tracking-wider text-ink-faint uppercase">
            Open searches
          </div>
          {searches
            .filter((s) => s.status === "open")
            .map((s) => (
              <Link
                key={s.id}
                href={`/searches/${s.id}`}
                className={`block truncate rounded px-2 py-1 text-[12.5px] ${
                  pathname.startsWith(`/searches/${s.id}`)
                    ? "bg-accent-soft text-ink"
                    : "text-ink-muted hover:bg-panel2"
                }`}
                title={s.name}
              >
                {s.name}
              </Link>
            ))}
        </div>
        <div className="border-t border-edge px-4 py-2.5 text-[11px] text-ink-faint">
          <kbd className="rounded border border-edge2 bg-panel2 px-1 py-0.5 font-mono">
            ⌘K
          </kbd>{" "}
          command bar
        </div>
      </aside>
      <main className="ml-52 min-w-0 flex-1 px-8 py-6">{children}</main>
      <CommandBar searches={searches} />
    </div>
  );
}
