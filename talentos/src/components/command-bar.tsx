"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { tagHref } from "@/lib/core/tags";
import type { ShellPerson, ShellSearch, ShellTag } from "./app-shell";
import { PHASES } from "./workspace-nav";
import { JOB_STATUSES, labelFor } from "@/lib/domain/job-fields";
import { classifyIntent, type IndexedRecord } from "@/lib/sourcing/intent";
import {
  flatten,
  intentGroups,
  nextIntentIndex,
  type IntentRow,
} from "@/lib/domain/command-intents";
import { routeQuestion } from "../../artifact-src/core/experts";
import { askExpertAction } from "@/lib/actions/expert";

/**
 * The one input.
 *
 * Two ways in, deliberately. Cmd+K is the palette convention. A bare "/" is
 * the Roam convention, and it is the one that makes the menu feel like part
 * of the page rather than a separate mode: no chord, no reach. "/" is
 * ignored while the caret is in a field, so typing a slash into a note or a
 * Boolean string still types a slash.
 *
 * With nothing typed it is a menu of everything addressable, grouped: the
 * app's own places, every module of the search you are currently in, every
 * other search, and every person on file with the search they belong to.
 *
 * The moment anything is typed it stops being a menu and becomes the product's
 * only front door. The classifier reads the string — a name, a filter
 * expression, a brief, a question — and the blocks come back in the order it
 * ranked them, strongest first. Enter runs the top row. Tab moves to the top
 * of the next block, which is how somebody disagrees with the classification
 * without retyping a word of it.
 *
 * `/search` and `/sourcing` used to have boxes of their own. They are result
 * views now. This is the only place anything is typed, so there is one grammar
 * to learn and one place for it to be wrong.
 */

type Group = "Go" | "This job" | "Jobs" | "People" | "Tags";

/** A picture per group, so the eye finds the right block before it reads. */
const GROUP_ICON: Record<Group, string> = {
  "This job": "📍",
  Go: "🏠",
  Tags: "🏷️",
  Jobs: "💼",
  People: "👥",
};

interface Command {
  id: string;
  label: string;
  icon?: string;
  group: Group;
  hint?: string;
  href: string;
  /** Extra words matched by the filter but not shown. */
  keywords?: string;
}

/** Group order in the list. Fixed, so position is learnable. */
const GROUP_ORDER: Group[] = ["This job", "Go", "Tags", "Jobs", "People"];

/** What each menu group is, in the classifier's vocabulary. */
const GROUP_KIND: Record<Group, IndexedRecord["kind"]> = {
  "This job": "page",
  Go: "page",
  Tags: "tag",
  Jobs: "job",
  People: "person",
};

/**
 * Modules addressable from the command menu when inside a search.
 *
 * Derived from the nav's own phase list rather than repeated here, so the two
 * cannot drift — a module added to a phase is in the menu the same day. Only
 * the extra words to match on live here.
 */
const MODULE_KEYWORDS: Record<string, string> = {
  "/role": "jd job description",
  "/intake": "hiring manager answers",
  "/profile": "criteria success",
  "/market": "research audience",
  "/strategy": "plan",
  "/sources": "where channels",
  "/strings": "query x-ray boolean",
  "/discover": "run search engine yield open index",
  "/graph": "map connections neo4j",
  "/candidates": "people shortlist",
  "/outreach": "email sequence message",
  "/screen": "questions",
  "/interviews": "scorecard loop",
  "/pipeline": "stages",
  "/close": "offer onboarding",
  "/analytics": "funnel metrics",
  "/diagnosis": "what is wrong stuck",
  "/guide": "help how next",
  "/review-shortlist": "compare deck cards side by side",
  "/learnings": "retro",
};

/**
 * Modules the menu reaches that the nav deliberately does not show. Crew is
 * an instrument for watching background work rather than a step in a job, so
 * it is reachable by name and nowhere else.
 */
