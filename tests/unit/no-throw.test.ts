import { fetchPage } from "../../src/fetch-page";
import { examplePage, target } from "../contract/fixtures/delivery-v1";

const KINDS = ["unknown_placement", "origin_not_allowed", "bad_query", "unavailable", "network", "contract_mismatch", "invalid_target"];

const answer = (status: number, text: string) =>
  (async () => ({ status, text: async () => text })) as unknown as typeof fetch;
const rejects = (value: unknown) =>
  (async () => {
    throw value;
  }) as unknown as typeof fetch;

// [label, call]: every one is a broken outcome, and none may reject.
const cases: Array<[string, () => Promise<unknown>]> = [
  ["network failure", () => fetchPage(target, undefined, { fetch: rejects(new TypeError("Failed to fetch")) })],
  ["rejects with undefined", () => fetchPage(target, undefined, { fetch: rejects(undefined) })],
  ["sync throw", () => fetchPage(target, undefined, { fetch: (() => { throw new Error("x"); }) as unknown as typeof fetch })],
  ["not JSON", () => fetchPage(target, undefined, { fetch: answer(200, "nope") })],
  ["JSON null", () => fetchPage(target, undefined, { fetch: answer(200, "null") })],
  ["JSON array", () => fetchPage(target, undefined, { fetch: answer(200, "[]") })],
  ["items not a list", () => fetchPage(target, undefined, { fetch: answer(200, '{"items":1,"next_cursor":null}') })],
  ["missing next_cursor", () => fetchPage(target, undefined, { fetch: answer(200, '{"items":[]}') })],
  ["item missing fields", () => fetchPage(target, undefined, { fetch: answer(200, '{"items":[{}],"next_cursor":null}') })],
  ["wrong type title", () => fetchPage(target, undefined, { fetch: answer(200, JSON.stringify({ items: [{ ...examplePage.items[0], title: 1 }], next_cursor: null })) })],
  ["404", () => fetchPage(target, undefined, { fetch: answer(404, "") })],
  ["403", () => fetchPage(target, undefined, { fetch: answer(403, "") })],
  ["422", () => fetchPage(target, undefined, { fetch: answer(422, "{") })],
  ["500", () => fetchPage(target, undefined, { fetch: answer(500, "boom") })],
  ["503", () => fetchPage(target, undefined, { fetch: answer(503, "") })],
  ["fetch returns undefined", () => fetchPage(target, undefined, { fetch: (async () => undefined) as unknown as typeof fetch })],
  ["fetch returns a string", () => fetchPage(target, undefined, { fetch: (async () => "ok") as unknown as typeof fetch })],
  ["undefined target", () => fetchPage(undefined as never)],
  ["null target", () => fetchPage(null as never)],
  ["target is a string", () => fetchPage("x" as never)],
  ["query is a string", () => fetchPage(target, "limit=1" as never)],
  ["query limit wrong type", () => fetchPage(target, { limit: "5" as never })],
  ["query tags wrong type", () => fetchPage(target, { tags: 5 as never })],
  ["query q is a number", () => fetchPage(target, { q: 5 as never })],
  ["query q is an object", () => fetchPage(target, { q: {} as never })],
  ["query q is a list", () => fetchPage(target, { q: ["a"] as never })],
  ["query q is null", () => fetchPage(target, { q: null as never })],
  ["query q is 101 characters", () => fetchPage(target, { q: "x".repeat(101) })],
  ["query q is a lone surrogate", () => fetchPage(target, { q: "\uD800" })],
  ["options is a string", () => fetchPage(target, undefined, "x" as never)],
  ["fetch option is not a function", () => fetchPage(target, undefined, { fetch: 5 as never })],
];

describe("fetchPage never throws or rejects", () => {
  // A non-function `fetch` option falls back to the global one; keep it off the real network.
  const original = globalThis.fetch;
  beforeAll(() => {
    globalThis.fetch = rejects(new TypeError("offline")) as typeof fetch;
  });
  afterAll(() => {
    globalThis.fetch = original;
  });

  it("has at least 20 cases", () => {
    expect(cases.length).toBeGreaterThanOrEqual(20);
  });

  it.each(cases)("%s", async (_label, call) => {
    const result = (await call()) as { ok: boolean; error?: { kind: string } };
    expect(result.ok).toBe(false);
    expect(KINDS).toContain(result.error?.kind);
  });
});
