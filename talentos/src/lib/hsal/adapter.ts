import { createHSALAdapter, type HSALAdapter } from "@talentos/hsal-adapter";
import type { HSALClient } from "@hsal/sdk";
import type { Db } from "@/lib/db/client";
import { getHSALClient } from "./client";
import { AppDomainSource } from "./domain-source";
import { DrizzleBindingStore, DrizzleLearningStore } from "./stores";

export interface AppAdapter {
  learnings: DrizzleLearningStore;
  bindings: DrizzleBindingStore;
  adapter: HSALAdapter;
  domain: AppDomainSource;
  /** The same client the adapter uses; for read-only checks in actions. */
  client: HSALClient;
}

/** Composition root for the app → HSAL adapter. */
export function getAppAdapter(db: Db): AppAdapter {
  const learnings = new DrizzleLearningStore(db);
  const bindings = new DrizzleBindingStore(db);
  const domain = new AppDomainSource(db);
  const client = getHSALClient();
  const adapter = createHSALAdapter({
    client,
    domain,
    bindings,
    learnings,
  });
  return { adapter, domain, learnings, bindings, client };
}
