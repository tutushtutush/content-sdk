import { fetchPage } from "../../src/fetch-page";
import { examplePage, fakeFetch, target } from "../contract/fixtures/delivery-v1";

describe("fetchPage: request", () => {
  it("sends a plain GET without credentials or headers", async () => {
    const { fn, calls } = fakeFetch(200, examplePage);
    const controller = new AbortController();
    await fetchPage(target, { limit: 5 }, { fetch: fn, signal: controller.signal });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://content-api.example.com/api/v1/delivery/listings/latest?limit=5");
    expect(calls[0].init).toEqual({ method: "GET", credentials: "omit", signal: controller.signal });
    expect(calls[0].init).not.toHaveProperty("headers");
  });

  it("uses the injected fetch", async () => {
    const { fn, calls } = fakeFetch(200, examplePage);
    await fetchPage(target, undefined, { fetch: fn });
    expect(calls).toHaveLength(1);
  });

  it("uses the global fetch when none is injected", async () => {
    const { fn, calls } = fakeFetch(200, examplePage);
    const original = globalThis.fetch;
    globalThis.fetch = fn;
    try {
      const result = await fetchPage(target);
      expect(result.ok).toBe(true);
      expect(calls).toHaveLength(1);
    } finally {
      globalThis.fetch = original;
    }
  });
});

const rawFetch = (status: number, text: string | (() => Promise<string>)) =>
  (async () => ({ status, text: typeof text === "string" ? async () => text : text })) as unknown as typeof fetch;

describe("fetchPage: failures", () => {
  it.each([[400], [500], [502], [301], [304], [201], [204]])("status %p is unavailable", async (status) => {
    const result = await fetchPage(target, undefined, { fetch: rawFetch(status, "") });
    expect(result).toMatchObject({ ok: false, error: { kind: "unavailable", status } });
  });

  it.each([[new Error("down")], ["text"], [undefined], [null]])("a rejected fetch (%p) is a network error with the cause", async (cause) => {
    const fake = (async () => {
      throw cause;
    }) as unknown as typeof fetch;
    const result = await fetchPage(target, undefined, { fetch: fake });
    expect(result).toMatchObject({ ok: false, error: { kind: "network" } });
    if (!result.ok) {
      expect(result.error.cause).toBe(cause);
      expect(result.error.aborted).toBeUndefined();
    }
  });

  it("a fetch that throws synchronously is a network error", async () => {
    const fake = (() => {
      throw new Error("sync");
    }) as unknown as typeof fetch;
    expect(await fetchPage(target, undefined, { fetch: fake })).toMatchObject({ ok: false, error: { kind: "network" } });
  });

  it("a signal aborted before the call gives network with aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const fake = (async (_url: string, init?: RequestInit) => {
      if (init?.signal?.aborted) throw new Error("AbortError");
      return { status: 200, text: async () => "{}" };
    }) as unknown as typeof fetch;
    const result = await fetchPage(target, undefined, { fetch: fake, signal: controller.signal });
    expect(result).toMatchObject({ ok: false, error: { kind: "network", aborted: true } });
  });

  it("a signal aborted during the call gives network with aborted", async () => {
    const controller = new AbortController();
    const fake = (() =>
      new Promise((_resolve, reject) => {
        controller.signal.addEventListener("abort", () => reject(new Error("AbortError")));
      })) as unknown as typeof fetch;
    const pending = fetchPage(target, undefined, { fetch: fake, signal: controller.signal });
    controller.abort();
    expect(await pending).toMatchObject({ ok: false, error: { kind: "network", aborted: true } });
  });

  it("a non-JSON 200 body is a contract mismatch", async () => {
    const result = await fetchPage(target, undefined, { fetch: rawFetch(200, "<html>proxy</html>") });
    expect(result).toMatchObject({ ok: false, error: { kind: "contract_mismatch", status: 200 } });
  });

  it("a 200 body of the wrong shape is a contract mismatch, with no partial items", async () => {
    const result = await fetchPage(target, undefined, { fetch: rawFetch(200, JSON.stringify({ items: [{}], next_cursor: null })) });
    expect(result).toMatchObject({ ok: false, error: { kind: "contract_mismatch" } });
    expect(result).not.toHaveProperty("page");
  });

  it.each([["<html>bad gateway</html>"], ["plain text"], [""], ["null"], ['{"error":5}']])(
    "an error body %p still gives the status's kind",
    async (text) => {
      expect(await fetchPage(target, undefined, { fetch: rawFetch(404, text) })).toMatchObject({ ok: false, error: { kind: "unknown_placement" } });
      expect(await fetchPage(target, undefined, { fetch: rawFetch(503, text) })).toMatchObject({ ok: false, error: { kind: "unavailable", status: 503 } });
    },
  );

  it("an error body that cannot be read still gives the status's kind", async () => {
    const fake = rawFetch(403, async () => {
      throw new Error("reset");
    });
    expect(await fetchPage(target, undefined, { fetch: fake })).toMatchObject({ ok: false, error: { kind: "origin_not_allowed" } });
  });

  it("a 200 body that cannot be read is a network error", async () => {
    const fake = rawFetch(200, async () => {
      throw new Error("reset");
    });
    expect(await fetchPage(target, undefined, { fetch: fake })).toMatchObject({ ok: false, error: { kind: "network" } });
  });

  it("the service message is kept but cut to a safe length", async () => {
    const body = JSON.stringify({ error: { code: "x", message: "m".repeat(5000) } });
    const result = await fetchPage(target, undefined, { fetch: rawFetch(503, body) });
    if (result.ok) throw new Error("expected an error");
    expect(result.error.serviceMessage).toHaveLength(500);
  });

  it("refuses bad input without calling fetch", async () => {
    const { fn, calls } = fakeFetch(200, examplePage);
    const result = await fetchPage(target, { limit: 51 }, { fetch: fn });
    expect(result).toMatchObject({ ok: false, error: { kind: "bad_query", fields: ["limit"] } });
    expect(calls).toHaveLength(0);
  });
});

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

