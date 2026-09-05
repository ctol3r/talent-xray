import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
};

export default nextConfig;
