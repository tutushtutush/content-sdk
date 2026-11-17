// Runs only with CONTENT_SDK_LIVE=1 (see jest.config.ts). Public values only; no secrets.
import { fetchPage } from "../../src/fetch-page";

const baseUrl = "https://content-api-test.onrender.com";
const ids = { platformId: "listings", placementId: "latest" };

describe("hosted test service", () => {
  jest.setTimeout(90_000); // the hosted service may be asleep

  it("returns a valid page for listings/latest", async () => {
    const result = await fetchPage({ baseUrl, ...ids }, { limit: 5 });
    if (!result.ok) throw new Error(`${result.error.kind}: ${result.error.message}`);
    expect(result.page.items.length).toBeLessThanOrEqual(5);
    expect(result.page.nextCursor === null || typeof result.page.nextCursor === "string").toBe(true);
    for (const item of result.page.items) {
      expect(Object.keys(item).sort()).toEqual(
        ["created_at", "description", "id", "images", "language", "platform", "tags", "title", "url"],
      );
    }
  });

  it("returns unknown_placement for a made-up placement", async () => {
    const result = await fetchPage({ baseUrl, platformId: "listings", placementId: "no-such-placement" });
    expect(result).toMatchObject({ ok: false, error: { kind: "unknown_placement" } });
  });

  it("returns an empty page for a search no item matches", async () => {
    const result = await fetchPage({ baseUrl, ...ids }, { q: "zzqxjvnothingmatchesthis" });
    expect(result).toEqual({ ok: true, page: { items: [], nextCursor: null } });
  });

  it("names q when the service refuses a text with no word in it", async () => {
    const result = await fetchPage({ baseUrl, ...ids }, { q: "&|!" });
    expect(result).toMatchObject({ ok: false, error: { kind: "bad_query", fields: ["q"] } });
  });

  it("refuses limit 51 without sending", async () => {
    const result = await fetchPage({ baseUrl, ...ids }, { limit: 51 });
    expect(result).toMatchObject({ ok: false, error: { kind: "bad_query", fields: ["limit"] } });
  });
});
