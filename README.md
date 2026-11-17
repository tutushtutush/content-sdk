# content-sdk

Headless browser SDK for content-api. It reads the service's public delivery endpoint and hands your platform **plain data**; you render it with your own components. No UI, no DOM, no runtime dependencies. Works in browsers and Node 22.

Public API contract: [specs/001-delivery-client/contracts/public-api.md](specs/001-delivery-client/contracts/public-api.md).

## Embedding (script tag)

Paste the stub and the script once per page:

```html
<script>window.contentSdk = window.contentSdk || { q: [] };</script>
<script async src="https://<service>/content-sdk.js"
        data-api-base-url="https://content-api.example.com"
        data-platform-id="YOUR_PLATFORM_ID"></script>
```

- `data-api-base-url`: the content-api address.
- `data-platform-id`: your platform id. One platform per page. Both attributes are read once, from the script's own tag, when it loads.

If either is missing or blank, the script logs one console warning and does nothing else (nothing is created, replayed or fetched):

```
[content-sdk] Missing data-api-base-url and data-platform-id on the content-sdk <script> tag. Nothing will be fetched.
```

Then ask for a page. Before the script has loaded, push onto the queue; commands run in the order pushed once it loads. After it has loaded, call the method; it also returns a promise of the same result.

```js
// before or after load: the callback gets { ok: true, page } or { ok: false, error }
window.contentSdk.q.push(["fetchPage", "latest", { limit: 5 }, (result) => show(result)]);

// after load only
const result = await window.contentSdk.fetchPage("latest", { limit: 5, tags: ["cars"] });
```

The query is the one `fetchPage` takes (`limit`, `tags`, `languages`, `q`, `cursor`); pass `page.nextCursor` back as `cursor` for the next page. Nothing here throws into your page: a bad call is a typed error in the result, a bad queue entry or a throwing callback is one console warning. All text in the result is untrusted; set it through your framework's escaping.

The script only reads its own tag. It creates no element, injects no style, and sets no cookie or storage. Full contract: [specs/002-browser-loader/contracts/loader.md](specs/002-browser-loader/contracts/loader.md).

The built file is `dist/content-sdk.js` (minified, with `content-sdk.js.map`). A Node program finds it with `require.resolve("content-sdk/browser")`; the bare `content-sdk` is still the library below.

## Use as a library

```ts
import { fetchPage, type Query } from "content-sdk";

const target = { baseUrl: "https://content-api.example.com", platformId: "listings", placementId: "latest" };

let query: Query = { limit: 20, tags: ["cars"], languages: ["am"] };
for (;;) {
  const result = await fetchPage(target, query, { signal: AbortSignal.timeout(10_000) });
  if (!result.ok) {
    console.warn(result.error.kind, result.error.message);
    break;
  }
  show(result.page.items); // your rendering
  if (result.page.nextCursor === null) break;
  query = { ...query, cursor: result.page.nextCursor };
}
```

### Search

Add `q`, the words a visitor typed, to search the placement's items:

```ts
const result = await fetchPage(target, { q: "toyota corolla", limit: 10 });
// the next page of the same search: the same q with the cursor
const next = await fetchPage(target, { q: "toyota corolla", limit: 10, cursor: page.nextCursor });
```

`q` is text of at most 100 characters after trimming (characters, not bytes). Empty or only spaces means no search, so an empty search box needs no special case. It is sent as typed. The service decides what matches and in what order (every word must match a word or the start of one, case is ignored, best match first), so the SDK only passes it on and returns the items as they come. A cursor belongs to the search it came from: pass the same `q` with it, or the service refuses it. A `q` that is not text or is too long is a `bad_query` error naming `q`, without a request; a text with no word in it is refused by the service the same way. The script tag takes the same option: `window.contentSdk.fetchPage("latest", { q: "toyota" })`, or queued.

`fetchPage` never throws or rejects. Every outcome is `{ ok: true, page }` or `{ ok: false, error }`. All text in an item (title, description, tags, addresses) is untrusted: set it through your framework's escaping, never build HTML from it.

## Errors

| `error.kind` | When |
|---|---|
| `unknown_placement` | 404: the platform or placement does not exist or is switched off |
| `origin_not_allowed` | 403: the page's origin is not allowed for the platform |
| `bad_query` | 422, or the SDK refused limit, tags, languages, q or cursor before sending; `fields` names them |
| `unavailable` | any other status (500, 503, ...) |
| `network` | the request failed or was cancelled (`aborted: true` when your signal cancelled it) |
| `contract_mismatch` | a 200 answer that does not match the contract |
| `invalid_target` | base address, platform id or placement id unusable; `fields` names it |

## Reporting views and clicks

The SDK tells content-api what visitors do with the items you show, so the service can count and rank them later. You hand it the element you rendered and the item; it renders and changes nothing itself.

```js
// after rendering an item into `element` (a framework ref callback, say)
const stop = window.contentSdk.watchView(element, item, { placementId: "latest", actorRef: "device-abc" });
stop(); // optional: cancel if the card is taken away before it was seen

// in your own click handler, when the visitor follows the item's link out
window.contentSdk.trackLinkClick(item, { placementId: "latest", actorRef: "device-abc" });

// before the script has loaded, push onto the queue as for fetchPage (a queued watchView cannot hand back a stop)
window.contentSdk.q.push(["watchView", element, item, { placementId: "latest" }]);
window.contentSdk.q.push(["trackLinkClick", item]);
```

As a library the same two functions take the target first: `watchView({ baseUrl, platformId }, element, item, options)` and `trackLinkClick({ baseUrl, platformId }, item, options)`. Without an `IntersectionObserver` (Node) `watchView` does nothing.

- **A view** is the item seen on screen: at least 50% of the element visible for one continuous second. It is reported once per `watchView` call; a card that is never seen that way is given up on after two minutes and reports nothing. **A click** is reported every time you call `trackLinkClick`. The SDK adds no listener to your elements.
- `item` is what `fetchPage` returned; only `item.id` is read, and it must be a UUID (any other id is one console warning and no event).
- `placementId` (the placement you read the item through; 3 to 40 characters of `a-z`, `0-9`, `-`) and `actorRef` (opaque text of 1 to 128 characters, for example a device or session id you already have) are optional and sent as given. A value the service would refuse is left out with one console warning. The SDK makes no id of its own and writes no cookie and no storage.
- Events wait about two seconds after the first one, then leave together; 50 waiting events leave at once; and everything waiting leaves when the page is hidden or being left. A request holds at most 50 events and nothing is sent when nothing waits. They go as one `text/plain` beacon to `/api/v1/events` (so no pre-flight), with one keep-alive `fetch` if the browser refuses the beacon. A failed send is not retried: these events are best effort and not for billing.
- Nothing throws into your page; a bad call is one console warning. Full contract: [specs/004-view-events/contracts/events-api.md](specs/004-view-events/contracts/events-api.md).

## Build and test

```sh
npm install
npm run lint && npm run typecheck && npm test
npm run build   # dist/: index.mjs, index.cjs, index.d.ts, and the browser file content-sdk.js (global contentSdk)
CONTENT_SDK_LIVE=1 npm test -- tests/live   # optional check against the hosted test service
```

Install from the repository at a tag: `npm install github:tutushtutush/content-sdk#<tag>`; the install runs `prepare`, which builds `dist/`.

Not published: `package.json` is `private` until the owner decides otherwise.