const MENU_ONLY: {
  path: string;
  label: string;
  icon: string;
  keywords: string;
}[] = [
  {
    path: "/crew",
    label: "Crew",
    icon: "🤖",
    keywords: "agents background work queue",
  },
];

const MODULE_COMMANDS = PHASES.flatMap((phase) =>
  phase.modules.map((module) => ({
    path: module.path,
    label: module.label,
    icon: module.icon,
    phase: phase.label,
    keywords: MODULE_KEYWORDS[module.path],
  })),
).concat(
  MENU_ONLY.map((entry) => ({
    path: entry.path,
    label: entry.label,
    icon: entry.icon,
    phase: "Not in the nav",
    keywords: entry.keywords,
  })),
);

/** True when the caret is somewhere that a typed "/" belongs. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

/** How anything without a keyboard asks for the command bar. */
export const COMMAND_BAR_EVENT = "talentos:command-bar";

/**
 * Open the menu from a button, optionally carrying a query.
 *
 * The seed is what makes a result page editable without owning an input: the
 * page hands its own query back to the one box the product has, with the
 * caret in it.
 */
export function openCommandBar(seed?: string): void {
  window.dispatchEvent(
    new CustomEvent<{ seed?: string }>(COMMAND_BAR_EVENT, {
      detail: seed ? { seed } : {},
    }),
  );
}

/** One block of rows under one heading. */
interface Block {
  key: string;
  label: string;
  icon: string;
  /** Why the classifier put this block here, in its own words. */
  why?: string;
  rows: IntentRow[];
}

