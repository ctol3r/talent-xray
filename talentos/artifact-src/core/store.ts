/**
 * Persistence: the `db` capability when granted, localStorage otherwise —
 * the same key ("talentos-lite-v1") and the same document paths as every
 * previous version, so nothing anyone has saved is lost. Everything read
 * passes through a normalizer that fills in what older records lack; the
 * store version stamp records what shape was last written.
 *
 * New in W13 (additive, backward compatible): per-search context
 * revisions, research snapshots, action items, and `lastError` on records.
 */
import type { SearchContext, SearchFacts } from "./search-context";
import { searchFactsSchema } from "./search-context";
import type { ResearchSnapshot } from "./research";
import type { ActionItem } from "./envelope";
import type { ResearchStatus } from "./research";

export const LS_KEY = "talentos-lite-v1";
export const STORE_VERSION = 2;

export interface RecordMeta {
  provider: string;
  generatedAt: string;
  downgrades?: number;
  editedAt?: string;
  editedBy?: string;
  /** W13 */
  inputVersion?: string;
  researchSnapshotId?: string;
  researchStatus?: ResearchStatus;
  acknowledgedNoResearch?: boolean;
  model?: string;
  durationMs?: number;
}

export interface Critique {
  verdict: "accept" | "revise";
  strengths: string[];
  issues: string[];
  revised?: boolean;
}

export interface StoredRecord<T = unknown> {
  payload?: T;
  meta: RecordMeta;
  traitWarnings: string[];
  critique?: Critique;
  /** Envelope-level validation problems (A–H, currency). */
  validationIssues?: string[];
  lastError?: { at: string; message: string; code?: string };
  /** Previous payload kept for "What changed?". */
  previous?: { payload: unknown; meta: RecordMeta };
  /** Universal envelope when the task emits one (W13.5). */
  envelope?: unknown;
}

export interface StoredCandidate {
  id: string;
  name: string;
  currentTitle?: string;
  currentCompany?: string;
  geography?: string;
  profileUrls: string[];
  notes?: string;
  pastedText?: string;
  createdAt: string;
  evidence?: StoredRecord;
  outreach?: StoredRecord;
  /** W13 — identity review flag when another candidate looks similar. */
  identityReview?: {
    status: "open" | "same_person" | "different_person";
    note?: string;
    similarTo: string[];
  };
}

interface LocalShape {
  storeVersion?: number;
  searches: Record<
    string,
    {
      facts: SearchFacts;
      artifacts: Record<string, StoredRecord>;
      candidates: Record<string, StoredCandidate>;
      contexts?: Record<string, SearchContext>;
      research?: Record<string, ResearchSnapshot>;
      actions?: Record<string, ActionItem>;
    }
  >;
}

// Minimal structural types for the `db` capability we use.
interface DbSnapshotDoc {
  id: string;
  data(): unknown;
}
interface DbQuery {
  orderBy(field: string, dir: "asc" | "desc"): DbQuery;
  limit(n: number): DbQuery;
  get(): Promise<{ docs: DbSnapshotDoc[] }>;
}
interface DbDocRef {
  set(value: unknown): Promise<void>;
  get(): Promise<{ exists?: boolean; data(): unknown } | undefined>;
  collection(name: string): DbQuery;
}
export interface DbLike {
  collection(name: string): DbQuery;
  doc(path: string): DbDocRef;
}

let dbApi: DbLike | null = null;
export function setDb(db: DbLike | null): void {
  dbApi = db;
}
export function storageMode(): "db" | "local" {
  return dbApi ? "db" : "local";
}

const local = {
  read(): LocalShape {
    try {
      const raw = JSON.parse(
        localStorage.getItem(LS_KEY) || "null",
      ) as LocalShape | null;
      return raw && typeof raw === "object" && raw.searches
        ? raw
        : { searches: {} };
    } catch {
      return { searches: {} };
    }
  },
  write(data: LocalShape): void {
    try {
      localStorage.setItem(
        LS_KEY,
        JSON.stringify({ ...data, storeVersion: STORE_VERSION }),
      );
    } catch {
      /* private mode / quota */
    }
  },
  shell(data: LocalShape, id: string) {
    if (!data.searches[id]) {
      data.searches[id] = {
        facts: { id, roleTitle: "" },
        artifacts: {},
        candidates: {},
      };
    }
    return data.searches[id];
  },
};

