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
  document: { createElement(tag: "script"): ScriptEl; head: { appendChild(el: ScriptEl): void; innerHTML: string }; documentElement: { outerHTML: string }; cookie: string };
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

  it("sends q for a command queued before load and for a direct call after it", async () => {
    const { urls, fn } = fakeFetch();
    w.fetch = fn;
    w.contentSdk = { q: [["fetchPage", "latest", { q: "toyota corolla" }, () => {}]] };
    loadScript(GOOD);
    await new Promise((r) => setTimeout(r, 20));
    await w.contentSdk?.fetchPage?.("latest", { q: "መኪና ፡ ቶዮታ", limit: 3 });
    const searches = urls.map((u) => new URL(u).searchParams);
    expect(searches[0].get("q")).toBe("toyota corolla");
    expect(searches[1].get("q")).toBe("መኪና ፡ ቶዮታ");
    expect(searches[1].get("limit")).toBe("3");
  });

  it("answers a q that is not text with a bad_query result and no request", async () => {
    const { urls, fn } = fakeFetch();
    w.fetch = fn;
    w.contentSdk = { q: [] };
    loadScript(GOOD);
    const result = await w.contentSdk?.fetchPage?.("latest", { q: 5 });
    expect(result).toMatchObject({ ok: false, error: { kind: "bad_query", fields: ["q"] } });
    expect(urls).toEqual([]);
  });

  it("returns the view_count of each item, for a queued command and a direct call", async () => {
    const { fn } = fakeFetch();
    w.fetch = fn;
    const queued: unknown[] = [];
    w.contentSdk = { q: [["fetchPage", "latest", {}, (r: unknown) => queued.push(r)]] };
    loadScript(GOOD);
    await new Promise((r) => setTimeout(r, 20));
    const direct = await w.contentSdk?.fetchPage?.("latest", { limit: 5 });
    const counts = (r: unknown) => (r as { page: { items: Array<{ view_count: number }> } }).page.items.map((item) => item.view_count);
    expect(counts(queued[0])).toEqual([1204]);
    expect(counts(direct)).toEqual([1204]);
  });

  it("answers a page whose count is bad with contract_mismatch to the callback and the promise, and throws nothing", async () => {
    const bad = (async () => ({ status: 200, text: async () => JSON.stringify({ items: [{ ...examplePage.items[0], view_count: "5" }], next_cursor: null }) })) as unknown as typeof fetch;
    w.fetch = bad;
    const queued: unknown[] = [];
    w.contentSdk = { q: [["fetchPage", "latest", {}, (r: unknown) => queued.push(r)]] };
    loadScript(GOOD);
    await new Promise((r) => setTimeout(r, 20));
    const direct = await w.contentSdk?.fetchPage?.("latest", {});
    expect(queued).toEqual([expect.objectContaining({ ok: false, error: expect.objectContaining({ kind: "contract_mismatch" }) })]);
    expect(direct).toMatchObject({ ok: false, error: { kind: "contract_mismatch" } });
  });

  it("sends sort for a command queued before load and for a direct call after it", async () => {
    const { urls, fn } = fakeFetch();
    w.fetch = fn;
    w.contentSdk = { q: [["fetchPage", "latest", { sort: "popular", limit: 5 }, () => {}]] };
    loadScript(GOOD);
    await new Promise((r) => setTimeout(r, 20));
    await w.contentSdk?.fetchPage?.("latest", { sort: "oldest", cursor: "c" });
    const sent = urls.map((u) => new URL(u).searchParams);
    expect([sent[0].get("sort"), sent[0].get("limit")]).toEqual(["popular", "5"]);
    expect([sent[1].get("sort"), sent[1].get("cursor")]).toEqual(["oldest", "c"]);
  });

  it("answers a bad sort, queued or direct, with a bad_query result naming sort and no request", async () => {
    const { urls, fn } = fakeFetch();
    w.fetch = fn;
    const queued: unknown[] = [];
    w.contentSdk = { q: [["fetchPage", "latest", { sort: "best" }, (r: unknown) => queued.push(r)]] };
    loadScript(GOOD);
    await new Promise((r) => setTimeout(r, 20));
    const direct = await w.contentSdk?.fetchPage?.("latest", { sort: "" });
    expect(queued).toEqual([expect.objectContaining({ ok: false, error: expect.objectContaining({ kind: "bad_query", fields: ["sort"] }) })]);
    expect(direct).toMatchObject({ ok: false, error: { kind: "bad_query", fields: ["sort"] } });
    expect(urls).toEqual([]);
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

// Spec 004: views and link clicks, through the built file, with a fake visibility observer and a fake beacon.
describe("the built browser file: reporting views and clicks", () => {
  const ID = "2f8b6c1e-3b0d-4d8a-9a9e-5a4f1b7c2d10";
  const item = { id: ID };

  class FakeObserver {
    static instances: FakeObserver[] = [];
    constructor(private readonly callback: (entries: { isIntersecting: boolean; intersectionRatio: number }[]) => void) {
      FakeObserver.instances.push(this);
    }
    observe(): void {}
    disconnect(): void {}
    emit(ratio: number): void {
      this.callback([{ isIntersecting: ratio > 0, intersectionRatio: ratio }]);
    }
  }

  interface Sdk {
    q: unknown[];
    watchView?: (element: unknown, item: unknown, options?: unknown) => () => void;
    trackLinkClick?: (item: unknown, options?: unknown) => void;
  }
  const global = globalThis as unknown as { IntersectionObserver?: unknown; navigator: { sendBeacon?: unknown } };
  let beacons: { url: string; body: string }[];

  beforeEach(() => {
    jest.useFakeTimers();
    FakeObserver.instances = [];
    beacons = [];
    global.IntersectionObserver = FakeObserver;
    Object.defineProperty(global.navigator, "sendBeacon", { configurable: true, value: (url: string, body: string) => (beacons.push({ url, body }), true) });
    w.fetch = fakeFetch().fn;
  });
  afterEach(() => {
    jest.useRealTimers();
    delete global.IntersectionObserver;
    delete global.navigator.sendBeacon;
  });

  it("offers watchView and trackLinkClick once loaded, and makes no request of its own until an event is reported", () => {
    const { urls, fn } = fakeFetch();
    w.fetch = fn;
    w.contentSdk = { q: [] };
    loadScript(GOOD);
    const sdk = w.contentSdk as unknown as Sdk;
    expect(typeof sdk.watchView).toBe("function");
    expect(typeof sdk.trackLinkClick).toBe("function");
    jest.advanceTimersByTime(60_000);
    expect(beacons).toEqual([]);
    expect(urls).toEqual([]);
  });

  it("reports one view, two seconds after a card has been half visible for a second, as one text/plain beacon", () => {
    w.contentSdk = { q: [] };
    loadScript(GOOD);
    const sdk = w.contentSdk as unknown as Sdk;
    const card = document.createElement("script"); // any object will do; the file must not touch it
    sdk.watchView?.(card, item, { placementId: "latest", actorRef: "device-1" });
    expect(FakeObserver.instances).toHaveLength(1);
    FakeObserver.instances[0]?.emit(0.8);
    jest.advanceTimersByTime(999);
    jest.advanceTimersByTime(1);
    expect(beacons).toEqual([]); // queued, waiting two seconds
    jest.advanceTimersByTime(1999);
    expect(beacons).toEqual([]);
    jest.advanceTimersByTime(1);
    expect(beacons).toHaveLength(1);
    expect(beacons[0]?.url).toBe("https://content-api.example.com/api/v1/events");
    expect(typeof beacons[0]?.body).toBe("string");
    expect(JSON.parse(beacons[0]?.body ?? "")).toEqual({
      platform_id: "listings",
      events: [{ kind: "view", item_id: ID, occurred_at: expect.stringMatching(/Z$/), placement_id: "latest", actor_ref: "device-1" }],
    });
  });

  it("reports a card that is never half visible as nothing, and a stopped watch as nothing", () => {
    w.contentSdk = { q: [] };
    loadScript(GOOD);
    const sdk = w.contentSdk as unknown as Sdk;
    sdk.watchView?.({}, item);
    FakeObserver.instances[0]?.emit(0.4);
    const stop = sdk.watchView?.({}, item);
    FakeObserver.instances[1]?.emit(0.9);
    jest.advanceTimersByTime(500);
    stop?.();
    jest.advanceTimersByTime(300_000);
    expect(beacons).toEqual([]);
  });

  it("runs a watchView and a trackLinkClick queued before the script loaded", () => {
    w.contentSdk = { q: [["watchView", {}, item], ["trackLinkClick", item, { placementId: "latest" }]] };
    loadScript(GOOD);
    expect(FakeObserver.instances).toHaveLength(1);
    FakeObserver.instances[0]?.emit(1);
    jest.advanceTimersByTime(1000);
    jest.advanceTimersByTime(2000);
    expect(beacons).toHaveLength(1);
    expect((JSON.parse(beacons[0]?.body ?? "") as { events: { kind: string }[] }).events.map((e) => e.kind)).toEqual(["link_click", "view"]);
  });

  it("falls back to one keep-alive fetch when the beacon refuses", () => {
    Object.defineProperty(global.navigator, "sendBeacon", { configurable: true, value: () => false });
    const { urls, fn } = fakeFetch();
    w.fetch = fn;
    w.contentSdk = { q: [] };
    loadScript(GOOD);
    (w.contentSdk as unknown as Sdk).trackLinkClick?.(item);
    jest.advanceTimersByTime(2000);
    expect(urls).toEqual(["https://content-api.example.com/api/v1/events"]);
  });

  it("sets no cookie, stores nothing and changes no element of the page", () => {
    const before = document.documentElement.outerHTML;
    w.contentSdk = { q: [] };
    loadScript(GOOD);
    const html = document.documentElement.outerHTML; // with the script tag in
    const sdk = w.contentSdk as unknown as Sdk;
    sdk.watchView?.({}, item, { actorRef: "device-1" });
    FakeObserver.instances[0]?.emit(0.9);
    jest.advanceTimersByTime(1000);
    sdk.trackLinkClick?.(item);
    jest.advanceTimersByTime(5000);
    expect(beacons).toHaveLength(1);
    expect(document.cookie).toBe("");
    expect(globalThis.localStorage.length).toBe(0);
    expect(globalThis.sessionStorage.length).toBe(0);
    expect(document.documentElement.outerHTML).toBe(html);
    expect(before).not.toBe("");
  });

  it("sends the sessionId the platform gives, only on the events it was given for, through the direct calls and the queue (spec 005)", () => {
    w.contentSdk = { q: [["trackLinkClick", item, { sessionId: "s-queued" }]] };
    loadScript(GOOD);
    const sdk = w.contentSdk as unknown as Sdk;
    sdk.watchView?.({}, item, { sessionId: "s-watch" });
    FakeObserver.instances[0]?.emit(0.9);
    jest.advanceTimersByTime(1000);
    sdk.trackLinkClick?.(item, { sessionId: "s-direct" });
    sdk.trackLinkClick?.(item);
    jest.advanceTimersByTime(5000);
    const events = beacons.flatMap((b) => (JSON.parse(b.body) as { events: Record<string, unknown>[] }).events);
    expect(events.map((e) => [e.kind, e.session_id])).toEqual([
      ["link_click", "s-queued"], ["view", "s-watch"], ["link_click", "s-direct"], ["link_click", undefined],
    ]);
    expect(events[3]).not.toHaveProperty("session_id");
  });

  it("sends external_ref for a reference, through the queue and the direct calls, and refuses a bad or ambiguous item with one warning each (spec 008)", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      w.contentSdk = { q: [["trackLinkClick", { externalRef: "telegram:addis_news/1" }, { placementId: "telegram" }]] };
      loadScript(GOOD);
      const sdk = w.contentSdk as unknown as Sdk;
      sdk.watchView?.({}, { externalRef: "telegram:addis_news/2" });
      FakeObserver.instances[0]?.emit(0.9);
      jest.advanceTimersByTime(1000);
      sdk.trackLinkClick?.(item);
      warn.mockClear();
      sdk.trackLinkClick?.({ externalRef: "SECRET a b" });
      sdk.trackLinkClick?.({ id: ID, externalRef: "telegram:addis_news/3" });
      sdk.trackLinkClick?.({});
      jest.advanceTimersByTime(5000);
      const events = beacons.flatMap((b) => (JSON.parse(b.body) as { events: Record<string, unknown>[] }).events);
      expect(events.map((e) => [e.kind, e.item_id, e.external_ref, e.placement_id])).toEqual([
        ["link_click", undefined, "telegram:addis_news/1", "telegram"],
        ["view", undefined, "telegram:addis_news/2", undefined],
        ["link_click", ID, undefined, undefined],
      ]);
      expect(warn).toHaveBeenCalledTimes(3);
      for (const call of warn.mock.calls) expect(String(call[0])).not.toMatch(/SECRET|addis_news/);
    } finally {
      warn.mockRestore();
    }
  });

  it("makes no session of its own: a whole lifecycle reads and writes no storage, cookie or random source (spec 005)", () => {
    const touched: string[] = [];
    const spies: { mockRestore: () => void }[] = [
      jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => (touched.push("getItem"), null)),
      jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => void touched.push("setItem")),
      jest.spyOn(Math, "random").mockImplementation(() => (touched.push("Math.random"), 0.5)),
    ];
    const cryptoLike = (globalThis as unknown as { crypto?: { getRandomValues?: unknown; randomUUID?: unknown } }).crypto;
    if (cryptoLike !== undefined && typeof cryptoLike.getRandomValues === "function") {
      spies.push(jest.spyOn(cryptoLike as { getRandomValues: (a: never) => never }, "getRandomValues").mockImplementation(((a: never) => (touched.push("getRandomValues"), a)) as never));
    }
    if (cryptoLike !== undefined && typeof cryptoLike.randomUUID === "function") {
      spies.push(jest.spyOn(cryptoLike as { randomUUID: () => string }, "randomUUID").mockImplementation(() => (touched.push("randomUUID"), "x") as never));
    }
    Object.defineProperty(document, "cookie", { configurable: true, get: () => (touched.push("cookie get"), ""), set: () => void touched.push("cookie set") });
    try {
      w.contentSdk = { q: [] };
      loadScript(GOOD);
      touched.length = 0; // the page's own loading is not the SDK's reporting
      const sdk = w.contentSdk as unknown as Sdk;
      sdk.watchView?.({}, item, { sessionId: "s-1" });
      FakeObserver.instances[0]?.emit(0.9);
      jest.advanceTimersByTime(1000);
      sdk.trackLinkClick?.(item);
      jest.advanceTimersByTime(5000);
      expect(beacons).toHaveLength(1);
      expect(touched).toEqual([]);
    } finally {
      delete (document as unknown as { cookie?: unknown }).cookie;
      for (const spy of spies) spy.mockRestore();
    }
  });

  it("is still one minified script with a source map", () => {
    expect(code.trimEnd().split("\n")).toHaveLength(2);
  });
});
