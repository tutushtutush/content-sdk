import { makeFetchPage, makeReporter, makeTrackLinkClick, makeWatchView } from "../../../src/loader/commands";
import type { Result } from "../../../src/types";

const settings = { baseUrl: "https://api.example.com", platformId: "listings" };
const okResult: Result = { ok: true, page: { items: [], nextCursor: null } };
const failResult: Result = { ok: false, error: { kind: "unknown_placement", message: "m", status: 404 } };

function setup(result: Result = okResult) {
  const calls: Array<{ target: unknown; query: unknown }> = [];
  const warnings: string[] = [];
  const env = { console: { warn: (t: string) => warnings.push(t) } };
  const fetchPage = (async (target: unknown, query: unknown) => {
    calls.push({ target, query });
    return result;
  }) as never;
  return { calls, warnings, method: makeFetchPage(settings, { fetchPage, env }) };
}

describe("makeFetchPage", () => {
  it("calls the delivery client with the tag's settings and the given placement and query", async () => {
    const { calls, method } = setup();
    const query = { limit: 5, tags: ["cars"], languages: ["am"], cursor: "c" };
    await method("latest", query, () => {});
    expect(calls).toEqual([
      { target: { baseUrl: "https://api.example.com", platformId: "listings", placementId: "latest" }, query },
    ]);
  });

  it("passes q in the query to the delivery client unchanged", async () => {
    const { calls, method } = setup();
    const query = { q: "toyota corolla", limit: 5, cursor: "c" };
    await method("latest", query, () => {});
    expect(calls[0]?.query).toBe(query);
  });

  it("gives a bad_query result for q to the callback and the promise like any other result", async () => {
    const bad: Result = { ok: false, error: { kind: "bad_query", message: "m", fields: ["q"] } };
    const { method } = setup(bad);
    const seen: unknown[] = [];
    const returned = await method("latest", { q: "x".repeat(101) }, (r: unknown) => seen.push(r));
    expect(returned).toBe(bad);
    expect(seen).toEqual([bad]);
  });

  it("passes sort in the query to the delivery client unchanged, with the cursor", async () => {
    const { calls, method } = setup();
    const query = { sort: "popular", limit: 5, cursor: "c" };
    await method("latest", query, () => {});
    expect(calls[0]?.query).toBe(query);
  });

  it("gives a bad_query result for sort to the callback and the promise like any other result", async () => {
    const bad: Result = { ok: false, error: { kind: "bad_query", message: "m", fields: ["sort"] } };
    const { method } = setup(bad);
    const seen: unknown[] = [];
    const returned = await method("latest", { sort: "best" }, (r: unknown) => seen.push(r));
    expect(returned).toBe(bad);
    expect(seen).toEqual([bad]);
  });

  it("hands a page whose items carry view_count to the callback and the promise as the very object it got", async () => {
    const item = { id: "a", platform: "p", title: "t", description: "d", language: "am", tags: [], images: [], created_at: "2026-11-13T08:00:00.000Z", url: null, view_count: 1204 };
    const counted: Result = { ok: true, page: { items: [item], nextCursor: null } };
    const { method } = setup(counted);
    const seen: unknown[] = [];
    const returned = await method("latest", {}, (r: unknown) => seen.push(r));
    expect(returned).toBe(counted);
    expect(seen[0]).toBe(counted);
    expect((seen[0] as { page: { items: Array<{ view_count: number }> } }).page.items[0]?.view_count).toBe(1204);
  });

  it("hands a contract_mismatch for a bad count on as it is", async () => {
    const mismatch: Result = { ok: false, error: { kind: "contract_mismatch", message: "The answer does not match the contract: item view_count is not a whole number of 0 or more", status: 200 } };
    const { method } = setup(mismatch);
    const seen: unknown[] = [];
    const returned = await method("latest", {}, (r: unknown) => seen.push(r));
    expect(returned).toBe(mismatch);
    expect(seen).toEqual([mismatch]);
  });

  it("gives the same result to the callback and the promise", async () => {
    const { method } = setup();
    const seen: Result[] = [];
    const returned = await method("latest", {}, (r: Result) => seen.push(r));
    expect(seen).toEqual([okResult]);
    expect(returned).toBe(seen[0]);
  });

  it("passes a failure result through as it is", async () => {
    const { method } = setup(failResult);
    const seen: Result[] = [];
    expect(await method("nope", undefined, (r: Result) => seen.push(r))).toBe(failResult);
    expect(seen[0]).toBe(failResult);
  });

  it("still resolves with no callback or a non-function callback", async () => {
    const { method } = setup();
    expect(await method("latest")).toBe(okResult);
    expect(await method("latest", {}, "x")).toBe(okResult);
    expect(await method("latest", {}, null)).toBe(okResult);
  });
});

describe("makeReporter, makeWatchView and makeTrackLinkClick (spec 004)", () => {
  function fakeReporter() {
    const calls: unknown[][] = [];
    return {
      calls,
      reporter: {
        watchView: (...args: unknown[]) => (calls.push(["watchView", ...args]), () => undefined),
        trackLinkClick: (...args: unknown[]) => void calls.push(["trackLinkClick", ...args]),
      },
    };
  }

  it("makes the reporter from the tag's base address and platform id, over the page's environment", () => {
    const targets: unknown[] = [];
    const envs: unknown[] = [];
    makeReporter(settings, { console: { warn: () => undefined } }, ((target: unknown, env: unknown) => {
      targets.push(target);
      envs.push(env);
      return fakeReporter().reporter;
    }) as never);
    expect(targets).toEqual([{ baseUrl: "https://api.example.com", platformId: "listings" }]);
    expect(typeof (envs[0] as { warn: unknown }).warn).toBe("function");
  });

  it("passes the call's arguments on, and hands back the stop of a watch", () => {
    const { calls, reporter } = fakeReporter();
    const element = {};
    const item = { id: "i" };
    const options = { placementId: "latest" };
    const stop = makeWatchView(reporter as never)(element, item, options);
    expect(typeof stop).toBe("function");
    expect(makeTrackLinkClick(reporter as never)(item, options)).toBeUndefined();
    expect(calls).toEqual([["watchView", element, item, options], ["trackLinkClick", item, options]]);
  });

  it("passes an item with an externalRef and the options on to the reporter unchanged (spec 008)", () => {
    const { calls, reporter } = fakeReporter();
    const element = {};
    const item = { externalRef: "telegram:addis_news/10234" };
    const options = { placementId: "telegram", sessionId: "s-1" };
    makeWatchView(reporter as never)(element, item, options);
    makeTrackLinkClick(reporter as never)(item, options);
    expect(calls).toEqual([["watchView", element, item, options], ["trackLinkClick", item, options]]);
  });

  it("hands the options, a sessionId among them, to the reporter unchanged (spec 005)", () => {
    const { calls, reporter } = fakeReporter();
    const item = { id: "i" };
    const options = { placementId: "latest", actorRef: "device-1", sessionId: "s-1" };
    makeWatchView(reporter as never)({}, item, options);
    makeTrackLinkClick(reporter as never)(item, options);
    expect((calls[0]?.[3] as typeof options)).toBe(options);
    expect((calls[1]?.[2] as typeof options)).toBe(options);
    expect(options).toEqual({ placementId: "latest", actorRef: "device-1", sessionId: "s-1" });
  });
});
