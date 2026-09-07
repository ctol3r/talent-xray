/** Wave P helper: record measured link-out runs into the yield ledger. */
import fs from "node:fs";
import { getDb } from "../src/lib/db/client";
import { recordLinkOutRun } from "../src/lib/services/discovery";

const file = process.argv[2];
if (!file) {
  console.error("usage: pilot-record-runs.mts <json>");
  process.exit(2);
}
const runs = JSON.parse(fs.readFileSync(file, "utf8")) as {
  searchProjectId: string;
  queryId: string;
  queryText: string;
  engine: "core" | "reach";
  resultCount: number;
}[];
const db = getDb();
for (const run of runs) {
  const result = await recordLinkOutRun(db, { ...run, saves: [] });
  console.log(
    `recorded ${run.engine} ${run.resultCount} → run ${result.runId.slice(0, 8)}`,
  );
}
