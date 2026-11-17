import { buildRequestUrl } from "../../src/request";

const t = { baseUrl: "https://api.example.com", platformId: "listings", placementId: "latest" };

function url(target = t, query = {}) {
  const r = buildRequestUrl(target, query);
  if ("error" in r) throw new Error(`unexpected error ${r.error.kind}`);
  return new URL(r.url);
}

describe("buildRequestUrl", () => {
  it("builds the delivery path", () => {
    const u = url();
    expect(u.origin).toBe("https://api.example.com");
    expect(u.pathname).toBe("/api/v1/delivery/listings/latest");
    expect(u.search).toBe("");
  });

  it("gives the same address with or without a trailing slash", () => {
    expect(url({ ...t, baseUrl: "https://api.example.com/" }).href).toBe(url().href);
  });

  it("keeps a path prefix", () => {
    expect(url({ ...t, baseUrl: "https://api.example.com/content/" }).pathname).toBe(
      "/content/api/v1/delivery/listings/latest",
    );
  });

  it("encodes ids so they cannot change the path", () => {
    const u = url({ ...t, platformId: "a/b?c#d e", placementId: "x%y" });
    expect(u.pathname).toBe("/api/v1/delivery/a%2Fb%3Fc%23d%20e/x%25y");
    expect(u.search).toBe("");
    expect(u.hash).toBe("");
  });

  it("sends only the options that are given", () => {
    expect(url(t, { limit: 5 }).search).toBe("?limit=5");
    expect(url(t, {}).search).toBe("");
  });

  it("joins tags and languages with commas", () => {
    const u = url(t, { limit: 50, tags: ["cars", "for_sale"], languages: ["am", "en"] });
    expect(u.searchParams.get("limit")).toBe("50");
    expect(u.searchParams.get("tag")).toBe("cars,for_sale");
    expect(u.searchParams.get("language")).toBe("am,en");
  });

  it("does not send empty lists", () => {
    expect(url(t, { tags: [], languages: [] }).search).toBe("");
  });

  it("accepts limit 1 and 50", () => {
    expect(url(t, { limit: 1 }).searchParams.get("limit")).toBe("1");
    expect(url(t, { limit: 50 }).searchParams.get("limit")).toBe("50");
  });

  it("sends the cursor unchanged", () => {
    const cursor = "eyJhIjoxfQ==/+ &x";
    expect(url(t, { cursor }).searchParams.get("cursor")).toBe(cursor);
  });

  it("does not send an empty cursor", () => {
    expect(url(t, { cursor: "" }).search).toBe("");
  });

  it("accepts a 512-character cursor", () => {
    expect(url(t, { cursor: "a".repeat(512) }).searchParams.get("cursor")).toHaveLength(512);
  });
});

function error(target: unknown, query?: unknown) {
  const r = buildRequestUrl(target as never, query as never);
  if (!("error" in r)) throw new Error("expected an error");
  return r.error;
}

describe("buildRequestUrl: refusals", () => {
  it.each([[0], [51], [1.5], [-1], [NaN], [Infinity], ["5"]])("refuses limit %p", (limit) => {
    const e = error(t, { limit });
    expect(e.kind).toBe("bad_query");
    expect(e.fields).toEqual(["limit"]);
  });

  it("refuses more than 50 tags or languages", () => {
    expect(error(t, { tags: Array(51).fill("a") }).fields).toEqual(["tag"]);
    expect(error(t, { languages: Array(51).fill("am") }).fields).toEqual(["language"]);
  });

  it.each([["Cars"], ["a b"], ["a,b"], [""], ["x".repeat(65)], ["é"]])("refuses tag %p", (tag) => {
    expect(error(t, { tags: [tag] }).fields).toEqual(["tag"]);
  });

  it("refuses a tag list that is not a list of text", () => {
    expect(error(t, { tags: "cars" }).fields).toEqual(["tag"]);
    expect(error(t, { tags: [1] }).fields).toEqual(["tag"]);
  });

  it.each([["a,b"], [""], ["x".repeat(17)]])("refuses language %p", (language) => {
    expect(error(t, { languages: [language] }).fields).toEqual(["language"]);
  });

  it("refuses a 513-character cursor and a cursor that is not text", () => {
    expect(error(t, { cursor: "a".repeat(513) }).fields).toEqual(["cursor"]);
    expect(error(t, { cursor: 5 }).fields).toEqual(["cursor"]);
  });

  it("refuses a query that is not an object", () => {
    expect(error(t, "limit=5").kind).toBe("bad_query");
  });

  it.each([[""], ["not a url"], ["ftp://x.example.com"], ["javascript:alert(1)"], ["https://gw.example.com/x?key=abc"], ["https://gw.example.com/x#top"], [undefined], [5]])(
    "refuses baseUrl %p",
    (baseUrl) => {
      const e = error({ ...t, baseUrl });
      expect(e.kind).toBe("invalid_target");
      expect(e.fields).toEqual(["baseUrl"]);
    },
  );

  it.each([[""], [undefined], [5], ["."], [".."]])("refuses id %p", (id) => {
    expect(error({ ...t, platformId: id }).fields).toEqual(["platformId"]);
    expect(error({ ...t, placementId: id }).fields).toEqual(["placementId"]);
  });

  it("refuses a target or query that is an array", () => {
    expect(error([]).kind).toBe("invalid_target");
    expect(error(t, []).kind).toBe("bad_query");
  });

  it("refuses a target that is not an object", () => {
    expect(error(undefined).kind).toBe("invalid_target");
    expect(error(null).kind).toBe("invalid_target");
  });
});

