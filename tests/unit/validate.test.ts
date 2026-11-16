import { parsePage } from "../../src/validate";
import { emptyPage, exampleItem, examplePage } from "../contract/fixtures/delivery-v1";

describe("parsePage: valid bodies", () => {
  it("returns the contract example as a page", () => {
    expect(parsePage(examplePage)).toEqual({
      page: { items: [exampleItem], nextCursor: null },
    });
  });

  it("accepts an empty page", () => {
    expect(parsePage(emptyPage)).toEqual({ page: { items: [], nextCursor: null } });
  });

  it("accepts an item with no link and no images", () => {
    const item = { ...exampleItem, url: null, images: [] };
    expect(parsePage({ items: [item], next_cursor: null })).toEqual({
      page: { items: [item], nextCursor: null },
    });
  });

  it("keeps a text cursor", () => {
    expect(parsePage({ items: [], next_cursor: "abc" })).toEqual({ page: { items: [], nextCursor: "abc" } });
  });
});

const withItem = (patch: Record<string, unknown>) => ({ items: [{ ...exampleItem, ...patch }], next_cursor: null });
const problem = (body: unknown) => {
  const r = parsePage(body);
  if (!("problem" in r)) throw new Error("expected a problem");
  return r.problem;
};

describe("parsePage: mismatches", () => {
  it.each([[null], [[]], ["text"], [5], [undefined]])("refuses body %p", (body) => {
    expect(problem(body)).toEqual(expect.any(String));
  });

  it("refuses a bad items list", () => {
    expect(problem({ next_cursor: null })).toContain("items");
    expect(problem({ items: {}, next_cursor: null })).toContain("items");
    expect(problem({ items: [null], next_cursor: null })).toEqual(expect.any(String));
    expect(problem({ items: ["x"], next_cursor: null })).toEqual(expect.any(String));
  });

  it("refuses a bad next_cursor", () => {
    expect(problem({ items: [] })).toContain("next_cursor");
    expect(problem({ items: [], next_cursor: 5 })).toContain("next_cursor");
    expect(problem({ items: [], next_cursor: undefined })).toContain("next_cursor");
  });

  const textFields = ["id", "platform", "title", "description", "language", "created_at"];
  it.each(textFields)("refuses item with %s missing or of the wrong type", (field) => {
    const missing: Record<string, unknown> = { ...exampleItem };
    delete missing[field];
    expect(problem({ items: [missing], next_cursor: null })).toContain(field);
    expect(problem(withItem({ [field]: 5 }))).toContain(field);
    expect(problem(withItem({ [field]: null }))).toContain(field);
  });

  it("refuses bad tags, images and url", () => {
    expect(problem(withItem({ tags: ["a", 1] }))).toContain("tags");
    expect(problem(withItem({ tags: "a" }))).toContain("tags");
    expect(problem(withItem({ images: "x" }))).toContain("images");
    expect(problem(withItem({ images: [null] }))).toContain("image");
    expect(problem(withItem({ images: [{}] }))).toContain("image");
    const noUrl: Record<string, unknown> = { ...exampleItem };
    delete noUrl.url;
    expect(problem({ items: [noUrl], next_cursor: null })).toContain("url");
  });

  it("fails the whole page when one item is bad", () => {
    expect(problem({ items: [exampleItem, { ...exampleItem, id: 5 }, exampleItem], next_cursor: null })).toContain("id");
  });
});

describe("parsePage: untrusted text", () => {
  const nasty = ['<script>alert(1)</script>', '<img src=x onerror=alert(1)>', "a\u0000b\u001f\u202e", "x".repeat(1_000_000)];

  it.each(nasty.map((s) => [s.slice(0, 30), s]))("returns %p unchanged", (_label, text) => {
    const r = parsePage(withItem({ title: text, description: text, tags: [text], language: text }));
    if (!("page" in r)) throw new Error("expected a page");
    expect(r.page.items[0].title).toBe(text);
    expect(r.page.items[0].description).toBe(text);
    expect(r.page.items[0].tags).toEqual([text]);
  });

  it("returns an item url with odd characters unchanged", () => {
    const odd = 'https://x.example.com/a"b<c>d`e\\f';
    const r = parsePage(withItem({ url: odd }));
    if (!("page" in r)) throw new Error("expected a page");
    expect(r.page.items[0].url).toBe(odd);
  });

  it.each([["javascript:alert(1)"], ["data:text/html,x"], ["ftp://x.example.com/a"], ["//x.example.com/a"], ["/posts/1"], [""], ["http://"]])(
    "refuses item url %p",
    (url) => {
      expect(problem(withItem({ url }))).toContain("url");
      expect(problem(withItem({ images: [{ url }] }))).toContain("image");
    },
  );

  it.each([["HTTP://x.example.com/a"], ["Https://x.example.com/a"]])("accepts scheme case %p", (url) => {
    expect(parsePage(withItem({ url, images: [{ url }] }))).toHaveProperty("page");
  });

  it("refuses an image with a null address", () => {
    expect(problem(withItem({ images: [{ url: null }] }))).toContain("image");
  });
});
