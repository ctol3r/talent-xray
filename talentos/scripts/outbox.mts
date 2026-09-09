/**
 * The session outbox, in one command.
 *
 * This install has no model key. Generation is fulfilled by a Claude session:
 * the app writes a request file and waits. Before this script the only way to
 * see what was waiting was to list a directory and read raw JSON, which is why
 * unanswered requests looked like broken features.
 *
 *   pnpm outbox              → every unanswered request, oldest first
 *   pnpm outbox <file>       → the full prompts of one request
 *
 * It reads and prints. It never writes a response and never calls out.
 */
import fs from "node:fs";
import path from "node:path";

const dir = path.resolve(
  process.env.TALENTOS_SESSION_OUTBOX ?? "./data/session-outbox",
);

/**
 * Two kinds of request land here. A generation carries a schema name and two
 * prompts; a research call carries a query and a result limit. Both name the
 * file the answer goes in. Everything below reads whichever fields are there
 * and never assumes the other kind's shape.
 */
interface RequestFile {
  respondTo: string;
  instructions?: string;
  schemaName?: string;
  system?: string;
  user?: string;
  kind?: string;
  query?: string;
  limit?: number;
}

function read(file: string): RequestFile {
  return JSON.parse(fs.readFileSync(file, "utf8")) as RequestFile;
}

/** What this request is for, in one line, whichever kind it is. */
function describe(request: RequestFile): { kind: string; about: string } {
  if (request.query !== undefined) {
    return {
      kind: `research (${request.kind ?? "search"}, up to ${request.limit ?? "?"} results)`,
      about: request.query,
    };
  }
  const firstLine =
    (request.user ?? "")
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0 && !line.startsWith("#")) ?? "";
  return { kind: request.schemaName ?? "unknown", about: firstLine };
}

const target = process.argv[2];

if (target) {
  const file = path.isAbsolute(target) ? target : path.join(dir, target);
  const request = read(file);
  const { kind } = describe(request);
  console.log(`# ${path.basename(file)}  [${kind}]`);
  if (request.instructions)
    console.log(`\n## Instructions\n${request.instructions}`);
  if (request.system) console.log(`\n## System\n${request.system}`);
  if (request.user) console.log(`\n## User\n${request.user}`);
  if (request.query) console.log(`\n## Query\n${request.query}`);
  console.log(`\n## Write the answer to\n${request.respondTo}`);
  /**
   * Printing a request is the moment it is handed to somebody. The conversation
   * shows a thread as "being answered" rather than "queued" once this marker is
   * beside its request, which is the only honest signal available that anyone
   * has picked it up. Answered requests are not claimed — there is nothing left
   * to pick up.
   */
  const claim = file.replace(/\.request\.json$/, ".claimed");
  const answered = file.replace(/\.request\.json$/, ".response.json");
  if (!fs.existsSync(answered) && !fs.existsSync(claim)) {
    fs.writeFileSync(claim, `${new Date().toISOString()}\n`);
  }
  process.exit(0);
}

if (!fs.existsSync(dir)) {
  console.log(`No outbox at ${dir}. Nothing is waiting.`);
  process.exit(0);
}

const pending = fs
  .readdirSync(dir)
  .filter((name) => name.endsWith(".request.json"))
  .map((name) => ({
    name,
    full: path.join(dir, name),
    answered: fs.existsSync(
      path.join(dir, name.replace(/\.request\.json$/, ".response.json")),
    ),
  }))
  .filter((entry) => !entry.answered)
  .map((entry) => ({
    ...entry,
    at: fs.statSync(entry.full).mtime,
  }))
  .sort((a, b) => a.at.getTime() - b.at.getTime());

if (pending.length === 0) {
  console.log(
    "Nothing is waiting. Every request in the outbox has been answered.",
  );
  process.exit(0);
}

console.log(
  `${pending.length} request${pending.length === 1 ? "" : "s"} waiting for a Claude session.\n`,
);
for (const entry of pending) {
  const request = read(entry.full);
  const { kind, about } = describe(request);
  console.log(`  ${entry.name}`);
  console.log(`    asks   : ${kind}`);
  console.log(`    written: ${entry.at.toISOString()}`);
  console.log(`    about  : ${about.slice(0, 100)}`);
  console.log(`    answer : ${request.respondTo}`);
  console.log("");
}
console.log(
  "To fulfil one, paste this into a Claude session:\n" +
    `  Read ${path.join(dir, pending[0].name)}, answer it against the schema it carries, and write the JSON object to the path in its respondTo field.`,
);
