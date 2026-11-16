import * as client from "../../../src/fetch-page";
import { install } from "../../../src/loader/install";
import { fakeEnv, GOOD } from "./helpers";

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

const url = "data-api-base-url";
const id = "data-platform-id";
const boom = () => {
  throw new Error("boom");
};

// [label, attributes, queue, expected warning count]
const cases: Array<[string, Record<string, string> | null, unknown[], number]> = [
  ["no attributes", {}, [["fetchPage", "a"]], 1],
  ["base address missing", { [id]: "p" }, [], 1],
  ["platform id blank", { [url]: "https://x.example.com", [id]: " " }, [], 1],
  ["no script tag", null, [["fetchPage", "a"]], 1],
  ["queue entry is a string", GOOD, ["x"], 1],
  ["queue entry is null", GOOD, [null], 1],
  ["queue entry is empty", GOOD, [[]], 1],
  ["name is not text", GOOD, [[5]], 1],
  ["unknown command", GOOD, [["nope"]], 1],
  ["constructor as a command", GOOD, [["constructor"]], 1],
  ["__proto__ as a command", GOOD, [["__proto__"]], 1],
  ["throwing callback", GOOD, [["fetchPage", "a", {}, boom]], 1],
  ["rejecting callback", GOOD, [["fetchPage", "a", {}, () => Promise.reject(new Error("r"))]], 1],
  ["callback that is not a function", GOOD, [["fetchPage", "a", {}, 5]], 0],
  ["no placement", GOOD, [["fetchPage"]], 0],
  ["placement is a number", GOOD, [["fetchPage", 5]], 0],
  ["query is a string", GOOD, [["fetchPage", "a", "limit=5"]], 0],
  ["query has a wrong type", GOOD, [["fetchPage", "a", { limit: "5" }]], 0],
  ["unusable base address", { [url]: "nope", [id]: "p" }, [["fetchPage", "a"]], 0],
  ["delivery client throws", GOOD, [["fetchPage", "a"]], 0],
  ["two bad entries", GOOD, ["x", ["nope"]], 2],
];

describe("the loader never throws or rejects into the page", () => {
  afterEach(() => jest.restoreAllMocks());

  it("has at least 20 cases", () => {
    expect(cases.length).toBeGreaterThanOrEqual(20);
  });

  it.each(cases)("%s", async (label, attrs, q, expectedWarnings) => {
    if (label === "delivery client throws") {
      jest.spyOn(client, "fetchPage").mockImplementation((() => Promise.reject(new Error("net"))) as never);
    } else {
      jest.spyOn(client, "fetchPage").mockImplementation((async () => ({ ok: true, page: { items: [], nextCursor: null } })) as never);
    }
    const { env, warnings } = fakeEnv(attrs, { q: [...q] });
    expect(() => install(env)).not.toThrow();
    await flush();
    expect(warnings).toHaveLength(expectedWarnings);
  });

  it("survives a console whose warn throws", async () => {
    const { env } = fakeEnv({}, { q: [] });
    env.console = { warn: boom };
    expect(() => install(env)).not.toThrow();
  });

  it("survives a script whose getAttribute throws", () => {
    const { env } = fakeEnv(GOOD);
    env.document = { currentScript: { getAttribute: boom } };
    expect(() => install(env)).not.toThrow();
  });
});
