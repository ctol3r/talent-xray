/**
 * The Neo4j connection.
 *
 * Off unless `NEO4J_URI` and `NEO4J_PASSWORD` are set. Nothing in the product
 * requires it: the graph is still derived from SQLite and every traversal
 * still works in process. Neo4j is what makes the graph *global* — one graph
 * across every search rather than a projection rebuilt per search — which is
 * the only thing a tag needs to mean what it claims to mean, because "every
 * search and person carrying this word" is not a question one search can
 * answer.
 *
 * `neo4j-driver-lite` rather than `neo4j-driver`: same version and same API,
 * without the RxJS dependency for a reactive session API this never uses.
 *
 * `disableLosslessIntegers` is on deliberately. Neo4j integers are 64-bit and
 * the driver otherwise hands back an `Integer` object that serialises as
 * `{"low":n,"high":0}` — which fails silently across a server-component
 * boundary rather than loudly. Nothing here approaches 2^53: these are hop
 * counts and degrees.
 */
import neo4j, { type Driver } from "neo4j-driver-lite";

declare global {
  var __talentosNeo4j: Driver | undefined;
}

export interface Neo4jSettings {
  uri: string;
  user: string;
  password: string;
  database: string;
}

export function neo4jSettings(): Neo4jSettings | null {
  const uri = process.env.NEO4J_URI?.trim();
  const password = process.env.NEO4J_PASSWORD?.trim();
  if (!uri || !password) return null;
  return {
    uri,
    user: process.env.NEO4J_USER?.trim() || "neo4j",
    password,
    database: process.env.NEO4J_DATABASE?.trim() || "neo4j",
  };
}

export function neo4jConfigured(): boolean {
  return neo4jSettings() !== null;
}

function create(settings: Neo4jSettings): Driver {
  return neo4j.driver(
    settings.uri,
    neo4j.auth.basic(settings.user, settings.password),
    {
      disableLosslessIntegers: true,
      maxConnectionPoolSize: 20,
      connectionAcquisitionTimeout: 10_000,
    },
  );
}

/**
 * One driver per process. Cached on globalThis so Next's dev hot reload does
 * not leak a connection pool per recompile.
 */
export function getDriver(): Driver {
  const settings = neo4jSettings();
  if (!settings) {
    throw new Error(
      "Neo4j is not configured. Set NEO4J_URI and NEO4J_PASSWORD, or leave them unset to use the in-process graph.",
    );
  }
  const existing = globalThis.__talentosNeo4j;
  if (existing) return existing;
  const driver = create(settings);
  globalThis.__talentosNeo4j = driver;
  return driver;
}

export async function closeDriver(): Promise<void> {
  const driver = globalThis.__talentosNeo4j;
  globalThis.__talentosNeo4j = undefined;
  if (driver) await driver.close();
}

/** Is the server actually reachable? Used by the status card; never throws. */
export async function neo4jReachable(): Promise<{
  ok: boolean;
  detail: string;
}> {
  const settings = neo4jSettings();
  if (!settings) return { ok: false, detail: "not configured" };
  try {
    const info = await getDriver().getServerInfo({
      database: settings.database,
    });
    return { ok: true, detail: `${info.address} · ${info.agent}` };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}
