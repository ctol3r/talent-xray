import { rmSync } from "node:fs";
import { join } from "node:path";

/** Fresh throwaway database for every e2e run. */
export default function globalSetup(): void {
  rmSync("/tmp/talentos-e2e-documents", { recursive: true, force: true });
  const dataDir = join(__dirname, "..", "..", "data");
  for (const suffix of ["", "-wal", "-shm"]) {
    rmSync(join(dataDir, `e2e.db${suffix}`), { force: true });
  }
}
