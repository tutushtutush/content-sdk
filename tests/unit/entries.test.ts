import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "../..");

describe("library entries are unchanged", () => {
  it("require gives fetchPage and creates no contentSdk global", () => {
    const out = execFileSync("node", ["-e", "const m=require('./dist/index.cjs');console.log(typeof m.fetchPage, typeof globalThis.contentSdk)"], { cwd: root });
    expect(out.toString().trim()).toBe("function undefined");
  });

  it("import gives fetchPage and creates no contentSdk global", () => {
    const out = execFileSync(
      "node",
      ["--input-type=module", "-e", "import {fetchPage} from './dist/index.mjs';console.log(typeof fetchPage, typeof globalThis.contentSdk)"],
      { cwd: root },
    );
    expect(out.toString().trim()).toBe("function undefined");
  });

  it("the declarations still export the 001 surface", () => {
    const d = readFileSync(join(root, "dist/index.d.ts"), "utf8");
    expect(d).toContain("fetchPage");
    for (const name of ["Target", "Query", "Options", "Result", "Page", "Item", "Image", "DeliveryError", "ErrorKind"]) {
      expect(d).toContain(name);
    }
  });

  it("the declarations cover the library only, not the loader's internals", () => {
    expect(existsSync(join(root, "dist/browser.d.ts"))).toBe(false);
    expect(existsSync(join(root, "dist/loader"))).toBe(false);
  });

  it("the package self-reference for the bare name still resolves to the CommonJS entry", () => {
    expect(require.resolve("content-sdk")).toBe(join(root, "dist/index.cjs"));
  });
});