describe("fetchPage: inputs", () => {
  it("does not modify frozen target, query or options", async () => {
    const { fn } = fakeFetch(200, examplePage);
    const t = deepFreeze({ ...target });
    const q = deepFreeze({ limit: 5, tags: ["cars"], languages: ["am"], cursor: "c" });
    const o = deepFreeze({ fetch: fn });
    const before = JSON.stringify([t, q]);
    const result = await fetchPage(t, q, o);
    expect(result.ok).toBe(true);
    expect(JSON.stringify([t, q])).toBe(before);
  });
});

describe("fetchPage: q (search)", () => {
  const pageOf = (...ids: string[]) => ({ items: ids.map((id) => ({ ...examplePage.items[0], id })), next_cursor: "c1" });

  it("sends q in one request and returns the service's items in its order", async () => {
    const { fn, calls } = fakeFetch(200, pageOf("b", "a", "c"));
    const result = await fetchPage(target, { q: "toyota corolla" }, { fetch: fn });
    expect(calls).toHaveLength(1);
    expect(new URL(calls[0].url).searchParams.get("q")).toBe("toyota corolla");
    if (!result.ok) throw new Error("unexpected error");
    expect(result.page.items.map((item) => item.id)).toEqual(["b", "a", "c"]);
    expect(result.page.nextCursor).toBe("c1");
  });

  it("answers an empty page for a search as a success", async () => {
    const { fn } = fakeFetch(200, { items: [], next_cursor: null });
    expect(await fetchPage(target, { q: "nothing" }, { fetch: fn })).toEqual({ ok: true, page: { items: [], nextCursor: null } });
  });

  it("requests the same address as a call with no query when q is absent, empty or spaces", async () => {
    const plain = fakeFetch(200, examplePage);
    await fetchPage(target, undefined, { fetch: plain.fn });
    for (const q of [undefined, "", "   "]) {
      const { fn, calls } = fakeFetch(200, examplePage);
      await fetchPage(target, { q }, { fetch: fn });
      expect(calls[0].url).toBe(plain.calls[0].url);
    }
  });

  it("makes no request for a q it refuses", async () => {
    const { fn, calls } = fakeFetch(200, examplePage);
    for (const q of [5, {}, ["a"], null, "x".repeat(101)]) {
      expect(await fetchPage(target, { q } as never, { fetch: fn })).toMatchObject({ ok: false, error: { kind: "bad_query", fields: ["q"] } });
    }
    expect(calls).toHaveLength(0);
  });

  it("gives bad_query naming q when the service refuses the text", async () => {
    const body = { error: { code: "invalid", message: "q must contain at least one word", details: { fields: [{ field: "q", message: "q must contain at least one word" }] } } };
    const { fn, calls } = fakeFetch(422, body);
    const result = await fetchPage(target, { q: "&|!" }, { fetch: fn });
    expect(calls).toHaveLength(1);
    expect(result).toMatchObject({ ok: false, error: { kind: "bad_query", status: 422, fields: ["q"], serviceMessage: "q must contain at least one word" } });
  });
});
