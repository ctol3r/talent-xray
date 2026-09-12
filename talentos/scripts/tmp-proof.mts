/** Throwaway: drive one generation step so the outbox loop can be observed. */
import { getDb } from "../src/lib/db/client";
import { generateRoleIntelligence } from "../src/lib/services/generation";
import { getNextBestActions } from "../src/lib/services/search-projects";

const [mode, projectId] = process.argv.slice(2);
const db = getDb();
if (mode === "generate") {
  try {
    await generateRoleIntelligence(db, projectId);
    console.log("GENERATED");
  } catch (error) {
    console.log("PENDING:", error instanceof Error ? error.message.slice(0, 140) : String(error));
  }
} else if (mode === "p1") {
  const actions = await getNextBestActions(db, projectId);
  const p1 = actions.filter((a) => a.priority === 1);
  console.log("P1:", p1.map((a) => `${a.id} (${a.title})`).join(" | ") || "none");
}
