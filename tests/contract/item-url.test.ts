import { fetchPage } from "../../src/fetch-page";
import { exampleItem, fakeFetch, target } from "./fixtures/delivery-v1";

async function itemFor(patch: Record<string, unknown>) {
  const { fn } = fakeFetch(200, { items: [{ ...exampleItem, ...patch }], next_cursor: null });
  const result = await fetchPage(target, undefined, { fetch: fn });
  if (!result.ok) throw new Error(`unexpected ${result.error.kind}`);
  return result.page.items[0];
}

describe("item-url contract", () => {
  it("url null", async () => {
    expect((await itemFor({ url: null })).url).toBeNull();
  });

  it("https url", async () => {
    expect((await itemFor({ url: "https://shop.example.com/p/1" })).url).toBe("https://shop.example.com/p/1");
  });

  it("an address with characters the form check still accepts is returned unchanged", async () => {
    const odd = 'https://x.example.com/a"b<c>d`e\\f';
    expect((await itemFor({ url: odd })).url).toBe(odd);
  });
});
