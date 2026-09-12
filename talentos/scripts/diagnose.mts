import { getDb } from "../src/lib/db/client";
import { getResearchProvider } from "../src/lib/research/provider";
import {
  generateEvidenceAlignment,
  generateOutreach,
} from "../src/lib/services/generation";

const db = getDb();
const candidateId = process.argv[2];
console.log(
  "research provider:",
  getResearchProvider().name,
  "configured:",
  getResearchProvider().configured,
);

for (const [name, run] of [
  ["evidence alignment", () => generateEvidenceAlignment(db, candidateId)],
  ["outreach", () => generateOutreach(db, candidateId)],
] as [string, () => Promise<unknown>][]) {
  try {
    await run();
    console.log(`OK   ${name}`);
  } catch (error) {
    const e = error as Error;
    console.log(`FAIL ${name}: [${e.name}] ${e.message.slice(0, 220)}`);
  }
}
