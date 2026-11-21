import { createReporter } from "../../../src/events/reporter";
import { fakeEnv } from "./helpers";

const ID = "2f8b6c1e-3b0d-4d8a-9a9e-5a4f1b7c2d10";
const ID2 = "9b1e7c52-0a63-4c36-8f55-1d2f6a7b8c90";
const item = { id: ID, title: "Bike", url: "https://acme.example/p/1" };
const target = { baseUrl: "https://api.example.com", platformId: "listings" };
const element = { tag: "card" };

function setup(options: Parameters<typeof fakeEnv>[0] = {}) {
  const f = fakeEnv(options);
  const reporter = createReporter(target, f.env);
  const sent = () => f.beacons.map((b) => JSON.parse(b.body) as { platform_id: string; events: Record<string, unknown>[] });
  const see = (index = 0) => {
    f.observers()[index]?.emit(0.9);
    f.clock.advance(1000);
  };
  return { f, reporter, sent, see };
}

describe("reporter.watchView", () => {
  it("observes the element, and when the dwell completes queues one view with the item's id and the time it completed", () => {
    const { f, reporter, sent, see } = setup();
    reporter.watchView(element, item);
    expect(f.observers()[0]?.observed).toEqual([element]);
    f.clock.advance(5000);
    f.observers()[0]?.emit(0.9);
    const seenAt = f.clock.now() + 1000;
    f.clock.advance(1000);
    expect(f.beacons).toEqual([]);
    f.clock.advance(2000);
    expect(sent()).toEqual([{ platform_id: "listings", events: [{ kind: "view", item_id: ID, occurred_at: new Date(seenAt).toISOString() }] }]);
    expect(see).toBeDefined();
  });

  it.each([["missing", undefined], ["null", null], ["a string", "card"], ["a number", 5]])("gives one warning, no watch and a stop that does nothing for an element that is %s", (_name, bad) => {
    const { f, reporter } = setup();
    const stop = reporter.watchView(bad, item);
    expect(f.warnings).toHaveLength(1);
    expect(f.observers()).toHaveLength(0);
    expect(() => stop()).not.toThrow();
  });

  it.each([["missing", undefined], ["without a UUID id", { id: "abc" }], ["a string", "x"]])("gives one warning and no watch for an item that is %s", (_name, bad) => {
    const { f, reporter } = setup();
    const stop = reporter.watchView(element, bad);
    expect(f.warnings).toHaveLength(1);
    expect(f.observers()).toHaveLength(0);
    expect(() => stop()).not.toThrow();
  });

  it("returns a stop that cancels the watch so nothing is reported", () => {
    const { f, reporter, see } = setup();
    const stop = reporter.watchView(element, item);
    f.observers()[0]?.emit(0.9);
    f.clock.advance(500);
    stop();
    f.clock.advance(1000);
    see();
    f.clock.advance(5000);
    expect(f.beacons).toEqual([]);
  });

  it("makes each call its own watch, even for the same element and item", () => {
    const { f, reporter, sent } = setup();
    reporter.watchView(element, item);
    reporter.watchView(element, item);
    expect(f.observers()).toHaveLength(2);
    f.observers().forEach((observer) => observer.emit(0.9));
    f.clock.advance(1000);
    f.clock.advance(2000);
    expect(sent()[0]?.events).toHaveLength(2);
  });

  it("has reported nothing, and sends nothing, when the page is hidden before the second has passed", () => {
    // The page is gone after this, so its timers never run: a dwell that was not finished never reports.
    const { f, reporter } = setup();
    reporter.watchView(element, item);
    f.observers()[0]?.emit(0.9);
    f.clock.advance(600);
    f.hide();
    expect(f.beacons).toEqual([]);
    expect(f.fetches).toEqual([]);
  });

  it("does nothing when the browser has no observer, and does not throw", () => {
    const { f, reporter } = setup({ observer: false });
    const stop = reporter.watchView(element, item);
    expect(() => stop()).not.toThrow();
    f.clock.advance(10_000);
    expect(f.beacons).toEqual([]);
    expect(f.warnings).toEqual([]);
  });

  it("warns once for the bad item id but still watches when only an option is bad", () => {
    const { f, reporter, sent, see } = setup();
    reporter.watchView(element, item, { placementId: "X", actorRef: "device-1" });
    expect(f.warnings).toHaveLength(1);
    see();
    f.clock.advance(2000);
    expect(sent()[0]?.events[0]).toEqual({ kind: "view", item_id: ID, occurred_at: expect.any(String), actor_ref: "device-1" });
  });
});

