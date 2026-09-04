/**
 * Build the single-file TalentOS artifact from artifact-src/.
 *
 *   pnpm build:artifact          → writes artifact/talentos-lite.html
 *   pnpm build:artifact:check    → builds in memory and fails if the
 *                                  committed file differs (run in verify)
 *
 * Output is one self-contained HTML fragment (the artifact platform wraps
 * it in <html>/<head>/<body>): the styles, the app markup, and the bundled
 * script inlined. The version stamp is content-addressed so the build is
 * deterministic and the drift check is meaningful.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "artifact-src");
const outFile = path.join(root, "artifact", "talentos-lite.html");
const check = process.argv.includes("--check");

const pkg = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8"),
) as { version: string };

async function bundle(version: string): Promise<string> {
  const result = await build({
    entryPoints: [path.join(src, "main.ts")],
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    target: ["es2022"],
    minify: false,
    legalComments: "none",
    logLevel: "silent",
    alias: { "@": path.join(root, "src") },
    define: { __TALENTOS_ARTIFACT_VERSION__: JSON.stringify(version) },
    charset: "utf8",
  });
  const text = result.outputFiles[0].text;
  // An inline <script> ends at the first "</script>", wherever it appears.
  return text.replace(/<\/script/gi, "<\\/script");
}

export async function renderArtifact(): Promise<string> {
  const styles = fs.readFileSync(path.join(src, "styles.css"), "utf8");
  const template = fs.readFileSync(path.join(src, "template.html"), "utf8");
  const unversioned = await bundle("0.0.0");
  const hash = createHash("sha256")
    .update(unversioned)
    .update(styles)
    .update(template)
    .digest("hex")
    .slice(0, 10);
  const version = `${pkg.version}+${hash}`;
  const js = await bundle(version);
  const html = template
    .replace("/*__STYLES__*/", () => styles.trim())
    .replace("/*__BUNDLE__*/", () => js.trim());
  if (!html.includes(`"${version}"`))
    throw new Error("version stamp missing from bundle");
  return html;
}

async function main(): Promise<void> {
  const html = await renderArtifact();
  const size = Buffer.byteLength(html, "utf8");
  if (size > 16 * 1024 * 1024)
    throw new Error(`artifact is ${size} bytes; the platform limit is 16 MB`);
  if (check) {
    const current = fs.existsSync(outFile)
      ? fs.readFileSync(outFile, "utf8")
      : "";
    if (current !== html) {
      console.error(
        `artifact/talentos-lite.html is out of date — run \`pnpm build:artifact\` and commit the result.`,
      );
      process.exit(1);
    }
    console.log(`artifact up to date (${size} bytes)`);
    return;
  }
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, html);
  const versionMatch = html.match(
    /__TALENTOS_ARTIFACT_VERSION__|"(\d+\.\d+\.\d+\+[0-9a-f]{10})"/,
  );
  console.log(
    `wrote ${path.relative(root, outFile)} (${size} bytes)${versionMatch?.[1] ? ` version ${versionMatch[1]}` : ""}`,
  );
}

if (process.argv[1] && /build-artifact\.mts$/.test(process.argv[1])) {
  void main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
