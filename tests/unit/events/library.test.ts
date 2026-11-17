import { createLibrary } from "../../../src/events/library";
import type { PageGlobals } from "../../../src/events/page-env";

const ID = "2f8b6c1e-3b0d-4d8a-9a9e-5a4f1b7c2d10";
const item = { id: ID };
const target = { baseUrl: "https://api.example.com", platformId: "listings" };

function page(extra: Partial<PageGlobals> = {}) {
  const warnings: string[] = [];
  const beacons: { url: string; body: string }[] = [];
  const timers: (() => void)[] = [];
  const globals: PageGlobals = {
    console: { warn: (t) => warnings.push(t) },
    navigator: { sendBeacon: (url, body) => (beacons.push({ url, body }), true) },
    setTimeout: (run) => (timers.push(run), timers.length),
    clearTimeout: () => undefined,
    ...extra,
  };
  return { globals, warnings, beacons, fire: () => timers.splice(0).forEach((t) => t()) };
}

describe("createLibrary", () => {
  it("sends a link click for the target it was given, after the wait", () => {
    const { globals, beacons, fire } = page();
    createLibrary(globals).trackLinkClick(target, item, { placementId: "latest" });
    fire();
    expect(beacons).toHaveLength(1);
    expect(beacons[0]?.url).toBe("https://api.example.com/api/v1/events");
    expect(JSON.parse(beacons[0]?.body ?? "").platform_id).toBe("listings");
  });

  it("keeps one batch per target: two calls for one target leave in one request, another target has its own", () => {
    const { globals, beacons, fire } = page();
    const library = createLibrary(globals);
    library.trackLinkClick(target, item);
    library.trackLinkClick({ ...target }, item);
    library.trackLinkClick({ baseUrl: "https://other.example.com", platformId: "listings" }, item);
    fire();
    expect(beacons.map((b) => b.url).sort()).toEqual(["https://api.example.com/api/v1/events", "https://other.example.com/api/v1/events"]);
    expect(JSON.parse(beacons.find((b) => b.url.startsWith("https://api"))?.body ?? "").events).toHaveLength(2);
  });

  it("accepts a fetch target with a placement id, and ignores the placement id", () => {
    const { globals, beacons, fire } = page();
    createLibrary(globals).trackLinkClick({ ...target, placementId: "latest" } as never, item);
    fire();
    expect(JSON.parse(beacons[0]?.body ?? "").events[0]).not.toHaveProperty("placement_id");
  });

  it("watches nothing, with no throw and no warning, where the page has no observer (Node)", () => {
    const { globals, warnings, beacons, fire } = page();
    const stop = createLibrary(globals).watchView(target, {}, item);
    expect(typeof stop).toBe("function");
    expect(() => stop()).not.toThrow();
    fire();
    expect(beacons).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it("watches when the page has an observer", () => {
    class Observer {
      static made = 0;
      constructor() {
        Observer.made += 1;
      }
      observe(): void {}
      disconnect(): void {}
    }
    const { globals } = page({ IntersectionObserver: Observer as never });
    createLibrary(globals).watchView(target, {}, item);
    expect(Observer.made).toBe(1);
  });

  describe("the session id (spec 005)", () => {
    class SeenObserver {
      static last: SeenObserver | undefined;
      constructor(private readonly callback: (entries: { isIntersecting: boolean; intersectionRatio: number }[]) => void) {
        SeenObserver.last = this;
      }
      observe(): void {}
      disconnect(): void {}
      see(): void {
        this.callback([{ isIntersecting: true, intersectionRatio: 0.9 }]);
      }
    }
    const eventsOf = (beacons: { body: string }[]) => beacons.flatMap((b) => (JSON.parse(b.body) as { events: Record<string, unknown>[] }).events);

    it("sends the sessionId of a link click through the library form, and none when none is given", () => {
      const { globals, beacons, fire } = page();
      const library = createLibrary(globals);
      library.trackLinkClick(target, item, { sessionId: "s-1" });
      library.trackLinkClick(target, item);
      fire();
      const events = eventsOf(beacons);
      expect(events.map((e) => e.session_id)).toEqual(["s-1", undefined]);
      expect(events[1]).not.toHaveProperty("session_id");
    });

    it("sends the sessionId of a view through the library form once the view is seen", () => {
      const { globals, beacons, fire } = page({ IntersectionObserver: SeenObserver as never });
      createLibrary(globals).watchView(target, {}, item, { sessionId: "s-2" });
      SeenObserver.last?.see();
      fire(); // the dwell completes and the event is queued
      fire(); // the batch leaves
      expect(eventsOf(beacons)).toEqual([{ kind: "view", item_id: ID, occurred_at: expect.any(String), session_id: "s-2" }]);
    });

    it("leaves out a bad sessionId with one warning that does not hold it, and still sends the click", () => {
      const { globals, warnings, beacons, fire } = page();
      createLibrary(globals).trackLinkClick(target, item, { sessionId: "secret-visit".repeat(20) });
      fire();
      expect(eventsOf(beacons)).toEqual([{ kind: "link_click", item_id: ID, occurred_at: expect.any(String) }]);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).not.toContain("secret");
    });
  });

  it.each([["missing", undefined], ["null", null], ["a string", "x"], ["a number", 5]])("warns once, returns a stop and sends nothing for a target that is %s", (_name, bad) => {
    const { globals, warnings, beacons, fire } = page();
    const library = createLibrary(globals);
    const stop = library.watchView(bad as never, {}, item);
    library.trackLinkClick(bad as never, item);
    fire();
    expect(typeof stop).toBe("function");
    expect(beacons).toEqual([]);
    expect(warnings).toHaveLength(2);
  });

  it("warns once and sends nothing for a target with an unusable address", () => {
    const { globals, warnings, beacons, fire } = page();
    const library = createLibrary(globals);
    library.trackLinkClick({ baseUrl: "nope", platformId: "listings" }, item);
    library.trackLinkClick({ baseUrl: "nope", platformId: "listings" }, item);
    fire();
    expect(beacons).toEqual([]);
    expect(warnings).toHaveLength(1);
  });

  it("does not throw for a target with a throwing getter", () => {
    const { globals, warnings } = page();
    const hostile = {
      get baseUrl(): string {
        throw new Error("boom");
      },
      platformId: "listings",
    };
    expect(() => createLibrary(globals).trackLinkClick(hostile as never, item)).not.toThrow();
    expect(warnings).toHaveLength(1);
  });
});
