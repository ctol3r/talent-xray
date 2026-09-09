/**
 * Which connector can carry which sourcing angle, and what happens when none
 * can.
 *
 * Three states, because in this product there genuinely are three:
 *
 *  - `runs`     — a structured public API the app calls itself.
 *  - `handoff`  — the query is composed in full and the recruiter opens it.
 *                 The engine's own result page is not read by the app: an
 *                 engine answers callers through its API, and reading its
 *                 HTML instead is what the API exists to avoid.
 *  - `dormant`  — no connector is configured. The angle is still rendered, so
 *                 the recruiter can see what a connector is worth before
 *                 turning it on. Nothing dormant is executed.
 *
 * Showing dormant angles is the point: a greyed-out row with the exact query
 * it would run tells you what a key buys before you pay for it.
 */
import type { AngleKind } from "@/lib/sourcing/angles";
import { PRODUCT_NAME } from "@/lib/product";

export type ConnectorState = "runs" | "handoff" | "dormant";

export interface Connector {
  id: string;
  label: string;
  /** What it holds, in a phrase. */
  holds: string;
  /** Angle kinds this connector can carry. */
  kinds: readonly AngleKind[];
  /** How the recruiter turns it on, when it is off. */
  enableWith: string;
  /**
   * False for the workspace itself. The angles find people you do NOT already
   * have, so routing them to what you already hold would report every angle as
   * running and never surface a single dormant one — which is the opposite of
   * the point.
   */
  discovery: boolean;
  /**
   * True when the connector parses search-operator syntax. The structured APIs
   * do not: they take fielded requests of their own, so an operator string
   * handed to one of them is not a narrower search, it is a broken one.
   */
  speaksOperators: boolean;
}

export const CONNECTORS: readonly Connector[] = [
  {
    id: "workspace",
    label: "This workspace",
    holds: `everyone already in ${PRODUCT_NAME}, and every claim held about them`,
    kinds: [
      "page",
      "list",
      "document",
      "paper",
      "patent",
      "dataset",
      "repository",
      "profile",
    ],
    enableWith: "always on",
    discovery: false,
    speaksOperators: false,
  },
  {
    id: "openalex",
    label: "OpenAlex",
    holds: "named authors, their institutions and their topics",
    kinds: ["paper", "profile"],
    enableWith: "add `openalex` to TALENTOS_OPEN_INDEX",
    discovery: true,
    speaksOperators: false,
  },
  {
    id: "crossref",
    label: "Crossref",
    holds: "named authors on registered works, with registry identifiers",
    kinds: ["paper"],
    enableWith: "add `crossref` to TALENTOS_OPEN_INDEX",
    discovery: true,
    speaksOperators: false,
  },
  {
    id: "wikidata",
    label: "Wikidata",
    holds: "people with a public record, their occupations and employers",
    kinds: ["profile", "list"],
    enableWith: "add `wikidata` to TALENTOS_OPEN_INDEX",
    discovery: true,
    speaksOperators: false,
  },
  {
    id: "github",
    label: "GitHub",
    holds: "repository owners and the languages they publish in",
    kinds: ["repository", "profile"],
    enableWith: "add `github` to TALENTOS_OPEN_INDEX",
    discovery: true,
    speaksOperators: false,
  },
  {
    id: "hosted_engine",
    label: "Talent X-Ray engines",
    holds: "100 people-only domains across two programmable engines",
    kinds: ["page", "list", "document", "dataset", "patent", "profile"],
    enableWith:
      "open the composed query in the engine — the result page is yours to read, not ours",
    discovery: true,
    speaksOperators: true,
  },
  {
    id: "web",
    label: "Open-web operator search",
    holds: "the whole open web, addressed with search operators",
    kinds: [
      "page",
      "list",
      "document",
      "dataset",
      "paper",
      "patent",
      "repository",
      "profile",
    ],
    enableWith:
      "set TALENTOS_DISCOVERY_PROVIDER=brave and TALENTOS_BRAVE_SEARCH_KEY (see docs/DISCOVERY-PROVIDERS-2026-09-07.md)",
    discovery: true,
    speaksOperators: true,
  },
];

export function connectorById(id: string): Connector | null {
  return CONNECTORS.find((c) => c.id === id) ?? null;
}

/** Which connectors are live right now, from the environment. */
export function availableConnectors(env: {
  openIndex?: string;
  webSearchKey?: string;
  hostedEngine?: boolean;
}): Set<string> {
  const out = new Set<string>(["workspace"]);
  const raw = (env.openIndex ?? "").trim();
  if (raw && raw !== "off" && raw !== "mock") {
    for (const id of raw.split(",").map((s) => s.trim().toLowerCase())) {
      if (id) out.add(id);
    }
  }
  if (env.hostedEngine !== false) out.add("hosted_engine");
  if (env.webSearchKey) out.add("web");
  return out;
}

export interface ConnectorRouting {
  state: ConnectorState;
  connector: Connector;
  /** Said plainly when the state is not `runs`. */
  reason: string;
}

/**
 * Pick the connector for one angle.
 *
 * An angle renders SEARCH-OPERATOR syntax — `inurl:`, `filetype:`, quoted OR
 * groups. Only a connector that speaks that syntax can carry one. Routing by
 * subject matter instead was wrong, and said so on the page: a team-page angle
 * was reported as running on Wikidata, which cannot parse `inurl:/team` and
 * would have returned nothing while the row claimed a result.
 *
 * The structured APIs answer the same brief through their own request shapes.
 * That is a different path (`structuredSources`), not this one.
 */
export function routeAngle(
  kind: AngleKind,
  available: Set<string>,
): ConnectorRouting {
  const carriers = CONNECTORS.filter(
    (c) => c.discovery && c.speaksOperators && c.kinds.includes(kind),
  );

  const web = carriers.find((c) => c.id === "web");
  if (web && available.has("web")) {
    return { state: "runs", connector: web, reason: "" };
  }

  const engine = carriers.find((c) => c.id === "hosted_engine");
  if (engine && available.has("hosted_engine")) {
    return {
      state: "handoff",
      connector: engine,
      reason: `the query is composed for you to open. ${PRODUCT_NAME} does not read an engine\u2019s own result page; a search API is how a connector answers the same question.`,
    };
  }

  const dormant = web ?? engine ?? CONNECTORS[CONNECTORS.length - 1];
  return { state: "dormant", connector: dormant, reason: dormant.enableWith };
}
