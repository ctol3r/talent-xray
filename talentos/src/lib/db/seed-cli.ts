/** CLI entry: `pnpm db:seed` — migrates, then seeds golden fixtures once. */
import { getDb } from "./client";
import { seed } from "./seed";

seed(getDb()).then(({ seeded }) => {
  console.log(seeded ? "Seeded golden fixtures." : "Already seeded — skipped.");
});
