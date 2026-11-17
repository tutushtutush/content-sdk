import { pageEnv, type PageGlobals } from "../../../src/events/page-env";

function fakePage(overrides: Partial<PageGlobals> = {}) {
  const log: string[] = [];
  const windowListeners: Record<string, () => void> = {};
  const documentListeners: Record<string, () => void> = {};
  const page: PageGlobals = {
    setTimeout: (cb, ms) => { log.push(`setTimeout ${ms}`); return cb; },
    clearTimeout: (h) => { log.push(`clearTimeout ${typeof h}`); },
    console: { warn: (t) => log.push(`warn ${t}`) },
    navigator: { sendBeacon(this: unknown, url: string, body: string) { log.push(`beacon ${url} ${body} ${this === page.navigator}`); return true; } },
    fetch: (url, init) => { log.push(`fetch ${url} ${init.method}`); return Promise.resolve({}); },
    addEventListener: (type, listener) => { windowListeners[type] = listener; },
    document: { visibilityState: "visible", addEventListener: (type, listener) => { documentListeners[type] = listener; } },
    ...overrides,
  };
  return { page, log, windowListeners, documentListeners };
}

describe("pageEnv", () => {
  it("passes the clock, timers and warning through", () => {
    const { page, log } = fakePage();
    const env = pageEnv(page);
    expect(typeof env.now()).toBe("number");
    const handle = env.setTimeout(() => undefined, 2000);
    env.clearTimeout(handle);
    env.warn("hello");
    expect(log).toEqual(["setTimeout 2000", "clearTimeout function", "warn hello"]);
  });

  it("calls the beacon as a method of navigator, and fetch with the address and init", () => {
    const { page, log } = fakePage();
    const env = pageEnv(page);
    expect(env.sendBeacon?.("https://a.example/e", "{}")).toBe(true);
    env.fetch?.("https://a.example/e", { method: "POST", body: "{}", keepalive: true, credentials: "omit", headers: { "content-type": "text/plain" } });
    expect(log).toEqual(["beacon https://a.example/e {} true", "fetch https://a.example/e POST"]);
  });

  it("offers no beacon, fetch or observer the page does not have", () => {
    const env = pageEnv({ console: { warn: () => undefined } });
    expect(env.sendBeacon).toBeUndefined();
    expect(env.fetch).toBeUndefined();
    expect(env.IntersectionObserver).toBeUndefined();
    expect(env.onPageHidden).toBeUndefined();
  });

  it("passes the observer constructor through", () => {
    class Observer {}
    const env = pageEnv({ ...fakePage().page, IntersectionObserver: Observer as never });
    expect(env.IntersectionObserver).toBe(Observer);
  });

  it("listens to pagehide on the window, and to visibilitychange on the document only when it says hidden", () => {
    const { page, windowListeners, documentListeners } = fakePage();
    const env = pageEnv(page);
    let hidden = 0;
    env.onPageHidden?.(() => (hidden += 1));
    windowListeners.pagehide?.();
    expect(hidden).toBe(1);
    documentListeners.visibilitychange?.();
    expect(hidden).toBe(1);
    (page.document as { visibilityState: string }).visibilityState = "hidden";
    documentListeners.visibilitychange?.();
    expect(hidden).toBe(2);
  });

  it("works with only the window's listener, or only the document's", () => {
    const onlyWindow = fakePage({ document: undefined });
    let hidden = 0;
    pageEnv(onlyWindow.page).onPageHidden?.(() => (hidden += 1));
    onlyWindow.windowListeners.pagehide?.();
    expect(hidden).toBe(1);
    const onlyDocument = fakePage({ addEventListener: undefined });
    pageEnv(onlyDocument.page).onPageHidden?.(() => (hidden += 1));
    (onlyDocument.page.document as { visibilityState: string }).visibilityState = "hidden";
    onlyDocument.documentListeners.visibilitychange?.();
    expect(hidden).toBe(2);
  });

  it("does not throw when a listener cannot be added, and does not throw from a broken console", () => {
    const { page } = fakePage({ addEventListener: () => { throw new Error("no"); }, console: { warn: () => { throw new Error("no"); } } });
    const env = pageEnv(page);
    expect(() => env.onPageHidden?.(() => undefined)).not.toThrow();
    expect(() => env.warn("x")).not.toThrow();
  });

  it("falls back to harmless timers when the page has none", () => {
    const env = pageEnv({});
    expect(env.setTimeout(() => undefined, 1)).toBeUndefined();
    expect(() => env.clearTimeout(undefined)).not.toThrow();
  });
});
