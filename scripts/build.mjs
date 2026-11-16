import * as esbuild from "esbuild";
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";

// Start clean so a file that is no longer built cannot linger in the package.
rmSync("dist", { recursive: true, force: true });

const common = { bundle: true, target: "es2020", sourcemap: true };

// The library: import and require entries.
await esbuild.build({ ...common, entryPoints: ["src/index.ts"], outfile: "dist/index.mjs", format: "esm" });
await esbuild.build({ ...common, entryPoints: ["src/index.ts"], outfile: "dist/index.cjs", format: "cjs" });

// The browser file: the loader only. It creates the `contentSdk` global and nothing else.
await esbuild.build({
  ...common,
  entryPoints: ["src/browser.ts"],
  outfile: "dist/content-sdk.js",
  format: "iife",
  minify: true,
});

// Declarations land beside the bundles: dist/index.d.ts and the files it imports.
execFileSync("npx", ["tsc", "-p", "tsconfig.build.json"], { stdio: "inherit" });
