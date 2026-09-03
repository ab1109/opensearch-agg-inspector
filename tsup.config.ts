import { defineConfig } from "tsup";

export default defineConfig([
  {
    // Library: dual ESM + CJS with type declarations.
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    sourcemap: true,
    target: "node20",
    outExtension: ({ format }) => ({ js: format === "cjs" ? ".cjs" : ".js" }),
  },
  {
    // CLI: ESM only, executable.
    entry: { cli: "src/cli.ts" },
    format: ["esm"],
    sourcemap: true,
    target: "node20",
    outExtension: () => ({ js: ".js" }),
  },
]);
