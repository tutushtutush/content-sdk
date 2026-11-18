import { fetchPage } from "../../src/fetch-page";
import { examplePage, exampleItem, fakeFetch, target } from "../contract/fixtures/delivery-v1";

// The sort option (spec 006) through fetchPage: sending, refusing, paging, and never throwing.

const item = (id: string) => ({ ...exampleItem, id });
const BAD: [string, unknown][] = [
  ["another word", "best"],
  ["other case", "Popular"],
  ["all capitals", "NEWEST"],
  ["leading space", " popular"],
  ["trailing space", "popular "],
  ["empty text", ""],
  ["a value the service dropped", "views"],
  ["two values in one text", "popular,newest"],
  ["a number", 5],
  ["true", true],
  ["null", null],
  ["a list", ["popular"]],
  ["an object", {}],
  ["a symbol", Symbol("popular")],
  ["an object whose toString throws", { toString: () => { throw new Error("must not be called"); } }],
  ["a function", () => "popular"],
];

describe("fetchPage: sort", () => {
  it.each([["popular"], ["newest"], ["oldest"]] as const)("sends %s and returns the page as plain data in the service's order", async (sort) => {
    const body = { items: [item("a"), item("b")], next_cursor: null };
    const { fn, calls } = fakeFetch(200, body);
    const result = await fetchPage(target, { sort }, { fetch: fn });
    expect(calls).toHaveLength(1);
    expect(new URL(calls[0].url).search).toBe(`?sort=${sort}`);
    if (!result.ok) throw new Error("unexpected error");
    expect(result.page.items.map((i) => i.id)).toEqual(["a", "b"]);
    // The item's fields: no score (the service's view_count is returned since feature 007).
    for (const shown of result.page.items) expect(Object.keys(shown).sort()).toEqual(["created_at", "description", "id", "images", "language", "platform", "tags", "title", "url", "view_count"]);
  });

  it("sends no sort without one, and the SDK adds no default", async () => {
    const { fn, calls } = fakeFetch(200, examplePage);
    await fetchPage(target, { limit: 5 }, { fetch: fn });
    await fetchPage(target, { sort: undefined }, { fetch: fn });
    expect(calls.map((call) => new URL(call.url).search)).toEqual(["?limit=5", ""]);
  });

  it("sends sort with limit, tags, languages, q and cursor, each in its own form", async () => {
    const { fn, calls } = fakeFetch(200, examplePage);
    await fetchPage(target, { limit: 3, tags: ["cars"], languages: ["am"], q: "corolla", sort: "oldest", cursor: "c" }, { fetch: fn });
    expect(new URL(calls[0].url).search).toBe("?limit=3&tag=cars&language=am&q=corolla&sort=oldest&cursor=c");
  });

  it.each(BAD)("refuses %s as a bad_query naming sort, with no request and no throw", async (_label, sort) => {
    const { fn, calls } = fakeFetch(200, examplePage);
    const result = await fetchPage(target, { sort: sort as never }, { fetch: fn });
    expect(result).toMatchObject({ ok: false, error: { kind: "bad_query", fields: ["sort"] } });
    expect(result.ok === false && "status" in result.error).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("gives bad_query naming sort, with one request and no retry, when the service refuses a sort", async () => {
    const body = { error: { code: "invalid", message: "bad", details: { fields: [{ field: "sort", message: "sort must be one of popular, newest, oldest" }] } } };
    let calls = 0;
    const fake = (async () => {
      calls += 1;
      return { status: 422, text: async () => JSON.stringify(body) };
    }) as unknown as typeof fetch;
    const result = await fetchPage(target, { sort: "popular" }, { fetch: fake });
    expect(result).toMatchObject({ ok: false, error: { kind: "bad_query", status: 422, fields: ["sort"] } });
    expect(calls).toBe(1);
  });
});

describe("fetchPage: paging with a sort", () => {
  const pagedFake = () => {
    const urls: string[] = [];
    const fn = (async (url: string) => {
      urls.push(url);
      const cursor = new URL(url).searchParams.get("cursor");
      const body = cursor === null ? { items: [item("1")], next_cursor: "opaque/c+1" } : { items: [item("2")], next_cursor: null };
      return { status: 200, text: async () => JSON.stringify(body) };
    }) as unknown as typeof fetch;
    return { urls, fn };
  };

  it("passes the same sort with the cursor, both unchanged", async () => {
    const { urls, fn } = pagedFake();
    const first = await fetchPage(target, { sort: "popular", limit: 1 }, { fetch: fn });
    if (!first.ok) throw new Error("unexpected error");
    await fetchPage(target, { sort: "popular", limit: 1, cursor: first.page.nextCursor ?? undefined }, { fetch: fn });
    const second = new URL(urls[1]).searchParams;
    expect(second.get("sort")).toBe("popular");
    expect(second.get("cursor")).toBe("opaque/c+1");
    expect(second.get("limit")).toBe("1");
  });

  it("passes sort, q and the cursor together", async () => {
    const { urls, fn } = pagedFake();
    await fetchPage(target, { q: "bike", sort: "oldest", cursor: "c" }, { fetch: fn });
    const sent = new URL(urls[0]).searchParams;
    expect([sent.get("q"), sent.get("sort"), sent.get("cursor")]).toEqual(["bike", "oldest", "c"]);
  });

  it("remembers nothing between calls: a later call without sort sends no sort and no cursor", async () => {
    const { urls, fn } = pagedFake();
    await fetchPage(target, { sort: "popular", cursor: "c" }, { fetch: fn });
    await fetchPage(target, {}, { fetch: fn });
    expect(new URL(urls[1]).search).toBe("");
  });

  it("gives bad_query naming the cursor, with one request and no retry, when the service refuses a cursor made for another order", async () => {
    const body = { error: { code: "invalid", message: "bad", details: { fields: [{ field: "cursor", message: "cursor is not valid for this placement, these filters and this order" }] } } };
    let calls = 0;
    const fake = (async () => {
      calls += 1;
      return { status: 422, text: async () => JSON.stringify(body) };
    }) as unknown as typeof fetch;
    const result = await fetchPage(target, { sort: "oldest", cursor: "made-for-popular" }, { fetch: fake });
    expect(result).toMatchObject({ ok: false, error: { kind: "bad_query", fields: ["cursor"] } });
    expect(calls).toBe(1);
  });

  it("does not compare the cursor with the sort: the service alone judges it", async () => {
    const { urls, fn } = pagedFake();
    const result = await fetchPage(target, { sort: "newest", cursor: "anything-at-all" }, { fetch: fn });
    expect(result.ok).toBe(true);
    expect(urls).toHaveLength(1);
  });
});
