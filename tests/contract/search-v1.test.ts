import { fetchPage } from "../../src/fetch-page";
import { errorBody, exampleItem, fakeFetch, target } from "./fixtures/delivery-v1";

// Rules read from content-api specs/012-search-q/contracts/search-v1.md (read only). The service has one
// error shape (delivery-v1), so a refused q is the same body naming q in details.fields.

describe("search-v1 contract", () => {
  it("Request: q is sent as the q parameter, and nothing the caller did not give", async () => {
    const { fn, calls } = fakeFetch(200, { items: [], next_cursor: null });
    await fetchPage(target, { q: "toyota corolla" }, { fetch: fn });
    expect(new URL(calls[0].url).search).toBe("?q=toyota+corolla");
  });

  it("Request: q is 1 to 100 characters after trimming, counted as characters", async () => {
    const { fn, calls } = fakeFetch(200, { items: [], next_cursor: null });
    expect((await fetchPage(target, { q: "አ".repeat(100) }, { fetch: fn })).ok).toBe(true);
    expect(await fetchPage(target, { q: "አ".repeat(101) }, { fetch: fn })).toMatchObject({ ok: false, error: { kind: "bad_query", fields: ["q"] } });
    expect(calls).toHaveLength(1);
  });

  it("Answers: 422 invalid naming q (empty, too long, no word) is a bad_query naming q with the service's message", async () => {
    const body = errorBody("invalid", "request is not valid", { fields: [{ field: "q", message: "q must contain at least one word (letters or digits)" }] });
    const { fn } = fakeFetch(422, body);
    const result = await fetchPage(target, { q: "&|!" }, { fetch: fn });
    expect(result).toMatchObject({ ok: false, error: { kind: "bad_query", status: 422, fields: ["q"], serviceMessage: "request is not valid" } });
  });

  it("Answers: 200 for a search is read as any page, in the service's order (best match first), items in item-v1 form", async () => {
    const body = { items: [{ ...exampleItem, id: "best" }, { ...exampleItem, id: "next" }], next_cursor: "c" };
    const { fn } = fakeFetch(200, body);
    const result = await fetchPage(target, { q: "corolla" }, { fetch: fn });
    if (!result.ok) throw new Error("unexpected error");
    expect(result.page.items.map((i) => i.id)).toEqual(["best", "next"]);
    expect(result.page.nextCursor).toBe("c");
  });

  it("Answers: an unmatched search is an empty page, not an error", async () => {
    const { fn } = fakeFetch(200, { items: [], next_cursor: null });
    expect(await fetchPage(target, { q: "nomatch" }, { fetch: fn })).toEqual({ ok: true, page: { items: [], nextCursor: null } });
  });

  it("Answers: a field the service adds to a search answer is ignored", async () => {
    const { fn } = fakeFetch(200, { items: [{ ...exampleItem, score: 0.9 }], next_cursor: null, total: 1 });
    const result = await fetchPage(target, { q: "corolla" }, { fetch: fn });
    if (!result.ok) throw new Error("unexpected error");
    expect(result.page.items[0]).not.toHaveProperty("score");
    expect(result.page).not.toHaveProperty("total");
  });
});
