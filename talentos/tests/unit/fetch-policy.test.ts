/**
 * The gate, stage by stage. The order matters as much as the verdicts: a
 * refusal that costs no packets should happen before one that costs a request.
 */
import { describe, expect, it } from "vitest";
import { gate, responseForbidsUse, type RobotsState } from "@/lib/fetch/policy";
import { newHostPace, UNLISTED_HOST_REQUEST_CAP } from "@/lib/fetch/pace";
import { parseRobots } from "@/lib/fetch/robots";

const NOW = 1_700_000_000_000;
const noRules: RobotsState = { status: "absent", policy: null };

function decide(
  url: string,
  overrides: Partial<Parameters<typeof gate>[0]> = {},
) {
  return gate({ url, enabled: true, robots: noRules, now: NOW, ...overrides });
}

describe("the switch", () => {
  it("refuses everything when reading pages is off, and offers the link instead", () => {
    const out = gate({
      url: "https://example.com/a",
      enabled: false,
      robots: noRules,
    });
    expect(out.allowed).toBe(false);
    if (!out.allowed) {
      expect(out.stage).toBe("off");
      expect(out.reason).toContain("composed for you to open");
    }
  });
});

describe("stages", () => {
  it("refuses a bad address before anything else", () => {
    const out = decide("http://example.com/a");
    expect(out.allowed).toBe(false);
    if (!out.allowed) expect(out.stage).toBe("address");
  });

  it("refuses a registry host without asking it for robots", () => {
    const out = decide("https://www.linkedin.com/in/somebody", {
      robots: { status: "unread", policy: null },
    });
    expect(out.allowed).toBe(false);
    if (!out.allowed) expect(out.stage).toBe("registry");
  });

  it("refuses when robots could not be read, and allows when there is none", () => {
    const unreachable = decide("https://example.com/a", {
      robots: { status: "unreachable", policy: null },
    });
    expect(unreachable.allowed).toBe(false);
    if (!unreachable.allowed) expect(unreachable.stage).toBe("robots");
    expect(decide("https://example.com/a").allowed).toBe(true);
  });

  it("quotes the robots line that refused it", () => {
    const out = decide("https://example.com/private/x", {
      robots: {
        status: "read",
        policy: parseRobots("User-agent: *\nDisallow: /private\n"),
      },
    });
    expect(out.allowed).toBe(false);
    if (!out.allowed) expect(out.reason).toContain("Disallow: /private");
  });

  it("stops on the run budget before it stops on the host's turn", () => {
    const out = decide("https://example.com/a", {
      budget: { requests: 999, bytes: 0, elapsedMs: 0 },
    });
    expect(out.allowed).toBe(false);
    if (!out.allowed) expect(out.stage).toBe("budget");
  });

  it("waits for the host's turn", () => {
    const pace = {
      ...newHostPace("example.com", NOW),
      nextAllowedAt: NOW + 4000,
    };
    const out = decide("https://example.com/a", { pace });
    expect(out.allowed).toBe(false);
    if (!out.allowed) {
      expect(out.stage).toBe("pace");
      expect(out.reason).toContain("4s");
    }
  });

  it("caps a host nobody has read the terms of", () => {
    const pace = {
      ...newHostPace("example.com", NOW),
      requests: UNLISTED_HOST_REQUEST_CAP,
    };
    const out = decide("https://example.com/a", { pace });
    expect(out.allowed).toBe(false);
    if (!out.allowed) expect(out.reason).toContain("at most");
  });

  it("says how it was permitted, not only how it was refused", () => {
    const out = decide("https://example.com/a");
    expect(out.allowed).toBe(true);
    if (out.allowed) expect(out.reason).toContain("no robots.txt");
  });
});

describe("responseForbidsUse", () => {
  it("reads the header and the page's own tag", () => {
    expect(responseForbidsUse("noindex", "<html></html>")).toContain("noindex");
    expect(
      responseForbidsUse(
        null,
        '<meta name="robots" content="noarchive, follow">',
      ),
    ).toContain("noarchive");
    expect(
      responseForbidsUse(null, '<meta name="robots" content="index,follow">'),
    ).toBeNull();
    expect(responseForbidsUse(null, "<html></html>")).toBeNull();
  });
});
