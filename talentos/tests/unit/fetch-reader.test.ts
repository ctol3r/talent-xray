/**
 * The reader end to end, against an injected transport: the whole pipeline
 * without a socket. Every case is a page the web actually serves.
 */
import { describe, expect, it } from "vitest";
import {
  htmlToText,
  challengeIn,
  titleFrom,
  decodeEntities,
} from "@/lib/fetch/html-text";
import {
  PageReader,
  readerEnv,
  readingSwitches,
  whyDisabled,
} from "@/lib/fetch/read-page";
import type { HttpOutcome } from "@/lib/fetch/http";

const ON = {
  enabled: true,
  contact: "https://example.org/reader",
  selfOrigins: [],
};

interface Page {
  status?: number;
  body?: string;
  headers?: Record<string, string>;
  location?: string;
  fail?: HttpOutcome;
}

/** A clock the tests move themselves, so a politeness wait costs nothing. */
function virtualClock(start = 1_700_000_000_000) {
  let t = start;
  return {
    now: () => t,
    sleep: async (ms: number) => {
      t += ms;
    },
  };
}

/** A tiny web: paths to responses, and a log of what was actually asked. */
function web(pages: Record<string, Page>) {
  const asked: string[] = [];
  const transport = async (url: URL): Promise<HttpOutcome> => {
    asked.push(url.toString());
    const page = pages[url.toString()];
    if (!page) {
      return {
        ok: true,
        response: {
          status: 404,
          headers: {},
          body: "",
          bytes: 0,
          location: null,
        },
      };
    }
    if (page.fail) return page.fail;
    const body = page.body ?? "";
    return {
      ok: true,
      response: {
        status: page.status ?? 200,
        headers: { "content-type": "text/html", ...(page.headers ?? {}) },
        body,
        bytes: body.length,
        location: page.location ?? null,
      },
    };
  };
  return { asked, transport: transport as never };
}

const TEAM_PAGE = `<!doctype html><html><head><title>Our Team — Harbour Robotics</title></head>
<body><nav>Home | About | Careers</nav>
<h1>Our Team</h1>
<div class="card"><h3>Priya Raman</h3><p>Principal Perception Engineer, Harbour Robotics. Priya leads the sensor fusion group in Bristol.</p><a href="mailto:priya@harbour-robotics.com">priya@harbour-robotics.com</a></div>
<div class="card"><h3>Tomas Vlk</h3><p>Staff Software Engineer. Tomas works on motion planning and SLAM.</p></div>
<footer>&copy; 2026 Harbour Robotics. All rights reserved.</footer></body></html>`;

describe("the switch", () => {
  it("is off unless the environment says on, with a contact URL", () => {
    expect(readerEnv({}).enabled).toBe(false);
    expect(readerEnv({ TALENTOS_FETCH: "on" }).enabled).toBe(false);
    expect(
      readerEnv({
        TALENTOS_FETCH: "on",
        TALENTOS_FETCH_CONTACT: "https://x.example/who",
      }).enabled,
    ).toBe(true);
  });

  it("says which half is missing", () => {
    expect(whyDisabled(readerEnv({}), {})).toContain("TALENTOS_FETCH=on");
    const raw = { TALENTOS_FETCH: "on" };
    expect(whyDisabled(readerEnv(raw), raw)).toContain(
      "TALENTOS_FETCH_CONTACT",
    );
  });

  it("names both halves at once, however many are missing", () => {
    // whyDisabled answers one at a time, which is right for a refused read and
    // wrong for a settings page: with neither set, the ordered message never
    // mentions the contact URL, so nobody learns it is half the switch.
    const none = readingSwitches({});
    expect(none.map((s) => s.env)).toEqual([
      "TALENTOS_FETCH",
      "TALENTOS_FETCH_CONTACT",
    ]);
    expect(none.every((s) => s.set)).toBe(false);

    const half = readingSwitches({ TALENTOS_FETCH: "on" });
    expect(half.map((s) => s.set)).toEqual([true, false]);

    const both = readingSwitches({
      TALENTOS_FETCH: "on",
      TALENTOS_FETCH_CONTACT: "https://x.example/who",
    });
    expect(both.map((s) => s.set)).toEqual([true, true]);
  });

  it("counts a contact URL too short to be one as not set", () => {
    const raw = { TALENTOS_FETCH: "on", TALENTOS_FETCH_CONTACT: "https://" };
    expect(readingSwitches(raw)[1].set).toBe(false);
    expect(readerEnv(raw).enabled).toBe(false);
  });

  it("requests nothing at all while it is off", async () => {
    const { asked, transport } = web({});
    const reader = new PageReader({
      env: { enabled: false, contact: null, selfOrigins: [] },
      transport,
      ...virtualClock(),
    });
    const out = await reader.read("https://harbour-robotics.com/team");
    expect(out.ok).toBe(false);
    expect(asked).toEqual([]);
  });
});

