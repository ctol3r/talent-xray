import { createHSALAdapter, type HSALAdapter } from "@talentos/hsal-adapter";
import type { Db } from "@/lib/db/client";
import { getHSALClient } from "./client";
import { AppDomainSource } from "./domain-source";
import { DrizzleBindingStore, DrizzleLearningStore } from "./stores";

export interface AppAdapter {
  learnings: DrizzleLearningStore;
  bindings: DrizzleBindingStore;
  adapter: HSALAdapter;
  domain: AppDomainSource;
}

/** Composition root for the app → HSAL adapter. */
export function getAppAdapter(db: Db): AppAdapter {
  const learnings = new DrizzleLearningStore(db);
  const bindings = new DrizzleBindingStore(db);
  const domain = new AppDomainSource(db);
  const adapter = createHSALAdapter({
    client: getHSALClient(),
    domain,
    bindings,
    learnings,
  });
  return { adapter, domain, learnings, bindings };
}
