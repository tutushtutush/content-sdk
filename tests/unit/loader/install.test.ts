import { install } from "../../../src/loader/install";
import { fakeEnv, GOOD } from "./helpers";

describe("install: success path", () => {
  it("creates the stub when the page has none, with fetchPage and q only", () => {
    const { env, warnings } = fakeEnv(GOOD);
    install(env);
    const sdk = env.contentSdk as Record<string, unknown>;
    expect(Object.keys(sdk).sort()).toEqual(["fetchPage", "q"]);
    expect(Array.isArray(sdk.q)).toBe(true);
    expect(typeof sdk.fetchPage).toBe("function");
    expect(warnings).toEqual([]);
  });

  it("reuses the page's stub", () => {
    const stub = { q: [] as unknown[] };
    const { env } = fakeEnv(GOOD, stub);
    install(env);
    expect(env.contentSdk).toBe(stub);
    expect(typeof (stub as Record<string, unknown>).fetchPage).toBe("function");
  });
});

// A fake delivery client that answers at once and records the order of calls.
import * as client from "../../../src/fetch-page";

const okPage = (id: string) => ({ ok: true as const, page: { items: [], nextCursor: id } });

function stubDelivery() {
  const calls: string[] = [];
  const spy = jest.spyOn(client, "fetchPage").mockImplementation((async (target: { placementId: string }) => {
    calls.push(target.placementId);
    return okPage(target.placementId);
  }) as never);
  return { calls, spy };
}

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

describe("install: queue replay", () => {
  afterEach(() => jest.restoreAllMocks());

  it("starts 20 queued commands once each, in the order pushed", async () => {
    const { calls } = stubDelivery();
    const seen: string[] = [];
    const q = Array.from({ length: 20 }, (_v, i) => ["fetchPage", `p${i}`, {}, (r: { page: { nextCursor: string } }) => seen.push(r.page.nextCursor)]);
    const { env } = fakeEnv(GOOD, { q });
    install(env);
    await flush();
    expect(calls).toEqual(Array.from({ length: 20 }, (_v, i) => `p${i}`));
    expect(seen).toEqual(calls);
  });

  it("runs a command pushed from inside a callback, after the earlier ones", async () => {
    const { calls } = stubDelivery();
    const stub = { q: [] as unknown[] };
    stub.q.push(["fetchPage", "first", {}, () => stub.q.push(["fetchPage", "from-callback"])], ["fetchPage", "second"]);
    const { env } = fakeEnv(GOOD, stub);
    install(env);
    await flush();
    expect(calls).toEqual(["first", "second", "from-callback"]);
  });

  it("runs a command pushed after load at once", async () => {
    const { calls } = stubDelivery();
    const stub = { q: [] as unknown[] };
    const { env } = fakeEnv(GOOD, stub);
    install(env);
    expect(typeof stub.q.push(["fetchPage", "late"])).toBe("number");
    await flush();
    expect(calls).toEqual(["late"]);
  });

  it("empties the queue so nothing is replayed twice", () => {
    stubDelivery();
    const stub = { q: [["fetchPage", "a"]] as unknown[] };
    const { env } = fakeEnv(GOOD, stub);
    install(env);
    expect(stub.q).toHaveLength(0);
  });

  it("a throwing callback does not stop later commands and warns once each", async () => {
    const { calls } = stubDelivery();
    const boom = () => {
      throw new Error("boom");
    };
    const { env, warnings } = fakeEnv(GOOD, { q: [["fetchPage", "a", {}, boom], ["fetchPage", "b", {}, boom], ["fetchPage", "c"]] });
    install(env);
    await flush();
    expect(calls).toEqual(["a", "b", "c"]);
    expect(warnings).toEqual(["[content-sdk] A fetchPage callback threw: boom", "[content-sdk] A fetchPage callback threw: boom"]);
  });

  it("a callback that rejects warns once and changes nothing else", async () => {
    stubDelivery();
    const { env, warnings } = fakeEnv(GOOD, { q: [["fetchPage", "a", {}, () => Promise.reject(new Error("late"))]] });
    install(env);
    await flush();
    expect(warnings).toEqual(["[content-sdk] A fetchPage callback threw: late"]);
  });

  it("reads the attributes before it replays", async () => {
    const order: string[] = [];
    stubDelivery();
    const { env } = fakeEnv(GOOD, { q: [["fetchPage", "a"]] });
    const script = env.document?.currentScript as { getAttribute: (n: string) => string | null };
    const original = script.getAttribute;
    script.getAttribute = (n) => {
      order.push(`read ${n}`);
      return original(n);
    };
    jest.spyOn(client, "fetchPage").mockImplementation((async () => {
      order.push("fetch");
      return okPage("x");
    }) as never);
    install(env);
    await flush();
    expect(order.indexOf("fetch")).toBeGreaterThan(order.lastIndexOf("read data-platform-id"));
  });
});

