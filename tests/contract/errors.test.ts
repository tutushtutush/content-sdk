import { fetchPage } from "../../src/fetch-page";
import { errorBody, fakeFetch, target } from "./fixtures/delivery-v1";

async function errorOf(status: number, body: unknown) {
  const { fn } = fakeFetch(status, body);
  const result = await fetchPage(target, undefined, { fetch: fn });
  if (result.ok) throw new Error("expected an error");
  return result.error;
}

describe("delivery-v1 errors", () => {
  it("404 unknown_placement", async () => {
    const e = await errorOf(404, errorBody("unknown_placement", "not found"));
    expect(e).toMatchObject({ kind: "unknown_placement", status: 404 });
  });

  it("403 origin_not_allowed", async () => {
    const e = await errorOf(403, errorBody("origin_not_allowed", "no"));
    expect(e).toMatchObject({ kind: "origin_not_allowed", status: 403 });
  });

  it("422 invalid names the parameter and keeps the service message", async () => {
    const body = errorBody("invalid", "limit must be 1 to 50", { fields: [{ field: "limit", message: "bad" }] });
    const e = await errorOf(422, body);
    expect(e).toMatchObject({
      kind: "bad_query",
      status: 422,
      fields: ["limit"],
      serviceMessage: "limit must be 1 to 50",
    });
  });

  it.each([[undefined], [{}], [{ fields: "limit" }], [{ fields: [5, null, { field: 3 }] }], ["x"]])(
    "422 with details %p leaves fields undefined",
    async (details) => {
      const e = await errorOf(422, errorBody("invalid", "m", details));
      expect(e.kind).toBe("bad_query");
      expect(e.fields).toBeUndefined();
    },
  );

  it("503 unavailable", async () => {
    const e = await errorOf(503, errorBody("unavailable", "db down"));
    expect(e).toMatchObject({ kind: "unavailable", status: 503 });
  });
});