describe("robots", () => {
  it("asks for robots.txt before the page, once per host", async () => {
    const { asked, transport } = web({
      "https://harbour-robotics.com/robots.txt": { status: 404 },
      "https://harbour-robotics.com/team": { body: TEAM_PAGE },
      "https://harbour-robotics.com/about": { body: TEAM_PAGE },
    });
    const reader = new PageReader({ env: ON, transport, ...virtualClock() });
    await reader.read("https://harbour-robotics.com/team");
    await reader.read("https://harbour-robotics.com/about");
    expect(asked.filter((u) => u.endsWith("/robots.txt"))).toHaveLength(1);
    expect(asked[0]).toBe("https://harbour-robotics.com/robots.txt");
  });

  it("obeys a disallow and quotes the line", async () => {
    const { asked, transport } = web({
      "https://harbour-robotics.com/robots.txt": {
        body: "User-agent: *\nDisallow: /team\n",
      },
      "https://harbour-robotics.com/team": { body: TEAM_PAGE },
    });
    const reader = new PageReader({ env: ON, transport, ...virtualClock() });
    const out = await reader.read("https://harbour-robotics.com/team");
    expect(out.ok).toBe(false);
    expect(out.reason).toContain("Disallow: /team");
    expect(asked).toEqual(["https://harbour-robotics.com/robots.txt"]);
  });

  it("reads nothing when robots could not be read at all", async () => {
    const { transport } = web({
      "https://harbour-robotics.com/robots.txt": {
        fail: {
          ok: false,
          kind: "serverError",
          reason: "That site answered 503.",
        },
      },
      "https://harbour-robotics.com/team": { body: TEAM_PAGE },
    });
    const reader = new PageReader({ env: ON, transport, ...virtualClock() });
    const out = await reader.read("https://harbour-robotics.com/team");
    expect(out.ok).toBe(false);
    expect(out.reason).toContain("what it permits is unknown");
  });
});

describe("redirects", () => {
  it("re-gates every hop rather than inheriting permission", async () => {
    const { asked, transport } = web({
      "https://harbour-robotics.com/robots.txt": { status: 404 },
      "https://harbour-robotics.com/team": {
        status: 301,
        location: "https://people.harbour-robotics.com/team",
      },
      "https://people.harbour-robotics.com/robots.txt": {
        body: "User-agent: *\nDisallow: /\n",
      },
      "https://people.harbour-robotics.com/team": { body: TEAM_PAGE },
    });
    const reader = new PageReader({ env: ON, transport, ...virtualClock() });
    const out = await reader.read("https://harbour-robotics.com/team");
    expect(out.ok).toBe(false);
    // The second host's own rules were asked for, and its page never was.
    expect(asked).toContain("https://people.harbour-robotics.com/robots.txt");
    expect(asked).not.toContain("https://people.harbour-robotics.com/team");
  });

  it("refuses a redirect that leaves the web", async () => {
    const { transport } = web({
      "https://harbour-robotics.com/robots.txt": { status: 404 },
      "https://harbour-robotics.com/team": {
        status: 302,
        location: "http://127.0.0.1:80/",
      },
    });
    const reader = new PageReader({ env: ON, transport, ...virtualClock() });
    const out = await reader.read("https://harbour-robotics.com/team");
    expect(out.ok).toBe(false);
    expect(out.reason).toContain("https");
  });
});

