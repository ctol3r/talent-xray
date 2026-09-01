/**
 * Crew worker (`pnpm crew:work -- --project <id>`): advances a search's
 * crew until it is finished or parked.
 *
 * - With ANTHROPIC_API_KEY (provider=anthropic): runs the whole crew to
 *   completion autonomously.
 * - With TALENTOS_MODEL_PROVIDER=session: advances every runnable job
 *   until each is parked on a request file, prints the handoff list for a
 *   Claude session to fulfill, and exits 3. Re-run after fulfillment.
 *
 * Exit codes: 0 crew done · 1 failures · 3 awaiting model fulfillment.
 */
import fs from "node:fs";
import path from "node:path";

const envFile = path.join(process.cwd(), ".env");
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const { getDb } = await import("../src/lib/db/client");
const { advanceCrew, crewTaskLabel, kickoffCrew, listCrewJobs } =
  await import("../src/lib/services/crew");

const args = process.argv.slice(2);
function flag(name: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
}

const projectId = flag("project");
if (!projectId) {
  console.error(
    "Usage: pnpm crew:work -- --project <searchProjectId> [--kickoff]",
  );
  process.exit(1);
}

const db = getDb();
if (args.includes("--kickoff")) {
  const jobs = await kickoffCrew(db, projectId);
  console.log(`Crew queued: ${jobs.length} agents.`);
}

const existing = await listCrewJobs(db, projectId);
if (existing.length === 0) {
  console.error("No crew jobs for this search — pass --kickoff to queue one.");
  process.exit(1);
}

const result = await advanceCrew(db, projectId);
console.log(
  `Crew: ${result.done} done, ${result.remaining} remaining, ${result.failed.length} failed (${result.ran} steps this pass).`,
);
for (const failure of result.failed) {
  console.error(`FAILED ${crewTaskLabel(failure.task)}: ${failure.error}`);
}
if (result.pending.length > 0) {
  console.log(
    "\nAwaiting a Claude session — fulfill each request (write the output JSON to the sibling .response.json), then re-run this worker:",
  );
  for (const pending of result.pending) {
    console.log(`PENDING ${crewTaskLabel(pending.task)}`);
    console.log(`REQUEST_FILE=${pending.requestPath}`);
  }
  process.exit(3);
}
process.exit(result.failed.length > 0 ? 1 : 0);