describe("install: bad entries", () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([["x"], [null], [5], [[]], [[5]], [[null, "a"]]])("warns once about the entry %p and still runs the good ones", async (bad) => {
    const { calls } = stubDelivery();
    const { env, warnings } = fakeEnv(GOOD, { q: [["fetchPage", "a"], bad, ["fetchPage", "b"]] });
    install(env);
    await flush();
    expect(calls).toEqual(["a", "b"]);
    expect(warnings).toEqual(["[content-sdk] Bad queue entry: expected [name, ...args]."]);
  });

  it.each([["nope"], ["constructor"], ["__proto__"], ["toString"], ["hasOwnProperty"]])("warns once about the unknown command %p", async (name) => {
    const { calls } = stubDelivery();
    const { env, warnings } = fakeEnv(GOOD, { q: [[name], ["fetchPage", "a"]] });
    install(env);
    await flush();
    expect(calls).toEqual(["a"]);
    expect(warnings).toEqual([`[content-sdk] Unknown command: ${name}`]);
  });

  it("clips a long command name to 40 characters", () => {
    const { env, warnings } = fakeEnv(GOOD, { q: [["x".repeat(200)]] });
    install(env);
    expect(warnings).toEqual([`[content-sdk] Unknown command: ${"x".repeat(40)}`]);
  });
});

describe("install: the stub and a second load", () => {
  afterEach(() => jest.restoreAllMocks());

  it("works with no stub", async () => {
    const { calls } = stubDelivery();
    const { env } = fakeEnv(GOOD);
    install(env);
    await (env.contentSdk as { fetchPage: (p: string) => Promise<unknown> }).fetchPage("a");
    expect(calls).toEqual(["a"]);
  });

  it("replaces a q that is not an array", () => {
    const stub = { q: "nope" as unknown };
    const { env } = fakeEnv(GOOD, stub);
    install(env);
    expect(Array.isArray(stub.q)).toBe(true);
  });

  it("a second load warns once, does not replay and does not replace fetchPage", async () => {
    const { calls } = stubDelivery();
    const stub = { q: [["fetchPage", "a"]] as unknown[] };
    const first = fakeEnv(GOOD, stub);
    install(first.env);
    const method = (stub as { fetchPage?: unknown }).fetchPage;
    stub.q.push(["fetchPage", "b"]);
    await flush();
    const second = fakeEnv(GOOD, stub);
    install(second.env);
    await flush();
    expect(second.warnings).toEqual(["[content-sdk] The script was loaded twice; the second load was ignored."]);
    expect((stub as { fetchPage?: unknown }).fetchPage).toBe(method);
    expect(calls).toEqual(["a", "b"]);
  });
});

const URL_ATTR = "data-api-base-url";
const ID_ATTR = "data-platform-id";
const missingText = (names: string) => `[content-sdk] Missing ${names} on the content-sdk <script> tag. Nothing will be fetched.`;

