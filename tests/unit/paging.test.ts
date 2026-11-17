import { fetchPage } from "../../src/fetch-page";
import type { Query } from "../../src/types";
import { exampleItem, target } from "../contract/fixtures/delivery-v1";

const item = (id: string) => ({ ...exampleItem, id });

describe("paging", () => {
  it("walks three pages in order, once each", async () => {
    const pages: Record<string, unknown> = {
      "": { items: [item("1"), item("2")], next_cursor: "c1" },
      c1: { items: [item("3"), item("4")], next_cursor: "c2" },
      c2: { items: [item("5")], next_cursor: null },
    };
    const urls: string[] = [];
    const fake = (async (url: string) => {
      urls.push(url);
      const cursor = new URL(url).searchParams.get("cursor") ?? "";
      return { status: 200, text: async () => JSON.stringify(pages[cursor]) };
    }) as unknown as typeof fetch;

    const seen: string[] = [];
    let query: Query = { limit: 2, tags: ["cars"] };
    for (;;) {
      const result = await fetchPage(target, query, { fetch: fake });
      if (!result.ok) throw new Error("unexpected error");
      seen.push(...result.page.items.map((i) => i.id));
      if (result.page.nextCursor === null) break;
      query = { ...query, cursor: result.page.nextCursor };
    }

    expect(seen).toEqual(["1", "2", "3", "4", "5"]);
    expect(urls).toHaveLength(3);
    for (const u of urls) {
      expect(new URL(u).searchParams.get("limit")).toBe("2");
      expect(new URL(u).searchParams.get("tag")).toBe("cars");
    }
    expect(new URL(urls[1]).searchParams.get("cursor")).toBe("c1");
    expect(new URL(urls[2]).searchParams.get("cursor")).toBe("c2");
  });

  it("pages a search by passing the same q with the cursor, both unchanged", async () => {
    const urls: string[] = [];
    const fake = (async (url: string) => {
      urls.push(url);
      const cursor = new URL(url).searchParams.get("cursor");
      const body = cursor === null ? { items: [item("1")], next_cursor: "opaque/c+1" } : { items: [item("2")], next_cursor: null };
      return { status: 200, text: async () => JSON.stringify(body) };
    }) as unknown as typeof fetch;
    const first = await fetchPage(target, { q: "toyota corolla", limit: 1 }, { fetch: fake });
    if (!first.ok) throw new Error("unexpected error");
    await fetchPage(target, { q: "toyota corolla", limit: 1, cursor: first.page.nextCursor ?? undefined }, { fetch: fake });
    const second = new URL(urls[1]).searchParams;
    expect(second.get("q")).toBe("toyota corolla");
    expect(second.get("cursor")).toBe("opaque/c+1");
    expect(second.get("limit")).toBe("1");
  });

  it("remembers nothing between calls: a later call without q sends none", async () => {
    const urls: string[] = [];
    const fake = (async (url: string) => {
      urls.push(url);
      return { status: 200, text: async () => JSON.stringify({ items: [], next_cursor: null }) };
    }) as unknown as typeof fetch;
    await fetchPage(target, { q: "bike", cursor: "c" }, { fetch: fake });
    await fetchPage(target, {}, { fetch: fake });
    expect(new URL(urls[1]).search).toBe("");
  });

  it("gives bad_query naming the cursor, with one request and no retry, when the service refuses a cursor made for another q", async () => {
    const body = { error: { code: "invalid", message: "bad", details: { fields: [{ field: "cursor", message: "cursor is not valid for this placement and these filters" }] } } };
    let calls = 0;
    const fake = (async () => {
      calls += 1;
      return { status: 422, text: async () => JSON.stringify(body) };
    }) as unknown as typeof fetch;
    const result = await fetchPage(target, { q: "other", cursor: "made-for-another-q" }, { fetch: fake });
    expect(result).toMatchObject({ ok: false, error: { kind: "bad_query", fields: ["cursor"] } });
    expect(calls).toBe(1);
  });

  it("gives bad_query for a cursor the service refuses", async () => {
    const body = { error: { code: "invalid", message: "bad", details: { fields: [{ field: "cursor", message: "no" }] } } };
    const fake = (async () => ({ status: 422, text: async () => JSON.stringify(body) })) as unknown as typeof fetch;
    const result = await fetchPage(target, { cursor: "old" }, { fetch: fake });
    expect(result).toMatchObject({ ok: false, error: { kind: "bad_query", fields: ["cursor"] } });
  });
});