export function CommandBar({
  searches,
  people = [],
  tags = [],
}: {
  searches: ShellSearch[];
  people?: ShellPerson[];
  tags?: ShellTag[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const [asking, startAsking] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  const currentSearchId = pathname.match(/^\/searches\/([^/]+)/)?.[1];

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [
      {
        id: "dashboard",
        label: "What should I do next?",
        icon: "🏠",
        group: "Go",
        hint: "dashboard",
        href: "/",
      },
      {
        id: "new-search",
        label: "Create job",
        icon: "➕",
        group: "Go",
        hint: "new",
        href: "/searches/new",
      },
      {
        id: "all-searches",
        label: "All jobs",
        icon: "💼",
        group: "Go",
        href: "/searches",
      },
      {
        id: "all-candidates",
        label: "All people",
        icon: "👥",
        group: "Go",
        keywords: "candidates",
        href: "/candidates",
      },
      {
        id: "all-tags",
        label: "All tags",
        icon: "🏷️",
        group: "Go",
        keywords: "words pages",
        href: "/tags",
      },
      {
        id: "whole-graph",
        label: "Whole graph",
        icon: "🕸️",
        group: "Go",
        keywords: "neo4j everything connections across jobs",
        href: "/graph",
      },
      {
        id: "daily",
        label: "Daily notes",
        icon: "📅",
        group: "Go",
        keywords: "today journal calendar",
        href: "/daily",
      },
      {
        id: "tasks",
        label: "Tasks",
        icon: "✅",
        group: "Go",
        href: "/tasks",
      },
      {
        id: "settings",
        label: "Settings",
        icon: "⚙️",
        group: "Go",
        href: "/settings",
      },
    ];
    if (currentSearchId && currentSearchId !== "new") {
      for (const entry of MODULE_COMMANDS) {
        list.push({
          id: `module${entry.path}`,
          label: entry.label,
          icon: entry.icon,
          group: "This job",
          hint: entry.phase,
          keywords: entry.keywords,
          href: `/searches/${currentSearchId}${entry.path}`,
        });
      }
    }
    for (const search of searches) {
      if (search.id === currentSearchId) continue;
      list.push({
        id: `search-${search.id}`,
        label: search.name,
        icon: "💼",
        group: "Jobs",
        hint: search.location ?? labelFor(JOB_STATUSES, search.status),
        keywords: search.location,
        href: `/searches/${search.id}`,
      });
    }
    for (const tag of tags) {
      list.push({
        id: `tag-${tag.slug}`,
        label: tag.display,
        icon: "🏷️",
        group: "Tags",
        hint: `${tag.count} use${tag.count === 1 ? "" : "s"}`,
        href: tagHref(tag.slug),
      });
    }
    for (const person of people) {
      list.push({
        id: `person-${person.id}`,
        label: person.name,
        icon: "👤",
        group: "People",
        hint: person.searchName,
        keywords: person.searchName,
        href: `/searches/${person.searchProjectId}/candidates/${person.id}`,
      });
    }
    return list;
  }, [searches, people, tags, currentSearchId]);

  /** Everything addressable, in the shape the classifier indexes. */
  const records = useMemo<IndexedRecord[]>(
    () =>
      commands.map((command) => ({
        kind: GROUP_KIND[command.group],
        id: command.id,
        name: command.label,
        href: command.href,
        keywords: command.keywords,
      })),
    [commands],
  );

  const byId = useMemo(
    () => new Map(commands.map((command) => [command.id, command])),
    [commands],
  );

  /**
   * The blocks on screen.
   *
   * Empty, this is the menu it has always been. Typed into, it is whatever
   * the classifier makes of the string, and the readings it rejected are
   * still underneath.
   */
  const blocks = useMemo<Block[]>(() => {
    const typed = query.trim();
    if (!typed) {
      const out: Block[] = [];
      for (const group of GROUP_ORDER) {
        const rows = commands
          .filter((command) => command.group === group)
          .slice(0, 12)
          .map((command) => ({
            id: command.id,
            label: command.label,
            icon: command.icon,
            hint: command.hint,
            href: command.href,
          }));
        if (rows.length > 0) {
          out.push({
            key: group,
            label: group,
            icon: GROUP_ICON[group],
            rows,
          });
        }
      }
      return out;
    }

    const read = classifyIntent(typed, records);
    const jumps: IntentRow[] = (
      read.candidates.find((c) => c.intent === "jump")?.records ?? []
    ).map((match) => {
      const command = byId.get(match.record.id);
      return {
        id: match.record.id,
        label: match.record.name,
        icon: command?.icon,
        hint: command?.hint,
        href: match.record.href,
      };
    });
    const why = new Map(read.candidates.map((c) => [c.intent, c.why]));

    return intentGroups({
      ranked: read.candidates.map((c) => c.intent),
      query: typed,
      jumps,
      specialist: routeQuestion(typed).expert,
    }).map((group) => ({
      key: group.intent,
      label: group.label,
      icon: group.icon,
      why: why.get(group.intent),
      rows: group.rows,
    }));
  }, [query, commands, records, byId]);

  const rows = useMemo(() => flatten(blocks), [blocks]);

  /**
   * Where each block starts in the flat list.
   *
   * The list is drawn in blocks and moved through as one run of rows, so the
   * two need a shared numbering. Counted once here rather than tallied while
   * drawing, which is the same arithmetic done somewhere it cannot be trusted.
   */
  const offsets = useMemo(() => {
    const out: number[] = [];
    let at = 0;
    for (const block of blocks) {
      out.push(at);
      at += block.rows.length;
    }
    return out;
  }, [blocks]);

  const run = useCallback(
    (row: IntentRow | undefined) => {
      if (!row) return;
      if (row.action === "ask") {
        // The same code path the home page's ask box uses: the question is
        // written down, routed, and left waiting for whoever answers it. The
        // menu closes onto the conversation rather than reporting back here.
        const question = row.label;
        startAsking(async () => {
          await askExpertAction({ question });
          setOpen(false);
          setQuery("");
          router.push("/");
          router.refresh();
        });
        return;
      }
      if (!row.href) return;
      setOpen(false);
      setQuery("");
      router.push(row.href);
    },
    [router],
  );

  /** Open, optionally onto a query the page handed back. */
  const show = useCallback((seed?: string) => {
    setOpen(true);
    setQuery(seed ?? "");
    setIndex(0);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((o) => !o);
        setQuery("");
        setIndex(0);
        return;
      }
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      // "/" opens the menu, but only when it is not being typed into a field.
      if (
        event.key === "/" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !isTyping(event.target)
      ) {
        event.preventDefault();
        show();
      }
    };
    // A touch device has neither ⌘K nor a "/" key, and the product tells the
    // reader twice that this is how you reach anything. So there is a second
    // way in: an event any button can dispatch, carrying a query when the
    // page it came from had one.
    const onAsked = (event: Event) => {
      const seed = (event as CustomEvent<{ seed?: string }>).detail?.seed;
      show(seed);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(COMMAND_BAR_EVENT, onAsked);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(COMMAND_BAR_EVENT, onAsked);
    };
  }, [show]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
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
              setIndex((i) => Math.min(i + 1, rows.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setIndex((i) => Math.max(i - 1, 0));
            } else if (
              e.key === "Tab" ||
              // The same move under a modifier, for anybody whose hands are
              // already on the arrows.
              (e.altKey && (e.key === "ArrowDown" || e.key === "ArrowUp"))
            ) {
              e.preventDefault();
              const back = e.shiftKey || e.key === "ArrowUp";
              setIndex((i) => nextIntentIndex(blocks, i, back ? -1 : 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              run(rows[index]);
            }
          }}
          placeholder="Type a name, a filter, a brief or a question…"
          className="w-full border-b border-edge bg-transparent px-4 py-3 text-sm placeholder:text-ink-faint"
        />
        <ul
          className="max-h-80 overflow-y-auto py-1"
          data-testid="command-rows"
        >
          {rows.length === 0 && (
            <li className="px-4 py-3 text-[14px] text-ink-faint">
              Nothing matches that.
            </li>
          )}
          {blocks.map((block, b) => (
            <li key={block.key} data-testid={`block-${block.key}`}>
              <p className="flex items-baseline gap-1.5 px-4 pb-1 pt-2 text-[11px] uppercase tracking-wider text-ink-faint">
                <span aria-hidden>{block.icon}</span>
                {block.label}
                {block.why && (
                  <span className="truncate normal-case tracking-normal text-ink-faint/80">
                    · {block.why}
                  </span>
                )}
              </p>
              <ul>
                {block.rows.map((row, j) => {
                  const i = offsets[b] + j;
                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        disabled={asking}
                        onMouseEnter={() => setIndex(i)}
                        onClick={() => run(row)}
                        className={`flex w-full items-center justify-between px-4 py-2 text-left text-[14px] disabled:opacity-60 ${
                          i === index
                            ? "bg-accent-soft text-ink"
                            : "text-ink-muted"
                        }`}
                      >
                        <span className="truncate">
                          {row.icon && (
                            <span aria-hidden className="mr-1.5">
                              {row.icon}
                            </span>
                          )}
                          {row.label}
                        </span>
                        {row.hint && (
                          <span className="ml-3 shrink-0 truncate text-[12px] text-ink-faint">
                            {asking && row.action === "ask"
                              ? "asking…"
                              : row.hint}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
        <p className="border-t border-edge px-4 py-2 text-[12px] text-ink-faint">
          <kbd className="rounded border border-edge2 px-1">/</kbd> or{" "}
          <kbd className="rounded border border-edge2 px-1">⌘K</kbd> to open ·{" "}
          <kbd className="rounded border border-edge2 px-1">↑↓</kbd> to move ·{" "}
          <kbd className="rounded border border-edge2 px-1">⇥</kbd> to change
          what it is · <kbd className="rounded border border-edge2 px-1">↵</kbd>{" "}
          to run
        </p>
      </div>
    </div>
  );
}
