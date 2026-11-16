import { readSettings } from "../../../src/loader/settings";

const script = (attrs: Record<string, string>) => ({ getAttribute: (n: string) => (n in attrs ? attrs[n] : null) });
const URL_ATTR = "data-api-base-url";
const ID_ATTR = "data-platform-id";

describe("readSettings", () => {
  it("reads and trims both attributes", () => {
    expect(readSettings(script({ [URL_ATTR]: " https://api.example.com ", [ID_ATTR]: " listings " }))).toEqual({
      settings: { baseUrl: "https://api.example.com", platformId: "listings" },
    });
  });

  it.each([
    ["missing", {}],
    ["empty", { [URL_ATTR]: "" }],
    ["blank", { [URL_ATTR]: "  \t\n" }],
  ])("reports a %s base address by name", (_n, extra) => {
    expect(readSettings(script({ [ID_ATTR]: "listings", ...extra }))).toEqual({ missing: [URL_ATTR] });
  });

  it.each([
    ["missing", {}],
    ["empty", { [ID_ATTR]: "" }],
    ["blank", { [ID_ATTR]: "   " }],
  ])("reports a %s platform id by name", (_n, extra) => {
    expect(readSettings(script({ [URL_ATTR]: "https://api.example.com", ...extra }))).toEqual({ missing: [ID_ATTR] });
  });

  it("reports both, base address first", () => {
    expect(readSettings(script({}))).toEqual({ missing: [URL_ATTR, ID_ATTR] });
  });

  it.each([[null], [undefined]])("reports both when there is no script tag (%p)", (tag) => {
    expect(readSettings(tag)).toEqual({ missing: [URL_ATTR, ID_ATTR] });
  });

  it("reports both and does not throw when getAttribute throws", () => {
    const bad = {
      getAttribute: () => {
        throw new Error("x");
      },
    };
    expect(readSettings(bad)).toEqual({ missing: [URL_ATTR, ID_ATTR] });
  });
});