describe("pages that are not pages", () => {
  it("stops at a bot check instead of getting past it", async () => {
    const { transport } = web({
      "https://harbour-robotics.com/robots.txt": { status: 404 },
      "https://harbour-robotics.com/team": {
        status: 403,
        body: "<html><body>Checking your browser before you continue</body></html>",
      },
    });
    const reader = new PageReader({ env: ON, transport, ...virtualClock() });
    const out = await reader.read("https://harbour-robotics.com/team");
    expect(out.ok).toBe(false);
    expect(out.reason).toContain("a bot check");
    expect(out.reason).toContain("gets past");
  });

  it("stops at a sign-in wall served with a 200", async () => {
    const { transport } = web({
      "https://harbour-robotics.com/robots.txt": { status: 404 },
      "https://harbour-robotics.com/team": {
        body: "<html><body><h1>Members only</h1></body></html>",
      },
    });
    const reader = new PageReader({ env: ON, transport, ...virtualClock() });
    expect(
      (await reader.read("https://harbour-robotics.com/team")).reason,
    ).toContain("sign-in wall");
  });

  it("drops a page that asks not to be held", async () => {
    const { transport } = web({
      "https://harbour-robotics.com/robots.txt": { status: 404 },
      "https://harbour-robotics.com/team": {
        headers: { "x-robots-tag": "noindex" },
        body: TEAM_PAGE,
      },
    });
    const reader = new PageReader({ env: ON, transport, ...virtualClock() });
    const out = await reader.read("https://harbour-robotics.com/team");
    expect(out.ok).toBe(false);
    expect(out.reason).toContain("Read and dropped");
    expect(out.reading).toBeNull();
  });
});

describe("the registry, before anything is asked", () => {
  it("asks a handoff host nothing at all, not even for its robots.txt", async () => {
    const { asked, transport } = web({});
    const reader = new PageReader({ env: ON, transport, ...virtualClock() });
    const out = await reader.read("https://www.linkedin.com/in/somebody");
    expect(out.ok).toBe(false);
    expect(out.reason).toContain("sign-in");
    expect(asked).toEqual([]);
    expect(reader.budget.requests).toBe(0);
  });

  it("does not follow a robots.txt redirect onto a host the registry refuses", async () => {
    const { asked, transport } = web({
      "https://roster.example-lab.org/robots.txt": {
        status: 302,
        location: "https://web.archive.org/robots.txt",
      },
      "https://roster.example-lab.org/people": { body: TEAM_PAGE },
    });
    const reader = new PageReader({ env: ON, transport, ...virtualClock() });
    const out = await reader.read("https://roster.example-lab.org/people");
    expect(out.ok).toBe(false);
    expect(asked).not.toContain("https://web.archive.org/robots.txt");
    // And a robots file we could not establish means nothing is read.
    expect(out.reason).toContain("what it permits is unknown");
  });
});

describe("the run's budget bounds the robots fetch too", () => {
  it("does not spend a last request finding out what a new host permits", async () => {
    const { asked, transport } = web({
      "https://one.example-lab.org/robots.txt": { status: 404 },
      "https://one.example-lab.org/a": { body: TEAM_PAGE },
      "https://two.example-lab.org/robots.txt": { status: 404 },
      "https://two.example-lab.org/b": { body: TEAM_PAGE },
    });
    const reader = new PageReader({
      env: ON,
      transport,
      limits: { maxRequests: 2, maxBytes: 1e9, maxElapsedMs: 1e9 },
      ...virtualClock(),
    });
    await reader.read("https://one.example-lab.org/a");
    const second = await reader.read("https://two.example-lab.org/b");
    expect(second.ok).toBe(false);
    expect(second.reason).toContain("Stopped");
    // The second host was never asked for anything, robots.txt included.
    expect(asked.some((u) => u.includes("two.example-lab.org"))).toBe(false);
    expect(reader.budget.requests).toBe(2);
  });
});

