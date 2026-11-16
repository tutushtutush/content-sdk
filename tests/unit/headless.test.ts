import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fetchPage } from "../../src/fetch-page";
import { examplePage, fakeFetch, target } from "../contract/fixtures/delivery-v1";

describe("headless", () => {
  it("runs with no window, document or location", async () => {
    expect(typeof (globalThis as Record<string, unknown>).window).toBe("undefined");
    expect(typeof (globalThis as Record<string, unknown>).document).toBe("undefined");
    const { fn } = fakeFetch(200, examplePage);
    expect((await fetchPage(target, undefined, { fetch: fn })).ok).toBe(true);
  });

  it("the source never names the DOM or evaluates text", () => {
    const dir = join(__dirname, "../../src");
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".ts"))) {
      const code = readFileSync(join(dir, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      for (const word of ["document", "window", "innerHTML", "eval", "Function"]) {
        expect({ file, word, found: new RegExp(`\\b${word}\\b`).test(code) }).toEqual({ file, word, found: false });
      }
    }
  });
});
