import { fetchPage } from "../../src/fetch-page";
import { emptyPage, exampleItem, examplePage, fakeFetch, target } from "./fixtures/delivery-v1";

describe("delivery-v1 success answers", () => {
  it("returns the example answer as plain data", async () => {
    const { fn } = fakeFetch(200, examplePage);
    const result = await fetchPage(target, undefined, { fetch: fn });
    expect(result).toEqual({ ok: true, page: { items: [exampleItem], nextCursor: null } });
  });

  it("returns an empty page as a success", async () => {
    const { fn } = fakeFetch(200, emptyPage);
    const result = await fetchPage(target, undefined, { fetch: fn });
    expect(result).toEqual({ ok: true, page: { items: [], nextCursor: null } });
  });
});

describe("unknown fields", () => {
  it("are absent from the result at every level", async () => {
    const body = {
      items: [{ ...exampleItem, author_ref: "secret", images: [{ url: "https://i.example.com/a.jpg", extra: 1 }], later: { a: 1 } }],
      next_cursor: null,
      total: 99,
    };
    const { fn } = fakeFetch(200, body);
    const result = await fetchPage(target, undefined, { fetch: fn });
    expect(result).toStrictEqual({
      ok: true,
      page: { items: [{ ...exampleItem, images: [{ url: "https://i.example.com/a.jpg" }] }], nextCursor: null },
    });
  });

  it("keys such as __proto__ and constructor in the body do not reach the result", async () => {
    const text =
      '{"__proto__":{"polluted":true},"constructor":1,"items":[{"__proto__":{"x":1},"constructor":"c",' +
      JSON.stringify(exampleItem).slice(1) +
      '],"next_cursor":null}';
    const { fn } = fakeFetch(200, text);
    const result = await fetchPage(target, undefined, { fetch: fn });
    if (!result.ok) throw new Error(`unexpected ${result.error.kind}`);
    const item = result.page.items[0];
    expect(Object.keys(item).sort()).toEqual(
      ["created_at", "description", "id", "images", "language", "platform", "tags", "title", "url", "view_count"],
    );
    expect(Object.getPrototypeOf(item)).toBe(Object.prototype);
    expect((item as unknown as { x?: number }).x).toBeUndefined();
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });
});
