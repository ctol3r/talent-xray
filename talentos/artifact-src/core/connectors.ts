/**
 * The connector bridge (spec §8, Phase 3).
 *
 * The page reaches the outside world only through the viewer's own
 * claude.ai connectors, via the `mcp` capability. This module owns the
 * honest half of that: whether the capability resolved at all, which
 * connectors the viewer actually has, whether their auth is live, and
 * what each failure code means for what the page should say.
 *
 * It deliberately does NOT contain a call to any connector tool. A tool's
 * argument names and result encoding are not in the capability contract,
 * and a guessed shape is a fabricated citation waiting to happen: a tool
 * call is written only after a real request/response pair has been
 * observed. `describeConnector` therefore reports "connected, not wired"
 * as a distinct state from "not connected" — the difference matters, and
 * both are the truth.
 */

export interface McpToolInfo {
  name: string;
  description: string;
}
export interface McpServerInfo {
  server: string;
  authStatus: "connected" | "needs_reauth" | "unknown";
  tools: McpToolInfo[];
}
export interface McpApi {
  listTools(): Promise<{ servers: McpServerInfo[] }>;
  callTool(
    server: string,
    tool: string,
    input?: unknown,
    options?: { cache?: false | { staleTime?: number; refresh?: boolean } },
  ): Promise<{ payload?: unknown; cache?: { storedAt: number } }>;
}

let mcpApi: McpApi | null = null;
export function setMcp(api: McpApi | null): void {
  mcpApi = api;
}
export function mcpGranted(): boolean {
  return mcpApi !== null;
}

/** Every code the contract defines, plus the fix each one actually has. */
export const MCP_ERROR_COPY: Record<string, string> = {
  needs_reauth:
    "The connector's access has lapsed. Reconnect it in claude.ai Settings → Connectors.",
  server_not_connected:
    "This connector is not on the viewer's account. Add it in claude.ai Settings → Connectors.",
  selection_required:
    "More than one connector has this name; the viewer has not chosen which to use.",
  server_not_found: "The connector no longer exists upstream.",
  server_unavailable:
    "The connector is temporarily unreachable. This is worth one retry.",
  not_in_manifest:
    "This page did not declare that tool, so the viewer never consented to it.",
  blocked_by_policy: "An organisation policy blocks this tool for this viewer.",
  approval_required:
    "This tool needs per-call approval, which artifacts cannot ask for yet.",
  tool_error: "The connector answered and reported a failure.",
  bad_request: "The page called the connector incorrectly.",
  cancelled: "The call was cancelled; whether it ran upstream is unknown.",
  rate_limited: "The page has exceeded its connector budget. Wait, then retry.",
  not_granted:
    "This view did not grant connector access to the page. Research stays manual here.",
  capability_disabled:
    "Connector access is not usable in this view. Research stays manual here.",
  capability_removed:
    "This runtime does not serve connector access. Research stays manual here.",
  transform_error: "The call's arguments could not be prepared.",
  upstream_error: "The connector failed for an unstated reason.",
};

export interface McpFailure {
  code: string;
  message: string;
  /** Only codes the runtime stamps may be retried, and only for reads. */
  retryable: boolean;
}

export function describeMcpError(error: unknown): McpFailure {
  const e = (error ?? {}) as {
    code?: unknown;
    message?: unknown;
    retryable?: unknown;
  };
  const code = typeof e.code === "string" ? e.code : "upstream_error";
  const known = code in MCP_ERROR_COPY ? code : "upstream_error";
  return {
    code: known,
    message:
      MCP_ERROR_COPY[known] +
      (typeof e.message === "string" && e.message ? ` (${e.message})` : ""),
    retryable: e.retryable === true,
  };
}

export type ConnectorState =
  | "capability_unavailable"
  | "not_connected"
  | "needs_reauth"
  | "missing_tools"
  | "connected_not_wired"
  | "ready";

export interface ConnectorStatus {
  server: string;
  state: ConnectorState;
  reason: string;
  /** Tool names the viewer's connector actually exposes, when known. */
  tools: string[];
}

/**
 * What is true about one connector right now. `wired` says whether THIS
 * BUILD has an observed request/response for the tools it would call —
 * a connected connector the page cannot correctly call is reported as
 * such rather than as ready.
 */
export async function describeConnector(input: {
  server: string;
  requiredTools: string[];
  wired: boolean;
}): Promise<ConnectorStatus> {
  const { server, requiredTools, wired } = input;
  if (!mcpApi) {
    return {
      server,
      state: "capability_unavailable",
      reason:
        "This page has no connector access in this view, so nothing here can reach the outside world. Paste a source you checked yourself.",
      tools: [],
    };
  }
  try {
    const { servers } = await mcpApi.listTools();
    const match = servers.find((s) => s.server === server);
    if (!match) {
      return {
        server,
        state: "not_connected",
        reason: MCP_ERROR_COPY.server_not_connected,
        tools: [],
      };
    }
    if (match.authStatus === "needs_reauth") {
      return {
        server,
        state: "needs_reauth",
        reason: MCP_ERROR_COPY.needs_reauth,
        tools: match.tools.map((t) => t.name),
      };
    }
    const names = match.tools.map((t) => t.name);
    const missing = requiredTools.filter((t) => !names.includes(t));
    if (missing.length) {
      return {
        server,
        state: "missing_tools",
        reason: `Connected, but it does not expose ${missing.join(", ")}.`,
        tools: names,
      };
    }
    if (!wired) {
      return {
        server,
        state: "connected_not_wired",
        reason:
          "Connected and exposing the right tools — but this build has not observed a real request/response for them, so it will not call them and risk a fabricated citation.",
        tools: names,
      };
    }
    return {
      server,
      state: "ready",
      reason: "Connected and callable.",
      tools: names,
    };
  } catch (error) {
    const failure = describeMcpError(error);
    return {
      server,
      state:
        failure.code === "needs_reauth"
          ? "needs_reauth"
          : failure.code === "server_not_connected"
            ? "not_connected"
            : "capability_unavailable",
      reason: failure.message,
      tools: [],
    };
  }
}
