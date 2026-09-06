import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // talentos/ is its own workspace root; do not let Turbopack infer the parent repository.
  turbopack: { root: path.join(import.meta.dirname) },
  outputFileTracingRoot: path.join(import.meta.dirname),
  // Mutable recruiter data is supplied by the local runtime, never packaged.
  outputFileTracingExcludes: {
    "/*": [
      "./data/**/*",
      "**/*.db",
      "**/*.db-wal",
      "**/*.db-shm",
      "**/session-outbox/**/*",
    ],
  },
  experimental: { serverActions: { bodySizeLimit: "21mb" } },
  serverExternalPackages: ["better-sqlite3", "pdfjs-dist", "mammoth"],
  transpilePackages: ["@talentos/hsal-adapter"],
};

export default nextConfig;
