/**
 * Wave P helper: walk one search through the generation pipeline, stopping at
 * the first step whose output a Claude session must supply.
 *
 * A step whose artifact already exists is skipped, because re-running it
 * would recompose its prompt against a larger context and ask for the same
 * work again under a new hash.
 *
 *   TALENTOS_MODEL_PROVIDER=session pnpm tsx scripts/pilot-run.mts <projectId>
 */
import { eq } from "drizzle-orm";
import { getDb } from "../src/lib/db/client";
import {
  marketResearch,
  roleIntelligence,
  searchQueries,
  sourceChannels,
  sourcingStrategies,
  successProfiles,
} from "../src/lib/db/schema";
import {
  generateChannels,
  generateMarketIntelligence,
  generateRoleIntelligence,
  generateSearchStrings,
  generateSourcingStrategy,
  generateSuccessProfile,
} from "../src/lib/services/generation";
import {
  deriveHiringNeed,
  deriveSearchPlan,
  generatePlannedQueries,
  getIntelligence,
} from "../src/lib/services/intelligence";

const projectId = process.argv[2];
if (!projectId) {
  console.error("usage: pilot-run.mts <projectId>");
  process.exit(2);
}
const db = getDb();

const has = (table: { searchProjectId: { name: string } }): boolean => {
  const rows = db
    .select()
    // @ts-expect-error the tables share the column but not a base type
    .from(table)
    // @ts-expect-error same
    .where(eq(table.searchProjectId, projectId))
    .all();
  return rows.length > 0;
};

const intel = () => getIntelligence(db, projectId);

const steps: [string, () => Promise<boolean>, () => Promise<unknown>][] = [
  [
    "role intelligence",
    async () => has(roleIntelligence),
    () => generateRoleIntelligence(db, projectId),
  ],
  [
    "success profile",
    async () => has(successProfiles),
    () => generateSuccessProfile(db, projectId),
  ],
  [
    "market intelligence",
    async () => has(marketResearch),
    () => generateMarketIntelligence(db, projectId),
  ],
  [
    "sourcing strategy",
    async () => has(sourcingStrategies),
    () => generateSourcingStrategy(db, projectId),
  ],
  [
    "channels",
    async () => has(sourceChannels),
    () => generateChannels(db, projectId),
  ],
  [
    "hiring need",
    async () => Boolean(await intel()),
    () => deriveHiringNeed(db, projectId),
  ],
  [
    "search plan",
    async () => Boolean((await intel())?.payload.searchPlan),
    () => deriveSearchPlan(db, projectId),
  ],
  [
    "search strings",
    async () => has(searchQueries),
    () => generateSearchStrings(db, projectId),
  ],
  [
    "planned queries",
    async () =>
      db
        .select()
        .from(searchQueries)
        .where(eq(searchQueries.searchProjectId, projectId))
        .all().length > 40,
    () => generatePlannedQueries(db, projectId),
  ],
];

for (const [name, done, run] of steps) {
  if (await done()) {
    console.log(`have  ${name}`);
    continue;
  }
  try {
    await run();
    console.log(`ok    ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Generation pending")) {
      const match = message.match(/request written to (\S+)\./);
      console.log(`WAIT  ${name}`);
      console.log(`      ${match?.[1] ?? message}`);
      process.exit(0);
    }
    console.log(`FAIL  ${name} — ${message.slice(0, 240)}`);
    process.exit(1);
  }
}
const final = await intel();
console.log(
  `done  requirements: ${final?.payload.intent.requirements.length ?? 0}, query plans: ${final?.payload.searchPlan?.queryPlans.length ?? 0}, strings: ${db.select().from(searchQueries).where(eq(searchQueries.searchProjectId, projectId)).all().length}`,
);
