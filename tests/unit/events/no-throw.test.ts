import { createReporter } from "../../../src/events/reporter";
import { fakeEnv, type Fakes } from "./helpers";

const ID = "2f8b6c1e-3b0d-4d8a-9a9e-5a4f1b7c2d10";
const good = { id: ID };
const target = { baseUrl: "https://api.example.com", platformId: "listings" };
const throwing = () => {
  throw new Error("boom");
};
const hostileGetters = {
  get id(): string {
    throw new Error("boom");
  },
};
const hostileOptions = {
  get placementId(): string {
    throw new Error("boom");
  },
  get actorRef(): string {
    throw new Error("boom");
  },
};

const elements: [string, unknown][] = [["missing", undefined], ["null", null], ["a number", 5], ["a string", "x"], ["an element", {}]];
const items: [string, unknown][] = [["missing", undefined], ["null", null], ["a number", 5], ["no id", {}], ["a bad id", { id: "x" }], ["a number id", { id: 5 }], ["throwing getters", hostileGetters], ["good", good]];
const options: [string, unknown][] = [["missing", undefined], ["null", null], ["a string", "latest"], ["a number", 5], ["an array", []], ["throwing getters", hostileOptions], ["empty", {}]];

describe("never throws, whatever the platform passes", () => {
  it.each(elements.flatMap(([en, e]) => items.flatMap(([inn, i]) => options.map(([on, o]) => [`${en} / ${inn} / ${on}`, e, i, o] as const))))(
    "watchView and trackLinkClick with %s",
    (_name, element, item, option) => {
      const f = fakeEnv();
      const reporter = createReporter(target, f.env);
      let stop: unknown;
      expect(() => {
        stop = reporter.watchView(element, item, option);
      }).not.toThrow();
      expect(typeof stop).toBe("function");
      expect(() => (stop as () => void)()).not.toThrow();
      expect(() => reporter.trackLinkClick(item, option)).not.toThrow();
      expect(() => f.clock.advance(200_000)).not.toThrow();
    },
  );

  it.each([
    ["no element", undefined, good, undefined],
    ["a null element", null, good, undefined],
    ["no item", {}, undefined, undefined],
    ["an item with a bad id", {}, { id: "x" }, undefined],
    ["options that are a string", {}, good, "latest"],
  ])("gives at most one warning for one bad argument: %s", (_name, element, item, option) => {
    const f = fakeEnv();
    const reporter = createReporter(target, f.env);
    reporter.watchView(element, item, option);
    expect(f.warnings.length).toBeLessThanOrEqual(1);
    const g = fakeEnv();
    createReporter(target, g.env).trackLinkClick(item, option);
    expect(g.warnings.length).toBeLessThanOrEqual(1);
  });
});

describe("never throws, whatever the page does", () => {
  const seeAndSend = (f: Fakes) => {
    const reporter = createReporter(target, f.env);
    expect(() => reporter.watchView({}, good)).not.toThrow();
    for (const observer of f.observers()) expect(() => observer.emit(0.9)).not.toThrow();
    expect(() => f.clock.advance(1000)).not.toThrow();
    expect(() => reporter.trackLinkClick(good)).not.toThrow();
    expect(() => f.clock.advance(5000)).not.toThrow();
    expect(() => f.hide()).not.toThrow();
  };

  it("with no observer", () => seeAndSend(fakeEnv({ observer: false })));
  it("with an observer constructor that throws", () => seeAndSend(fakeEnv({ observer: throwing as never })));
  it("with an observer callback that is given nonsense", () => {
    const f = fakeEnv();
    createReporter(target, f.env).watchView({}, good);
    const observer = f.observers()[0] as unknown as { callback: (entries: unknown) => void };
    for (const nonsense of [null, undefined, [], [null], [{}], "x", [{ isIntersecting: "yes", intersectionRatio: "high" }]]) {
      expect(() => observer.callback(nonsense)).not.toThrow();
    }
  });
  it("with a beacon that throws", () => seeAndSend(fakeEnv({ beacon: throwing })));
  it("with a beacon that returns something that is not a boolean", () => seeAndSend(fakeEnv({ beacon: (() => "yes") as never })));
  it("with a fetch that throws", () => seeAndSend(fakeEnv({ beacon: false, fetch: throwing })));
  it("with a fetch that rejects", async () => {
    seeAndSend(fakeEnv({ beacon: false, fetch: () => Promise.reject(new Error("down")) }));
    await Promise.resolve();
  });
  it("with neither a beacon nor a fetch", () => seeAndSend(fakeEnv({ beacon: false, fetch: false })));

  it("with a timer function that throws", () => {
    const f = fakeEnv();
    f.env.setTimeout = throwing;
    const reporter = createReporter(target, f.env);
    expect(() => reporter.watchView({}, good)).not.toThrow();
    expect(() => reporter.trackLinkClick(good)).not.toThrow();
    expect(() => reporter.trackLinkClick(good)).not.toThrow();
  });

  it("with a clearTimeout that throws", () => {
    const f = fakeEnv();
    f.env.clearTimeout = throwing;
    const reporter = createReporter(target, f.env);
    const stop = reporter.watchView({}, good);
    f.observers()[0]?.emit(0.9);
    expect(() => stop()).not.toThrow();
    reporter.trackLinkClick(good);
    expect(() => f.hide()).not.toThrow();
  });

  it("with a page-hidden subscription that throws", () => {
    const f = fakeEnv();
    f.env.onPageHidden = throwing;
    const reporter = createReporter(target, f.env);
    expect(() => reporter.trackLinkClick(good)).not.toThrow();
    f.clock.advance(2000);
    expect(f.beacons).toHaveLength(1);
  });

  it("with a console whose warn throws", () => {
    const f = fakeEnv();
    f.env.warn = throwing;
    const reporter = createReporter(target, f.env);
    expect(() => reporter.watchView(null, good)).not.toThrow();
    expect(() => reporter.trackLinkClick({ id: "x" })).not.toThrow();
    expect(() => reporter.trackLinkClick(good, { placementId: "X" })).not.toThrow();
  });

  it("with an unusable service address, warning once and sending nothing", () => {
    const f = fakeEnv();
    const reporter = createReporter({ baseUrl: "not a url", platformId: "listings" }, f.env);
    reporter.trackLinkClick(good);
    reporter.trackLinkClick(good);
    f.clock.advance(5000);
    expect(f.beacons).toEqual([]);
    expect(f.warnings).toHaveLength(1);
  });
});

