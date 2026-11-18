import { fetchPage } from "../../src/fetch-page";
import { parsePage } from "../../src/validate";
import { examplePage, exampleItem, fakeFetch, target } from "../contract/fixtures/delivery-v1";

// The item's view_count (spec 007): returned as the service sent it, and required. A missing or wrong
// count refuses the whole page, never a default and never a partial page.

const page = (...counts: unknown[]) => ({ items: counts.map((view_count, n) => ({ ...exampleItem, id: `item-${n}`, view_count })), next_cursor: null });
const problem = (body: unknown) => {
  const r = parsePage(body);
  if (!("problem" in r)) throw new Error("expected a problem");
  return r.problem;
};

describe("parsePage: view_count", () => {
  it.each([[0], [1], [7], [1204], [Number.MAX_SAFE_INTEGER]])("returns %p exactly as given", (count) => {
    const parsed = parsePage(page(count));
    if (!("page" in parsed)) throw new Error("expected a page");
    expect(parsed.page.items[0]?.view_count).toBe(count);
  });

  it("returns the counts of several items in the service's order, with the other fields as before", () => {
    const parsed = parsePage(page(1204, 0, 7));
    if (!("page" in parsed)) throw new Error("expected a page");
    expect(parsed.page.items.map((item) => [item.id, item.view_count])).toEqual([["item-0", 1204], ["item-1", 0], ["item-2", 7]]);
    expect(Object.keys(parsed.page.items[0] ?? {}).sort()).toEqual(["created_at", "description", "id", "images", "language", "platform", "tags", "title", "url", "view_count"]);
  });

  it("returns -0 as 0, and does not take 0 for missing", () => {
    const parsed = parsePage(page(-0, 0));
    if (!("page" in parsed)) throw new Error("expected a page");
    expect(parsed.page.items.map((item) => Object.is(item.view_count, 0))).toEqual([true, true]);
  });

  const noCount: Record<string, unknown> = { ...exampleItem };
  delete noCount.view_count;
  const hostile = { toString: () => { throw new Error("must not be called"); }, valueOf: () => { throw new Error("must not be called"); } };
  const BAD: [string, unknown][] = [
    ["a missing key", undefined],
    ["null", null],
    ["a text", "abc"],
    ["a numeric text", "5"],
    ["true", true],
    ["a list", [1]],
    ["an object", {}],
    ["a negative number", -1],
    ["a fraction", 1.5],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["-Infinity", Number.NEGATIVE_INFINITY],
    ["2 ** 53", 2 ** 53],
    ["1e300", 1e300],
    ["a symbol", Symbol("5")],
    ["a function", () => 5],
    ["an object whose conversions throw", hostile],
    ["a Proxy", new Proxy({}, { get() { throw new Error("must not be read"); } })],
  ];

  it.each(BAD)("refuses %s, naming view_count, and never throws", (_label, value) => {
    const body = value === undefined ? { items: [noCount], next_cursor: null } : page(value);
    expect(problem(body)).toBe("item view_count is not a whole number of 0 or more");
  });

  it("refuses the whole page when one item of several has a bad count, returning none", () => {
    expect(problem(page(1, "x", 3))).toContain("view_count");
    expect("page" in parsePage(page(1, "x", 3))).toBe(false);
  });

  it("says nothing from the item in the problem", () => {
    const body = { items: [{ ...exampleItem, title: "SECRET-TITLE", view_count: "SECRET-COUNT" }], next_cursor: null };
    expect(problem(body)).not.toMatch(/SECRET/);
  });
});

// A JSON body with the raw text of a value in place of the first item's count, for values JSON.stringify would change.
const bodyWith = (raw: string, items = 1) => JSON.stringify({ items: Array.from({ length: items }, (_, n) => ({ ...exampleItem, id: `item-${n}`, view_count: "__COUNT__" })), next_cursor: null }).replace('"__COUNT__"', raw);

describe("fetchPage: view_count", () => {
  it("returns the counts of a page as numbers, in order, not formatted or summed", async () => {
    const { fn } = fakeFetch(200, page(1204, 0, 7));
    const result = await fetchPage(target, undefined, { fetch: fn });
    if (!result.ok) throw new Error("unexpected error");
    expect(result.page.items.map((item) => item.view_count)).toEqual([1204, 0, 7]);
    expect(typeof result.page.items[0]?.view_count).toBe("number");
  });

  it("returns the count of the contract example", async () => {
    const { fn } = fakeFetch(200, examplePage);
    const result = await fetchPage(target, undefined, { fetch: fn });
    expect(result).toEqual({ ok: true, page: { items: [exampleItem], nextCursor: null } });
  });

  it("returns the counts with every option, and sends the address 0.6.0 sent", async () => {
    const { fn, calls } = fakeFetch(200, page(5));
    const result = await fetchPage(target, { limit: 3, tags: ["cars"], languages: ["am"], q: "bike", sort: "popular", cursor: "c" }, { fetch: fn });
    expect(new URL(calls[0].url).search).toBe("?limit=3&tag=cars&language=am&q=bike&sort=popular&cursor=c");
    expect(result.ok && result.page.items[0]?.view_count).toBe(5);
  });

  it.each([["1e999"], ["1e300"], ["9007199254740992"], ["-1"], ["1.5"], ['"5"'], ['"abc"'], ["true"], ["[1]"], ["{}"], ["null"]])("refuses a page whose count is the raw JSON %s, as contract_mismatch, once", async (raw) => {
    const { fn, calls } = fakeFetch(200, bodyWith(raw));
    const result = await fetchPage(target, undefined, { fetch: fn });
    expect(result).toMatchObject({ ok: false, error: { kind: "contract_mismatch", status: 200 } });
    expect(result.ok === false && result.error.message).toContain("view_count");
    expect("page" in result).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it("refuses a page whose item has no count at all", async () => {
    const noCount = { ...exampleItem } as Record<string, unknown>;
    delete noCount.view_count;
    const { fn } = fakeFetch(200, { items: [noCount], next_cursor: null });
    expect(await fetchPage(target, undefined, { fetch: fn })).toMatchObject({ ok: false, error: { kind: "contract_mismatch" } });
  });

  it("refuses the whole page when only the last of three items is bad", async () => {
    const text = JSON.stringify({ items: [{ ...exampleItem, id: "a" }, { ...exampleItem, id: "b" }, { ...exampleItem, id: "c", view_count: "x" }], next_cursor: "n" });
    const { fn } = fakeFetch(200, text);
    const result = await fetchPage(target, undefined, { fetch: fn });
    expect(result).toMatchObject({ ok: false, error: { kind: "contract_mismatch" } });
  });

  it.each([["null"], ['"5"'], ["{}"], ['["1"]'], ["1e999"], ["1e300"], ["-0"], ["0"]])("resolves, never rejects, for the raw count %s", async (raw) => {
    const { fn } = fakeFetch(200, bodyWith(raw));
    await expect(fetchPage(target, undefined, { fetch: fn })).resolves.toHaveProperty("ok");
  });
});