describe("reporter.trackLinkClick", () => {
  it("queues one link_click with the item's id and the time of the call", () => {
    const { f, reporter, sent } = setup();
    const at = new Date(f.clock.now()).toISOString();
    reporter.trackLinkClick(item);
    f.clock.advance(2000);
    expect(sent()).toEqual([{ platform_id: "listings", events: [{ kind: "link_click", item_id: ID, occurred_at: at }] }]);
  });

  it("queues two events for two calls: it does not deduplicate", () => {
    const { f, reporter, sent } = setup();
    reporter.trackLinkClick(item);
    reporter.trackLinkClick(item);
    f.clock.advance(2000);
    expect(sent()[0]?.events).toHaveLength(2);
  });

  it.each([["missing", undefined], ["without a UUID id", { id: "x" }]])("gives one warning and queues nothing for an item that is %s", (_name, bad) => {
    const { f, reporter } = setup();
    reporter.trackLinkClick(bad);
    f.clock.advance(10_000);
    expect(f.warnings).toHaveLength(1);
    expect(f.beacons).toEqual([]);
  });

  it("adds no click listener and none on any element: the only subscription is the one page-hidden signal, made once", () => {
    const { f, reporter } = setup();
    expect(f.hiddenSubscriptions).toBe(0);
    reporter.trackLinkClick(item);
    reporter.trackLinkClick(item);
    reporter.trackLinkClick({ id: ID2 });
    expect(f.hiddenSubscriptions).toBe(1);
  });
});

