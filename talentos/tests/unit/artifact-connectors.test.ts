/**
 * The connector bridge. It reports what is TRUE about a viewer's
 * connectors — including the distinction the page must not blur:
 * "connected" is not the same as "this build can correctly call it".
 * Nothing here calls a connector tool, because no request/response pair
 * has been observed for one.
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  MCP_ERROR_COPY,
  describeConnector,
  describeMcpError,
  mcpGranted,
  setMcp,
  type McpApi,
} from "../../artifact-src/core/connectors";
import {
  RESEARCH_ADAPTERS,
  bigdataAdapter,
  npiAdapter,
  publicationsAdapter,
} from "../../artifact-src/core/research";
import { contextFromFacts } from "../../artifact-src/core/search-context";

const NOW = "2026-09-04T00:00:00.000Z";

type Servers = Awaited<ReturnType<McpApi["listTools"]>>["servers"];

const api = (servers: Servers): McpApi => ({
  listTools: async () => ({ servers }),
  callTool: async () => {
    throw new Error("no tool call should happen in these tests");
  },
});

afterEach(() => setMcp(null));

describe("without the capability", () => {
  it("says the page has no connector access, and does not guess", async () => {
    setMcp(null);
    expect(mcpGranted()).toBe(false);
    const status = await describeConnector({
      server: "Bigdata.com",
      requiredTools: ["bigdata_search"],
      wired: false,
    });
    expect(status.state).toBe("capability_unavailable");
    expect(status.reason).toContain("Paste a source you checked yourself");
  });
});

describe("with the capability", () => {
  it("reports a connector the viewer has not added", async () => {
    setMcp(api([]));
    const status = await describeConnector({
      server: "Bigdata.com",
      requiredTools: ["bigdata_search"],
      wired: false,
    });
    expect(status.state).toBe("not_connected");
    expect(status.reason).toContain("Settings → Connectors");
  });

  it("reports lapsed auth as its own state, with the fix", async () => {
    setMcp(
      api([
        {
          server: "Bigdata.com",
          authStatus: "needs_reauth",
          tools: [{ name: "bigdata_search", description: "" }],
        },
      ]),
    );
    const status = await describeConnector({
      server: "Bigdata.com",
      requiredTools: ["bigdata_search"],
      wired: false,
    });
    expect(status.state).toBe("needs_reauth");
    expect(status.reason).toContain("Reconnect");
  });

  it("reports a connected connector that lacks the tools it needs", async () => {
    setMcp(
      api([
        {
          server: "Bigdata.com",
          authStatus: "connected",
          tools: [{ name: "something_else", description: "" }],
        },
      ]),
    );
    const status = await describeConnector({
      server: "Bigdata.com",
      requiredTools: ["find_securities", "bigdata_search"],
      wired: false,
    });
    expect(status.state).toBe("missing_tools");
    expect(status.reason).toContain("find_securities");
  });

  it("distinguishes CONNECTED from WIRED — the honest state of this build", async () => {
    const servers = [
      {
        server: "Bigdata.com",
        authStatus: "connected" as const,
        tools: [
          { name: "find_securities", description: "" },
          { name: "bigdata_search", description: "" },
        ],
      },
    ];
    setMcp(api(servers));
    const unwired = await describeConnector({
      server: "Bigdata.com",
      requiredTools: ["find_securities", "bigdata_search"],
      wired: false,
    });
    expect(unwired.state).toBe("connected_not_wired");
    expect(unwired.reason).toContain(
      "has not observed a real request/response",
    );
    expect(unwired.tools).toEqual(["find_securities", "bigdata_search"]);

    const wired = await describeConnector({
      server: "Bigdata.com",
      requiredTools: ["find_securities", "bigdata_search"],
      wired: true,
    });
    expect(wired.state).toBe("ready");
  });

  it("turns a listTools failure into the code's own fix, never a generic banner", async () => {
    setMcp({
      listTools: async () => {
        throw { code: "needs_reauth", message: "token expired" };
      },
      callTool: async () => {
        throw new Error("unused");
      },
    });
    const status = await describeConnector({
      server: "PubMed",
      requiredTools: ["search_articles"],
      wired: false,
    });
    expect(status.state).toBe("needs_reauth");
    expect(status.reason).toContain("token expired");
  });
});

describe("error codes", () => {
  it("every documented code has copy naming the actual fix", () => {
    for (const code of [
      "needs_reauth",
      "server_not_connected",
      "selection_required",
      "server_unavailable",
      "not_in_manifest",
      "blocked_by_policy",
      "approval_required",
      "tool_error",
      "bad_request",
      "cancelled",
      "rate_limited",
      "not_granted",
      "capability_disabled",
      "capability_removed",
      "upstream_error",
    ]) {
      expect(MCP_ERROR_COPY[code], code).toBeTruthy();
    }
  });

  it("an unknown code degrades to upstream_error rather than inventing one", () => {
    expect(describeMcpError({ code: "something_new" }).code).toBe(
      "upstream_error",
    );
    expect(describeMcpError(undefined).code).toBe("upstream_error");
  });

  it("only retries what the runtime stamped retryable", () => {
    expect(
      describeMcpError({ code: "server_unavailable", retryable: true })
        .retryable,
    ).toBe(true);
    expect(describeMcpError({ code: "server_unavailable" }).retryable).toBe(
      false,
    );
    expect(
      describeMcpError({ code: "needs_reauth", retryable: false }).retryable,
    ).toBe(false);
  });
});

describe("the adapters name the connectors they would call", () => {
  it("each connector-backed adapter declares real servers and tools", () => {
    expect(bigdataAdapter.connectors).toEqual([
      { server: "Bigdata.com", tools: ["find_securities", "bigdata_search"] },
    ]);
    expect(npiAdapter.connectors[0].server).toBe("NPI Registry");
    expect(publicationsAdapter.connectors.map((c) => c.server)).toEqual([
      "PubMed",
      "bioRxiv",
      "Consensus",
    ]);
  });

  it("none of them retrieves anything while unwired, and none throws", async () => {
    setMcp(null);
    const ctx = contextFromFacts(
      { id: "s", roleTitle: "Research Scientist", companyName: "Example" },
      [],
      NOW,
    );
    for (const adapter of RESEARCH_ADAPTERS) {
      await expect(adapter.retrieve("brief", ctx)).resolves.toEqual([]);
      const availability = await adapter.availability();
      if (adapter.connectors.length) {
        expect(availability.state).toBe("unavailable");
        expect(availability.connectors?.length).toBe(adapter.connectors.length);
      } else {
        expect(availability.state).toBe("available");
      }
    }
  });
});
