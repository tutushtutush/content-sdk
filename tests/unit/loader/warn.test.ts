import { clip, warn } from "../../../src/loader/warn";

describe("warn", () => {
  it("calls console.warn once with one string", () => {
    const calls: unknown[][] = [];
    warn({ console: { warn: (...a: [string]) => calls.push(a) } }, "hello");
    expect(calls).toEqual([["hello"]]);
  });

  it("does nothing when console or console.warn is missing", () => {
    expect(() => warn({}, "x")).not.toThrow();
    expect(() => warn({ console: {} }, "x")).not.toThrow();
  });

  it("does not throw when console.warn throws", () => {
    const env = {
      console: {
        warn: () => {
          throw new Error("no console");
        },
      },
    };
    expect(() => warn(env, "x")).not.toThrow();
  });
});

describe("clip", () => {
  it("keeps short text and clips long text", () => {
    expect(clip("abc", 5)).toBe("abc");
    expect(clip("abcdef", 3)).toBe("abc");
  });

  it("turns any value into text without throwing", () => {
    expect(clip({ toString: () => { throw new Error("x"); } }, 10)).toBe("");
    expect(clip(undefined, 10)).toBe("undefined");
    expect(clip(Symbol("s"), 10)).toBe("Symbol(s)");
  });
});
