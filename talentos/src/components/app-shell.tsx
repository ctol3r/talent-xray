"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { CommandBar, openCommandBar } from "./command-bar";
import { PagePreviewProvider, PreviewLink } from "./page-preview";
import {
  BottomPane,
  PaneShortcuts,
  SlidingPanes,
  insideAPane,
  reportPane,
} from "./sliding-panes";
import { PaneStage } from "./pane-stage";
import { CompanyMark } from "./company-mark";
import { ParallelRibbons } from "./parallel-ribbons";
import { PageContextPanel } from "./page-context";
import {
  MENU_OPEN_WIDTH,
  useIsNarrow,
  useMenuOpen,
  useMenuWidth,
} from "./workspace-layout";

const NAV = [
  { href: "/", label: "Home", icon: "🏠", exact: true },
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/search", label: "Search", icon: "🔍" },
  { href: "/notes", label: "Notes", icon: "📝" },
  { href: "/daily", label: "Daily notes", icon: "📅" },
  { href: "/searches", label: "Jobs", icon: "💼" },
  { href: "/sourcing", label: "Sourcing", icon: "🔭" },
  { href: "/candidates", label: "Candidates", icon: "👥" },
  { href: "/companies", label: "Companies", icon: "🏢" },
  { href: "/tags", label: "Tags", icon: "🏷️" },
  { href: "/graph", label: "Whole graph", icon: "🕸️" },
  { href: "/tasks", label: "Tasks", icon: "✅" },
  { href: "/outbox", label: "Outbox", icon: "📮" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export interface ShellSearch {
  id: string;
  name: string;
  status: string;
  /** Shown under the title: what separates two jobs fastest. */
  location?: string;
  /** For the mark beside the name in the sidebar. */
  company?: string;
  companyUrl?: string | null;
}

/** A tag that exists because somebody wrote it, with how often. */
export interface ShellTag {
  slug: string;
  display: string;
  count: number;
}

/** A person on file, with the search they belong to, for the command menu. */
export interface ShellPerson {
  id: string;
  name: string;
  searchProjectId: string;
  searchName: string;
}

export function AppShell({
  productName,
  searches,
  people = [],
  tags = [],
  favicons = false,
  framed = false,
  children,
}: {
  productName: string;
  searches: ShellSearch[];
  people?: ShellPerson[];
  tags?: ShellTag[];
  /** Whether a company's own icon is shown over its drawn mark. */
  favicons?: boolean;
  /**
   * True when this page is being rendered inside a pane.
   *
   * Decided on the server from `Sec-Fetch-Dest`, so the bare page is what
   * arrives rather than what it turns into a frame later.
   */
  framed?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useMenuOpen();
  const menuWidth = useMenuWidth();
  /**
   * On a narrow window the menu stops holding ground and lies over the page.
   *
   * 208px of menu plus a page that will not go below 420 is more than a phone
   * has, and the arithmetic was giving the page 167px of a 518px window. So
   * below the breakpoint the menu is an overlay you open and dismiss, and the
   * page has the whole width — which is the only arrangement where the page is
   * the thing you are looking at.
   */
  const narrow = useIsNarrow();
  /**
   * On a phone the menu starts closed, whatever the desktop preference says.
   *
   * The stored preference is about a menu that holds ground beside the page.
   * An overlay is a different thing, and arriving on a phone with the page
   * covered by navigation you did not ask for is the wrong first frame — so
   * narrow keeps its own state, and it starts shut.
   */
  const [narrowOpen, setNarrowOpen] = useState(false);
  const shown = narrow ? narrowOpen : menuOpen;
  const toggle = (next: boolean) =>
    narrow ? setNarrowOpen(next) : setMenuOpen(next);
  const over = narrow && narrowOpen;

  /**
   * The same question, asked from the browser.
   *
   * `Sec-Fetch-Dest` is not universal, and a pane that fell back to a whole
   * workspace inside a 500px frame would be worse than no pane. This costs
   * one effect and covers everything the header does not.
   */
  const selfFramed = useSyncExternalStore(
    // Nothing to subscribe to: a window does not stop being a frame.
    () => () => {},
    insideAPane,
    () => false,
  );

  /**
   * Tell the pane what this page is called, and keep telling it.
   *
   * Once on arrival and again after each navigation inside the pane, because
   * the reader can follow links in there and a pane still labelled with where
   * they started is a pane labelled with the wrong thing. The short delay is
   * for the document title, which the router writes after the render that
   * changes the path.
   */
  useEffect(() => {
    if (!(framed || selfFramed)) return;
    reportPane();
    const settled = window.setTimeout(reportPane, 60);
    return () => window.clearTimeout(settled);
  }, [framed, selfFramed, pathname]);

  if (framed || selfFramed) {
    /**
     * A page inside a pane is the page and nothing else.
     *
     * No menu, no rail, no dock, no command bar — the pane's own header
     * carries the title, the close and the link out, and everything the shell
     * would add here already exists ten pixels to the left in the window that
     * owns this frame.
     *
     * The padding matches `PaneStage`'s exactly, because `PageHeader` pulls
     * itself out to the edges with negative margins and a different inset
     * would leave its sticky bar hanging.
     */
    return (
      <PagePreviewProvider>
        <main
          data-testid="paned-page"
          className="min-h-screen px-3 py-4 sm:px-6 sm:py-5"
        >
          {children}
          <PageContextPanel />
        </main>
        {/* Shift-click still opens beside, from in here too — the handler
            notices it is framed and asks the rail that owns this frame. */}
        <PaneShortcuts />
      </PagePreviewProvider>
    );
  }

  return (
    <PagePreviewProvider>
      <div className="flex min-h-screen">
        {/* Dismissing it by tapping the page is the gesture people already
            have for an overlay; without it the only way out is the same small
            button you came in by. */}
        {over && (
          <button
            type="button"
            aria-label="Close the menu"
            onClick={() => toggle(false)}
            className="fixed inset-0 z-40 bg-canvas/60 backdrop-blur-[2px]"
          />
        )}
        {narrow && !narrowOpen && (
          // The toggle lives inside the menu, so with the menu off-canvas it
          // needs one out here or there is no way back in.
          <button
            type="button"
            aria-label="Show the menu"
            onClick={() => toggle(true)}
            className="fixed top-2 left-2 z-50 rounded-lg border border-edge bg-panel/90 px-2.5 py-1.5 text-[16px] shadow-lg backdrop-blur"
          >
            ☰
          </button>
        )}
        {narrow && (
          // The command bar is the product's stated way to reach anything, and
          // ⌘K is not a gesture a phone has.
          <button
            type="button"
            aria-label="Search everything"
            onClick={() => openCommandBar()}
            className="fixed top-2 right-2 z-50 rounded-lg border border-edge bg-panel/90 px-2.5 py-1.5 text-[16px] shadow-lg backdrop-blur"
          >
            🔍
          </button>
        )}
        <aside
          data-testid="workspace-menu"
          data-open={shown}
          data-narrow={narrow}
          style={{ width: narrow ? MENU_OPEN_WIDTH : menuWidth }}
          className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-edge bg-panel transition-transform duration-200 ease-out sm:transition-[width] ${
            narrow
              ? narrowOpen
                ? "translate-x-0 shadow-2xl"
                : "-translate-x-full"
              : "translate-x-0"
          }`}
        >
          <div className="flex items-center gap-2 px-3 py-4">
            {/* Off-canvas, this toggle is unreachable and would be a second
                "Show the menu" in the accessibility tree pointing at nothing.
                The floating one above is the way back in. */}
            {(!narrow || shown) && (
              <button
                type="button"
                aria-expanded={shown}
                aria-label={shown ? "Hide the menu" : "Show the menu"}
                title={shown ? "Hide the menu" : "Show the menu"}
                onClick={() => toggle(!shown)}
                className="rounded px-1 py-0.5 text-[14px] text-ink-faint hover:bg-panel2 hover:text-ink"
              >
                {shown ? "⟨" : "☰"}
              </button>
            )}
            {shown && (
              <>
                <span className="inline-block h-2 w-2 rounded-sm bg-accent" />
                <span className="truncate text-sm font-semibold tracking-wide">
                  {productName}
                </span>
              </>
            )}
          </div>
          <nav className="flex flex-col gap-0.5 px-2" aria-label="Workspace">
            {NAV.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-plain
                  onClick={() => narrow && setNarrowOpen(false)}
                  title={item.label}
                  className={`truncate rounded px-2 py-1.5 text-[14px] ${
                    shown ? "" : "text-center"
                  } ${
                    active
                      ? "bg-panel2 text-ink"
                      : "text-ink-muted hover:bg-panel2 hover:text-ink"
                  }`}
                >
                  <span aria-hidden className={shown ? "mr-1.5" : ""}>
                    {item.icon}
                  </span>
                  {/* Shut, the icons carry it. Every one of them has a title,
                      so the name is a hover away and the link keeps its
                      accessible name either way. */}
                  <span className={shown ? "" : "sr-only"}>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div
            className={`mt-4 flex-1 overflow-y-auto px-2 pb-4 ${shown ? "" : "hidden"}`}
          >
            <div className="px-2 pb-1 text-[12px] font-medium tracking-wider text-ink-faint uppercase">
              Open jobs
            </div>
            {searches
              .filter((s) => s.status === "open")
              .map((s) => (
                <PreviewLink
                  key={s.id}
                  target={`job:${s.id}`}
                  href={`/searches/${s.id}`}
                  className={`flex items-center gap-1.5 rounded px-2 py-1 text-[13.5px] ${
                    pathname.startsWith(`/searches/${s.id}`)
                      ? "bg-accent-soft text-ink"
                      : "text-ink-muted hover:bg-panel2"
                  }`}
                  title={s.name}
                >
                  {s.company && (
                    <CompanyMark
                      name={s.company}
                      url={s.companyUrl}
                      favicons={favicons}
                      size={14}
                    />
                  )}
                  <span className="min-w-0 truncate">{s.name}</span>
                </PreviewLink>
              ))}
          </div>
          <div
            className={`border-t border-edge px-4 py-2.5 text-[12px] text-ink-faint max-sm:hidden ${
              shown ? "" : "hidden"
            }`}
          >
            <kbd className="rounded border border-edge2 bg-panel2 px-1 py-0.5 font-mono">
              /
            </kbd>{" "}
            or{" "}
            <kbd className="rounded border border-edge2 bg-panel2 px-1 py-0.5 font-mono">
              ⌘K
            </kbd>{" "}
            to go anywhere, or ask
          </div>
        </aside>
        <PaneStage>{children}</PaneStage>
        <CommandBar searches={searches} people={people} tags={tags} />
        <PaneShortcuts />
        <SlidingPanes />
        <BottomPane />
        {/* The lines between what is open side by side. Nothing in the
            workspace is moved or covered by them; they are a picture of a
            relationship the records already have. */}
        <ParallelRibbons />
      </div>
    </PagePreviewProvider>
  );
}
