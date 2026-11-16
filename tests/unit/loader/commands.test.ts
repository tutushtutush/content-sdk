import { makeFetchPage } from "../../../src/loader/commands";
import type { Result } from "../../../src/types";

const settings = { baseUrl: "https://api.example.com", platformId: "listings" };
const okResult: Result = { ok: true, page: { items: [], nextCursor: null } };
const failResult: Result = { ok: false, error: { kind: "unknown_placement", message: "m", status: 404 } };

function setup(result: Result = okResult) {
  const calls: Array<{ target: unknown; query: unknown }> = [];
  const warnings: string[] = [];
  const env = { console: { warn: (t: string) => warnings.push(t) } };
  const fetchPage = (async (target: unknown, query: unknown) => {
    calls.push({ target, query });
    return result;
  }) as never;
  return { calls, warnings, method: makeFetchPage(settings, { fetchPage, env }) };
}

describe("makeFetchPage", () => {
  it("calls the delivery client with the tag's settings and the given placement and query", async () => {
    const { calls, method } = setup();
    const query = { limit: 5, tags: ["cars"], languages: ["am"], cursor: "c" };
    await method("latest", query, () => {});
    expect(calls).toEqual([
      { target: { baseUrl: "https://api.example.com", platformId: "listings", placementId: "latest" }, query },
    ]);
  });

  it("gives the same result to the callback and the promise", async () => {
    const { method } = setup();
    const seen: Result[] = [];
    const returned = await method("latest", {}, (r: Result) => seen.push(r));
    expect(seen).toEqual([okResult]);
    expect(returned).toBe(seen[0]);
  });

  it("passes a failure result through as it is", async () => {
    const { method } = setup(failResult);
    const seen: Result[] = [];
    expect(await method("nope", undefined, (r: Result) => seen.push(r))).toBe(failResult);
    expect(seen[0]).toBe(failResult);
  });

  it("still resolves with no callback or a non-function callback", async () => {
    const { method } = setup();
    expect(await method("latest")).toBe(okResult);
    expect(await method("latest", {}, "x")).toBe(okResult);
    expect(await method("latest", {}, null)).toBe(okResult);
  });
});