/** Fill in what older records lack; never throws on a legacy shape. */
export function normalizeRecord(raw: unknown): StoredRecord | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Partial<StoredRecord> & { meta?: Partial<RecordMeta> };
  const meta: RecordMeta = {
    provider: r.meta?.provider ?? "claude-artifact",
    generatedAt: r.meta?.generatedAt ?? "",
    ...r.meta,
  };
  return {
    payload: r.payload,
    meta,
    traitWarnings: Array.isArray(r.traitWarnings) ? r.traitWarnings : [],
    critique: r.critique,
    validationIssues: r.validationIssues,
    lastError: r.lastError,
    previous: r.previous,
    envelope: r.envelope,
  };
}

export function normalizeFacts(raw: unknown): SearchFacts | undefined {
  const parsed = searchFactsSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

export function normalizeCandidate(raw: unknown): StoredCandidate | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const c = raw as Partial<StoredCandidate>;
  if (typeof c.id !== "string" || typeof c.name !== "string") return undefined;
  return {
    id: c.id,
    name: c.name,
    currentTitle: c.currentTitle,
    currentCompany: c.currentCompany,
    geography: c.geography,
    profileUrls: Array.isArray(c.profileUrls) ? c.profileUrls : [],
    notes: c.notes,
    pastedText: c.pastedText,
    createdAt: c.createdAt ?? "",
    evidence: c.evidence ? normalizeRecord(c.evidence) : undefined,
    outreach: c.outreach ? normalizeRecord(c.outreach) : undefined,
    identityReview: c.identityReview,
  };
}

async function tryDb<T>(
  fn: (db: DbLike) => Promise<T>,
): Promise<T | undefined> {
  if (!dbApi) return undefined;
  try {
    return await fn(dbApi);
  } catch (e) {
    console.warn("db", e);
    return undefined;
  }
}

