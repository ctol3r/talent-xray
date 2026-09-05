import { readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? walk(path.join(dir, entry.name))
      : [path.join(dir, entry.name)],
  );
}
const originals = path.resolve(
  process.env.TALENTOS_DOCUMENT_DIR ??
    path.join(homedir(), ".local", "share", "talentos", "documents"),
);
const runtime = path.resolve("data");
let violations = 0;
const traces = walk(".next/server").filter((f) => f.endsWith(".nft.json"));
if (!traces.length)
  throw new Error("Build traces are missing; run pnpm build first.");
for (const file of traces) {
  const manifest = JSON.parse(readFileSync(file, "utf8")) as {
    files: string[];
  };
  for (const item of manifest.files) {
    const target = path.resolve(path.dirname(file), item);
    if (
      target.startsWith(runtime + path.sep) ||
      target.startsWith(originals + path.sep) ||
      /\.db(?:-wal|-shm)?$/.test(target)
    )
      violations++;
  }
}
if (violations)
  throw new Error(
    `Build packaging references ${violations} runtime data files. Do not ship this build.`,
  );
console.log(
  `Private-data packaging check passed across ${traces.length} build traces.`,
);
