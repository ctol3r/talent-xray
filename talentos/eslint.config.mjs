import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    // The dev server builds here so it stops fighting `next build` (D-053).
    ".next-dev/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "data/**",
    "drizzle/**",
    "vendor/**",
    "test-results/**",
    "playwright-report/**",
  ]),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
]);

export default eslintConfig;
