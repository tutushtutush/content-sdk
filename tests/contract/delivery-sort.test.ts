import { fetchPage } from "../../src/fetch-page";
import { errorBody, exampleItem, fakeFetch, target } from "./fixtures/delivery-v1";

// Rules read from content-api specs/020-delivery-sort/contracts/delivery-v1-delta.md (read only). The service
// has one error shape (delivery-v1), so a refused sort or cursor is the same body naming the field in
// details.fields.

describe("delivery sort contract (content-api spec 020)", () => {
  it.each([["popular"], ["newest"], ["oldest"]] as const)("Request: sort=%s is sent as the sort parameter, and nothing the caller did not give", async (sort) => {
    const { fn, calls } = fakeFetch(200, { items: [], next_cursor: null });
    await fetchPage(target, { sort }, { fetch: fn });
    expect(new URL(calls[0].url).search).toBe(`?sort=${sort}`);
  });

  it("Request: only the three values are ever sent; any other is refused before a request", async () => {
    const { fn, calls } = fakeFetch(200, { items: [], next_cursor: null });
    for (const sort of ["views", "relevance", "price", "Popular", ""]) {
      expect(await fetchPage(target, { sort: sort as never }, { fetch: fn })).toMatchObject({ ok: false, error: { kind: "bad_query", fields: ["sort"] } });
    }
    expect(calls).toHaveLength(0);
  });

  it("Request: no sort sends none, so the service keeps its own order", async () => {
    const { fn, calls } = fakeFetch(200, { items: [], next_cursor: null });
    await fetchPage(target, { q: "bike" }, { fetch: fn });
    await fetchPage(target, {}, { fetch: fn });
    expect(calls.map((call) => new URL(call.url).searchParams.has("sort"))).toEqual([false, false]);
  });

  it("Answers: 200 for a popular page is read as any page, in the service's order, items in item-v1 form and no score", async () => {
    const body = { items: [{ ...exampleItem, id: "hot" }, { ...exampleItem, id: "warm" }], next_cursor: "c" };
    const { fn } = fakeFetch(200, body);
    const result = await fetchPage(target, { sort: "popular" }, { fetch: fn });
    if (!result.ok) throw new Error("unexpected error");
    expect(result.page.items.map((item) => item.id)).toEqual(["hot", "warm"]);
    expect(result.page.nextCursor).toBe("c");
    for (const item of result.page.items) expect(Object.keys(item)).not.toContain("score");
  });

  it("Answers: 422 invalid naming sort is a bad_query naming sort with the service's message, and no retry", async () => {
    const body = errorBody("invalid", "request is not valid", { fields: [{ field: "sort", message: "sort must be given once, as one of popular, newest, oldest" }] });
    const { fn, calls } = fakeFetch(422, body);
    const result = await fetchPage(target, { sort: "popular" }, { fetch: fn });
    expect(result).toMatchObject({ ok: false, error: { kind: "bad_query", status: 422, fields: ["sort"], serviceMessage: "request is not valid" } });
    expect(calls).toHaveLength(1);
  });

  it("Answers: 422 invalid naming cursor (a cursor made for another order) is a bad_query naming cursor, and no retry", async () => {
    const body = errorBody("invalid", "request is not valid", { fields: [{ field: "cursor", message: "cursor is not valid for this placement, these filters and this order" }] });
    const { fn, calls } = fakeFetch(422, body);
    const result = await fetchPage(target, { sort: "oldest", cursor: "made-for-popular" }, { fetch: fn });
    expect(result).toMatchObject({ ok: false, error: { kind: "bad_query", status: 422, fields: ["cursor"] } });
    expect(calls).toHaveLength(1);
  });

  it("Answers: a search with a sort is an ordinary page, and an unmatched one is an empty page, not an error", async () => {
    const { fn } = fakeFetch(200, { items: [], next_cursor: null });
    expect(await fetchPage(target, { q: "nomatch", sort: "popular" }, { fetch: fn })).toEqual({ ok: true, page: { items: [], nextCursor: null } });
  });
});
