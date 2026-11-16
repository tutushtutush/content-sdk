/** @jest-environment jsdom */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { examplePage } from "../contract/fixtures/delivery-v1";

const FILE = join(__dirname, "../../dist/content-sdk.js");
const code = readFileSync(FILE, "utf8");

// The project compiles without the DOM library on purpose, so the page is typed by hand here.
interface ScriptEl {
  setAttribute(name: string, value: string): void;
  textContent: string | null;
}
interface Page {
  document: { createElement(tag: "script"): ScriptEl; head: { appendChild(el: ScriptEl): void; innerHTML: string } };
  contentSdk?: { q: unknown[]; fetchPage?: (placementId: string, query?: unknown, cb?: (r: unknown) => void) => Promise<unknown> };
  fetch: unknown;
}
const w = globalThis as unknown as Page;
const document = w.document;

function fakeFetch() {
  const urls: string[] = [];
  const fn = (async (url: string) => {
    urls.push(String(url));
    return { status: 200, text: async () => JSON.stringify(examplePage) };
  }) as unknown as typeof fetch;
  return { urls, fn };
}

/** Puts the built file into the page as a script tag carrying the given attributes. */
function loadScript(attrs: Record<string, string>) {
  const script = document.createElement("script");
  for (const [k, v] of Object.entries(attrs)) script.setAttribute(k, v);
  script.textContent = code;
  document.head.appendChild(script);
  return script;
}

const GOOD = { "data-api-base-url": "https://content-api.example.com", "data-platform-id": "listings" };

afterEach(() => {
  delete w.contentSdk;
  document.head.innerHTML = "";
});

describe("the built browser file", () => {
  it("is one minified script with a source map", () => {
    const lines = code.trimEnd().split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe("//# sourceMappingURL=content-sdk.js.map");
    expect(readFileSync(`${FILE}.map`, "utf8")).toContain('"mappings"');
  });

  it("creates only the contentSdk global and answers fetchPage with the delivery result", async () => {
    const { urls, fn } = fakeFetch();
    w.fetch = fn;
    w.contentSdk = { q: [] };
    const before = new Set(Object.getOwnPropertyNames(globalThis));
    loadScript(GOOD);

    const added = Object.getOwnPropertyNames(globalThis).filter((n) => !before.has(n));
    expect(added).toEqual([]); // the page made contentSdk; the file adds no global of its own

    const seen: unknown[] = [];
    const returned = await w.contentSdk?.fetchPage?.("latest", { limit: 5 }, (r) => seen.push(r));
    expect(returned).toEqual({ ok: true, page: expect.objectContaining({ nextCursor: null }) });
    expect(seen).toEqual([returned]);
    expect(urls).toEqual(["https://content-api.example.com/api/v1/delivery/listings/latest?limit=5"]);
  });

  it("replays commands queued before it loaded, in order, with the right results", async () => {
    const { urls, fn } = fakeFetch();
    w.fetch = fn;
    const seen: string[] = [];
    const cb = (name: string) => () => seen.push(name);
    w.contentSdk = { q: [["fetchPage", "one", {}, cb("one")], ["fetchPage", "two", { limit: 2 }, cb("two")], ["fetchPage", "three", {}, cb("three")]] };
    loadScript(GOOD);
    await new Promise((r) => setTimeout(r, 20));
    expect(seen).toEqual(["one", "two", "three"]);
    expect(urls.map((u) => u.split("/delivery/")[1])).toEqual(["listings/one", "listings/two?limit=2", "listings/three"]);
  });

  it("ignores a second load of the file with one warning", async () => {
    const warnings: string[] = [];
    const realWarn = console.warn;
    console.warn = (t: string) => warnings.push(t);
    try {
      w.fetch = fakeFetch().fn;
      w.contentSdk = { q: [] };
      loadScript(GOOD);
      const method = w.contentSdk.fetchPage;
      loadScript(GOOD);
      expect(w.contentSdk.fetchPage).toBe(method);
      expect(warnings).toEqual(["[content-sdk] The script was loaded twice; the second load was ignored."]);
    } finally {
      console.warn = realWarn;
    }
  });

  it.each([["data-platform-id"], ["data-api-base-url"]])("without %s: one warning, no request, no fetchPage", (missing) => {
    const warnings: string[] = [];
    const realWarn = console.warn;
    console.warn = (t: string) => warnings.push(t);
    try {
      const { urls, fn } = fakeFetch();
      w.fetch = fn;
      w.contentSdk = { q: [["fetchPage", "a"]] };
      const attrs: Record<string, string> = { ...GOOD };
      attrs[missing] = "  ";
      loadScript(attrs);
      expect(warnings).toEqual([`[content-sdk] Missing ${missing} on the content-sdk <script> tag. Nothing will be fetched.`]);
      expect(urls).toEqual([]);
      expect(w.contentSdk.fetchPage).toBeUndefined();
    } finally {
      console.warn = realWarn;
    }
  });
});
