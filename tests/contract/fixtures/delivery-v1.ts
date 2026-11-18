// Bodies copied from content-api's contracts (read only):
//   specs/009-public-delivery-endpoint/contracts/delivery-v1.md  (answer example, errors)
//   specs/010-item-link-out/contracts/item-url.md                (item url)
//   specs/019-item-view-counts/contracts/delivery-v1-delta.md    (item view_count)

export const exampleItem = {
  id: "item-1",
  platform: "listings",
  title: "Toyota Corolla 2012",
  description: "Clean car, one owner",
  language: "am",
  tags: ["cars", "for_sale"],
  images: [{ url: "https://images.example.com/post-images/a.jpg" }],
  created_at: "2026-11-13T08:00:00.000Z",
  url: "https://listings.example.com/posts/item-1",
  view_count: 1204,
};

export const examplePage = { items: [exampleItem], next_cursor: null };

export const emptyPage = { items: [], next_cursor: null };

export const errorBody = (code: string, message: string, details: unknown = {}) => ({
  error: { code, message, details },
});

export const target = {
  baseUrl: "https://content-api.example.com",
  platformId: "listings",
  placementId: "latest",
};

/** A fetch fake answering with a status and a JSON body, recording what it was called with. */
export function fakeFetch(status: number, body: unknown) {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const fn = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const text = typeof body === "string" ? body : JSON.stringify(body);
    // Only what the client reads: status and text(). Response is not defined in every test environment.
    return { status, text: async () => text } as unknown as Response;
  }) as typeof fetch;
  return { fn, calls };
}
