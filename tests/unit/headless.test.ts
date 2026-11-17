import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fetchPage } from "../../src/fetch-page";
import { examplePage, fakeFetch, target } from "../contract/fixtures/delivery-v1";

const src = join(__dirname, "../../src");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : path.endsWith(".ts") ? [path] : [];
  });
}

const code = (path: string) =>
  readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

// The code that reads the page: the loader (its own script tag and two attributes) and the one module that
// builds the reporter's environment from the page's globals. Everything else is tested with plain fakes.
const isLoader = (path: string) =>
  relative(src, path).startsWith("loader") || relative(src, path) === "browser.ts" || relative(src, path) === join("events", "page-env.ts");

const has = (text: string, word: string) => new RegExp(`\\b${word}\\b`).test(text);

describe("headless", () => {
  it("runs with no window, document or location", async () => {
    expect(typeof (globalThis as Record<string, unknown>).window).toBe("undefined");
    expect(typeof (globalThis as Record<string, unknown>).document).toBe("undefined");
    const { fn } = fakeFetch(200, examplePage);
    expect((await fetchPage(target, undefined, { fetch: fn })).ok).toBe(true);
  });

  it("the delivery client never names the DOM or evaluates text", () => {
    const core = files(src).filter((f) => !isLoader(f));
    expect(core.length).toBeGreaterThan(5);
    for (const file of core) {
      for (const word of ["document", "window", "innerHTML", "eval", "Function"]) {
        expect({ file: relative(src, file), word, found: has(code(file), word) }).toEqual({ file: relative(src, file), word, found: false });
      }
    }
  });

  it("the loader creates nothing on the page and stores nothing", () => {
    const loader = files(src).filter(isLoader);
    expect(loader.length).toBeGreaterThanOrEqual(6);
    for (const file of loader) {
      const text = code(file);
      for (const word of ["createElement", "innerHTML", "appendChild", "insertAdjacent", "cookie", "localStorage", "sessionStorage", "eval", "Function", "XMLHttpRequest"]) {
        // (sendBeacon was on this list until spec 004: the events reporter sends its batches that way.)
        expect({ file: relative(src, file), word, found: has(text, word) }).toEqual({ file: relative(src, file), word, found: false });
      }
      expect({ file: relative(src, file), found: text.includes("document.write") }).toEqual({ file: relative(src, file), found: false });
      // document is read only for the running script and, since spec 004, for the page-hidden signal
      // (its visibility state and one listener); it is never written to.
      for (const m of text.matchAll(/\bdocument\b[^\n]*/g)) {
        expect(m[0]).toMatch(/currentScript|document\?:|\bpage\.document\b|visibilityState|addEventListener/);
      }
    }
  });
});