describe("reporter: sending", () => {
  it("sends a view and a click queued within two seconds as one beacon of two events after 2000 ms", () => {
    const { f, reporter, sent, see } = setup();
    reporter.watchView(element, item);
    see();
    reporter.trackLinkClick({ id: ID2 });
    f.clock.advance(1999);
    expect(f.beacons).toEqual([]);
    f.clock.advance(1);
    expect(sent()).toHaveLength(1);
    expect(sent()[0]?.events.map((e) => e.kind)).toEqual(["view", "link_click"]);
  });

  it("sends 50 events at once in one request, and starts a new wait for the 51st", () => {
    const { f, reporter, sent } = setup();
    for (let n = 0; n < 50; n++) reporter.trackLinkClick(item);
    expect(sent()).toHaveLength(1);
    expect(sent()[0]?.events).toHaveLength(50);
    reporter.trackLinkClick(item);
    f.clock.advance(1999);
    expect(sent()).toHaveLength(1);
    f.clock.advance(1);
    expect(sent().map((b) => b.events.length)).toEqual([50, 1]);
  });

  it("sends what waits when the page is hidden, once, and nothing more when it is hidden again", () => {
    const { f, reporter, sent } = setup();
    reporter.trackLinkClick(item);
    f.hide();
    f.hide();
    expect(sent()).toHaveLength(1);
    f.clock.advance(60_000);
    expect(sent()).toHaveLength(1);
  });

  it("makes no request, however often the page is hidden, when nothing waits", () => {
    const { f, reporter } = setup();
    reporter.trackLinkClick(item);
    f.clock.advance(2000);
    const before = f.beacons.length;
    f.hide();
    f.hide();
    expect(f.beacons).toHaveLength(before);
  });

  it("subscribes to the page-hidden signal once, when the first event is queued, not before", () => {
    const { f, reporter, see } = setup();
    reporter.watchView(element, item);
    expect(f.hiddenSubscriptions).toBe(0);
    see();
    expect(f.hiddenSubscriptions).toBe(1);
    reporter.trackLinkClick(item);
    expect(f.hiddenSubscriptions).toBe(1);
  });

  it("does not retry a refused beacon and a rejected fetch, and still sends the next event", async () => {
    const { f, reporter } = setup({ beacon: () => false, fetch: () => Promise.reject(new Error("down")) });
    reporter.trackLinkClick(item);
    f.clock.advance(2000);
    await Promise.resolve();
    f.clock.advance(60_000);
    expect(f.beacons).toHaveLength(1);
    expect(f.fetches).toHaveLength(1);
    reporter.trackLinkClick(item);
    f.clock.advance(2000);
    expect(f.beacons).toHaveLength(2);
    expect(f.fetches).toHaveLength(2);
  });

  it("sends to the address and with the body of the contract", () => {
    const { f, reporter } = setup();
    reporter.trackLinkClick(item, { placementId: "latest", actorRef: "device-abc" });
    f.clock.advance(2000);
    expect(f.beacons[0]?.url).toBe("https://api.example.com/api/v1/events");
    expect(JSON.parse(f.beacons[0]?.body ?? "")).toEqual({
      platform_id: "listings",
      events: [{ kind: "link_click", item_id: ID, occurred_at: expect.any(String), placement_id: "latest", actor_ref: "device-abc" }],
    });
  });

  it("works when the page-hidden signal cannot be subscribed to", () => {
    const f = fakeEnv();
    delete f.env.onPageHidden;
    const reporter = createReporter(target, f.env);
    reporter.trackLinkClick(item);
    f.clock.advance(2000);
    expect(f.beacons).toHaveLength(1);
  });
});

describe("the session id (spec 005)", () => {
  it("sends the sessionId of a link click as session_id, beside the other options", () => {
    const { f, reporter, sent } = setup();
    reporter.trackLinkClick(item, { placementId: "latest", actorRef: "device-abc", sessionId: "s-1" });
    f.clock.advance(2000);
    expect(sent()).toEqual([
      { platform_id: "listings", events: [{ kind: "link_click", item_id: ID, occurred_at: expect.any(String), placement_id: "latest", actor_ref: "device-abc", session_id: "s-1" }] },
    ]);
  });

  it("sends the sessionId of a view once the view is seen", () => {
    const { f, reporter, sent, see } = setup();
    reporter.watchView(element, item, { sessionId: "s-1" });
    see();
    f.clock.advance(2000);
    expect(sent()[0]?.events).toEqual([{ kind: "view", item_id: ID, occurred_at: expect.any(String), session_id: "s-1" }]);
  });

  it("gives each of five events reported across two sessions the id of its own call, and keeps them five events", () => {
    const { f, reporter, sent } = setup();
    const ids = ["s-a", "s-b", "s-a", "s-b", "s-a"];
    ids.forEach((sessionId, n) => reporter.trackLinkClick({ id: n % 2 === 0 ? ID : ID2 }, { sessionId, placementId: "latest" }));
    f.clock.advance(2000);
    const events = sent().flatMap((batch) => batch.events);
    expect(events).toHaveLength(5);
    expect(events.map((e) => e.session_id)).toEqual(ids);
    expect(events.map((e) => e.placement_id)).toEqual(Array(5).fill("latest"));
  });

  it("still sends the event, without the key, when the sessionId is bad, and warns once with no value in it", () => {
    const { f, reporter, sent } = setup();
    reporter.trackLinkClick(item, { sessionId: "secret-visit".repeat(20) });
    f.clock.advance(2000);
    expect(sent()[0]?.events).toEqual([{ kind: "link_click", item_id: ID, occurred_at: expect.any(String) }]);
    expect(f.warnings).toHaveLength(1);
    expect(f.warnings[0]).not.toContain("secret");
  });

  it("sends a batch whole when one of its events has a bad sessionId, losing none", () => {
    const { f, reporter, sent } = setup();
    reporter.trackLinkClick(item, { sessionId: "ok-1" });
    reporter.trackLinkClick(item, { sessionId: "" });
    reporter.trackLinkClick(item, { sessionId: "ok-3" });
    reporter.trackLinkClick(item);
    f.clock.advance(2000);
    const events = sent().flatMap((batch) => batch.events);
    expect(events.map((e) => e.session_id)).toEqual(["ok-1", undefined, "ok-3", undefined]);
    expect(f.warnings).toHaveLength(1);
  });

  it("remembers nothing between calls: a call with an id, then one with none, sends the id only on the first", () => {
    const { f, reporter, sent, see } = setup();
    reporter.trackLinkClick(item, { sessionId: "s-1" });
    reporter.trackLinkClick(item);
    reporter.watchView(element, item, { sessionId: "s-2" });
    reporter.watchView({ tag: "second" }, { id: ID2 });
    see(0);
    see(1);
    f.clock.advance(2000);
    const events = sent().flatMap((batch) => batch.events);
    expect(events.map((e) => [e.kind, e.item_id, e.session_id])).toEqual([
      ["link_click", ID, "s-1"], ["link_click", ID, undefined], ["view", ID, "s-2"], ["view", ID2, undefined],
    ]);
  });

  it("shares nothing between two reporters", () => {
    const first = setup();
    const second = setup();
    first.reporter.trackLinkClick(item, { sessionId: "s-1" });
    second.reporter.trackLinkClick(item);
    first.f.clock.advance(2000);
    second.f.clock.advance(2000);
    expect(first.sent()[0]?.events[0]?.session_id).toBe("s-1");
    expect(second.sent()[0]?.events[0]).not.toHaveProperty("session_id");
  });
});

