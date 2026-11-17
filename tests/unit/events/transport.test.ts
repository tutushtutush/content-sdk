import { createTransport } from "../../../src/events/transport";
import type { EventRecord } from "../../../src/events/rules";
import { fakeEnv } from "./helpers";

const ID = "2f8b6c1e-3b0d-4d8a-9a9e-5a4f1b7c2d10";
const event: EventRecord = { kind: "view", item_id: ID, occurred_at: "2026-11-17T08:00:00.000Z" };
const target = { baseUrl: "https://api.example.com", platformId: "listings" };
const BODY = JSON.stringify({ platform_id: "listings", events: [event] });

describe("createTransport: address and body", () => {
  it("posts to {base}/api/v1/events with the platform id and the events as one JSON text", () => {
    const f = fakeEnv();
    createTransport(target, f.env).send([event]);
    expect(f.beacons).toEqual([{ url: "https://api.example.com/api/v1/events", body: BODY }]);
  });

  it.each([
    ["https://api.example.com/", "https://api.example.com/api/v1/events"],
    ["https://api.example.com//", "https://api.example.com/api/v1/events"],
    ["https://api.example.com/content", "https://api.example.com/content/api/v1/events"],
    ["https://api.example.com/content/", "https://api.example.com/content/api/v1/events"],
    ["http://localhost:4000", "http://localhost:4000/api/v1/events"],
  ])("builds the address for the base %s", (baseUrl, expected) => {
    const f = fakeEnv();
    createTransport({ baseUrl, platformId: "listings" }, f.env).send([event]);
    expect(f.beacons[0]?.url).toBe(expected);
  });

  it.each([
    ["not http or https", "ftp://api.example.com"],
    ["with a query", "https://api.example.com/?a=1"],
    ["with a fragment", "https://api.example.com/#x"],
    ["empty", ""],
    ["not an address", "not a url"],
  ])("sends nothing and warns once when the base is %s", (_name, baseUrl) => {
    const f = fakeEnv();
    const transport = createTransport({ baseUrl, platformId: "listings" }, f.env);
    transport.send([event]);
    transport.send([event]);
    expect(f.beacons).toEqual([]);
    expect(f.fetches).toEqual([]);
    expect(f.warnings).toHaveLength(1);
    expect(f.warnings[0]).toMatch(/^\[content-sdk\] /);
  });

  it("sends nothing and warns once when the platform id is unusable", () => {
    const f = fakeEnv();
    const transport = createTransport({ baseUrl: "https://api.example.com", platformId: "" }, f.env);
    transport.send([event]);
    expect(f.beacons).toEqual([]);
    expect(f.warnings).toHaveLength(1);
  });

  it("sends nothing for an empty list", () => {
    const f = fakeEnv();
    createTransport(target, f.env).send([]);
    expect(f.beacons).toEqual([]);
    expect(f.fetches).toEqual([]);
  });
});

describe("createTransport: beacon first, one fetch after", () => {
  it("makes no fetch when the beacon takes the body", () => {
    const f = fakeEnv();
    createTransport(target, f.env).send([event]);
    expect(f.fetches).toEqual([]);
  });

  it.each([
    ["is missing", { beacon: false as const }],
    ["returns false", { beacon: () => false }],
    ["throws", { beacon: () => { throw new Error("no"); } }],
  ])("sends once as a keep-alive fetch when the beacon %s", (_name, options) => {
    const f = fakeEnv(options);
    createTransport(target, f.env).send([event]);
    expect(f.fetches).toEqual([
      {
        url: "https://api.example.com/api/v1/events",
        init: { method: "POST", body: BODY, keepalive: true, credentials: "omit", headers: { "content-type": "text/plain;charset=UTF-8" } },
      },
    ]);
  });

  it("swallows a fetch that throws or rejects, and a result that is not a promise", async () => {
    for (const fetch of [() => { throw new Error("x"); }, () => Promise.reject(new Error("y")), () => undefined, () => 5]) {
      const f = fakeEnv({ beacon: false, fetch });
      expect(() => createTransport(target, f.env).send([event])).not.toThrow();
      await Promise.resolve();
      expect(f.warnings).toEqual([]);
    }
  });

  it("warns once, and sends nothing, when neither a beacon nor a fetch exists", () => {
    const f = fakeEnv({ beacon: false, fetch: false });
    const transport = createTransport(target, f.env);
    transport.send([event]);
    transport.send([event]);
    expect(f.warnings).toHaveLength(1);
  });

  it("never retries: a refused beacon and a rejected fetch mean one attempt each", async () => {
    const f = fakeEnv({ beacon: () => false, fetch: () => Promise.reject(new Error("down")) });
    createTransport(target, f.env).send([event]);
    await Promise.resolve();
    f.clock.advance(60_000);
    expect(f.beacons).toHaveLength(1);
    expect(f.fetches).toHaveLength(1);
  });

  it("returns at once and does not wait for the answer", () => {
    const f = fakeEnv({ beacon: false, fetch: () => new Promise(() => undefined) });
    expect(createTransport(target, f.env).send([event])).toBeUndefined();
  });

  it("keeps working after a failure", () => {
    const f = fakeEnv({ beacon: () => { throw new Error("no"); }, fetch: () => { throw new Error("no"); } });
    const transport = createTransport(target, f.env);
    transport.send([event]);
    transport.send([event]);
    expect(f.fetches).toHaveLength(2);
  });
});
