import { createHSALAdapter, type HSALAdapter } from "@talentos/hsal-adapter";
import type { Db } from "@/lib/db/client";
import { getHSALClient } from "./client";
import { AppDomainSource } from "./domain-source";
import { DrizzleBindingStore, DrizzleLearningStore } from "./stores";

export interface AppAdapter {
  adapter: HSALAdapter;
  domain: AppDomainSource;
}

/** Composition root for the app → HSAL adapter. */
export function getAppAdapter(db: Db): AppAdapter {
  const domain = new AppDomainSource(db);
  const adapter = createHSALAdapter({
    client: getHSALClient(),
    domain,
    bindings: new DrizzleBindingStore(db),
    learnings: new DrizzleLearningStore(db),
  });
  return { adapter, domain };
}