describe("reporter with external references (spec 008)", () => {
  const REF = "telegram:addis_news/10234";

  it("sends a link click with external_ref, the options and no item_id", () => {
    const { f, reporter, sent } = setup();
    reporter.trackLinkClick({ externalRef: REF }, { placementId: "telegram", sessionId: "s-1" });
    f.clock.advance(2000);
    expect(sent()[0]?.events).toEqual([{ kind: "link_click", external_ref: REF, occurred_at: expect.any(String), placement_id: "telegram", session_id: "s-1" }]);
  });

  it("sends a view with external_ref once seen, by the same rule as for an item", () => {
    const { f, reporter, sent, see } = setup();
    reporter.watchView(element, { externalRef: REF });
    f.clock.advance(5000);
    expect(f.beacons).toEqual([]);
    see();
    f.clock.advance(2000);
    expect(sent()[0]?.events).toEqual([{ kind: "view", external_ref: REF, occurred_at: expect.any(String) }]);
  });

  it("keeps item and reference events apart in one batch: 50 mixed calls, each with exactly one identifying key", () => {
    const { f, reporter, sent } = setup();
    for (let n = 0; n < 50; n++) {
      if (n % 2 === 0) reporter.trackLinkClick({ id: ID });
      else reporter.trackLinkClick({ externalRef: `ref-${n}` });
    }
    f.clock.advance(2000);
    const events = sent()[0]?.events ?? [];
    expect(events).toHaveLength(50);
    events.forEach((e, n) => {
      expect(["item_id" in e, "external_ref" in e]).toEqual(n % 2 === 0 ? [true, false] : [false, true]);
      if (n % 2 === 1) expect(e.external_ref).toBe(`ref-${n}`);
    });
  });

  it("sends nothing and warns once for a bad reference, and the good events of the batch still go", () => {
    const { f, reporter, sent } = setup();
    reporter.trackLinkClick({ externalRef: "SECRET b" });
    reporter.trackLinkClick({ externalRef: REF });
    reporter.trackLinkClick({ id: ID, externalRef: REF });
    reporter.trackLinkClick({});
    f.clock.advance(2000);
    expect(f.warnings).toHaveLength(3);
    f.warnings.forEach((w) => expect(w).not.toContain("SECRET"));
    expect(sent()[0]?.events).toEqual([{ kind: "link_click", external_ref: REF, occurred_at: expect.any(String) }]);
  });
});

