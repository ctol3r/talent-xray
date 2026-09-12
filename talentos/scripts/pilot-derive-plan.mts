/**
 * Wave P helper: derive the canonical hiring need and the search plan for a
 * search through the normal services and the session provider. The app has
 * no UI entry point for these two derivations yet (pilot finding), so the
 * pilot drives them here. Each run either completes or reports the outbox
 * request a Claude session must fulfil; re-run after fulfilling.
 *
 *   TALENTOS_MODEL_PROVIDER=session pnpm tsx scripts/pilot-derive-plan.mts <searchProjectId>
 */
import { getDb } from "../src/lib/db/client";
import {
  deriveHiringNeed,
  deriveSearchPlan,
  getIntelligence,
} from "../src/lib/services/intelligence";

const projectId = process.argv[2];
if (!projectId) {
  console.error("usage: pilot-derive-plan.mts <searchProjectId>");
  process.exit(2);
}
const db = getDb();
try {
  const existing = await getIntelligence(db, projectId);
  if (!existing) {
    await deriveHiringNeed(db, projectId);
    console.log("hiring need derived");
  } else {
    console.log(
      `hiring need present: ${existing.payload.intent.requirements.length} requirements, revision ${existing.payload.intent.revision}`,
    );
  }
  const after = await getIntelligence(db, projectId);
  if (!after?.payload.searchPlan) {
    await deriveSearchPlan(db, projectId);
    console.log("search plan derived");
  } else {
    console.log(
      `search plan present: ${after.payload.searchPlan.queryPlans.length} query plans`,
    );
  }
} catch (error) {
  console.log(String(error instanceof Error ? error.message : error));
  process.exit(1);
}