describe("buildRequestUrl: q (search)", () => {
  const sent = (q: unknown) => url(t, { q }).searchParams;
  const refused = (q: unknown) => {
    const r = buildRequestUrl(t, { q } as never);
    return "error" in r ? r.error : undefined;
  };

  it.each([[undefined], [""], ["   "], ["\t\n "], ["   "]])("sends no q for %p", (q) => {
    expect(url(t, { q }).search).toBe("");
  });

  it("sends the text as q", () => {
    expect(url(t, { q: "toyota corolla" }).search).toBe("?q=toyota+corolla");
  });

  it("sends the text unchanged, spaces at its ends included", () => {
    expect(sent(" a b ").get("q")).toBe(" a b ");
  });

  it("sends Amharic text and Ethiopic punctuation unchanged", () => {
    expect(sent("መኪና ፡ ቶዮታ።").get("q")).toBe("መኪና ፡ ቶዮታ።");
  });

  it.each(["&", "=", "#", "+", "%", "?", "/", "\\", "'", '"', "<", ">", "a&limit=50", "x=1&tag=cars", "a#b", "line\nbreak", "100%", "a+b"])(
    "keeps %p inside q: it adds and changes no other parameter",
    (text) => {
      const u = url(t, { q: text });
      expect([...u.searchParams.keys()]).toEqual(["q"]);
      expect(u.searchParams.get("q")).toBe(text);
      expect(u.hash).toBe("");
      expect(u.pathname).toBe("/api/v1/delivery/listings/latest");
    },
  );

  it("sends q with limit, tags, languages and cursor, each in its own form", () => {
    const u = url(t, { q: "bike", limit: 5, tags: ["cars", "x"], languages: ["am"], cursor: "c1" });
    expect(Object.fromEntries(u.searchParams)).toEqual({ q: "bike", limit: "5", tag: "cars,x", language: "am", cursor: "c1" });
  });

  it("leaves limit, tag, language and cursor out when only q is given", () => {
    expect([...url(t, { q: "bike" }).searchParams.keys()]).toEqual(["q"]);
  });

  it("allows 100 characters, with or without spaces around them", () => {
    expect(sent("a".repeat(100)).get("q")).toBe("a".repeat(100));
    expect(sent(`  ${"a".repeat(100)}  `).get("q")).toBe(`  ${"a".repeat(100)}  `);
    expect(refused("a".repeat(100))).toBeUndefined();
  });

  it("refuses 101 characters with bad_query naming q", () => {
    expect(refused("a".repeat(101))).toMatchObject({ kind: "bad_query", fields: ["q"] });
    expect(refused(`  ${"a".repeat(101)}  `)).toMatchObject({ kind: "bad_query", fields: ["q"] });
  });

  it("counts characters, not bytes or UTF-16 units", () => {
    expect(refused("አ".repeat(100))).toBeUndefined();
    expect(refused("አ".repeat(101))).toMatchObject({ kind: "bad_query", fields: ["q"] });
    expect(refused("😀".repeat(100))).toBeUndefined();
    expect(refused("😀".repeat(101))).toMatchObject({ kind: "bad_query", fields: ["q"] });
  });

  it.each([[5], [{}], [["a"]], [null], [true], [() => "a"]])("refuses %p with bad_query naming q", (q) => {
    expect(refused(q)).toMatchObject({ kind: "bad_query", fields: ["q"] });
  });

  it("does not throw for a lone surrogate and sends it", () => {
    expect(() => url(t, { q: "\uD800" })).not.toThrow();
    expect(url(t, { q: "\uD800" }).searchParams.has("q")).toBe(true);
  });

  it("reports q together with another bad field as the first problem found, never a throw", () => {
    const r = buildRequestUrl(t, { q: 5, limit: 0 } as never);
    expect("error" in r && r.error.kind).toBe("bad_query");
  });
});