describe("reporter with an eventId (spec 009)", () => {
  const KEY = "5b2f0c4e-9d1a-4e0b-8f7a-3c1d2e4f5a6b";
  const REF = "telegram:addis_news/10234";

  it("sends a click and a seen view with event_id, for an item and for a reference", () => {
    const { f, reporter, sent, see } = setup();
    reporter.trackLinkClick(item, { eventId: "k-1" });
    reporter.trackLinkClick({ externalRef: REF }, { eventId: "k-2" });
    reporter.watchView(element, item, { eventId: "k-3" });
    see();
    reporter.watchView(element, { externalRef: REF }, { eventId: "k-4" });
    see(1);
    f.clock.advance(2000);
    expect(sent().flatMap((body) => body.events).map((e) => [e.kind, e.event_id])).toEqual([["link_click", "k-1"], ["link_click", "k-2"], ["view", "k-3"], ["view", "k-4"]]);
  });

  it("sends the same key on two calls as two events, both with it: the SDK deduplicates nothing", () => {
    const { f, reporter, sent } = setup();
    reporter.trackLinkClick(item, { eventId: KEY });
    reporter.trackLinkClick(item, { eventId: KEY });
    f.clock.advance(2000);
    expect(sent()[0]?.events.map((e) => e.event_id)).toEqual([KEY, KEY]);
  });

  it("sends 50 events across 5 keys, each with the key of its own call", () => {
    const { f, reporter, sent } = setup();
    for (let n = 0; n < 50; n++) {
      const options = { eventId: `key-${n % 5}` };
      if (n % 2 === 0) reporter.trackLinkClick(item, options);
      else reporter.trackLinkClick({ externalRef: `ref-${n}` }, options);
    }
    f.clock.advance(2000);
    const events = sent()[0]?.events ?? [];
    expect(events).toHaveLength(50);
    events.forEach((e, n) => expect(e.event_id).toBe(`key-${n % 5}`));
  });

  it("remembers nothing: a call with a key then one with none; the same item twice with no key is two events", () => {
    const { f, reporter, sent } = setup();
    reporter.trackLinkClick(item, { eventId: "k-1" });
    reporter.trackLinkClick(item);
    reporter.trackLinkClick(item);
    f.clock.advance(2000);
    const events = sent()[0]?.events ?? [];
    expect(events).toHaveLength(3);
    expect(events.map((e) => "event_id" in e)).toEqual([true, false, false]);
  });

  it("shares nothing between two reporters", () => {
    const a = setup();
    const b = setup();
    a.reporter.trackLinkClick(item, { eventId: "k-a" });
    b.reporter.trackLinkClick(item);
    a.f.clock.advance(2000);
    b.f.clock.advance(2000);
    expect(a.sent()[0]?.events[0]?.event_id).toBe("k-a");
    expect(b.sent()[0]?.events[0]).not.toHaveProperty("event_id");
  });

  it("still sends the event, without the key, and warns once without the value, for a bad key; the batch goes whole", () => {
    const { f, reporter, sent } = setup();
    reporter.trackLinkClick(item, { eventId: "SECRET a/b" });
    reporter.trackLinkClick(item, { eventId: KEY });
    f.clock.advance(2000);
    expect(f.warnings).toHaveLength(1);
    expect(f.warnings[0]).not.toContain("SECRET");
    expect(sent()[0]?.events.map((e) => e.event_id)).toEqual([undefined, KEY]);
    expect(sent()[0]?.events[0]).not.toHaveProperty("event_id");
  });
});
