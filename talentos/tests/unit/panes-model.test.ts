/**
 * What a pane is, and where it sits.
 *
 * Both are string arithmetic, and both are where this feature breaks: a URL
 * that no longer opens what it used to, or a drag that lands one place off.
 */
import { describe, expect, it } from "vitest";
import {
  graphNodeForRoute,
  movePane,
  paneFallbackTitle,
  paneForRoute,
  paneIcon,
  paneTarget,
  parsePane,
  routeForPane,
  PANE_KINDS,
} from "@/lib/core/panes";

describe("reading a pane out of its string", () => {
  it("reads each kind", () => {
    expect(parsePane("tasks").kind).toBe("tasks");
    expect(parsePane("people").kind).toBe("people");
    expect(parsePane("calendar:2026-09-07")).toEqual({
      target: "calendar:2026-09-07",
      kind: "calendar",
      id: "2026-09-07",
    });
    expect(parsePane("job:abc").kind).toBe("job");
    expect(parsePane("page:ai-safety").id).toBe("ai-safety");
  });

  it("treats a bare slug as a page, so old links still open", () => {
    // Every stack written before typed panes existed looks like this.
    expect(parsePane("ai-safety")).toEqual({
      target: "ai-safety",
      kind: "page",
      id: "ai-safety",
    });
  });

  it("does not mistake a slug containing a colon-like word for a kind", () => {
    expect(parsePane("jobs-to-be-done").kind).toBe("page");
    expect(parsePane("peoples-republic").kind).toBe("page");
  });

  it("round-trips through the canonical form", () => {
    for (const kind of PANE_KINDS) {
      const target = paneTarget(kind, "x");
      expect(`${kind} → ${parsePane(target).kind}`).toBe(`${kind} → ${kind}`);
    }
  });

  it("gives every kind an icon and a title to show before it loads", () => {
    for (const kind of PANE_KINDS) {
      expect(paneIcon(kind).length).toBeGreaterThan(0);
      expect(
        paneFallbackTitle({ target: kind, kind, id: "" }).length,
      ).toBeGreaterThan(0);
    }
  });
});

describe("moving a pane from one slot to another", () => {
  const stack = ["a", "b", "c", "d"];

  it("moves one to the left", () => {
    expect(movePane(stack, "d", 0)).toEqual(["d", "a", "b", "c"]);
  });

  it("moves one to the right, accounting for the gap it leaves", () => {
    // The off-by-one every hand-rolled reorder gets wrong: dropping 'a' on
    // index 2 means "third in the list without 'a' in it".
    expect(movePane(stack, "a", 2)).toEqual(["b", "c", "a", "d"]);
  });

  it("moves one to the end", () => {
    expect(movePane(stack, "a", 3)).toEqual(["b", "c", "d", "a"]);
    expect(movePane(stack, "a", 99)).toEqual(["b", "c", "d", "a"]);
  });

  it("leaves the stack alone when nothing moved", () => {
    expect(movePane(stack, "b", 1)).toEqual(stack);
  });

  it("ignores a pane that is not in the stack", () => {
    expect(movePane(stack, "zz", 0)).toEqual(stack);
  });
});

describe("what the graph pane follows", () => {
  it("centres on the record the page is about", () => {
    expect(graphNodeForRoute("/searches/abc")).toBe("search:abc");
    expect(graphNodeForRoute("/searches/abc/strings")).toBe("search:abc");
    expect(graphNodeForRoute("/searches/abc/candidates/p1")).toBe(
      "candidate:p1",
    );
    expect(graphNodeForRoute("/searches/abc/candidates/p1/review")).toBe(
      "candidate:p1",
    );
    expect(graphNodeForRoute("/tags/ai-safety")).toBe("tag:ai-safety");
    expect(graphNodeForRoute("/tags/ai%20safety")).toBe("tag:ai safety");
    // Importing people into a job is still a page about that job.
    expect(graphNodeForRoute("/searches/abc/candidates/import")).toBe(
      "search:abc",
    );
  });

  it("has nothing to centre on where a page is not about one record", () => {
    // Which is honest rather than a gap: the pane falls back to the busiest
    // part of the graph, and "nothing in particular is near here" is the
    // right answer on the task list.
    for (const path of [
      "/",
      "/tasks",
      "/settings",
      "/graph",
      "/tags",
      "/candidates",
      "/searches",
      "/searches/new",
    ]) {
      expect(graphNodeForRoute(path), path).toBeNull();
    }
  });
});

/**
 * The address a pane shows.
 *
 * A pane holds the real page now, so `routeForPane` is load-bearing in a way
 * a title table never was: get it wrong and the pane shows the wrong page, or
 * a 404 where a workspace used to be. The property that keeps it honest is
 * that it and `paneForRoute` are inverses — the route a pane shows must be a
 * route that opens that pane.
 */
describe("the route a pane shows", () => {
  it("round-trips every kind through paneForRoute", () => {
    const examples: Record<string, string> = {
      page: "ai-safety",
      job: "b6a7ff8c",
      calendar: "2026-09-08",
      search: "recruiter",
      sourcing: "nurses in leeds",
    };
    for (const kind of PANE_KINDS) {
      const target = paneTarget(kind, examples[kind] ?? "");
      const route = routeForPane(parsePane(target));
      const [path, query = ""] = route.split("?");
      expect(paneForRoute(path, query), `${kind} → ${route}`).toBe(target);
    }
  });

  it("keeps a query in the address rather than in the path", () => {
    // A search pane is a search, and the query belongs where the page reads
    // it from. Putting it in the path would be a route that does not exist.
    expect(routeForPane(parsePane("search:senior nurse"))).toBe(
      "/search?q=senior%20nurse",
    );
    expect(routeForPane(parsePane("search"))).toBe("/search");
  });

  it("gives the graph the record the reader is standing on", () => {
    // The one pane that changes with where you are rather than with what you
    // opened. Everything else ignores the focus entirely.
    expect(routeForPane(parsePane("graph"), "search:abc")).toBe(
      "/graph?focus=search%3Aabc",
    );
    expect(routeForPane(parsePane("graph"), null)).toBe("/graph");
    expect(routeForPane(parsePane("tasks"), "search:abc")).toBe("/tasks");
  });

  it("escapes a tag that is not a bare word", () => {
    expect(routeForPane(parsePane("page:c++"))).toBe("/tags/c%2B%2B");
  });
});
