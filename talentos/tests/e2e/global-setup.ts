import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Fresh throwaway database and outbox for every e2e run. */
export default function globalSetup(): void {
  rmSync("/tmp/talentos-e2e-documents", { recursive: true, force: true });
  const dataDir = join(__dirname, "..", "..", "data");
  for (const suffix of ["", "-wal", "-shm"]) {
    rmSync(join(dataDir, `e2e.db${suffix}`), { force: true });
  }
  seedOutbox();
}

/**
 * One request waiting in a throwaway outbox.
 *
 * E2E runs on the mock provider, which answers in-process and never writes a
 * handoff, so the queue would otherwise always be empty and the page would
 * only ever be tested empty. The file is the real shape — this is what the
 * session provider writes — and the directory is a temporary one so a test
 * can never read, or answer, anything in the developer's own outbox.
 */
const OUTBOX = "/tmp/talentos-e2e-outbox";

function seedOutbox(): void {
  rmSync(OUTBOX, { recursive: true, force: true });
  mkdirSync(OUTBOX, { recursive: true });
  const id = "ExpertReply-0123456789ab";
  writeFileSync(
    join(OUTBOX, `${id}.request.json`),
    JSON.stringify(
      {
        schemaName: "ExpertReply",
        instructions:
          "Compose the highest-quality output satisfying `system` and `user`, then write ONLY the output JSON object (no markdown fences) to `respondTo`.",
        respondTo: join(OUTBOX, `${id}.response.json`),
        system: "You are the outreach specialist on a small talent team.",
        user: "why is nobody replying to my first message",
      },
      null,
      2,
    ),
  );
}
