import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "../..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

describe("package.json", () => {
  it("exposes the browser file at content-sdk/browser", () => {
    expect(pkg.exports["./browser"]).toBe("./dist/content-sdk.js");
  });

  it("keeps the library entries from 001", () => {
    expect(pkg.exports["."]).toEqual({
      types: "./dist/index.d.ts",
      import: "./dist/index.mjs",
      require: "./dist/index.cjs",
    });
  });

  it("ships dist, builds on prepare, stays private with no runtime dependencies, version 0.6.0", () => {
    expect(pkg.files).toEqual(expect.arrayContaining(["dist"]));
    expect(pkg.scripts.prepare).toBe("npm run build");
    expect(pkg.private).toBe(true);
    expect(pkg.dependencies).toBeUndefined();
    expect(pkg.version).toBe("0.6.0");
  });

  it("every file named by exports exists after the build", () => {
    const targets = [pkg.exports["./browser"], ...Object.values(pkg.exports["."])] as string[];
    for (const t of targets) expect({ t, exists: existsSync(join(root, t)) }).toEqual({ t, exists: true });
    expect(existsSync(join(root, "dist/content-sdk.js.map"))).toBe(true);
  });

  it("require.resolve gives the browser file", () => {
    expect(require.resolve("content-sdk/browser")).toBe(join(root, "dist/content-sdk.js"));
  });
});
