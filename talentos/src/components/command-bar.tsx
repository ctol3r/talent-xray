"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ShellSearch } from "./app-shell";

interface Command {
  id: string;
  label: string;
  hint?: string;
  href: string;
}

/** Modules addressable from the command bar when inside a search. */
const MODULE_COMMANDS: { path: string; label: string }[] = [
  { path: "", label: "Overview" },
  { path: "/role", label: "Role Intelligence" },
  { path: "/intake", label: "Generate intake / capture answers" },
  { path: "/profile", label: "Success Profile" },
  { path: "/market", label: "Research talent market" },
  { path: "/strategy", label: "Generate search strategy" },
  { path: "/sources", label: "Source channels" },
  { path: "/strings", label: "Generate Boolean strings" },
  { path: "/candidates", label: "Candidates / add candidate" },
  { path: "/outreach", label: "Draft outreach" },
  { path: "/screen", label: "Create recruiter screen" },
  { path: "/interviews", label: "Interview plan & scorecards" },
  { path: "/pipeline", label: "Pipeline board" },
  { path: "/close", label: "Close / offer / onboarding" },
  { path: "/analytics", label: "Analyze pipeline" },
  { path: "/learnings", label: "Search learnings" },
];

export function CommandBar({ searches }: { searches: ShellSearch[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  const currentSearchId = pathname.match(/^\/searches\/([^/]+)/)?.[1];

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [
      { id: "new-search", label: "Create search", hint: "new", href: "/searches/new" },
      { id: "dashboard", label: "What should I do next?", hint: "dashboard", href: "/" },
      { id: "candidates", label: "All candidates", href: "/candidates" },
      { id: "tasks", label: "Tasks", href: "/tasks" },
      { id: "settings", label: "Settings", href: "/settings" },
    ];
    if (currentSearchId && currentSearchId !== "new") {
      for (const entry of MODULE_COMMANDS) {
        list.push({
          id: `module${entry.path}`,
          label: entry.label,
          hint: "this search",
          href: `/searches/${currentSearchId}${entry.path}`,
        });
      }
    }
    for (const search of searches) {
      list.push({
        id: `search-${search.id}`,
        label: search.name,
        hint: "open search",
        href: `/searches/${search.id}`,
      });
    }
    return list;
  }, [searches, currentSearchId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands.slice(0, 12);
    return commands
      .filter((c) => c.label.toLowerCase().includes(q))
      .slice(0, 12);
  }, [commands, query]);

  const run = useCallback(
    (command: Command | undefined) => {
      if (!command) return;
      setOpen(false);
      setQuery("");
      router.push(command.href);
    },
    [router],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((o) => !o);
        setIndex(0);
      } else if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[18vh]"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-[560px] overflow-hidden rounded-lg border border-edge2 bg-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="command-bar"
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIndex((i) => Math.min(i + 1, filtered.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              run(filtered[index]);
            }
          }}
          placeholder="Type a command or search…"
          className="w-full border-b border-edge bg-transparent px-4 py-3 text-sm outline-none placeholder:text-ink-faint"
        />
        <ul className="max-h-80 overflow-y-auto py-1">
          {filtered.length === 0 && (
            <li className="px-4 py-3 text-[13px] text-ink-faint">
              No matching commands.
            </li>
          )}
          {filtered.map((command, i) => (
            <li key={command.id}>
              <button
                type="button"
                onMouseEnter={() => setIndex(i)}
                onClick={() => run(command)}
                className={`flex w-full items-center justify-between px-4 py-2 text-left text-[13px] ${
                  i === index ? "bg-accent-soft text-ink" : "text-ink-muted"
                }`}
              >
                <span className="truncate">{command.label}</span>
                {command.hint && (
                  <span className="ml-3 shrink-0 text-[11px] text-ink-faint">
                    {command.hint}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