describe("install: misconfiguration", () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([
    ["base address missing", { [ID_ATTR]: "listings" }, URL_ATTR],
    ["base address empty", { [URL_ATTR]: "", [ID_ATTR]: "listings" }, URL_ATTR],
    ["base address blank", { [URL_ATTR]: "  ", [ID_ATTR]: "listings" }, URL_ATTR],
    ["platform id missing", { [URL_ATTR]: "https://api.example.com" }, ID_ATTR],
    ["platform id empty", { [URL_ATTR]: "https://api.example.com", [ID_ATTR]: "" }, ID_ATTR],
    ["platform id blank", { [URL_ATTR]: "https://api.example.com", [ID_ATTR]: " \t" }, ID_ATTR],
    ["both missing", {}, `${URL_ATTR} and ${ID_ATTR}`],
  ])("%s: one warning, nothing installed, queue untouched", async (_n, attrs, names) => {
    const { calls } = stubDelivery();
    const queue = [["fetchPage", "a"]];
    const stub = { q: queue };
    const { env, warnings } = fakeEnv(attrs, stub);
    expect(() => install(env)).not.toThrow();
    await flush();
    expect(warnings).toEqual([missingText(names)]);
    expect(stub).toEqual({ q: [["fetchPage", "a"]] });
    expect(stub.q).toBe(queue);
    expect(calls).toEqual([]);
  });

  it("creates nothing on the page when there was no stub", () => {
    const { env, warnings } = fakeEnv({});
    install(env);
    expect(env.contentSdk).toBeUndefined();
    expect(warnings).toHaveLength(1);
  });

  it("no script tag found gives the both-missing warning", () => {
    const { env, warnings } = fakeEnv(null);
    install(env);
    expect(warnings).toEqual([missingText(`${URL_ATTR} and ${ID_ATTR}`)]);
  });

  it("no document at all gives the both-missing warning", () => {
    const warnings: string[] = [];
    install({ console: { warn: (t) => warnings.push(t) } });
    expect(warnings).toEqual([missingText(`${URL_ATTR} and ${ID_ATTR}`)]);
  });

  it.each([["not a url"], ["ftp://x.example.com"], ["https://gw.example.com/x?key=1"]])(
    "an unusable base address %p is accepted at load and gives invalid_target on a call",
    async (baseUrl) => {
      const { env, warnings } = fakeEnv({ [URL_ATTR]: baseUrl, [ID_ATTR]: "listings" });
      install(env);
      const seen: unknown[] = [];
      const sdk = env.contentSdk as { fetchPage: (p: string, q: undefined, cb: (r: unknown) => void) => Promise<unknown> };
      const result = await sdk.fetchPage("latest", undefined, (r) => seen.push(r));
      expect(result).toMatchObject({ ok: false, error: { kind: "invalid_target", fields: ["baseUrl"] } });
      expect(seen).toEqual([result]);
      expect(warnings).toEqual([]);
    },
  );

  it("odd arguments never throw", async () => {
    const { env } = fakeEnv(GOOD);
    install(env);
    const sdk = env.contentSdk as { fetchPage: (...a: unknown[]) => Promise<unknown> };
    for (const args of [[], [5], [null, "x"], ["a", "limit=5"], ["a", { limit: "5" }], ["a", { tags: 5 }]]) {
      await expect(sdk.fetchPage(...args)).resolves.toMatchObject({ ok: false });
    }
  });

  it("an env with no console does not throw", () => {
    expect(() => install({ document: { currentScript: { getAttribute: () => null } } })).not.toThrow();
  });
});

describe("install: last guards", () => {
  it("a command that throws is one warning with its name and message, and later commands run", () => {
    const { makeRunner } = jest.requireActual("../../../src/loader/commands") as typeof import("../../../src/loader/commands");
    const warnings: string[] = [];
    const ran: string[] = [];
    const run = makeRunner(
      {
        bad: () => {
          throw new Error("kaput");
        },
        good: () => ran.push("good"),
      },
      { console: { warn: (t) => warnings.push(t) } },
    );
    expect(() => {
      run(["bad"]);
      run(["good"]);
    }).not.toThrow();
    expect(warnings).toEqual(["[content-sdk] Command bad failed: kaput"]);
    expect(ran).toEqual(["good"]);
  });

  it("an env whose page access throws is one warning and no exception", () => {
    const warnings: string[] = [];
    const env = {
      console: { warn: (t: string) => warnings.push(t) },
      get document(): never {
        throw new Error("blocked");
      },
    };
    expect(() => install(env)).not.toThrow();
    expect(warnings).toEqual(["[content-sdk] The loader failed to start: blocked"]);
  });
});