export const store = {
  async listSearches(): Promise<SearchFacts[]> {
    const fromDb = await tryDb(async (db) => {
      const snap = await db
        .collection("searches")
        .orderBy("createdAt", "desc")
        .limit(200)
        .get();
      return snap.docs
        .map((d) => normalizeFacts({ id: d.id, ...(d.data() as object) }))
        .filter((x): x is SearchFacts => Boolean(x));
    });
    if (fromDb) return fromDb;
    const data = local.read();
    return Object.values(data.searches)
      .map((s) => normalizeFacts(s.facts))
      .filter((x): x is SearchFacts => Boolean(x))
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  },

  async saveSearch(facts: SearchFacts): Promise<void> {
    const done = await tryDb(async (db) => {
      await db.doc("searches/" + facts.id).set(facts);
      return true;
    });
    if (done) return;
    const data = local.read();
    local.shell(data, facts.id).facts = facts;
    local.write(data);
  },

  async loadArtifacts(searchId: string): Promise<Record<string, StoredRecord>> {
    const fromDb = await tryDb(async (db) => {
      const snap = await db
        .doc("searches/" + searchId)
        .collection("artifacts")
        .get();
      const out: Record<string, StoredRecord> = {};
      for (const d of snap.docs) {
        const rec = normalizeRecord(d.data());
        if (rec) out[d.id] = rec;
      }
      return out;
    });
    if (fromDb) return fromDb;
    const raw = local.read().searches[searchId]?.artifacts ?? {};
    const out: Record<string, StoredRecord> = {};
    for (const [k, v] of Object.entries(raw)) {
      const rec = normalizeRecord(v);
      if (rec) out[k] = rec;
    }
    return out;
  },

  async saveArtifact(
    searchId: string,
    task: string,
    record: StoredRecord,
  ): Promise<void> {
    const done = await tryDb(async (db) => {
      await db.doc(`searches/${searchId}/artifacts/${task}`).set(record);
      return true;
    });
    if (done) return;
    const data = local.read();
    local.shell(data, searchId).artifacts[task] = record;
    local.write(data);
  },

  async listCandidates(searchId: string): Promise<StoredCandidate[]> {
    const fromDb = await tryDb(async (db) => {
      const snap = await db
        .doc("searches/" + searchId)
        .collection("candidates")
        .get();
      return snap.docs
        .map((d) => normalizeCandidate({ id: d.id, ...(d.data() as object) }))
        .filter((x): x is StoredCandidate => Boolean(x));
    });
    if (fromDb) return fromDb;
    return Object.values(local.read().searches[searchId]?.candidates ?? {})
      .map(normalizeCandidate)
      .filter((x): x is StoredCandidate => Boolean(x));
  },

  async saveCandidate(searchId: string, cand: StoredCandidate): Promise<void> {
    const done = await tryDb(async (db) => {
      await db.doc(`searches/${searchId}/candidates/${cand.id}`).set(cand);
      return true;
    });
    if (done) return;
    const data = local.read();
    local.shell(data, searchId).candidates[cand.id] = cand;
    local.write(data);
  },

  // ── W13 additions ────────────────────────────────────────────────────────
  async listContexts(searchId: string): Promise<SearchContext[]> {
    const fromDb = await tryDb(async (db) => {
      const snap = await db
        .doc("searches/" + searchId)
        .collection("contexts")
        .get();
      return snap.docs.map((d) => d.data() as SearchContext);
    });
    const list =
      fromDb ?? Object.values(local.read().searches[searchId]?.contexts ?? {});
    return list.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  },

  async saveContext(ctx: SearchContext): Promise<void> {
    const done = await tryDb(async (db) => {
      await db
        .doc(`searches/${ctx.searchId}/contexts/${ctx.searchVersion}`)
        .set(ctx);
      return true;
    });
    if (done) return;
    const data = local.read();
    const s = local.shell(data, ctx.searchId);
    s.contexts = { ...(s.contexts ?? {}), [ctx.searchVersion]: ctx };
    local.write(data);
  },

  async listResearch(searchId: string): Promise<ResearchSnapshot[]> {
    const fromDb = await tryDb(async (db) => {
      const snap = await db
        .doc("searches/" + searchId)
        .collection("research")
        .get();
      return snap.docs.map((d) => d.data() as ResearchSnapshot);
    });
    const list =
      fromDb ?? Object.values(local.read().searches[searchId]?.research ?? {});
    return list.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  },

  async saveResearch(snapshot: ResearchSnapshot): Promise<void> {
    const done = await tryDb(async (db) => {
      await db
        .doc(`searches/${snapshot.searchId}/research/${snapshot.id}`)
        .set(snapshot);
      return true;
    });
    if (done) return;
    const data = local.read();
    const s = local.shell(data, snapshot.searchId);
    s.research = { ...(s.research ?? {}), [snapshot.id]: snapshot };
    local.write(data);
  },

  async listActions(searchId: string): Promise<ActionItem[]> {
    const fromDb = await tryDb(async (db) => {
      const snap = await db
        .doc("searches/" + searchId)
        .collection("actions")
        .get();
      return snap.docs.map((d) => d.data() as ActionItem);
    });
    return (
      fromDb ?? Object.values(local.read().searches[searchId]?.actions ?? {})
    );
  },

  async saveAction(searchId: string, action: ActionItem): Promise<void> {
    const done = await tryDb(async (db) => {
      await db.doc(`searches/${searchId}/actions/${action.id}`).set(action);
      return true;
    });
    if (done) return;
    const data = local.read();
    const s = local.shell(data, searchId);
    s.actions = { ...(s.actions ?? {}), [action.id]: action };
    local.write(data);
  },

  /** For tests and the migration check: the raw local blob. */
  _local: local,
};
