import {
  badQuery,
  contractMismatch,
  fail,
  invalidTarget,
  network,
  originNotAllowed,
  succeed,
  unavailable,
  unknownPlacement,
} from "../../src/errors";

describe("error constructors", () => {
  it("unknownPlacement is 404", () => {
    expect(unknownPlacement()).toEqual({ kind: "unknown_placement", message: expect.any(String), status: 404 });
  });

  it("originNotAllowed is 403", () => {
    expect(originNotAllowed()).toEqual({ kind: "origin_not_allowed", message: expect.any(String), status: 403 });
  });

  it("badQuery keeps fields, status and service message only when given", () => {
    expect(badQuery()).toEqual({ kind: "bad_query", message: expect.any(String) });
    expect(badQuery({ fields: ["limit"], status: 422, serviceMessage: "limit is bad" })).toEqual({
      kind: "bad_query",
      message: expect.any(String),
      fields: ["limit"],
      status: 422,
      serviceMessage: "limit is bad",
    });
  });

  it("unavailable carries the status", () => {
    expect(unavailable(503)).toEqual({ kind: "unavailable", message: expect.any(String), status: 503 });
  });

  it("network keeps the cause and sets aborted only when true", () => {
    const cause = new Error("boom");
    expect(network(cause)).toEqual({ kind: "network", message: expect.any(String), cause });
    expect(network(cause, true)).toEqual({ kind: "network", message: expect.any(String), cause, aborted: true });
  });

  it("contractMismatch carries the status and what was wrong", () => {
    const e = contractMismatch(200, "items is not a list");
    expect(e.kind).toBe("contract_mismatch");
    expect(e.status).toBe(200);
    expect(e.message).toContain("items is not a list");
  });

  it("invalidTarget names the field", () => {
    expect(invalidTarget("baseUrl")).toEqual({
      kind: "invalid_target",
      message: expect.any(String),
      fields: ["baseUrl"],
    });
  });

  it("messages are fixed text written by the SDK", () => {
    expect(unknownPlacement().message).toBe(unknownPlacement().message);
    expect(unavailable(500).message).not.toContain("500x");
  });

  it("fail and succeed build results", () => {
    const page = { items: [], nextCursor: null };
    expect(succeed(page)).toEqual({ ok: true, page });
    expect(fail(unknownPlacement())).toEqual({ ok: false, error: unknownPlacement() });
  });
});