describe("a published crawl-delay", () => {
  it("applies to the first page fetch, not only the second", async () => {
    const clock = virtualClock();
    const { transport } = web({
      "https://slow.example-lab.org/robots.txt": {
        body: "User-agent: *\nCrawl-delay: 30\n",
      },
      "https://slow.example-lab.org/people": { body: TEAM_PAGE },
    });
    const started = clock.now();
    const reader = new PageReader({ env: ON, transport, ...clock });
    const out = await reader.read("https://slow.example-lab.org/people");
    expect(out.ok).toBe(true);
    // Thirty seconds, not the two-second default: the delay was published in
    // the file the previous request fetched, and covers the one after it.
    expect(clock.now() - started).toBeGreaterThanOrEqual(30_000);
  });
});

describe("what comes back", () => {
  it("reads the people off a team page", async () => {
    const { transport } = web({
      "https://harbour-robotics.com/robots.txt": { status: 404 },
      "https://harbour-robotics.com/team": { body: TEAM_PAGE },
    });
    const reader = new PageReader({ env: ON, transport, ...virtualClock() });
    const out = await reader.read("https://harbour-robotics.com/team");
    expect(out.ok).toBe(true);
    expect(out.title).toBe("Our Team — Harbour Robotics");
    const names = out.reading?.people.map((p) => p.name) ?? [];
    expect(names).toContain("Priya Raman");
    expect(names).toContain("Tomas Vlk");
    // Furniture is not a person.
    expect(names).not.toContain("Our Team");
    expect(names).not.toContain("Harbour Robotics");
    const priya = out.reading?.people.find((p) => p.name === "Priya Raman");
    expect(priya?.emails).toEqual(["priya@harbour-robotics.com"]);
  });

  it("charges the run budget for every request, robots included", async () => {
    const { transport } = web({
      "https://harbour-robotics.com/robots.txt": { status: 404 },
      "https://harbour-robotics.com/team": { body: TEAM_PAGE },
    });
    const reader = new PageReader({ env: ON, transport, ...virtualClock() });
    await reader.read("https://harbour-robotics.com/team");
    expect(reader.budget.requests).toBe(2);
  });

  it("stops the run when its budget is spent", async () => {
    const { transport } = web({
      "https://harbour-robotics.com/robots.txt": { status: 404 },
      "https://harbour-robotics.com/team": { body: TEAM_PAGE },
    });
    const reader = new PageReader({
      env: ON,
      transport,
      limits: { maxRequests: 2, maxBytes: 1e9, maxElapsedMs: 1e9 },
      ...virtualClock(),
    });
    await reader.read("https://harbour-robotics.com/team");
    const second = await reader.read("https://harbour-robotics.com/other");
    expect(second.ok).toBe(false);
    expect(second.reason).toContain("Stopped");
  });
});

describe("markup to text", () => {
  it("keeps the page's own line structure", () => {
    expect(
      htmlToText(
        "<tr><td>Ana Silva</td><td>Chair</td></tr><tr><td>Bo Lin</td></tr>",
      ),
    ).toBe("Ana Silva\nChair\nBo Lin");
  });

  it("throws away what is never text", () => {
    expect(
      htmlToText("<script>alert('x')</script><p>Hello</p><style>p{}</style>"),
    ).toBe("Hello");
  });

  it("decodes the entities a roster actually contains", () => {
    expect(decodeEntities("Jos&eacute; &amp; C&#233;line &#x2014; done")).toBe(
      "José & Céline — done",
    );
  });

  it("reads the title", () => {
    expect(titleFrom("<title>Faculty &amp; Staff</title>")).toBe(
      "Faculty & Staff",
    );
  });

  it("drops an element the page never closed", () => {
    // A page truncated at the byte cap ends mid-element often enough that
    // without this a script's source arrives as text and its string literals
    // read as people.
    expect(htmlToText("<p>Ana Silva</p><script>var who='Bo Lin';")).toBe(
      "Ana Silva",
    );
  });

  it("names a challenge without trying to solve it", () => {
    expect(challengeIn("<p>Verify you are human</p>")).toBe("a bot check");
    expect(challengeIn("<p>Subscribe to read the rest</p>")).toBe("a paywall");
    expect(challengeIn(TEAM_PAGE)).toBeNull();
  });
});