describe("never throws, whatever sessionId the platform passes (spec 005)", () => {
  const hostile: [string, unknown][] = [
    ["a getter that throws", { get sessionId(): string { throw new Error("boom"); } }],
    ["a proxy that throws on any access", new Proxy({}, { get: throwing, has: throwing, ownKeys: throwing })],
    ["a Symbol", { sessionId: Symbol("s") }],
    ["a BigInt", { sessionId: 10n }],
    ["a huge string", { sessionId: "x".repeat(1_000_000) }],
    ["a cyclic object", (() => { const c: Record<string, unknown> = {}; c.sessionId = c; return c; })()],
    ["a frozen object", Object.freeze({ sessionId: "s-1" })],
    ["an object whose toString throws", { sessionId: { toString: throwing } }],
  ];

  it.each(hostile)("watchView and trackLinkClick with %s still report a valid item", (_name, option) => {
    const f = fakeEnv();
    const reporter = createReporter(target, f.env);
    expect(() => reporter.trackLinkClick(good, option)).not.toThrow();
    let stop: unknown;
    expect(() => {
      stop = reporter.watchView({}, good, option);
    }).not.toThrow();
    expect(() => (stop as () => void)()).not.toThrow();
    expect(() => f.clock.advance(200_000)).not.toThrow();
    expect(f.beacons.length).toBeGreaterThan(0);
  });
});

describe("never throws for a hostile externalRef (spec 008)", () => {
  const hostileRef = (value: unknown) => ({ get externalRef() { if (value === "throw") throw new Error("boom"); return value; } });
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  const proxy = new Proxy({}, { get: throwing, has: throwing, ownKeys: throwing, getPrototypeOf: throwing });
  it.each([
    ["a getter that throws", hostileRef("throw")],
    ["a proxy that throws", { externalRef: proxy }],
    ["a symbol", { externalRef: Symbol("x") }],
    ["a bigint", { externalRef: BigInt(5) }],
    ["a huge string", { externalRef: "x".repeat(1_000_000) }],
    ["a cyclic object", { externalRef: cyclic }],
    ["a frozen item", Object.freeze({ externalRef: "a b" })],
    ["a proxy item", proxy],
    ["both fields hostile", { id: proxy, externalRef: proxy }],
  ])("watchView and trackLinkClick with %s", (_name, item) => {
    const f = fakeEnv();
    const reporter = createReporter(target, f.env);
    expect(() => (reporter.watchView({}, item) as () => void)()).not.toThrow();
    expect(() => reporter.trackLinkClick(item)).not.toThrow();
    expect(() => f.clock.advance(200_000)).not.toThrow();
  });
});

describe("never throws for a hostile eventId (spec 009)", () => {
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  const proxy = new Proxy({}, { get: throwing, has: throwing, ownKeys: throwing, getPrototypeOf: throwing });
  it.each([
    ["a getter that throws", { get eventId(): string { throw new Error("boom"); } }],
    ["a proxy that throws", { eventId: proxy }],
    ["a symbol", { eventId: Symbol("x") }],
    ["a bigint", { eventId: BigInt(5) }],
    ["a huge string", { eventId: "x".repeat(1_000_000) }],
    ["a cyclic object", { eventId: cyclic }],
    ["frozen options", Object.freeze({ eventId: "a b" })],
    ["a proxy as the options", proxy],
  ])("watchView and trackLinkClick with %s", (_name, opts) => {
    const f = fakeEnv();
    const reporter = createReporter(target, f.env);
    expect(() => (reporter.watchView({}, good, opts) as () => void)()).not.toThrow();
    expect(() => reporter.trackLinkClick(good, opts)).not.toThrow();
    expect(() => f.clock.advance(200_000)).not.toThrow();
    expect(f.beacons.length).toBeGreaterThan(0);
  });
});
