import { fetchPage } from "../../src/fetch-page";
import { exampleItem, fakeFetch, target } from "./fixtures/delivery-v1";

// Rules read from content-api specs/019-item-view-counts/contracts/delivery-v1-delta.md (read only): every
// item carries view_count, a whole number of 0 or more, always present and never null, 0 when the item has
// not been viewed, raw, the same for every placement, and no other count is returned.

const KEYS = ["created_at", "description", "id", "images", "language", "platform", "tags", "title", "url", "view_count"];

describe("item view_count contract (content-api spec 019)", () => {
  it("Answers: the delta's item example is read as an item and returned with its count", async () => {
    const delta = { id: "52fcb106-d6e7-4b92-b4b7-88315cfcbe58", platform: "listings", title: "Toyota Corolla 2012", description: "Clean car", language: "am", tags: ["cars", "for_sale"], images: [{ url: "https://images.example.com/post-images/a.jpg" }], created_at: "2026-11-13T08:00:00.000Z", url: "https://listings.example.com/posts/x", view_count: 1204 };
    const { fn } = fakeFetch(200, { items: [delta], next_cursor: null });
    const result = await fetchPage(target, undefined, { fetch: fn });
    expect(result).toEqual({ ok: true, page: { items: [delta], nextCursor: null } });
  });

  it("Answers: the count is on every item of a page, and the item has exactly the contract's fields", async () => {
    const items = [0, 3, 1204].map((view_count, n) => ({ ...exampleItem, id: `item-${n}`, view_count }));
    const { fn } = fakeFetch(200, { items, next_cursor: "c" });
    const result = await fetchPage(target, undefined, { fetch: fn });
    if (!result.ok) throw new Error("unexpected error");
    expect(result.page.items.map((item) => item.view_count)).toEqual([0, 3, 1204]);
    for (const item of result.page.items) expect(Object.keys(item).sort()).toEqual(KEYS);
    expect(result.page.nextCursor).toBe("c");
  });

  it("Answers: an item never viewed has 0, a number, and no other count (such as click_count) reaches the result", async () => {
    const { fn } = fakeFetch(200, { items: [{ ...exampleItem, view_count: 0, click_count: 9 }], next_cursor: null });
    const result = await fetchPage(target, undefined, { fetch: fn });
    if (!result.ok) throw new Error("unexpected error");
    expect(result.page.items[0]?.view_count).toBe(0);
    expect(Object.keys(result.page.items[0] ?? {})).not.toContain("click_count");
  });

  it("Answers: the count is the same item field whatever the placement, and the request is unchanged", async () => {
    const { fn, calls } = fakeFetch(200, { items: [exampleItem], next_cursor: null });
    await fetchPage({ ...target, placementId: "latest" }, undefined, { fetch: fn });
    await fetchPage({ ...target, placementId: "other" }, undefined, { fetch: fn });
    expect(calls.map((call) => new URL(call.url).search)).toEqual(["", ""]);
  });

  it.each([["null"], ["-1"], ["1.5"], ['"1204"'], ["9007199254740992"], ["1e999"]])("a page whose count is the raw JSON %s is refused whole, as contract_mismatch naming view_count", async (raw) => {
    const text = JSON.stringify({ items: [{ ...exampleItem, view_count: "__COUNT__" }], next_cursor: null }).replace('"__COUNT__"', raw);
    const { fn } = fakeFetch(200, text);
    const result = await fetchPage(target, undefined, { fetch: fn });
    expect(result).toMatchObject({ ok: false, error: { kind: "contract_mismatch", status: 200 } });
    expect(result.ok === false && result.error.message).toContain("view_count");
  });
});
