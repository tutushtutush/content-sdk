import * as esbuild from "esbuild";
import { execFileSync } from "node:child_process";

const common = { entryPoints: ["src/index.ts"], bundle: true, target: "es2020", sourcemap: true };

await esbuild.build({ ...common, outfile: "dist/index.mjs", format: "esm" });
await esbuild.build({ ...common, outfile: "dist/index.cjs", format: "cjs" });
await esbuild.build({
  ...common,
  outfile: "dist/content-sdk.js",
  format: "iife",
  globalName: "ContentSdk",
  minify: true,
});

// Declarations land beside the bundles: dist/index.d.ts and the files it imports.
execFileSync("npx", ["tsc", "-p", "tsconfig.build.json"], { stdio: "inherit" });
