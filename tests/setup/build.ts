import { execFileSync } from "node:child_process";
import { join } from "node:path";

// Builds dist/ once before the run so tests can load the real browser file.
export default function globalSetup(): void {
  execFileSync("node", ["scripts/build.mjs"], { cwd: join(__dirname, "../.."), stdio: "inherit" });
}
