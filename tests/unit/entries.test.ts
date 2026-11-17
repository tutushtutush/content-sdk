import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "../..");

describe("library entries are unchanged", () => {
  it("require and import also give watchView and trackLinkClick, still with no contentSdk global (spec 004)", () => {
    const cjs = execFileSync("node", ["-e", "const m=require('./dist/index.cjs');console.log(typeof m.watchView, typeof m.trackLinkClick, typeof globalThis.contentSdk)"], { cwd: root });
    expect(cjs.toString().trim()).toBe("function function undefined");
    const esm = execFileSync(
      "node",
      ["--input-type=module", "-e", "import {watchView, trackLinkClick} from './dist/index.mjs';console.log(typeof watchView, typeof trackLinkClick, typeof globalThis.contentSdk)"],
      { cwd: root },
    );
    expect(esm.toString().trim()).toBe("function function undefined");
  });

  it("in Node, watchView does nothing and trackLinkClick never throws (spec 004)", () => {
    const out = execFileSync(
      "node",
      ["-e", "const m=require('./dist/index.cjs');const stop=m.watchView({baseUrl:'https://api.example.com',platformId:'p'},{}, {id:'2f8b6c1e-3b0d-4d8a-9a9e-5a4f1b7c2d10'});stop();m.trackLinkClick(null,{});console.log('ok')"],
      { cwd: root },
    );
    expect(out.toString()).toContain("ok");
  });

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
    for (const name of ["Target", "Query", "Options", "Result", "Page", "Item", "Image", "DeliveryError", "ErrorKind", "ReportTarget", "ViewOptions", "watchView", "trackLinkClick"]) {
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
